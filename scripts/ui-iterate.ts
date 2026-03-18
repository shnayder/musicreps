// UI iteration tool: capture screenshots of specific app states across
// versions, annotate them in a review HTML page, export feedback for Claude.
//
// Usage (via deno task, see deno.json):
//   deno task iterate new <session> <state1> [state2...]
//   deno task iterate capture [session]
//   deno task iterate view [session]
//   deno task iterate list
//
// State names match the screenshot manifest (e.g. fretboard-idle,
// semitoneMath-quiz, design-correct-feedback). Use --list-states to see all.

import { chromium } from 'playwright';
import { ChildProcess, spawn } from 'child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { FixtureDetail } from '../src/types.ts';
import { buildManifest, type ScreenshotEntry } from './screenshot-manifest.ts';
import { startServer } from '../tests/e2e/helpers/server.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ITERATE_DIR = path.join(ROOT, 'screenshots', 'iterate');

const PREFERRED_PORT = 8002;
let BASE_URL = '';
const VIEWPORT = { width: 402, height: 873 };

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

type Session = {
  states: string[];
  versions: string[];
};

function sessionDir(name: string): string {
  return path.join(ITERATE_DIR, name);
}

function sessionFile(name: string): string {
  return path.join(sessionDir(name), 'session.json');
}

function readSession(name: string): Session {
  const file = sessionFile(name);
  if (!existsSync(file)) {
    throw new Error(`Session "${name}" not found at ${file}`);
  }
  return JSON.parse(readFileSync(file, 'utf-8'));
}

function writeSession(name: string, session: Session): void {
  writeFileSync(sessionFile(name), JSON.stringify(session, null, 2) + '\n');
}

function listSessions(): string[] {
  if (!existsSync(ITERATE_DIR)) return [];
  return readdirSync(ITERATE_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(sessionFile(d.name)))
    .map((d) => d.name);
}

// Dev server — uses shared helper from tests/e2e/helpers/server.ts

async function waitForServer(timeoutMs = 10_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE_URL}`);
      if (res.ok) return;
    } catch {
      /* server not ready yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Server did not start within ${timeoutMs}ms`);
}

// ---------------------------------------------------------------------------
// Screenshot capture
// ---------------------------------------------------------------------------

async function captureStates(
  entries: ScreenshotEntry[],
  outDir: string,
  hasTouch = true,
): Promise<void> {
  mkdirSync(outDir, { recursive: true });

  console.log('Starting dev server...');
  const { proc: server, portReady } = startServer(PREFERRED_PORT);
  try {
    const port = await portReady;
    BASE_URL = `http://localhost:${port}`;
    console.log(`Server ready on port ${port}.`);

    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
      hasTouch,
    });
    const page = await context.newPage();

    // Load page with ?fixtures to enable fixture injection
    await page.goto(`${BASE_URL}/?fixtures`);
    await page.waitForLoadState('networkidle');

    // Seed shared motor baseline to skip calibration for all modes.
    // All button-based modes share the 'button' provider key.
    await page.evaluate(
      () => localStorage.setItem('motorBaseline_button', '500'),
    );
    await page.reload();
    await page.waitForLoadState('networkidle');

    async function navigateToMode(modeId: string) {
      await page.goto(`${BASE_URL}/?fixtures`);
      await page.waitForLoadState('networkidle');
      if (modeId === 'home') return;
      await page.click(`[data-mode="${modeId}"]`);
      await page.waitForSelector(`#mode-${modeId}.mode-active`);
    }

    async function applyFixture(modeId: string, fixture: FixtureDetail) {
      const container = `#mode-${modeId}`;
      await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) el.removeAttribute('data-fixture-applied');
      }, container);
      await page.evaluate(
        ({ sel, detail }) => {
          const el = document.querySelector(sel);
          if (!el) throw new Error(`Container not found: ${sel}`);
          el.dispatchEvent(
            new CustomEvent('__fixture__', { detail, bubbles: false }),
          );
        },
        { sel: container, detail: fixture },
      );
      await page.waitForSelector(`${container}[data-fixture-applied="true"]`, {
        timeout: 5000,
      });
      await page.waitForTimeout(500);
    }

    // Sort entries to minimize mode switches
    const sorted = [...entries].sort((a, b) => {
      if (a.modeId !== b.modeId) return a.modeId < b.modeId ? -1 : 1;
      // Within same mode: idle (no fixture) before fixture states
      if (!a.fixture && b.fixture) return -1;
      if (a.fixture && !b.fixture) return 1;
      return 0;
    });

    let currentMode = '';
    let previousHadFixture = false;
    let previousHadLocalStorage = false;

    for (const entry of sorted) {
      const needsReload = entry.modeId !== currentMode ||
        previousHadFixture || previousHadLocalStorage ||
        !!entry.localStorageData;

      // Seed localStorage before navigation so the reload picks it up
      if (entry.localStorageData) {
        await page.evaluate((data: Record<string, string>) => {
          for (const [k, v] of Object.entries(data)) {
            localStorage.setItem(k, v);
          }
        }, entry.localStorageData);
      }

      if (needsReload) {
        if (entry.modeId !== currentMode) {
          console.log(`Mode: ${entry.modeId}`);
        }
        await navigateToMode(entry.modeId);
        currentMode = entry.modeId;
      }
      if (entry.fixture) {
        await applyFixture(entry.modeId, entry.fixture);
      }

      // Switch to progress tab after navigation
      if (entry.clickTab) {
        const sel = `#mode-${entry.modeId} [data-tab="${entry.clickTab}"]`;
        await page.click(sel);
        await page.waitForTimeout(200);
      }

      const filePath = path.join(outDir, `${entry.name}.png`);
      await page.screenshot({ path: filePath, type: 'png' });
      console.log(`  ${entry.name}.png`);

      previousHadFixture = !!entry.fixture;

      // Clean up seeded localStorage for next entry
      if (entry.localStorageData) {
        await page.evaluate((keys: string[]) => {
          for (const k of keys) localStorage.removeItem(k);
        }, Object.keys(entry.localStorageData));
        previousHadLocalStorage = true;
      } else {
        previousHadLocalStorage = false;
      }
    }

    await browser.close();
    console.log(`Captured ${sorted.length} screenshots in ${outDir}`);
  } finally {
    server.kill();
  }
}

// ---------------------------------------------------------------------------
// Capture session states via dev server
// ---------------------------------------------------------------------------

async function captureSessionStates(
  stateNames: string[],
  outDir: string,
  appManifestMap: Map<string, ScreenshotEntry>,
  hasTouch = true,
): Promise<void> {
  const appEntries = stateNames.map((s) => {
    const entry = appManifestMap.get(s);
    if (!entry) throw new Error(`State "${s}" no longer in manifest`);
    return entry;
  });
  await captureStates(appEntries, outDir, hasTouch);
}

// ---------------------------------------------------------------------------
// Review HTML generation
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (
      c,
    ) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[
      c
    ]!),
  );
}

function generateReviewHTML(name: string, session: Session): void {
  const { states, versions } = session;
  const colCount = states.length + 1; // +1 for General column

  // Table header
  const headers = states
    .map((s) => `<th title="${escapeHtml(s)}">${escapeHtml(s)}</th>`)
    .join('\n          ');

  // Table body: one group per version
  let body = '';
  for (const ver of versions) {
    body += `
      <tr class="ver-header">
        <td colspan="${colCount}"><h2>${
      escapeHtml(ver)
    }</h2><button onclick="copyRound('${
      escapeHtml(ver)
    }')">Copy round summary</button></td>
      </tr>
      <tr class="shots">`;
    for (const state of states) {
      const file = `${encodeURIComponent(ver)}/${
        encodeURIComponent(state)
      }.png`;
      body += `
        <td><img src="${file}" alt="${escapeHtml(state)} ${
        escapeHtml(ver)
      }"></td>`;
    }
    body += `
        <td></td>
      </tr>
      <tr class="notes">`;
    for (const state of states) {
      const id = `${escapeHtml(ver)}--${escapeHtml(state)}`;
      body += `
        <td><textarea id="${id}" placeholder="Notes on ${
        escapeHtml(state)
      }..." rows="4"></textarea></td>`;
    }
    body += `
        <td><textarea id="${
      escapeHtml(ver)
    }--general" placeholder="General notes..." rows="4"></textarea></td>
      </tr>`;
  }

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>UI Iteration: ${escapeHtml(name)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: system-ui, sans-serif;
    margin: 0; padding: 1rem;
    background: #f5f5f5;
  }
  h1 { margin: 0 0 .5rem; font-size: 1.4rem; }
  .toolbar {
    position: sticky; top: 0; z-index: 10;
    background: #f5f5f5; padding: .5rem 0 1rem;
    display: flex; gap: .75rem; align-items: center;
  }
  .toolbar button {
    padding: .4rem .8rem; border-radius: 4px; border: 1px solid #ccc;
    background: #fff; cursor: pointer; font-size: .85rem;
  }
  .toolbar button:hover { background: #e8e8e8; }
  .toolbar .status { font-size: .8rem; color: #666; margin-left: auto; }
  .scroll-wrapper { overflow-x: auto; }
  table { border-collapse: collapse; }
  th, td { padding: .25rem .5rem; vertical-align: top; text-align: center; }
  th {
    background: #e8e8e8; font-size: .75rem;
    white-space: nowrap; max-width: 300px; overflow: hidden; text-overflow: ellipsis;
  }
  .ver-header td {
    text-align: left; padding-top: 1rem;
    border-bottom: 2px solid #ccc;
  }
  .ver-header h2 { margin: 0; font-size: 1.1rem; }
  .shots td { padding: .25rem; }
  .shots img {
    width: 300px; display: block;
    border: 1px solid #ddd; border-radius: 4px;
  }
  .notes td { padding: .25rem; }
  textarea {
    width: 300px; min-height: 60px; resize: vertical;
    font-family: system-ui, sans-serif; font-size: .8rem;
    border: 1px solid #ccc; border-radius: 4px; padding: .3rem;
    field-sizing: content;
  }
  textarea:focus { outline: 2px solid #4a90d9; border-color: transparent; }
  .ver-header { position: relative; }
  .ver-header td { display: flex; align-items: center; gap: .75rem; }
  .ver-header button {
    padding: .25rem .6rem; border-radius: 4px; border: 1px solid #ccc;
    background: #fff; cursor: pointer; font-size: .75rem; white-space: nowrap;
  }
  .ver-header button:hover { background: #e8e8e8; }
</style>
</head>
<body>

<h1>UI Iteration: ${escapeHtml(name)}</h1>
<div class="toolbar">
  <button id="btn-copy" title="Copy all feedback to clipboard">Copy full summary</button>
  <button id="btn-save" title="Download feedback as .md file">Save .md</button>
  <span class="status" id="status"></span>
</div>

<div class="scroll-wrapper">
<table>
  <thead>
    <tr>
      ${headers}
      <th>General</th>
    </tr>
  </thead>
  <tbody>
    ${body}
  </tbody>
</table>
</div>

<script>
const SESSION = ${JSON.stringify(name)};
const STATES = ${JSON.stringify(states)};
const VERSIONS = ${JSON.stringify(versions)};

// --- localStorage persistence ---
const storagePrefix = 'iterate-' + SESSION + '-';

function storageKey(ver, state) {
  return storagePrefix + ver + '--' + state;
}

// Load saved notes into textareas
function loadNotes() {
  for (const ver of VERSIONS) {
    for (const state of [...STATES, 'general']) {
      const ta = document.getElementById(ver + '--' + state);
      if (!ta) continue;
      const saved = localStorage.getItem(storageKey(ver, state));
      if (saved) ta.value = saved;
    }
  }
}

// Save on input
document.addEventListener('input', (e) => {
  if (e.target.tagName !== 'TEXTAREA') return;
  const id = e.target.id; // "v1--fretboard-idle"
  const [ver, ...rest] = id.split('--');
  const state = rest.join('--');
  localStorage.setItem(storageKey(ver, state), e.target.value);
});

loadNotes();

// --- Summary generation ---
function buildRoundLines(ver) {
  const lines = [];
  const gen = document.getElementById(ver + '--general');
  if (gen && gen.value.trim()) {
    lines.push('**General:** ' + gen.value.trim());
  }
  for (const state of STATES) {
    const ta = document.getElementById(ver + '--' + state);
    if (ta && ta.value.trim()) {
      lines.push('**' + state + ':** ' + ta.value.trim());
    }
  }
  return lines;
}

function buildRoundSummary(ver) {
  const lines = ['## UI Iteration Feedback — ' + SESSION, '', '### ' + ver, ''];
  lines.push(...buildRoundLines(ver));
  return lines.join('\\n');
}

function buildSummary() {
  const lines = ['## UI Iteration Feedback — ' + SESSION, ''];
  for (const ver of VERSIONS) {
    const verLines = buildRoundLines(ver);
    if (verLines.length > 0) {
      lines.push('### ' + ver, '');
      lines.push(...verLines);
      lines.push('');
    }
  }
  return lines.join('\\n');
}

async function copyToClipboard(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    showStatus('Copied ' + label + '!');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showStatus('Copied ' + label + ' (fallback)');
  }
}

async function copyRound(ver) {
  await copyToClipboard(buildRoundSummary(ver), ver);
}

// Copy full summary to clipboard
document.getElementById('btn-copy').addEventListener('click', () => {
  copyToClipboard(buildSummary(), 'full summary');
});

// Save as .md download
document.getElementById('btn-save').addEventListener('click', () => {
  const text = buildSummary();
  const blob = new Blob([text], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = SESSION + '-feedback.md';
  a.click();
  URL.revokeObjectURL(a.href);
  showStatus('Saved!');
});

function showStatus(msg) {
  const el = document.getElementById('status');
  el.textContent = msg;
  setTimeout(() => { el.textContent = ''; }, 2000);
}
</script>
</body></html>
`;

  const dir = sessionDir(name);
  const filePath = path.join(dir, 'review.html');
  writeFileSync(filePath, html);
  console.log(`Generated ${filePath}`);
}

// ---------------------------------------------------------------------------
// Browser open
// ---------------------------------------------------------------------------

function openInBrowser(filePath: string): void {
  const cmd = process.platform === 'darwin'
    ? 'open'
    : process.platform === 'win32'
    ? 'start'
    : 'xdg-open';
  try {
    spawn(cmd, [filePath], { detached: true, stdio: 'ignore' }).unref();
  } catch {
    console.log(`Open manually: ${filePath}`);
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function usage(): never {
  console.log(`UI iteration tool — capture, annotate, iterate.

Usage:
  deno task iterate new <session> <state1> [state2...]
  deno task iterate capture [session]
  deno task iterate view [session]
  deno task iterate list
  deno task iterate --list-states

Commands:
  new       Create a new iteration session and capture v1 screenshots.
  capture   Capture the next version for an existing session.
  view      Open the review HTML in the default browser.
  list      List all iteration sessions.

Options:
  --list-states   Print all valid state names and exit.

State names match the screenshot manifest (run --list-states to see all).
`);
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  const touchMode = !args.includes('--no-touch');
  const filteredArgs = args.filter((a) => a !== '--no-touch');

  // --list-states: print all valid state names
  if (filteredArgs.includes('--list-states')) {
    const manifest = buildManifest();
    for (const entry of manifest) console.log(entry.name);
    return;
  }

  const command = filteredArgs[0];
  if (!command || command === '--help' || command === '-h') usage();

  const manifest = buildManifest();
  const manifestMap = new Map(manifest.map((e) => [e.name, e]));
  const allNames = new Set(manifestMap.keys());

  switch (command) {
    case 'new': {
      const sessionName = filteredArgs[1];
      if (!sessionName) {
        console.error('Error: session name required.\n');
        usage();
      }
      const stateNames = filteredArgs.slice(2);
      if (stateNames.length === 0) {
        console.error('Error: at least one state name required.\n');
        usage();
      }

      // Validate state names against both app and component manifests
      const invalid = stateNames.filter((s) => !allNames.has(s));
      if (invalid.length > 0) {
        console.error(`Unknown state(s): ${invalid.join(', ')}`);
        console.error('Run --list-states to see valid names.');
        process.exit(1);
      }

      const dir = sessionDir(sessionName);
      if (existsSync(sessionFile(sessionName))) {
        console.error(
          `Session "${sessionName}" already exists. Choose a different name or delete ${dir}.`,
        );
        process.exit(1);
      }
      mkdirSync(dir, { recursive: true });

      const session: Session = { states: stateNames, versions: ['v1'] };
      writeSession(sessionName, session);

      const outDir = path.join(dir, 'v1');
      await captureSessionStates(
        stateNames,
        outDir,
        manifestMap,
        touchMode,
      );

      generateReviewHTML(sessionName, session);
      const reviewPath = path.join(dir, 'review.html');
      console.log(`\nSession "${sessionName}" created with v1.`);
      openInBrowser(reviewPath);
      break;
    }

    case 'capture': {
      // Determine session name: explicit arg, or most recent
      let sessionName = filteredArgs[1];
      if (!sessionName) {
        const sessions = listSessions();
        if (sessions.length === 0) {
          console.error(
            'No sessions found. Create one with: new <session> <states...>',
          );
          process.exit(1);
        }
        // Pick most recently modified session
        sessionName = sessions
          .map((s) => ({
            name: s,
            mtime: statSync(sessionFile(s)).mtimeMs,
          }))
          .sort((a, b) => b.mtime - a.mtime)[0].name;
        console.log(`Using session: ${sessionName}`);
      }

      const session = readSession(sessionName);
      const nextNum = session.versions.length + 1;
      const nextVer = `v${nextNum}`;

      const outDir = path.join(sessionDir(sessionName), nextVer);
      await captureSessionStates(
        session.states,
        outDir,
        manifestMap,
        touchMode,
      );

      session.versions.push(nextVer);
      writeSession(sessionName, session);

      generateReviewHTML(sessionName, session);
      const reviewPath = path.join(sessionDir(sessionName), 'review.html');
      console.log(`\nCaptured ${nextVer} for session "${sessionName}".`);
      openInBrowser(reviewPath);
      break;
    }

    case 'view': {
      let sessionName = filteredArgs[1];
      if (!sessionName) {
        const sessions = listSessions();
        if (sessions.length === 0) {
          console.error('No sessions found.');
          process.exit(1);
        }
        sessionName = sessions[sessions.length - 1];
        console.log(`Using session: ${sessionName}`);
      }
      const session = readSession(sessionName);
      generateReviewHTML(sessionName, session);
      const reviewPath = path.join(sessionDir(sessionName), 'review.html');
      openInBrowser(reviewPath);
      console.log(`Opened ${reviewPath}`);
      break;
    }

    case 'list': {
      const sessions = listSessions();
      if (sessions.length === 0) {
        console.log('No iteration sessions found.');
      } else {
        for (const s of sessions) {
          const session = readSession(s);
          console.log(
            `  ${s}  (${session.versions.length} versions, ${session.states.length} states)`,
          );
        }
      }
      break;
    }

    default:
      console.error(`Unknown command: ${command}\n`);
      usage();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
