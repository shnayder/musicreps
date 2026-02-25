// UI iteration tool: capture screenshots of specific app states across
// versions, annotate them in a review HTML page, export feedback for Claude.
//
// Usage:
//   npx tsx scripts/ui-iterate.ts new <session> <state1> [state2...]
//   npx tsx scripts/ui-iterate.ts capture [session]
//   npx tsx scripts/ui-iterate.ts view [session]
//   npx tsx scripts/ui-iterate.ts list
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
  writeFileSync,
} from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { FixtureDetail } from '../src/fixtures/quiz-page.ts';
import {
  buildManifest,
  ENGINE_MODES,
  type ScreenshotEntry,
} from './screenshot-manifest.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ITERATE_DIR = path.join(ROOT, 'screenshots', 'iterate');

const PORT = 8001;
const BASE_URL = `http://localhost:${PORT}`;
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

// ---------------------------------------------------------------------------
// Dev server (same pattern as take-screenshots.ts)
// ---------------------------------------------------------------------------

function startServer(): ChildProcess {
  const proc = spawn(
    'deno',
    ['run', '--allow-net', '--allow-read', '--allow-run', 'main.ts'],
    { cwd: ROOT, stdio: 'pipe' },
  );
  proc.stderr?.on('data', (d: Buffer) => {
    const msg = d.toString();
    if (!msg.includes('Listening on')) process.stderr.write(msg);
  });
  return proc;
}

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
): Promise<void> {
  mkdirSync(outDir, { recursive: true });

  console.log('Starting dev server...');
  const server = startServer();
  try {
    await waitForServer();
    console.log('Server ready.');

    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    // Load page with ?fixtures to enable fixture injection
    await page.goto(`${BASE_URL}/?fixtures`);
    await page.waitForLoadState('networkidle');

    // Seed motorBaseline for all engine modes to skip calibration
    for (const ns of ENGINE_MODES) {
      await page.evaluate(
        (key) => localStorage.setItem(key, '500'),
        `motorBaseline_${ns}`,
      );
    }
    await page.reload();
    await page.waitForLoadState('networkidle');

    async function navigateToMode(modeId: string) {
      await page.goto(`${BASE_URL}/?fixtures`);
      await page.waitForLoadState('networkidle');
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

    for (const entry of sorted) {
      const needsReload = entry.modeId !== currentMode || previousHadFixture;
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
      const filePath = path.join(outDir, `${entry.name}.png`);
      await page.screenshot({ path: filePath, type: 'png' });
      console.log(`  ${entry.name}.png`);
      previousHadFixture = !!entry.fixture;
    }

    await browser.close();
    console.log(`Captured ${sorted.length} screenshots in ${outDir}`);
  } finally {
    server.kill();
  }
}

// ---------------------------------------------------------------------------
// Review HTML generation
// ---------------------------------------------------------------------------

function generateReviewHTML(name: string, session: Session): void {
  const { states, versions } = session;
  const colCount = states.length + 1; // +1 for General column

  // Table header
  const headers = states
    .map((s) => `<th title="${s}">${s}</th>`)
    .join('\n          ');

  // Table body: one group per version
  let body = '';
  for (const ver of versions) {
    body += `
      <tr class="ver-header">
        <td colspan="${colCount}"><h2>${ver}</h2></td>
      </tr>
      <tr class="shots">`;
    for (const state of states) {
      const file = `${ver}/${state}.png`;
      body += `
        <td><img src="${file}" alt="${state} ${ver}"></td>`;
    }
    body += `
        <td></td>
      </tr>
      <tr class="notes">`;
    for (const state of states) {
      const id = `${ver}--${state}`;
      body += `
        <td><textarea id="${id}" placeholder="Notes on ${state}..." rows="4"></textarea></td>`;
    }
    body += `
        <td><textarea id="${ver}--general" placeholder="General notes..." rows="4"></textarea></td>
      </tr>`;
  }

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>UI Iteration: ${name}</title>
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
    position: sticky; top: 72px; z-index: 5;
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
  }
  textarea:focus { outline: 2px solid #4a90d9; border-color: transparent; }
</style>
</head>
<body>

<h1>UI Iteration: ${name}</h1>
<div class="toolbar">
  <button id="btn-copy" title="Copy feedback summary to clipboard">Copy Summary</button>
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
function buildSummary() {
  const lines = ['## UI Iteration Feedback — ' + SESSION, ''];
  for (const ver of VERSIONS) {
    const verLines = [];
    // General first
    const gen = document.getElementById(ver + '--general');
    if (gen && gen.value.trim()) {
      verLines.push('**General:** ' + gen.value.trim());
    }
    // Per-state
    for (const state of STATES) {
      const ta = document.getElementById(ver + '--' + state);
      if (ta && ta.value.trim()) {
        verLines.push('**' + state + ':** ' + ta.value.trim());
      }
    }
    if (verLines.length > 0) {
      lines.push('### ' + ver, '');
      lines.push(...verLines);
      lines.push('');
    }
  }
  return lines.join('\\n');
}

// Copy to clipboard
document.getElementById('btn-copy').addEventListener('click', async () => {
  const text = buildSummary();
  try {
    await navigator.clipboard.writeText(text);
    showStatus('Copied!');
  } catch {
    // Fallback: select a temporary textarea
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showStatus('Copied (fallback)');
  }
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
  npx tsx scripts/ui-iterate.ts new <session> <state1> [state2...]
  npx tsx scripts/ui-iterate.ts capture [session]
  npx tsx scripts/ui-iterate.ts view [session]
  npx tsx scripts/ui-iterate.ts list
  npx tsx scripts/ui-iterate.ts --list-states

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

  // --list-states: print all valid state names
  if (args.includes('--list-states')) {
    const manifest = buildManifest();
    for (const entry of manifest) console.log(entry.name);
    return;
  }

  const command = args[0];
  if (!command || command === '--help' || command === '-h') usage();

  const manifest = buildManifest();
  const manifestMap = new Map(manifest.map((e) => [e.name, e]));

  switch (command) {
    case 'new': {
      const sessionName = args[1];
      if (!sessionName) {
        console.error('Error: session name required.\n');
        usage();
      }
      const stateNames = args.slice(2);
      if (stateNames.length === 0) {
        console.error('Error: at least one state name required.\n');
        usage();
      }

      // Validate state names
      const invalid = stateNames.filter((s) => !manifestMap.has(s));
      if (invalid.length > 0) {
        console.error(`Unknown state(s): ${invalid.join(', ')}`);
        console.error('Run --list-states to see valid names.');
        process.exit(1);
      }

      const dir = sessionDir(sessionName);
      mkdirSync(dir, { recursive: true });

      const session: Session = { states: stateNames, versions: ['v1'] };
      writeSession(sessionName, session);

      const entries = stateNames.map((s) => manifestMap.get(s)!);
      const outDir = path.join(dir, 'v1');
      await captureStates(entries, outDir);

      generateReviewHTML(sessionName, session);
      const reviewPath = path.join(dir, 'review.html');
      console.log(`\nSession "${sessionName}" created with v1.`);
      openInBrowser(reviewPath);
      break;
    }

    case 'capture': {
      // Determine session name: explicit arg, or most recent
      let sessionName = args[1];
      if (!sessionName) {
        const sessions = listSessions();
        if (sessions.length === 0) {
          console.error(
            'No sessions found. Create one with: new <session> <states...>',
          );
          process.exit(1);
        }
        // Pick most recently modified
        sessionName = sessions
          .map((s) => ({
            name: s,
            mtime: new Date(
              readFileSync(sessionFile(s), 'utf-8') ? 0 : 0,
            ).getTime(),
          }))
          .sort((a, b) => b.mtime - a.mtime)[0].name;

        // Actually just pick the last one alphabetically for now;
        // a better heuristic would use file mtime
        sessionName = sessions[sessions.length - 1];
        console.log(`Using session: ${sessionName}`);
      }

      const session = readSession(sessionName);
      const nextNum = session.versions.length + 1;
      const nextVer = `v${nextNum}`;

      const entries = session.states.map((s) => {
        const entry = manifestMap.get(s);
        if (!entry) throw new Error(`State "${s}" no longer in manifest`);
        return entry;
      });

      const outDir = path.join(sessionDir(sessionName), nextVer);
      await captureStates(entries, outDir);

      session.versions.push(nextVer);
      writeSession(sessionName, session);

      generateReviewHTML(sessionName, session);
      const reviewPath = path.join(sessionDir(sessionName), 'review.html');
      console.log(`\nCaptured ${nextVer} for session "${sessionName}".`);
      openInBrowser(reviewPath);
      break;
    }

    case 'view': {
      let sessionName = args[1];
      if (!sessionName) {
        const sessions = listSessions();
        if (sessions.length === 0) {
          console.error('No sessions found.');
          process.exit(1);
        }
        sessionName = sessions[sessions.length - 1];
        console.log(`Using session: ${sessionName}`);
      }
      const dir = sessionDir(sessionName);
      const reviewPath = path.join(dir, 'review.html');
      if (!existsSync(reviewPath)) {
        console.error(`No review.html found for session "${sessionName}".`);
        process.exit(1);
      }
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
