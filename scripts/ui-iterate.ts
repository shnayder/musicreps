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
    // All note-button modes share the 'note-button' task type key.
    await page.evaluate(
      () => localStorage.setItem('motorBaseline_note-button', '500'),
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

      // Extra clicks (e.g. enter notes, open modal) scoped to mode container
      if (entry.clickSelectors) {
        for (const selector of entry.clickSelectors) {
          const scoped = `#mode-${entry.modeId} ${selector}`;
          await page.click(scoped);
          await page.waitForTimeout(200);
        }
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
// Evaluation data
// ---------------------------------------------------------------------------

type EvalIssue = {
  id: string;
  element: string;
  category: string;
  severity: 'high' | 'medium' | 'low';
  issue: string;
  principles: { id: string; name: string }[];
  proposal: string;
  sourceRef?: string;
};

type EvalState = {
  issues: EvalIssue[];
  positives: string[];
};

type EvalData = {
  goal: string;
  version: string;
  timestamp: string;
  categoriesEvaluated?: string[];
  states: Record<string, EvalState>;
  summary: string;
  prioritizedChanges: {
    priority: number;
    description: string;
    affectedStates: string[];
    effort: string;
    issues: string[];
  }[];
};

function readEvaluations(name: string): Map<string, EvalData> {
  const dir = sessionDir(name);
  const evals = new Map<string, EvalData>();
  if (!existsSync(dir)) return evals;
  for (const file of readdirSync(dir)) {
    const match = file.match(/^evaluation-(v\d+)\.json$/);
    if (!match) continue;
    try {
      const data = JSON.parse(readFileSync(path.join(dir, file), 'utf-8'));
      evals.set(match[1], data);
    } catch {
      // Skip malformed evaluation files
    }
  }
  return evals;
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

function generateEvalCell(
  evalData: EvalData | undefined,
  state: string,
): string {
  if (!evalData) return '';
  const stateEval = evalData.states[state];
  if (!stateEval) return '<td class="eval-cell"></td>';

  const issues = stateEval.issues || [];
  const positives = stateEval.positives || [];
  const counts = { high: 0, medium: 0, low: 0 };
  for (const i of issues) counts[i.severity]++;

  let badges = '';
  if (counts.high) {
    badges += `<span class="eval-badge eval-high">${counts.high}</span>`;
  }
  if (counts.medium) {
    badges += `<span class="eval-badge eval-medium">${counts.medium}</span>`;
  }
  if (counts.low) {
    badges += `<span class="eval-badge eval-low">${counts.low}</span>`;
  }
  if (!issues.length) badges = '<span class="eval-badge eval-ok">0</span>';

  let issueHtml = '';
  for (const issue of issues) {
    const principles = issue.principles
      .map((p) => `${escapeHtml(p.id)}: ${escapeHtml(p.name)}`)
      .join(', ');
    issueHtml += `
      <div class="eval-issue eval-severity-${issue.severity}">
        <div class="eval-issue-header"><span class="eval-dot"></span><strong>${
      escapeHtml(issue.element)
    }</strong></div>
        <p class="eval-issue-text">${escapeHtml(issue.issue)}</p>
        ${
      issue.proposal
        ? `<p class="eval-proposal">&rarr; ${escapeHtml(issue.proposal)}</p>`
        : ''
    }
        ${
      principles
        ? `<p class="eval-principles">${escapeHtml(principles)}</p>`
        : ''
    }
      </div>`;
  }

  let posHtml = '';
  if (positives.length) {
    posHtml =
      `<details class="eval-positives"><summary>Positives (${positives.length})</summary>
      <ul>${
        positives.map((p) => `<li>${escapeHtml(p)}</li>`).join('')
      }</ul></details>`;
  }

  return `<td class="eval-cell"><details open>
    <summary>${badges} ${issues.length} issue${
    issues.length !== 1 ? 's' : ''
  }</summary>
    <div class="eval-issues">${issueHtml}</div>${posHtml}
  </details></td>`;
}

function generateReviewHTML(name: string, session: Session): void {
  const { states, versions } = session;
  const colCount = states.length + 1; // +1 for General column
  const evaluations = readEvaluations(name);
  const hasEvals = evaluations.size > 0;

  // Table header
  const headers = states
    .map((s) => `<th title="${escapeHtml(s)}">${escapeHtml(s)}</th>`)
    .join('\n          ');

  // Table body: one group per version
  let body = '';
  for (const ver of versions) {
    const evalData = evaluations.get(ver);
    body += `
      <tr class="ver-header">
        <td colspan="${colCount}"><h2>${
      escapeHtml(ver)
    }</h2><button onclick="copyRound('${
      escapeHtml(ver)
    }')">Copy round summary</button>${
      evalData
        ? `<button onclick="copyEval('${
          escapeHtml(ver)
        }')">Copy evaluation</button>`
        : ''
    }</td>
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
      </tr>`;
    // Evaluation row (only if evaluation exists for this version)
    if (evalData) {
      body += `
      <tr class="eval">`;
      for (const state of states) {
        body += generateEvalCell(evalData, state);
      }
      body += `
        <td class="eval-cell">${
        evalData.summary
          ? `<div class="eval-summary">${escapeHtml(evalData.summary)}</div>`
          : ''
      }</td>
      </tr>`;
    }
    body += `
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

  /* Evaluation panels */
  .eval td { padding: .25rem; vertical-align: top; }
  .eval-cell { width: 300px; }
  .eval-cell > details { font-size: .75rem; padding: .25rem; }
  .eval-cell > details > summary { cursor: pointer; font-weight: 600; padding: .2rem 0; text-align: left; }
  .eval-badge {
    display: inline-block; padding: 1px 6px; border-radius: 8px;
    font-size: .65rem; font-weight: 600; color: #fff; margin-right: 2px;
  }
  .eval-high { background: #c62828; }
  .eval-medium { background: #e6a817; }
  .eval-low { background: #888; }
  .eval-ok { background: #2e7d32; }
  .eval-dot {
    display: inline-block; width: 8px; height: 8px; border-radius: 50%;
    margin-right: 4px; vertical-align: middle;
  }
  .eval-severity-high .eval-dot { background: #c62828; }
  .eval-severity-medium .eval-dot { background: #e6a817; }
  .eval-severity-low .eval-dot { background: #888; }
  .eval-issue {
    margin: .3rem 0; padding: .3rem .4rem; border-left: 3px solid; border-radius: 2px;
  }
  .eval-severity-high { border-color: #c62828; background: #fff5f5; }
  .eval-severity-medium { border-color: #e6a817; background: #fffdf5; }
  .eval-severity-low { border-color: #888; background: #fafafa; }
  .eval-issue-header { font-size: .8rem; }
  .eval-issue-text { margin: .15rem 0; }
  .eval-proposal { color: #2e7d32; font-style: italic; margin: .15rem 0; }
  .eval-principles { color: #888; font-size: .65rem; margin: .1rem 0; }
  .eval-positives { margin-top: .4rem; text-align: left; }
  .eval-positives summary { cursor: pointer; color: #2e7d32; font-weight: 500; text-align: left; }
  .eval-positives ul { margin: .2rem 0; padding-left: 1.2rem; }
  .eval-positives li { color: #2e7d32; margin: .1rem 0; }
  .eval-summary { font-size: .75rem; color: #555; font-style: italic; padding: .3rem; }
  .eval-goal-bar {
    background: #fff; border: 1px solid #ddd; border-radius: 4px;
    padding: .5rem .75rem; margin-bottom: .5rem; font-size: .85rem;
    display: flex; gap: .5rem; align-items: center; flex-wrap: wrap;
  }
  .eval-goal-bar strong { color: #333; flex-shrink: 0; }
  .eval-goal-bar input {
    flex: 1; min-width: 200px; border: 1px solid transparent; border-radius: 3px;
    padding: .2rem .4rem; font: inherit; background: transparent;
  }
  .eval-goal-bar input:hover { border-color: #ddd; }
  .eval-goal-bar input:focus { border-color: #4a90d9; outline: none; background: #fff; }
  .eval-goal-bar .eval-categories { color: #888; font-size: .75rem; flex-shrink: 0; }
</style>
</head>
<body>

<h1>UI Iteration: ${escapeHtml(name)}</h1>
<div class="toolbar">
  <button id="btn-copy" title="Copy all feedback to clipboard">Copy full summary</button>
  <button id="btn-save" title="Download feedback as .md file">Save .md</button>
  <span class="status" id="status"></span>
</div>
${
    hasEvals
      ? (() => {
        // Show goal from the latest evaluation
        const latestEval = evaluations.get(versions[versions.length - 1]) ||
          [...evaluations.values()].pop();
        if (!latestEval) return '';
        const cats = latestEval.categoriesEvaluated
          ? ` <span class="eval-categories">(${
            latestEval.categoriesEvaluated.join(', ')
          })</span>`
          : '';
        return `<div class="eval-goal-bar"><strong>Goal:</strong> <input id="eval-goal" value="${
          escapeHtml(latestEval.goal)
        }">${cats}</div>`;
      })()
      : ''
  }

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
const EVALUATIONS = ${
    JSON.stringify(
      Object.fromEntries(evaluations),
    )
  };

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
  // Load saved goal override
  const goalInput = document.getElementById('eval-goal');
  if (goalInput) {
    const saved = localStorage.getItem(storagePrefix + 'goal');
    if (saved) goalInput.value = saved;
  }
}

// Save on input
document.addEventListener('input', (e) => {
  if (e.target.id === 'eval-goal') {
    localStorage.setItem(storagePrefix + 'goal', e.target.value);
    return;
  }
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

// --- Evaluation export ---
function buildEvalMarkdown(ver) {
  const evalData = EVALUATIONS[ver];
  if (!evalData) return '';
  const lines = ['## Design Evaluation — ' + SESSION + ' ' + ver, ''];
  lines.push('**Goal:** ' + evalData.goal, '');
  for (const state of STATES) {
    const se = evalData.states[state];
    if (!se || !se.issues.length) continue;
    lines.push('### ' + state, '');
    for (const issue of se.issues) {
      const sev = issue.severity.toUpperCase();
      const princ = issue.principles.map(function(p) { return p.id + ': ' + p.name; }).join(', ');
      lines.push('- **[' + sev + ']** ' + issue.element + ': ' + issue.issue);
      if (issue.proposal) lines.push('  -> ' + issue.proposal);
      if (princ) lines.push('  Principles: ' + princ);
    }
    if (se.positives && se.positives.length) {
      lines.push('', '**Positives:**');
      for (const p of se.positives) lines.push('- ' + p);
    }
    lines.push('');
  }
  if (evalData.prioritizedChanges && evalData.prioritizedChanges.length) {
    lines.push('### Prioritized Changes', '');
    for (const c of evalData.prioritizedChanges) {
      lines.push(c.priority + '. ' + c.description + ' (' + c.effort + ')');
    }
  }
  return lines.join('\\n');
}

async function copyEval(ver) {
  const text = buildEvalMarkdown(ver);
  if (!text) { showStatus('No evaluation for ' + ver); return; }
  await copyToClipboard(text, ver + ' evaluation');
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
