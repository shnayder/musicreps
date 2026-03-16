// Recommendation diagnostic report generator.
// Runs pre-baked learner scenarios through the recommendation algorithm,
// captures practice tab screenshots, and outputs an annotatable HTML report.
//
// Session-based workflow (like ui-iterate.ts):
//   deno task diagnostic [new] [session-name]   # Create session, capture round 1
//   deno task diagnostic capture [session]       # Add a new round
//   deno task diagnostic view [session]          # Open review HTML
//   deno task diagnostic list                    # List sessions
//
// Options:
//   --only <pattern1,pattern2>   Filter scenarios by name substring

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

import {
  createAdaptiveSelector,
  createMemoryStorage,
  deriveScaledConfig,
} from '../src/adaptive.ts';
import { computeRecommendations } from '../src/recommendations.ts';
import {
  buildRecommendationText,
  computePracticeSummary,
} from '../src/mode-ui-state.ts';
import {
  ALL_GROUP_INDICES,
  ALL_ITEMS,
  DISTANCE_GROUPS,
  getItemIdsForGroup,
} from '../src/modes/semitone-math/logic.ts';
import {
  generateLocalStorageData,
  type GroupSpec,
  type ScenarioOutput,
  SCENARIOS,
} from '../src/fixtures/recommendation-scenarios.ts';
import { startServer } from '../tests/e2e/helpers/server.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const PREFERRED_PORT = 8002;
const VIEWPORT = { width: 402, height: 873 };
const MOTOR_BASELINE = 1000;
const NAMESPACE = 'semitoneMath';

const DIAG_DIR = path.join(ROOT, 'screenshots', 'diagnostic');

// ---------------------------------------------------------------------------
// Serializable analysis type (Sets → arrays for JSON persistence)
// ---------------------------------------------------------------------------

type SerializedRow = {
  name: string;
  description: string;
  levelSpeed: number;
  levelFreshness: number;
  gateOpen: boolean;
  groupRecs: {
    index: number;
    automatic: number;
    working: number;
    unseen: number;
  }[];
  recommendedIndices: number[];
  expandIndex: number | null;
  expandNewCount: number;
  levelRecs: { index: number; type: string }[];
  recommendationText: string;
  statusLabel: string;
  statusDetail: string;
  screenshotFile: string;
  checks: { label: string; pass: boolean; error: string | null }[];
};

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

type Session = {
  rounds: string[];
};

function sessionDir(name: string): string {
  return path.join(DIAG_DIR, name);
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

function writeSessionFile(name: string, session: Session): void {
  writeFileSync(sessionFile(name), JSON.stringify(session, null, 2) + '\n');
}

function listSessions(): string[] {
  if (!existsSync(DIAG_DIR)) return [];
  return readdirSync(DIAG_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(sessionFile(d.name)))
    .map((d) => d.name);
}

function autoSessionName(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `diag-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

// Dev server — uses shared helper from tests/e2e/helpers/server.ts

// ---------------------------------------------------------------------------
// Pure analysis: run scenario through recommendation algorithm
// ---------------------------------------------------------------------------

function analyzeScenario(
  groupStats: Record<number, GroupSpec>,
  now: number,
): Omit<
  SerializedRow,
  'name' | 'description' | 'screenshotFile' | 'checks'
> {
  const storage = createMemoryStorage();
  const cfg = deriveScaledConfig(MOTOR_BASELINE);
  const selector = createAdaptiveSelector(storage, cfg);

  // Populate storage from group specs
  const lsData = generateLocalStorageData(NAMESPACE, groupStats, now);
  for (const [key, value] of Object.entries(lsData)) {
    const prefix = `adaptive_${NAMESPACE}_`;
    if (key.startsWith(prefix)) {
      const itemId = key.slice(prefix.length);
      storage.saveStats(itemId, JSON.parse(value));
    }
  }

  // Run recommendation algorithm (sort unstarted by index, matching use-group-scope)
  const recommendation = computeRecommendations(
    selector,
    ALL_GROUP_INDICES,
    getItemIdsForGroup,
    {},
    { sortUnstarted: (a, b) => a.string - b.string },
  );

  // Build recommendation text
  const getGroupLabel = (idx: number) => DISTANCE_GROUPS[idx].label;
  const recommendationText = buildRecommendationText(
    recommendation,
    getGroupLabel,
  );

  // Compute practice summary
  const practiceSummary = computePracticeSummary({
    allItemIds: ALL_ITEMS,
    selector,
    itemNoun: 'items',
    recommendation,
    recommendationText,
    masteryText: '',
    showMastery: false,
  });

  // Compute algorithm internals
  const recs = selector.getStringRecommendations(
    ALL_GROUP_INDICES,
    getItemIdsForGroup,
  );
  const started = recs.filter((r) => r.unseenCount < r.totalCount);

  const startedItemIds = started.flatMap((r) => getItemIdsForGroup(r.string));
  const { level: levelSpeed } = selector.getLevelSpeed(startedItemIds);
  const { level: levelFreshness } = selector.getLevelFreshness(
    startedItemIds,
    undefined,
    Date.now(),
  );

  const groupRecs = recs.map((r) => ({
    index: r.string,
    automatic: r.automaticCount,
    working: r.workingCount,
    unseen: r.unseenCount,
  }));

  return {
    levelSpeed,
    levelFreshness,
    gateOpen: recommendation.expandIndex !== null,
    groupRecs,
    recommendedIndices: [...recommendation.recommended],
    expandIndex: recommendation.expandIndex,
    expandNewCount: recommendation.expandNewCount,
    levelRecs: recommendation.levelRecs,
    recommendationText,
    statusLabel: practiceSummary.statusLabel,
    statusDetail: practiceSummary.statusDetail,
  };
}

// ---------------------------------------------------------------------------
// Round capture: analyze all scenarios + screenshots + checks → analysis.json
// ---------------------------------------------------------------------------

async function captureRound(
  roundDir: string,
  onlyPatterns: string[] | null,
  hasTouch = true,
): Promise<SerializedRow[]> {
  let scenarios = SCENARIOS;
  if (onlyPatterns) {
    scenarios = scenarios.filter((s) =>
      onlyPatterns.some((p) => s.name.includes(p))
    );
  }

  if (scenarios.length === 0) {
    console.log('No scenarios matched filter.');
    return [];
  }

  mkdirSync(roundDir, { recursive: true });

  const now = Date.now();

  console.log('Starting dev server...');
  const { proc: server, portReady } = startServer(PREFERRED_PORT);
  const rows: SerializedRow[] = [];

  try {
    const port = await portReady;
    const baseUrl = `http://localhost:${port}`;
    console.log(`Server ready on port ${port}.`);

    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 3,
      hasTouch,
    });
    const page = await context.newPage();

    for (const scenario of scenarios) {
      console.log(`  ${scenario.name}...`);

      // --- 1. Pure analysis (no browser) ---
      const analysis = analyzeScenario(scenario.groupStats, now);

      // --- 2. Screenshot ---
      const lsData = generateLocalStorageData(
        NAMESPACE,
        scenario.groupStats,
        now,
      );

      await page.goto(`${baseUrl}/?fixtures`);
      await page.waitForLoadState('networkidle');

      await page.evaluate(
        (data: Record<string, string>) => {
          localStorage.clear();
          for (const [k, v] of Object.entries(data)) {
            localStorage.setItem(k, v);
          }
        },
        lsData,
      );

      await page.evaluate(
        (baseline: number) => {
          localStorage.setItem('motorBaseline_button', String(baseline));
        },
        MOTOR_BASELINE,
      );

      await page.goto(`${baseUrl}/?fixtures`);
      await page.waitForLoadState('networkidle');
      await page.click('[data-mode="semitoneMath"]');
      await page.waitForSelector('#mode-semitoneMath.mode-active');
      await page.click('#mode-semitoneMath [data-tab="progress"]');
      await page.waitForTimeout(300);

      const statsContainer = await page.$(
        '#mode-semitoneMath .stats-container',
      );
      const screenshotFile = `${scenario.name}.png`;
      if (statsContainer) {
        await statsContainer.screenshot({
          path: path.join(roundDir, screenshotFile),
          type: 'png',
        });
      } else {
        await page.screenshot({
          path: path.join(roundDir, screenshotFile),
          type: 'png',
        });
        console.warn(
          `    Warning: .stats-container not found, used full page`,
        );
      }

      await page.evaluate(() => localStorage.clear());

      // --- 3. Run checks ---
      // Reconstruct RecommendationResult with Sets for check functions
      const recommendation = {
        recommended: new Set(analysis.recommendedIndices),
        enabled: null as Set<number> | null,
        expandIndex: analysis.expandIndex,
        expandNewCount: analysis.expandNewCount,
        levelRecs: analysis.levelRecs,
      };

      const output: ScenarioOutput = {
        recommendation,
        recommendationText: analysis.recommendationText,
        practiceSummary: {
          statusLabel: analysis.statusLabel,
          statusDetail: analysis.statusDetail,
          recommendationText: analysis.recommendationText,
          showRecommendationButton: false,
          masteryText: '',
          showMastery: false,
          enabledItemCount: 0,
        },
      };
      const checks = (scenario.checks ?? []).map((c) => {
        const error = c.check(output);
        return { label: c.label, pass: error === null, error };
      });

      rows.push({
        name: scenario.name,
        description: scenario.description,
        ...analysis,
        screenshotFile,
        checks,
      });
    }

    await browser.close();
  } finally {
    server.kill();
  }

  // Write analysis.json
  writeFileSync(
    path.join(roundDir, 'analysis.json'),
    JSON.stringify(rows, null, 2) + '\n',
  );

  // Print check summary
  const totalChecks = rows.reduce((s, r) => s + r.checks.length, 0);
  const passed = rows.reduce(
    (s, r) => s + r.checks.filter((c) => c.pass).length,
    0,
  );
  console.log(`Checks: ${passed}/${totalChecks} passed`);

  if (passed < totalChecks) {
    const failures = rows.flatMap((r) =>
      r.checks
        .filter((c) => !c.pass)
        .map((c) => `  ${r.name}: ${c.label} — ${c.error}`)
    );
    console.log('Failures:\n' + failures.join('\n'));
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Review HTML generation
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function generateReviewHTML(sessionName: string, session: Session): void {
  // Load all rounds' analysis data
  const roundData: Record<string, SerializedRow[]> = {};
  for (const round of session.rounds) {
    const analysisPath = path.join(
      sessionDir(sessionName),
      round,
      'analysis.json',
    );
    if (existsSync(analysisPath)) {
      roundData[round] = JSON.parse(readFileSync(analysisPath, 'utf-8'));
    }
  }

  // Build per-round table sections
  let roundSections = '';
  for (const round of session.rounds) {
    const rows = roundData[round];
    if (!rows) continue;

    // Check summary for this round
    const totalChecks = rows.reduce((s, r) => s + r.checks.length, 0);
    const passedChecks = rows.reduce(
      (s, r) => s + r.checks.filter((c) => c.pass).length,
      0,
    );
    const allPassed = passedChecks === totalChecks;

    let tableRows = '';
    for (const row of rows) {
      const groupStatsHtml = row.groupRecs
        .map(
          (g) =>
            `<div class="group-row">` +
            `<span class="group-label">G${g.index}</span> ` +
            `<span class="automatic">${g.automatic}A</span> ` +
            `<span class="working">${g.working}W</span> ` +
            `<span class="unseen">${g.unseen}U</span>` +
            `</div>`,
        )
        .join('\n');

      const algorithmHtml =
        `<div>P10 speed: <strong>${row.levelSpeed.toFixed(2)}</strong></div>` +
        `<div>P10 freshness: <strong>${
          row.levelFreshness.toFixed(2)
        }</strong></div>` +
        `<div>Gate: <strong class="${
          row.gateOpen ? 'gate-open' : 'gate-closed'
        }">${row.gateOpen ? 'OPEN' : 'CLOSED'}</strong></div>`;

      const recommendedLabels = row.recommendedIndices
        .map((i) => `G${i}`)
        .join(', ');
      const levelRecLabels = row.levelRecs
        .map((r) => `${r.type}(G${r.index})`)
        .join(', ');
      const recHtml =
        `<div>Recommended: <strong>${
          recommendedLabels || 'none'
        }</strong></div>` +
        `<div>Recs: <strong>${levelRecLabels || 'none'}</strong></div>` +
        `<div class="rec-text">${
          escapeHtml(row.recommendationText || '(none)')
        }</div>`;

      const statusHtml =
        `<div class="status-label">${escapeHtml(row.statusLabel)}</div>` +
        `<div class="status-detail">${escapeHtml(row.statusDetail)}</div>`;

      const checksHtml = row.checks
        .map(
          (c) =>
            `<div class="check ${c.pass ? 'pass' : 'fail'}">` +
            `<span class="badge">${c.pass ? 'PASS' : 'FAIL'}</span> ` +
            `${escapeHtml(c.label)}` +
            (c.error
              ? `<div class="check-error">${escapeHtml(c.error)}</div>`
              : '') +
            `</div>`,
        )
        .join('\n');

      const noteId = `${escapeHtml(round)}--${escapeHtml(row.name)}`;
      const screenshotSrc = `${encodeURIComponent(round)}/${
        encodeURIComponent(row.screenshotFile)
      }`;

      tableRows += `
    <tr>
      <td class="name-col">
        <div class="scenario-name">${escapeHtml(row.name)}</div>
        <div class="scenario-desc">${escapeHtml(row.description)}</div>
      </td>
      <td class="group-stats-col">${groupStatsHtml}</td>
      <td class="algo-col">${algorithmHtml}</td>
      <td class="rec-col">${recHtml}</td>
      <td class="status-col">${statusHtml}</td>
      <td class="screenshot-col"><img src="${screenshotSrc}" loading="lazy"></td>
      <td class="checks-col">${checksHtml}</td>
      <td class="notes-col"><textarea id="${noteId}" placeholder="Notes on ${
        escapeHtml(row.name)
      }..." rows="3"></textarea></td>
    </tr>`;
    }

    const generalNoteId = `${escapeHtml(round)}--general`;

    roundSections += `
<div class="round-section">
  <div class="round-header">
    <h2>${escapeHtml(round)}</h2>
    <span class="badge-summary ${allPassed ? 'pass' : 'fail'}">
      ${passedChecks}/${totalChecks} checks
    </span>
    <button onclick="copyRound('${
      escapeHtml(round)
    }')">Copy round summary</button>
  </div>
  <table>
    <thead>
      <tr>
        <th>Name + Description</th>
        <th>Group Stats</th>
        <th>Algorithm</th>
        <th>Recommendation</th>
        <th>Status</th>
        <th>Progress Chart</th>
        <th>Checks</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>${tableRows}
    </tbody>
  </table>
  <div class="general-notes">
    <label for="${generalNoteId}">General notes for ${
      escapeHtml(round)
    }:</label>
    <textarea id="${generalNoteId}" placeholder="Overall observations for this round..." rows="3"></textarea>
  </div>
</div>`;
  }

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Recommendation Diagnostic: ${
    escapeHtml(sessionName)
  }</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; margin: 0; padding: 1rem;
         background: #f5f5f5; font-size: 13px; }
  h1 { font-size: 1.4rem; margin: 0 0 0.5rem; }
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
  .round-section { margin-bottom: 2rem; }
  .round-header {
    display: flex; align-items: center; gap: .75rem;
    padding: .5rem 0; border-bottom: 2px solid #ccc; margin-bottom: .5rem;
  }
  .round-header h2 { margin: 0; font-size: 1.1rem; }
  .round-header button {
    padding: .25rem .6rem; border-radius: 4px; border: 1px solid #ccc;
    background: #fff; cursor: pointer; font-size: .75rem;
  }
  .round-header button:hover { background: #e8e8e8; }
  .badge-summary {
    display: inline-block; padding: 2px 8px; border-radius: 3px;
    font-size: 0.8rem; font-weight: bold;
  }
  .badge-summary.pass { background: #d4edda; color: #155724; }
  .badge-summary.fail { background: #f8d7da; color: #721c24; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ddd; padding: 8px; vertical-align: top; }
  th { background: #e8e8e8; font-size: 0.85rem; text-align: left;
       position: sticky; top: 72px; z-index: 5; }
  .name-col { min-width: 130px; }
  .scenario-name { font-weight: bold; font-size: 0.95rem; }
  .scenario-desc { color: #666; font-size: 0.8rem; margin-top: 2px; }
  .group-stats-col { min-width: 120px; font-family: monospace; font-size: 0.8rem; }
  .group-row { white-space: nowrap; }
  .group-label { font-weight: bold; }
  .automatic { color: #2a7; }
  .working { color: #c63; }
  .unseen { color: #888; }
  .algo-col { min-width: 120px; }
  .gate-open { color: #2a7; }
  .gate-closed { color: #c63; }
  .rec-col { min-width: 150px; }
  .rec-text { font-size: 0.8rem; color: #555; margin-top: 4px; font-style: italic; }
  .status-col { min-width: 100px; }
  .status-label { font-weight: bold; font-size: 1rem; }
  .status-detail { color: #666; font-size: 0.8rem; }
  .screenshot-col { width: 140px; }
  .screenshot-col img { width: 134px; border: 1px solid #ddd; border-radius: 3px; }
  .checks-col { min-width: 140px; }
  .check { margin-bottom: 4px; }
  .badge { display: inline-block; padding: 1px 6px; border-radius: 3px;
           font-size: 0.75rem; font-weight: bold; }
  .pass .badge { background: #d4edda; color: #155724; }
  .fail .badge { background: #f8d7da; color: #721c24; }
  .check-error { font-size: 0.75rem; color: #721c24; margin-top: 2px; }
  .notes-col { min-width: 160px; }
  .notes-col textarea {
    width: 100%; min-height: 50px; resize: vertical;
    font-family: system-ui, sans-serif; font-size: .8rem;
    border: 1px solid #ccc; border-radius: 4px; padding: .3rem;
    field-sizing: content;
  }
  .notes-col textarea:focus { outline: 2px solid #4a90d9; border-color: transparent; }
  .general-notes { margin-top: .5rem; }
  .general-notes label { font-size: .85rem; font-weight: bold; display: block;
                         margin-bottom: .25rem; }
  .general-notes textarea {
    width: 100%; max-width: 600px; min-height: 50px; resize: vertical;
    font-family: system-ui, sans-serif; font-size: .8rem;
    border: 1px solid #ccc; border-radius: 4px; padding: .3rem;
    field-sizing: content;
  }
  .general-notes textarea:focus { outline: 2px solid #4a90d9; border-color: transparent; }
  .howto { font-size: 0.9rem; line-height: 1.5; max-width: 700px; }
  .howto ul { margin: 0.3rem 0; padding-left: 1.5rem; }
  .howto p { margin: 0.4rem 0; }
</style></head>
<body>

<h1>Recommendation Diagnostic: ${escapeHtml(sessionName)}</h1>

<div class="toolbar">
  <button id="btn-copy" title="Copy all feedback to clipboard">Copy full summary</button>
  <button id="btn-save" title="Download feedback as .md file">Save .md</button>
  <span class="status" id="status"></span>
</div>

<details>
<summary style="cursor:pointer; font-weight:bold; margin-bottom:0.5rem;">How it works</summary>
<div class="howto">
  <p>Each item is classified by its <strong>speed score</strong>:</p>
  <ul>
    <li><strong class="automatic">A (Automatic)</strong> &mdash; speed &ge; 0.9</li>
    <li><strong class="working">W (Working)</strong> &mdash; seen but speed &lt; 0.9</li>
    <li><strong class="unseen">U (Unseen)</strong> &mdash; no data yet</li>
  </ul>
  <p><strong>Per-level status:</strong> P10 speed &rarr; Automatic (&ge;0.9) / Learned (&ge;0.7) / Learning (&ge;0.3) / Hesitant (&gt;0) / Starting (=0).<br>
     <strong>Freshness:</strong> P10 freshness &lt; 0.5 &rarr; needs review.<br>
     <strong>Recs priority:</strong> review &rarr; practice &rarr; expand &rarr; automate.<br>
     <strong>Expansion gate</strong> opens when all started levels &ge; Learned AND none need review.</p>
  <p style="font-size:0.8rem; color:#666;">
    See <a href="../../guides/architecture.md">guides/architecture.md</a> &sect; &ldquo;Recommendation Pipeline (v4)&rdquo; for the full algorithm.
  </p>
</div>
</details>

${roundSections}

<script>
var SESSION = ${JSON.stringify(sessionName)};
var ROUNDS = ${JSON.stringify(session.rounds)};
var ROUND_DATA = ${JSON.stringify(roundData)};

// --- localStorage persistence ---
var storagePrefix = 'diagnostic-' + SESSION + '-';

function storageKey(round, scenario) {
  return storagePrefix + round + '--' + scenario;
}

function loadNotes() {
  for (var ri = 0; ri < ROUNDS.length; ri++) {
    var round = ROUNDS[ri];
    var rows = ROUND_DATA[round] || [];
    var ids = rows.map(function(r) { return round + '--' + r.name; });
    ids.push(round + '--general');
    for (var i = 0; i < ids.length; i++) {
      var ta = document.getElementById(ids[i]);
      if (!ta) continue;
      var parts = ids[i].split('--');
      var scenario = parts.slice(1).join('--');
      var saved = localStorage.getItem(storageKey(round, scenario));
      if (saved) ta.value = saved;
    }
  }
}

document.addEventListener('input', function(e) {
  if (e.target.tagName !== 'TEXTAREA') return;
  var id = e.target.id;
  var sep = id.indexOf('--');
  if (sep < 0) return;
  var round = id.substring(0, sep);
  var scenario = id.substring(sep + 2);
  localStorage.setItem(storageKey(round, scenario), e.target.value);
});

loadNotes();

// --- Summary generation ---
function buildRoundLines(round) {
  var lines = [];
  var gen = document.getElementById(round + '--general');
  if (gen && gen.value.trim()) {
    lines.push('**General:** ' + gen.value.trim());
  }
  var rows = ROUND_DATA[round] || [];
  for (var i = 0; i < rows.length; i++) {
    var ta = document.getElementById(round + '--' + rows[i].name);
    if (ta && ta.value.trim()) {
      lines.push('**' + rows[i].name + ':** ' + ta.value.trim());
    }
  }
  return lines;
}

function buildRoundSummary(round) {
  var lines = ['## Recommendation Diagnostic — ' + SESSION, '', '### ' + round, ''];
  var rl = buildRoundLines(round);
  for (var i = 0; i < rl.length; i++) lines.push(rl[i]);
  return lines.join('\\n');
}

function buildSummary() {
  var lines = ['## Recommendation Diagnostic — ' + SESSION, ''];
  for (var ri = 0; ri < ROUNDS.length; ri++) {
    var round = ROUNDS[ri];
    var rl = buildRoundLines(round);
    if (rl.length > 0) {
      lines.push('### ' + round, '');
      for (var i = 0; i < rl.length; i++) lines.push(rl[i]);
      lines.push('');
    }
  }
  return lines.join('\\n');
}

function showStatus(msg) {
  var el = document.getElementById('status');
  el.textContent = msg;
  setTimeout(function() { el.textContent = ''; }, 2000);
}

function copyToClipboard(text, label) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(function() {
      showStatus('Copied ' + label + '!');
    }).catch(function() {
      fallbackCopy(text, label);
    });
  } else {
    fallbackCopy(text, label);
  }
}

function fallbackCopy(text, label) {
  var ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  showStatus('Copied ' + label + ' (fallback)');
}

function copyRound(round) {
  copyToClipboard(buildRoundSummary(round), round);
}

document.getElementById('btn-copy').addEventListener('click', function() {
  copyToClipboard(buildSummary(), 'full summary');
});

document.getElementById('btn-save').addEventListener('click', function() {
  var text = buildSummary();
  var blob = new Blob([text], { type: 'text/markdown' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = SESSION + '-diagnostic.md';
  a.click();
  URL.revokeObjectURL(a.href);
  showStatus('Saved!');
});
</script>
</body></html>`;

  const dir = sessionDir(sessionName);
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
  console.log(`Recommendation diagnostic — session-based iteration + annotation.

Usage:
  deno task diagnostic [new] [session-name]   Create session, capture round 1
  deno task diagnostic capture [session]      Add a new round
  deno task diagnostic view [session]         Open review HTML
  deno task diagnostic list                   List sessions

Options:
  --only <pattern1,pattern2>   Filter scenarios by name substring (new/capture)
`);
  process.exit(1);
}

function parseOnlyFlag(args: string[]): string[] | null {
  const idx = args.indexOf('--only');
  if (idx >= 0 && args[idx + 1]) {
    return args[idx + 1].split(',');
  }
  return null;
}

function stripFlags(args: string[]): string[] {
  const result: string[] = [];
  let i = 0;
  while (i < args.length) {
    if (args[i] === '--only') {
      i += 2; // skip flag + value
    } else if (args[i] === '--no-touch') {
      i++; // skip boolean flag
    } else {
      result.push(args[i]);
      i++;
    }
  }
  return result;
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const onlyPatterns = parseOnlyFlag(rawArgs);
  const touchMode = !rawArgs.includes('--no-touch');
  const args = stripFlags(rawArgs);

  const command = args[0] || 'new';
  if (command === '--help' || command === '-h') usage();

  switch (command) {
    case 'new': {
      const sessionName = args[1] || autoSessionName();
      const dir = sessionDir(sessionName);

      if (existsSync(sessionFile(sessionName))) {
        console.error(
          `Session "${sessionName}" already exists. Use "capture" to add a round, or choose a different name.`,
        );
        process.exit(1);
      }
      mkdirSync(dir, { recursive: true });

      const roundName = 'round-1';
      const session: Session = { rounds: [roundName] };
      writeSessionFile(sessionName, session);

      const roundDir = path.join(dir, roundName);
      await captureRound(roundDir, onlyPatterns, touchMode);

      generateReviewHTML(sessionName, session);
      const reviewPath = path.join(dir, 'review.html');
      console.log(`\nSession "${sessionName}" created with ${roundName}.`);
      openInBrowser(reviewPath);
      break;
    }

    case 'capture': {
      let sessionName = args[1];
      if (!sessionName) {
        const sessions = listSessions();
        if (sessions.length === 0) {
          console.error(
            'No sessions found. Create one with: deno task diagnostic new',
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
      const nextNum = session.rounds.length + 1;
      const roundName = `round-${nextNum}`;

      const roundDir = path.join(sessionDir(sessionName), roundName);
      await captureRound(roundDir, onlyPatterns, touchMode);

      session.rounds.push(roundName);
      writeSessionFile(sessionName, session);

      generateReviewHTML(sessionName, session);
      const reviewPath = path.join(sessionDir(sessionName), 'review.html');
      console.log(`\nCaptured ${roundName} for session "${sessionName}".`);
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
        console.log('No diagnostic sessions found.');
      } else {
        for (const s of sessions) {
          const session = readSession(s);
          console.log(`  ${s}  (${session.rounds.length} rounds)`);
        }
      }
      break;
    }

    default:
      // Bare arg that's not a command — treat as session name for "new"
      if (!command.startsWith('-')) {
        const sessionName = command;
        const dir = sessionDir(sessionName);

        if (existsSync(sessionFile(sessionName))) {
          console.error(
            `Session "${sessionName}" already exists. Use "capture" to add a round.`,
          );
          process.exit(1);
        }
        mkdirSync(dir, { recursive: true });

        const roundName = 'round-1';
        const session: Session = { rounds: [roundName] };
        writeSessionFile(sessionName, session);

        const roundDir = path.join(dir, roundName);
        await captureRound(roundDir, onlyPatterns, touchMode);

        generateReviewHTML(sessionName, session);
        const reviewPath = path.join(dir, 'review.html');
        console.log(`\nSession "${sessionName}" created with ${roundName}.`);
        openInBrowser(reviewPath);
      } else {
        console.error(`Unknown command: ${command}\n`);
        usage();
      }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
