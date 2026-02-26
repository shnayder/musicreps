// Recommendation diagnostic report generator.
// Runs pre-baked learner scenarios through the recommendation algorithm,
// captures practice tab screenshots, and outputs an HTML table report.
//
// Usage:
//   npx tsx scripts/recommendation-diagnostic.ts
//   npx tsx scripts/recommendation-diagnostic.ts --only fresh-start,struggling

import { chromium } from 'playwright';
import { ChildProcess, spawn } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
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
import type { RecommendationResult } from '../src/types.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PREFERRED_PORT = 8002;
const VIEWPORT = { width: 402, height: 873 };
const MOTOR_BASELINE = 1000;
const NAMESPACE = 'semitoneMath';

// Parse CLI flags
const args = process.argv.slice(2);
const onlyIdx = args.indexOf('--only');
const onlyPatterns = onlyIdx >= 0 && args[onlyIdx + 1]
  ? args[onlyIdx + 1].split(',')
  : null;

const OUT_DIR = path.resolve(__dirname, '..', 'screenshots', 'diagnostic');

// ---------------------------------------------------------------------------
// Dev server (same pattern as take-screenshots.ts)
// ---------------------------------------------------------------------------

function startServer(): { proc: ChildProcess; portReady: Promise<number> } {
  const proc = spawn(
    'deno',
    [
      'run',
      '--allow-net',
      '--allow-read',
      '--allow-run',
      'main.ts',
      `--port=${PREFERRED_PORT}`,
    ],
    {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'pipe',
    },
  );
  const portReady = new Promise<number>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Server did not start within 10s')),
      10_000,
    );
    proc.stderr?.on('data', (d: Buffer) => {
      const msg = d.toString();
      const m = msg.match(/Listening on http:\/\/[\w.]+:(\d+)/);
      if (m) {
        clearTimeout(timeout);
        resolve(parseInt(m[1], 10));
      } else if (!msg.includes('Listening on')) process.stderr.write(msg);
    });
    proc.on('exit', (code) => {
      clearTimeout(timeout);
      if (code) reject(new Error(`Server exited with code ${code}`));
    });
  });
  return { proc, portReady };
}

// ---------------------------------------------------------------------------
// Pure analysis: run scenario through recommendation algorithm
// ---------------------------------------------------------------------------

type AnalysisResult = {
  recommendation: RecommendationResult;
  recommendationText: string;
  practiceSummary: ReturnType<typeof computePracticeSummary>;
  consolidationRatio: number;
  medianWork: number;
  gateOpen: boolean;
  groupRecs: { index: number; mastered: number; due: number; unseen: number }[];
};

function analyzeScenario(
  groupStats: Record<number, GroupSpec>,
  now: number,
): AnalysisResult {
  const storage = createMemoryStorage();
  const cfg = deriveScaledConfig(MOTOR_BASELINE);
  const selector = createAdaptiveSelector(storage, cfg);

  // Populate storage from group specs
  const lsData = generateLocalStorageData(NAMESPACE, groupStats, now);
  for (const [key, value] of Object.entries(lsData)) {
    // Parse key: adaptive_semitoneMath_{itemId}
    const prefix = `adaptive_${NAMESPACE}_`;
    if (key.startsWith(prefix)) {
      const itemId = key.slice(prefix.length);
      storage.saveStats(itemId, JSON.parse(value));
    }
  }

  // Run recommendation algorithm
  const recommendation = computeRecommendations(
    selector,
    ALL_GROUP_INDICES,
    getItemIdsForGroup,
    { expansionThreshold: cfg.expansionThreshold },
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
  const totalSeen = started.reduce(
    (sum, r) => sum + r.masteredCount + r.dueCount,
    0,
  );
  const totalMastered = started.reduce((sum, r) => sum + r.masteredCount, 0);
  const consolidationRatio = totalSeen > 0 ? totalMastered / totalSeen : 0;

  const workCounts = started
    .map((r) => r.dueCount + r.unseenCount)
    .sort((a, b) => b - a);
  const medianWork = workCounts.length > 0
    ? workCounts[Math.floor(workCounts.length / 2)]
    : 0;

  const gateOpen = recommendation.expandIndex !== null;

  const groupRecs = recs.map((r) => ({
    index: r.string,
    mastered: r.masteredCount,
    due: r.dueCount,
    unseen: r.unseenCount,
  }));

  return {
    recommendation,
    recommendationText,
    practiceSummary,
    consolidationRatio,
    medianWork,
    gateOpen,
    groupRecs,
  };
}

// ---------------------------------------------------------------------------
// HTML report generation
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type ReportRow = {
  name: string;
  description: string;
  analysis: AnalysisResult;
  screenshotFile: string;
  checks: { label: string; pass: boolean; error: string | null }[];
};

function generateReport(rows: ReportRow[]): string {
  const totalChecks = rows.reduce((s, r) => s + r.checks.length, 0);
  const passedChecks = rows.reduce(
    (s, r) => s + r.checks.filter((c) => c.pass).length,
    0,
  );
  const allPassed = passedChecks === totalChecks;

  let tableRows = '';
  for (const row of rows) {
    // Group stats column
    const groupStatsHtml = row.analysis.groupRecs
      .map(
        (g) =>
          `<div class="group-row">` +
          `<span class="group-label">G${g.index}</span> ` +
          `<span class="mastered">${g.mastered}M</span> ` +
          `<span class="due">${g.due}D</span> ` +
          `<span class="unseen">${g.unseen}U</span>` +
          `</div>`,
      )
      .join('\n');

    // Algorithm column
    const ratio = row.analysis.consolidationRatio;
    const algorithmHtml =
      `<div>Ratio: <strong>${ratio.toFixed(2)}</strong></div>` +
      `<div>Median work: <strong>${row.analysis.medianWork}</strong></div>` +
      `<div>Gate: <strong class="${
        row.analysis.gateOpen ? 'gate-open' : 'gate-closed'
      }">${row.analysis.gateOpen ? 'OPEN' : 'CLOSED'}</strong></div>`;

    // Recommendation column
    const consolidateLabels = row.analysis.recommendation.consolidateIndices
      .map((i) => `G${i}`)
      .join(', ');
    const expandLabel = row.analysis.recommendation.expandIndex !== null
      ? `G${row.analysis.recommendation.expandIndex}`
      : 'none';
    const recHtml =
      `<div>Consolidate: <strong>${
        consolidateLabels || 'none'
      }</strong></div>` +
      `<div>Expand: <strong>${expandLabel}</strong></div>` +
      `<div class="rec-text">${
        escapeHtml(row.analysis.recommendationText || '(none)')
      }</div>`;

    // Status column
    const statusHtml =
      `<div class="status-label">${
        escapeHtml(row.analysis.practiceSummary.statusLabel)
      }</div>` +
      `<div class="status-detail">${
        escapeHtml(row.analysis.practiceSummary.statusDetail)
      }</div>`;

    // Checks column
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
      <td class="screenshot-col"><img src="${row.screenshotFile}" loading="lazy"></td>
      <td class="checks-col">${checksHtml}</td>
    </tr>`;
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Recommendation Diagnostic</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 1rem; font-size: 13px; }
  h1 { font-size: 1.4rem; margin-bottom: 0.5rem; }
  .summary { margin-bottom: 1rem; font-size: 1rem; }
  .summary .badge { font-size: 0.9rem; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ddd; padding: 8px; vertical-align: top; }
  th { background: #f5f5f5; font-size: 0.85rem; text-align: left; }
  .name-col { min-width: 130px; }
  .scenario-name { font-weight: bold; font-size: 0.95rem; }
  .scenario-desc { color: #666; font-size: 0.8rem; margin-top: 2px; }
  .group-stats-col { min-width: 120px; font-family: monospace; font-size: 0.8rem; }
  .group-row { white-space: nowrap; }
  .group-label { font-weight: bold; }
  .mastered { color: #2a7; }
  .due { color: #c63; }
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
</style></head>
<body>
<h1>Recommendation Diagnostic Report</h1>
<div class="summary">
  <span class="badge ${allPassed ? 'pass' : 'fail'}" style="background: ${
    allPassed ? '#d4edda' : '#f8d7da'
  }; color: ${
    allPassed ? '#155724' : '#721c24'
  }; padding: 3px 10px; font-size: 1rem;">
    ${passedChecks}/${totalChecks} checks passed
  </span>
  &nbsp; ${rows.length} scenarios &middot; Mode: Semitone Math &middot; Baseline: ${MOTOR_BASELINE}ms
</div>
<table>
  <thead>
    <tr>
      <th>Name + Description</th>
      <th>Group Stats</th>
      <th>Algorithm</th>
      <th>Recommendation</th>
      <th>Status</th>
      <th>Practice Tab</th>
      <th>Checks</th>
    </tr>
  </thead>
  <tbody>${tableRows}
  </tbody>
</table>
</body></html>`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  let scenarios = SCENARIOS;
  if (onlyPatterns) {
    scenarios = scenarios.filter((s) =>
      onlyPatterns.some((p) => s.name.includes(p))
    );
  }

  if (scenarios.length === 0) {
    console.log('No scenarios matched filter.');
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });

  // Fix "now" for deterministic analysis across all scenarios
  const now = Date.now();

  console.log('Starting dev server...');
  const { proc: server, portReady } = startServer();
  try {
    const port = await portReady;
    const baseUrl = `http://localhost:${port}`;
    console.log(`Server ready on port ${port}.`);

    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 3,
    });
    const page = await context.newPage();

    const reportRows: ReportRow[] = [];

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

      // Seed localStorage
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

      // Seed motor baseline for button provider
      await page.evaluate(
        (baseline: number) => {
          localStorage.setItem('motorBaseline_button', String(baseline));
        },
        MOTOR_BASELINE,
      );

      // Navigate to semitoneMath mode (practice tab is default)
      await page.goto(`${baseUrl}/?fixtures`);
      await page.waitForLoadState('networkidle');
      await page.click('[data-mode="semitoneMath"]');
      await page.waitForSelector('#mode-semitoneMath.mode-active');
      await page.waitForTimeout(300);

      const screenshotFile = `${scenario.name}.png`;
      await page.screenshot({
        path: path.join(OUT_DIR, screenshotFile),
        type: 'png',
      });

      // Clean up localStorage
      await page.evaluate(() => localStorage.clear());

      // --- 3. Run checks ---
      const output: ScenarioOutput = {
        recommendation: analysis.recommendation,
        recommendationText: analysis.recommendationText,
        practiceSummary: analysis.practiceSummary,
      };
      const checks = (scenario.checks ?? []).map((c) => {
        const error = c.check(output);
        return { label: c.label, pass: error === null, error };
      });

      reportRows.push({
        name: scenario.name,
        description: scenario.description,
        analysis,
        screenshotFile,
        checks,
      });
    }

    await browser.close();

    // Generate HTML report
    const html = generateReport(reportRows);
    const reportPath = path.join(OUT_DIR, 'index.html');
    writeFileSync(reportPath, html);
    console.log(`\nReport: ${reportPath}`);

    const totalChecks = reportRows.reduce((s, r) => s + r.checks.length, 0);
    const passed = reportRows.reduce(
      (s, r) => s + r.checks.filter((c) => c.pass).length,
      0,
    );
    console.log(`Checks: ${passed}/${totalChecks} passed`);

    if (passed < totalChecks) {
      const failures = reportRows.flatMap((r) =>
        r.checks
          .filter((c) => !c.pass)
          .map((c) => `  ${r.name}: ${c.label} — ${c.error}`)
      );
      console.log('Failures:\n' + failures.join('\n'));
    }
  } finally {
    server.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
