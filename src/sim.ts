#!/usr/bin/env npx tsx
// Simulation tables for tuning forgetting model parameters.
// Usage: npx tsx src/sim.ts
//        npx tsx src/sim.ts --initialStability=8 --stabilityGrowthBase=1.5

import {
  computeAutomaticity,
  computeRecall,
  computeSpeedScore,
  computeStabilityAfterWrong,
  computeWeight,
  DEFAULT_CONFIG,
  updateStability,
} from './adaptive.js';

// ---------------------------------------------------------------------------
// Parse CLI overrides
// ---------------------------------------------------------------------------

const cfg = { ...DEFAULT_CONFIG };
for (const arg of process.argv.slice(2)) {
  const m = arg.match(/^--(\w+)=([\d.]+)$/);
  if (m && m[1] in cfg) {
    (cfg as any)[m[1]] = parseFloat(m[2]);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pad(s: string, w: number) {
  return s.length >= w ? s : s + ' '.repeat(w - s.length);
}
function rpad(s: string, w: number) {
  return s.length >= w ? s : ' '.repeat(w - s.length) + s;
}

function fmtRecall(v: number | null): string {
  if (v === null) return '-';
  if (v < 0.005) return '~0';
  return v.toFixed(2);
}

function fmtHours(h: number): string {
  if (h < 24) return h.toFixed(1) + 'h';
  return (h / 24).toFixed(1) + 'd';
}

function printTable(headers: string[], rows: string[][], colWidths?: number[]) {
  const widths = colWidths ??
    headers.map((h, i) =>
      Math.max(h.length, ...rows.map((r) => r[i]?.length ?? 0))
    );
  const hdr = headers.map((h, i) => rpad(h, widths[i])).join('  ');
  console.log(hdr);
  console.log('-'.repeat(hdr.length));
  for (const row of rows) {
    console.log(row.map((c, i) => rpad(c, widths[i])).join('  '));
  }
}

// ---------------------------------------------------------------------------
// Print active config
// ---------------------------------------------------------------------------

console.log('=== Config ===');
const cfgKeys = [
  'minTime',
  'maxResponseTime',
  'initialStability',
  'maxStability',
  'stabilityGrowthBase',
  'stabilityDecayOnWrong',
  'recallThreshold',
  'speedBonusMax',
  'selfCorrectionThreshold',
  'automaticityTarget',
];
for (const k of cfgKeys) {
  const def = (DEFAULT_CONFIG as any)[k];
  const cur = (cfg as any)[k];
  const mark = cur !== def ? ' *' : '';
  console.log(`  ${k}: ${cur}${mark}`);
}
console.log('');

// ---------------------------------------------------------------------------
// Table 1: Recall decay over time
// ---------------------------------------------------------------------------

console.log('=== Table 1: Recall decay over time ===');
console.log('P(recall) = 2^(-elapsed/stability)\n');

const stabilityValues = [
  { label: 'S=4h (new)', s: 4 },
  { label: 'S=16h', s: 16 },
  { label: 'S=96h (4d)', s: 96 },
  { label: 'S=672h (28d)', s: 672 },
];
const timePoints = [
  { label: '1h', h: 1 },
  { label: '4h', h: 4 },
  { label: '12h', h: 12 },
  { label: '1d', h: 24 },
  { label: '3d', h: 72 },
  { label: '7d', h: 168 },
  { label: '30d', h: 720 },
];

const labelWidth = Math.max(...stabilityValues.map((s) => s.label.length));
const t1Headers = [pad('', labelWidth), ...timePoints.map((t) => t.label)];
const t1Rows = stabilityValues.map((sv) => [
  pad(sv.label, labelWidth),
  ...timePoints.map((tp) => fmtRecall(computeRecall(sv.s, tp.h))),
]);
printTable(t1Headers, t1Rows);
console.log('');

// ---------------------------------------------------------------------------
// Table 2: Stability growth scenarios
// ---------------------------------------------------------------------------

console.log('=== Table 2: Stability updates ===');
console.log('How stability changes after correct/wrong answers\n');

type Scenario = {
  label: string;
  oldS: number | null;
  resp: number | null; // null for wrong-answer scenarios
  elapsed: number | null;
  wrong?: boolean;
};

const scenarios: Scenario[] = [
  { label: 'First correct answer', oldS: null, resp: 2000, elapsed: null },
  { label: '2nd answer, medium speed', oldS: 4, resp: 2500, elapsed: 1 },
  { label: '2nd answer, fast', oldS: 4, resp: 1000, elapsed: 1 },
  { label: '2nd answer, slow', oldS: 4, resp: 7000, elapsed: 1 },
  { label: 'Daily practice, fast', oldS: 16, resp: 1200, elapsed: 24 },
  { label: 'Daily practice, medium', oldS: 16, resp: 3000, elapsed: 24 },
  { label: 'Daily practice, slow', oldS: 16, resp: 6000, elapsed: 24 },
  { label: 'Weekly review, fast', oldS: 96, resp: 1000, elapsed: 168 },
  { label: 'Weekly review, medium', oldS: 96, resp: 3000, elapsed: 168 },
  { label: 'Weekly review, slow', oldS: 96, resp: 7000, elapsed: 168 },
  { label: 'Monthly, fast (self-corr)', oldS: 96, resp: 900, elapsed: 720 },
  { label: 'Monthly, medium', oldS: 96, resp: 3000, elapsed: 720 },
  { label: 'Monthly, slow (struggled)', oldS: 96, resp: 7000, elapsed: 720 },
  { label: '3mo away, fast (self-corr)', oldS: 96, resp: 1000, elapsed: 2160 },
  { label: '3mo away, slow', oldS: 96, resp: 7000, elapsed: 2160 },
  {
    label: 'Wrong (high stability)',
    oldS: 96,
    resp: null,
    elapsed: null,
    wrong: true,
  },
  {
    label: 'Wrong (medium stability)',
    oldS: 16,
    resp: null,
    elapsed: null,
    wrong: true,
  },
  {
    label: 'Wrong (low stability)',
    oldS: 10,
    resp: null,
    elapsed: null,
    wrong: true,
  },
];

const s2Headers = [
  'Scenario',
  'oldS',
  'resp',
  'elapsed',
  'newS',
  'newS(days)',
  'growth',
];
const scenLabelW = Math.max(...scenarios.map((s) => s.label.length));
const s2Rows = scenarios.map((sc) => {
  let newS: number;
  if (sc.wrong) {
    newS = computeStabilityAfterWrong(sc.oldS, cfg);
  } else {
    newS = updateStability(sc.oldS, sc.resp!, sc.elapsed, cfg);
  }
  const oldSStr = sc.oldS == null ? '-' : fmtHours(sc.oldS);
  const respStr = sc.resp == null ? '-' : sc.resp + 'ms';
  const elapStr = sc.elapsed == null ? '-' : fmtHours(sc.elapsed);
  const growth = sc.oldS != null && sc.oldS > 0
    ? (newS / sc.oldS).toFixed(2) + 'x'
    : '-';
  return [
    pad(sc.label, scenLabelW),
    oldSStr,
    respStr,
    elapStr,
    fmtHours(newS),
    (newS / 24).toFixed(1) + 'd',
    growth,
  ];
});
printTable(s2Headers, s2Rows);
console.log('');

// ---------------------------------------------------------------------------
// Table 3: Within-session weight comparisons
// ---------------------------------------------------------------------------

console.log('=== Table 3: Within-session weights ===');
console.log('How different item states affect selection probability\n');

const now = Date.now();
const unseenWeight = computeWeight(null, cfg);

type WeightScenario = {
  label: string;
  ewma: number;
  stability: number | null;
  lastCorrectAt: number | null;
};

const weightScenarios: WeightScenario[] = [
  {
    label: 'Fast (1000ms), just answered',
    ewma: 1000,
    stability: 4,
    lastCorrectAt: now,
  },
  {
    label: 'Medium (2500ms), just answered',
    ewma: 2500,
    stability: 4,
    lastCorrectAt: now,
  },
  {
    label: 'Slow (5000ms), just answered',
    ewma: 5000,
    stability: 4,
    lastCorrectAt: now,
  },
  {
    label: 'Fast (1000ms), recall~0.8',
    ewma: 1000,
    stability: 4,
    lastCorrectAt: now - 4 * 0.32 * 3600000,
  },
  {
    label: 'Fast (1000ms), recall~0.5',
    ewma: 1000,
    stability: 4,
    lastCorrectAt: now - 4 * 3600000,
  },
  {
    label: 'Fast (1000ms), recall~0.3',
    ewma: 1000,
    stability: 4,
    lastCorrectAt: now - 4 * 1.74 * 3600000,
  },
  {
    label: 'Slow (5000ms), recall~0.5',
    ewma: 5000,
    stability: 4,
    lastCorrectAt: now - 4 * 3600000,
  },
  {
    label: 'Slow (5000ms), recall~0.3',
    ewma: 5000,
    stability: 4,
    lastCorrectAt: now - 4 * 1.74 * 3600000,
  },
  {
    label: 'Fast (1000ms), no stability data',
    ewma: 1000,
    stability: null,
    lastCorrectAt: null,
  },
  {
    label: 'Slow (5000ms), no stability data',
    ewma: 5000,
    stability: null,
    lastCorrectAt: null,
  },
];

const w3Headers = [
  'Item state',
  'speedW',
  'recall',
  'recallW',
  'total',
  'vs unseen',
];
const wLabelW = Math.max(...weightScenarios.map((s) => s.label.length));

const w3Rows: string[][] = [
  [pad('Unseen', wLabelW), '-', '-', '-', unseenWeight.toFixed(2), '-'],
];

for (const ws of weightScenarios) {
  const stats: any = {
    ewma: ws.ewma,
    recentTimes: [ws.ewma],
    sampleCount: 1,
    lastSeen: now,
    stability: ws.stability,
    lastCorrectAt: ws.lastCorrectAt,
  };
  const speedW = Math.max(ws.ewma, cfg.minTime) / cfg.minTime;
  const totalW = computeWeight(stats, cfg);
  let recallStr = '-';
  let recallW = '-';
  if (ws.stability != null && ws.lastCorrectAt != null) {
    const elapsed = (now - ws.lastCorrectAt) / 3600000;
    const r = computeRecall(ws.stability, elapsed)!;
    recallStr = r.toFixed(2);
    recallW = (1 + (1 - r)).toFixed(2);
  }
  w3Rows.push([
    pad(ws.label, wLabelW),
    speedW.toFixed(2),
    recallStr,
    recallW,
    totalW.toFixed(2),
    (totalW / unseenWeight).toFixed(2) + 'x',
  ]);
}

printTable(w3Headers, w3Rows);
console.log('');

// ---------------------------------------------------------------------------
// Table 4: Multi-session trajectory
// ---------------------------------------------------------------------------

console.log('=== Table 4: Stability trajectory over repeated sessions ===');
console.log('Simulates a user practicing an item at regular intervals\n');

type Trajectory = {
  label: string;
  interval: number;
  responseTime: number;
  sessions: number;
};

const trajectories: Trajectory[] = [
  {
    label: 'Daily, fast (1200ms)',
    interval: 24,
    responseTime: 1200,
    sessions: 10,
  },
  {
    label: 'Daily, medium (3000ms)',
    interval: 24,
    responseTime: 3000,
    sessions: 10,
  },
  {
    label: 'Daily, slow (6000ms)',
    interval: 24,
    responseTime: 6000,
    sessions: 10,
  },
  {
    label: 'Every-other-day, fast',
    interval: 48,
    responseTime: 1200,
    sessions: 10,
  },
];

for (const traj of trajectories) {
  console.log(
    `  ${traj.label} (${traj.sessions} sessions, every ${
      fmtHours(traj.interval)
    }):`,
  );
  const sessionNums = Array.from({ length: traj.sessions }, (_, i) => i + 1);
  let stability: number | null = null;
  const rowData: string[] = [];
  for (const _n of sessionNums) {
    const elapsed = stability == null ? null : traj.interval;
    stability = updateStability(stability, traj.responseTime, elapsed, cfg);
    const _recall = elapsed != null
      ? computeRecall(stability, traj.interval)
      : null;
    rowData.push(`S=${fmtHours(stability)}`);
  }
  const nums = sessionNums.map((n) => rpad('#' + n, 10));
  const vals = rowData.map((v) => rpad(v, 10));
  console.log('    ' + nums.join('  '));
  console.log('    ' + vals.join('  '));
  console.log('');
}

// ---------------------------------------------------------------------------
// Table 5: Automaticity (heatmap values)
// ---------------------------------------------------------------------------

console.log('=== Table 5: Automaticity (recall * speedScore) ===');
console.log('What the default heatmap shows. Green > 0.8, red < 0.2\n');

const ewmaValues = [1000, 1500, 2000, 3000, 4500, 6000];
const recallValues = [1.0, 0.8, 0.5, 0.3, 0.1];

// Print speed scores
console.log('  Speed scores by EWMA:');
for (const e of ewmaValues) {
  const ss = computeSpeedScore(e, cfg)!;
  console.log(`    ${e}ms → ${ss.toFixed(2)}`);
}
console.log('');

// Automaticity grid
const t5LabelW = 10;
const t5Headers = [
  pad('recall\\ewma', t5LabelW),
  ...ewmaValues.map((e) => e + 'ms'),
];
const t5Rows = recallValues.map((r) => [
  pad(r.toFixed(1), t5LabelW),
  ...ewmaValues.map((e) => {
    const ss = computeSpeedScore(e, cfg)!;
    const auto = computeAutomaticity(r, ss)!;
    return auto.toFixed(2);
  }),
]);
printTable(t5Headers, t5Rows);
console.log('');
