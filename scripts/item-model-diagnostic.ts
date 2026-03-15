// Item-level adaptive model diagnostic report generator.
// Defines interaction patterns (sequences of response times, correct/incorrect,
// with timing gaps) and shows what the adaptive model derives at each step.
// Like a "unit test visualization" for the adaptive model.
//
// Session-based workflow:
//   deno task item-model [new] [session-name]   # Generate report
//   deno task item-model view [session]          # Open report
//   deno task item-model list                    # List sessions

import { spawn } from 'child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  computeEwma,
  computeFreshness,
  computeRecall,
  computeSpeedScore,
  computeStabilityAfterWrong,
  DEFAULT_CONFIG,
  updateStability,
} from '../src/adaptive.ts';
import { statusLabelFromLevel } from '../src/mode-ui-state.ts';
import type { AdaptiveConfig, ItemStats } from '../src/types.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const DIAG_DIR = path.join(ROOT, 'screenshots', 'diagnostic');
const ITEM_ID = 'test-item';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InteractionEvent = {
  deltaHours: number; // Time since previous event (0 for first)
  responseMs: number; // Response time
  correct: boolean; // Correct or wrong
};

type InteractionPattern = {
  name: string;
  description: string;
  events: InteractionEvent[];
};

type StepSnapshot = {
  step: number;
  event: InteractionEvent;
  // Simulated time
  timeMs: number;
  // Raw stats
  ewma: number;
  sampleCount: number;
  stability: number | null;
  // Derived metrics (computed at "now" = time of this event)
  recall: number | null;
  freshness: number | null;
  speedScore: number | null;
  // Heatmap color
  heatmapColor: string;
  // Classification
  status: string; // 'Not started' | 'Hesitant' | 'Learning' | 'Solid' | 'Automatic'
  recallClass: 'unseen' | 'due' | 'mastered';
};

type ProjectionPoint = {
  label: string;
  offsetHours: number;
  timeMs: number;
  recall: number | null;
  freshness: number | null;
  speedScore: number | null;
  heatmapColor: string;
  status: string; // 'Not started' | 'Hesitant' | 'Learning' | 'Solid' | 'Automatic'
};

type PatternResult = {
  pattern: InteractionPattern;
  snapshots: StepSnapshot[];
  projection: ProjectionPoint[];
};

// ---------------------------------------------------------------------------
// Heatmap color (inline computation, same as stats-display.ts)
// ---------------------------------------------------------------------------

const SPEED_HSL: [number, number, number][] = [
  [40, 60, 58], // needs work (speed <= 0.3)
  [48, 50, 52], // > 0.3
  [60, 40, 46], // > 0.55
  [80, 35, 40], // > 0.75
  [125, 48, 33], // > 0.9 — automatic
];
const FRESHNESS_FLOOR = 0.25;
const NEUTRAL_L = 78;
const NO_DATA_COLOR = 'hsl(30, 4%, 85%)';

function getSpeedFreshnessColor(
  speedScore: number | null,
  freshness: number | null,
): string {
  if (speedScore === null || freshness === null) return NO_DATA_COLOR;
  const level = speedScore > 0.9
    ? 4
    : speedScore > 0.75
    ? 3
    : speedScore > 0.55
    ? 2
    : speedScore > 0.3
    ? 1
    : 0;
  const [h, s, l] = SPEED_HSL[level];
  const f = FRESHNESS_FLOOR +
    (1 - FRESHNESS_FLOOR) * Math.max(0, Math.min(1, freshness));
  const fadedS = Math.round(s * f);
  const fadedL = Math.round(l + (NEUTRAL_L - l) * (1 - f));
  return `hsl(${h}, ${fadedS}%, ${fadedL}%)`;
}

// ---------------------------------------------------------------------------
// Status classification
// ---------------------------------------------------------------------------

function classifyStatus(speedScore: number | null): string {
  if (speedScore === null) return 'Not started';
  return statusLabelFromLevel(speedScore);
}

function classifyRecall(
  recall: number | null,
  hasSeen: boolean,
): 'unseen' | 'due' | 'mastered' {
  if (!hasSeen || recall === null) return 'unseen';
  return recall < DEFAULT_CONFIG.freshnessThreshold ? 'due' : 'mastered';
}

// ---------------------------------------------------------------------------
// Replay engine: simulates events by directly manipulating stats
// ---------------------------------------------------------------------------

function replayPattern(
  pattern: InteractionPattern,
  cfg: AdaptiveConfig,
): PatternResult {
  const EPOCH = Date.UTC(2026, 0, 1); // Fixed epoch for determinism
  let currentTimeMs = EPOCH;
  let stats: ItemStats | null = null;
  const snapshots: StepSnapshot[] = [];

  for (let i = 0; i < pattern.events.length; i++) {
    const event = pattern.events[i];
    currentTimeMs += event.deltaHours * 3600000;
    const clamped = Math.min(event.responseMs, cfg.maxResponseTime);

    if (event.correct) {
      const elapsedHours = stats?.lastCorrectAt
        ? (currentTimeMs - stats.lastCorrectAt) / 3600000
        : null;

      if (stats) {
        const newEwma = computeEwma(stats.ewma, clamped, cfg.ewmaAlpha);
        const newTimes = [...stats.recentTimes, clamped].slice(
          -cfg.maxStoredTimes,
        );
        const newStability = updateStability(
          stats.stability ?? null,
          clamped,
          elapsedHours,
          cfg,
        );
        stats = {
          recentTimes: newTimes,
          ewma: newEwma,
          sampleCount: stats.sampleCount + 1,
          lastSeen: currentTimeMs,
          stability: newStability,
          lastCorrectAt: currentTimeMs,
        };
      } else {
        stats = {
          recentTimes: [clamped],
          ewma: clamped,
          sampleCount: 1,
          lastSeen: currentTimeMs,
          stability: cfg.initialStability,
          lastCorrectAt: currentTimeMs,
        };
      }
    } else {
      // Wrong answer
      if (stats) {
        const newStability = computeStabilityAfterWrong(
          stats.stability ?? null,
          cfg,
        );
        stats = {
          ...stats,
          lastSeen: currentTimeMs,
          stability: newStability,
        };
      } else {
        stats = {
          recentTimes: [],
          ewma: cfg.maxResponseTime,
          sampleCount: 0,
          lastSeen: currentTimeMs,
          stability: cfg.initialStability,
          lastCorrectAt: null,
        };
      }
    }

    // Compute derived metrics at this moment
    const recall = computeRecall(
      stats.stability ?? null,
      stats.lastCorrectAt
        ? (currentTimeMs - stats.lastCorrectAt) / 3600000
        : null,
    );
    const freshness = computeFreshness(
      stats.stability ?? null,
      stats.lastCorrectAt ?? null,
      currentTimeMs,
    );
    const speedScore = computeSpeedScore(stats.ewma, cfg);
    const hasSeen = stats.sampleCount > 0 || stats.lastSeen > 0;
    const heatmapColor = getSpeedFreshnessColor(speedScore, freshness);

    snapshots.push({
      step: i + 1,
      event,
      timeMs: currentTimeMs,
      ewma: stats.ewma,
      sampleCount: stats.sampleCount,
      stability: stats.stability,
      recall,
      freshness,
      speedScore,
      heatmapColor,
      status: classifyStatus(hasSeen ? speedScore : null),
      recallClass: classifyRecall(recall, hasSeen),
    });
  }

  // Future projection
  const PROJECTION_OFFSETS = [
    { label: '+1h', hours: 1 },
    { label: '+4h', hours: 4 },
    { label: '+12h', hours: 12 },
    { label: '+24h', hours: 24 },
    { label: '+48h', hours: 48 },
    { label: '+1wk', hours: 168 },
  ];

  const projection: ProjectionPoint[] = [];
  if (stats && stats.lastCorrectAt !== null) {
    for (const offset of PROJECTION_OFFSETS) {
      const futureMs = currentTimeMs + offset.hours * 3600000;
      const recall = computeFreshness(
        stats.stability ?? null,
        stats.lastCorrectAt,
        futureMs,
      );
      const freshness = recall; // Same formula
      const speedScore = computeSpeedScore(stats.ewma, cfg);
      const heatmapColor = getSpeedFreshnessColor(speedScore, freshness);

      projection.push({
        label: offset.label,
        offsetHours: offset.hours,
        timeMs: futureMs,
        recall,
        freshness,
        speedScore,
        heatmapColor,
        status: classifyStatus(speedScore),
      });
    }
  }

  return { pattern, snapshots, projection };
}

// ---------------------------------------------------------------------------
// Interaction patterns
// ---------------------------------------------------------------------------

// Within a session, with ~20 items enabled, a specific item comes up roughly
// every 1-2 minutes. Sessions are 5-10 minutes (so 2-4 reps of each item).
// Between sessions: typically 12-24 hours (once or twice a day).
const M = 1 / 60; // 1 minute in hours — within-session gap

const PATTERNS: InteractionPattern[] = [
  {
    name: 'steady-learner',
    description:
      'Moderate speed (~2s), 3 daily sessions. Gradual improvement within and across sessions.',
    events: [
      // Session 1 — first encounter
      { deltaHours: 0, responseMs: 2500, correct: true },
      { deltaHours: M, responseMs: 2200, correct: true },
      { deltaHours: M, responseMs: 2100, correct: true },
      // Session 2 — next day
      { deltaHours: 22, responseMs: 2300, correct: true },
      { deltaHours: M, responseMs: 2000, correct: true },
      { deltaHours: M, responseMs: 1900, correct: true },
      // Session 3 — day after
      { deltaHours: 24, responseMs: 2000, correct: true },
      { deltaHours: M, responseMs: 1800, correct: true },
      { deltaHours: M, responseMs: 1800, correct: true },
    ],
  },
  {
    name: 'getting-faster',
    description:
      'Starts at ~4s, improves to ~1.3s over 4 sessions across a week. Shows EWMA and speed score improvement.',
    events: [
      // Session 1
      { deltaHours: 0, responseMs: 4200, correct: true },
      { deltaHours: M, responseMs: 3800, correct: true },
      { deltaHours: M, responseMs: 3500, correct: true },
      // Session 2 — next day
      { deltaHours: 20, responseMs: 3200, correct: true },
      { deltaHours: M, responseMs: 2800, correct: true },
      { deltaHours: M, responseMs: 2500, correct: true },
      // Session 3 — 2 days later
      { deltaHours: 48, responseMs: 2200, correct: true },
      { deltaHours: M, responseMs: 1900, correct: true },
      { deltaHours: M, responseMs: 1700, correct: true },
      // Session 4 — 3 days later
      { deltaHours: 72, responseMs: 1600, correct: true },
      { deltaHours: M, responseMs: 1400, correct: true },
      { deltaHours: M, responseMs: 1300, correct: true },
    ],
  },
  {
    name: 'struggling',
    description:
      'Mix of correct/incorrect across sessions, slow responses. Shows stability decay on wrong answers and slow recovery.',
    events: [
      // Session 1 — first encounter, shaky
      { deltaHours: 0, responseMs: 4500, correct: false },
      { deltaHours: M, responseMs: 4000, correct: true },
      { deltaHours: M, responseMs: 3800, correct: false },
      { deltaHours: M, responseMs: 3500, correct: true },
      // Session 2 — next day, still struggling
      { deltaHours: 18, responseMs: 4200, correct: false },
      { deltaHours: M, responseMs: 3800, correct: true },
      { deltaHours: M, responseMs: 3500, correct: true },
      // Session 3 — day after, slightly better
      { deltaHours: 26, responseMs: 3600, correct: false },
      { deltaHours: M, responseMs: 3200, correct: true },
      { deltaHours: M, responseMs: 3000, correct: true },
    ],
  },
  {
    name: 'fast-mastery',
    description:
      'Quick correct answers (<1.5s), daily sessions. Shows speedBonus effect and self-correction on returning.',
    events: [
      // Session 1
      { deltaHours: 0, responseMs: 1400, correct: true },
      { deltaHours: M, responseMs: 1200, correct: true },
      { deltaHours: M, responseMs: 1100, correct: true },
      // Session 2 — next day
      { deltaHours: 22, responseMs: 1300, correct: true },
      { deltaHours: M, responseMs: 1100, correct: true },
      // Session 3 — 2 days later
      { deltaHours: 50, responseMs: 1200, correct: true },
      { deltaHours: M, responseMs: 1100, correct: true },
      // Session 4 — 4 days later (longer gap, tests self-correction)
      { deltaHours: 96, responseMs: 1200, correct: true },
    ],
  },
  {
    name: 'returning-after-break',
    description:
      '3 sessions building mastery, then 5-day break, then return. Shows recall decay and recovery.',
    events: [
      // Session 1
      { deltaHours: 0, responseMs: 2200, correct: true },
      { deltaHours: M, responseMs: 1900, correct: true },
      { deltaHours: M, responseMs: 1700, correct: true },
      // Session 2 — next day
      { deltaHours: 23, responseMs: 1600, correct: true },
      { deltaHours: M, responseMs: 1400, correct: true },
      { deltaHours: M, responseMs: 1300, correct: true },
      // Session 3 — day after
      { deltaHours: 25, responseMs: 1300, correct: true },
      { deltaHours: M, responseMs: 1200, correct: true },
      // 5-day break
      { deltaHours: 120, responseMs: 2400, correct: true },
      { deltaHours: M, responseMs: 1900, correct: true },
      { deltaHours: M, responseMs: 1600, correct: true },
    ],
  },
  {
    name: 'cramming',
    description:
      "One long session with many reps (1-min gaps), then nothing. Short-gap practice doesn't build lasting stability.",
    events: [
      { deltaHours: 0, responseMs: 2500, correct: true },
      { deltaHours: M, responseMs: 2200, correct: true },
      { deltaHours: M, responseMs: 1900, correct: true },
      { deltaHours: M, responseMs: 1700, correct: true },
      { deltaHours: M, responseMs: 1500, correct: true },
      { deltaHours: M, responseMs: 1400, correct: true },
      { deltaHours: M, responseMs: 1300, correct: true },
      { deltaHours: M, responseMs: 1200, correct: true },
      { deltaHours: M, responseMs: 1200, correct: true },
      { deltaHours: M, responseMs: 1100, correct: true },
      // Projection shows how quickly this fades
    ],
  },
  {
    name: 'spaced-practice',
    description:
      'One or two reps per session, sessions spread across days. Ideal for stability growth via spaced repetition.',
    events: [
      // Day 1
      { deltaHours: 0, responseMs: 2200, correct: true },
      { deltaHours: M, responseMs: 1900, correct: true },
      // Day 2
      { deltaHours: 24, responseMs: 1800, correct: true },
      // Day 4 (skip a day)
      { deltaHours: 48, responseMs: 1700, correct: true },
      // Day 7
      { deltaHours: 72, responseMs: 1500, correct: true },
      // Day 14
      { deltaHours: 168, responseMs: 1400, correct: true },
    ],
  },
  {
    name: 'wrong-then-right',
    description:
      'First session mostly wrong, gets it right by end. Next sessions improve. Shows recovery from initial errors.',
    events: [
      // Session 1 — rough start
      { deltaHours: 0, responseMs: 5000, correct: false },
      { deltaHours: M, responseMs: 4500, correct: false },
      { deltaHours: M, responseMs: 3800, correct: true },
      { deltaHours: M, responseMs: 3200, correct: true },
      // Session 2 — next day, remembers a bit
      { deltaHours: 20, responseMs: 3500, correct: true },
      { deltaHours: M, responseMs: 2800, correct: true },
      { deltaHours: M, responseMs: 2400, correct: true },
      // Session 3 — day after
      { deltaHours: 24, responseMs: 2200, correct: true },
      { deltaHours: M, responseMs: 1900, correct: true },
    ],
  },
  {
    name: 'decay-to-due',
    description:
      'Item mastered over 3 daily sessions, then no practice. Projection shows when it flips from mastered to due.',
    events: [
      // Session 1
      { deltaHours: 0, responseMs: 1600, correct: true },
      { deltaHours: M, responseMs: 1400, correct: true },
      { deltaHours: M, responseMs: 1300, correct: true },
      // Session 2 — next day
      { deltaHours: 22, responseMs: 1300, correct: true },
      { deltaHours: M, responseMs: 1200, correct: true },
      // Session 3 — day after
      { deltaHours: 26, responseMs: 1200, correct: true },
      { deltaHours: M, responseMs: 1100, correct: true },
      // Then stop — projection shows decay
    ],
  },
  {
    name: 'speed-plateau',
    description:
      'Always correct but consistently slow (~3.5s) across sessions. High recall, but low speed score keeps status at Hesitant.',
    events: [
      // Session 1
      { deltaHours: 0, responseMs: 3600, correct: true },
      { deltaHours: M, responseMs: 3500, correct: true },
      { deltaHours: M, responseMs: 3400, correct: true },
      // Session 2 — next day
      { deltaHours: 24, responseMs: 3600, correct: true },
      { deltaHours: M, responseMs: 3500, correct: true },
      { deltaHours: M, responseMs: 3400, correct: true },
      // Session 3 — 2 days later
      { deltaHours: 48, responseMs: 3500, correct: true },
      { deltaHours: M, responseMs: 3500, correct: true },
    ],
  },
];

// ---------------------------------------------------------------------------
// Sparkline SVG
// ---------------------------------------------------------------------------

function generateSparkline(
  snapshots: StepSnapshot[],
  projection: ProjectionPoint[],
): string {
  const W = 200;
  const H = 60;
  const PAD_X = 2;
  const PAD_Y = 4;

  // Data points: snapshots then projection
  const points: { x: number; y: number }[] = [];
  const totalSteps = snapshots.length + projection.length;
  if (totalSteps === 0) return '';

  const xScale = (W - 2 * PAD_X) / Math.max(totalSteps - 1, 1);

  for (let i = 0; i < snapshots.length; i++) {
    const s = snapshots[i].speedScore ?? 0;
    points.push({
      x: PAD_X + i * xScale,
      y: PAD_Y + (1 - s) * (H - 2 * PAD_Y),
    });
  }
  for (let i = 0; i < projection.length; i++) {
    const s = projection[i].speedScore ?? 0;
    points.push({
      x: PAD_X + (snapshots.length + i) * xScale,
      y: PAD_Y + (1 - s) * (H - 2 * PAD_Y),
    });
  }

  // Band backgrounds
  const bands = [
    { y0: 0, y1: 0.3, color: 'rgba(255,180,130,0.15)' }, // Hesitant
    { y0: 0.3, y1: 0.7, color: 'rgba(220,200,100,0.15)' }, // Learning
    { y0: 0.7, y1: 0.9, color: 'rgba(150,200,100,0.15)' }, // Solid
    { y0: 0.9, y1: 1.0, color: 'rgba(80,180,80,0.15)' }, // Automatic
  ];

  let svg =
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;

  // Background bands
  for (const b of bands) {
    const ry = PAD_Y + (1 - b.y1) * (H - 2 * PAD_Y);
    const rh = (b.y1 - b.y0) * (H - 2 * PAD_Y);
    svg +=
      `<rect x="0" y="${ry}" width="${W}" height="${rh}" fill="${b.color}"/>`;
  }

  // Divider between actual and projected
  if (projection.length > 0 && snapshots.length > 0) {
    const divX = PAD_X + (snapshots.length - 0.5) * xScale;
    svg +=
      `<line x1="${divX}" y1="0" x2="${divX}" y2="${H}" stroke="#ccc" stroke-dasharray="3,3"/>`;
  }

  // Threshold lines
  const thresholds = [0.3, 0.7, 0.9];
  for (const t of thresholds) {
    const ty = PAD_Y + (1 - t) * (H - 2 * PAD_Y);
    svg +=
      `<line x1="0" y1="${ty}" x2="${W}" y2="${ty}" stroke="#ddd" stroke-width="0.5"/>`;
  }

  // Actual line
  if (snapshots.length > 1) {
    const actualPoints = points.slice(0, snapshots.length);
    const d = actualPoints.map((p, i) =>
      `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`
    ).join(' ');
    svg +=
      `<path d="${d}" fill="none" stroke="#2a7" stroke-width="1.5" stroke-linejoin="round"/>`;
  }

  // Projected line (dashed)
  if (projection.length > 0 && snapshots.length > 0) {
    const projPoints = points.slice(snapshots.length - 1); // start from last actual
    const d = projPoints.map((p, i) =>
      `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`
    ).join(' ');
    svg +=
      `<path d="${d}" fill="none" stroke="#c63" stroke-width="1.5" stroke-dasharray="4,3" stroke-linejoin="round"/>`;
  }

  // Dots
  for (let i = 0; i < points.length; i++) {
    const color = i < snapshots.length ? '#2a7' : '#c63';
    svg += `<circle cx="${points[i].x.toFixed(1)}" cy="${
      points[i].y.toFixed(1)
    }" r="2" fill="${color}"/>`;
  }

  svg += '</svg>';
  return svg;
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

function fmt(v: number | null, decimals: number = 2): string {
  if (v === null) return '—';
  return v.toFixed(decimals);
}

function fmtDelta(hours: number): string {
  if (hours < 1 / 30) return `${Math.round(hours * 60 * 60)}s`;
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function deltaColor(hours: number): string {
  if (hours < 0.1) return '#e8e8e8'; // within-session (~minutes): light grey
  if (hours < 8) return '#d4e8f0'; // short break: light blue
  if (hours < 30) return '#f0e4c8'; // overnight: warm amber
  if (hours < 72) return '#f0d4a8'; // multi-day: deeper amber
  return '#f0c4b0'; // long break: warm coral
}

function statusBadge(status: string): string {
  const colors: Record<string, string> = {
    'Not started': '#888',
    'Hesitant': '#c63',
    'Learning': '#b90',
    'Solid': '#6a4',
    'Automatic': '#2a7',
  };
  const color = colors[status] || '#888';
  return `<span class="status-badge" style="background:${color}">${status}</span>`;
}

function colorCell(color: string): string {
  return `<div class="color-swatch" style="background:${color}"></div>`;
}

function generateReviewHTML(
  sessionName: string,
  results: PatternResult[],
): string {
  const cfg = DEFAULT_CONFIG;

  let patternSections = '';
  for (const result of results) {
    const { pattern, snapshots, projection } = result;
    const sparkline = generateSparkline(snapshots, projection);

    // Step table
    let stepRows = '';
    for (const snap of snapshots) {
      stepRows += `
      <tr>
        <td>${snap.step}</td>
        <td style="background:${deltaColor(snap.event.deltaHours)}">${
        fmtDelta(snap.event.deltaHours)
      }</td>
        <td>${snap.event.responseMs}ms</td>
        <td class="${snap.event.correct ? 'correct' : 'wrong'}">${
        snap.event.correct ? 'Yes' : 'No'
      }</td>
        <td>${fmt(snap.ewma, 0)}ms</td>
        <td>${fmt(snap.stability, 1)}h</td>
        <td>${fmt(snap.recall)}</td>
        <td>${fmt(snap.speedScore)}</td>
        <td>${colorCell(snap.heatmapColor)}</td>
        <td>${statusBadge(snap.status)}</td>
      </tr>`;
    }

    // Projection table
    let projRows = '';
    if (projection.length > 0) {
      for (const p of projection) {
        projRows += `
        <tr>
          <td>${p.label}</td>
          <td>${fmt(p.recall)}</td>
          <td>${fmt(p.freshness)}</td>
          <td>${fmt(p.speedScore)}</td>
          <td>${colorCell(p.heatmapColor)}</td>
          <td>${statusBadge(p.status)}</td>
        </tr>`;
      }
    }

    const noteId = escapeHtml(pattern.name);

    patternSections += `
    <div class="pattern-section">
      <div class="pattern-header">
        <div class="pattern-title">
          <h2>${escapeHtml(pattern.name)}</h2>
          <span class="pattern-desc">${escapeHtml(pattern.description)}</span>
        </div>
        <div class="sparkline">${sparkline}</div>
      </div>

      <table class="step-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Delta</th>
            <th>Response</th>
            <th>Correct?</th>
            <th>EWMA</th>
            <th>Stability</th>
            <th>Recall</th>
            <th>Speed</th>
            <th>Color</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${stepRows}
        </tbody>
      </table>

      ${
      projection.length > 0
        ? `
      <div class="projection-section">
        <h3>Future projection</h3>
        <table class="projection-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Recall</th>
              <th>Freshness</th>
              <th>Speed</th>
              <th>Color</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${projRows}
          </tbody>
        </table>
      </div>`
        : ''
    }

      <div class="pattern-notes">
        <textarea id="${noteId}" placeholder="Notes on ${
      escapeHtml(pattern.name)
    }..." rows="2"></textarea>
      </div>
    </div>`;
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Item Model Diagnostic: ${
    escapeHtml(sessionName)
  }</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; margin: 0; padding: 1rem;
         background: #f5f5f5; font-size: 13px; }
  h1 { font-size: 1.4rem; margin: 0 0 0.5rem; }
  h2 { font-size: 1.1rem; margin: 0; }
  h3 { font-size: 0.9rem; margin: 0.5rem 0 0.25rem; color: #555; }
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
  .config-summary {
    font-size: 0.8rem; color: #666; margin-bottom: 1rem;
    font-family: monospace;
  }
  .config-summary span { margin-right: 1rem; }
  .pattern-section {
    background: #fff; border: 1px solid #ddd; border-radius: 6px;
    padding: 1rem; margin-bottom: 1.5rem;
  }
  .pattern-header {
    display: flex; align-items: flex-start; justify-content: space-between;
    margin-bottom: 0.75rem; gap: 1rem;
  }
  .pattern-title { flex: 1; }
  .pattern-desc { color: #666; font-size: 0.85rem; display: block; margin-top: 4px; }
  .sparkline { flex-shrink: 0; border: 1px solid #eee; border-radius: 4px;
               background: #fafafa; padding: 2px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ddd; padding: 4px 8px; text-align: center;
           font-size: 0.82rem; }
  th { background: #e8e8e8; font-size: 0.78rem; white-space: nowrap; }
  .step-table th:first-child { width: 30px; }
  .correct { color: #2a7; font-weight: bold; }
  .wrong { color: #c63; font-weight: bold; }
  .color-swatch {
    width: 20px; height: 20px; border-radius: 3px;
    display: inline-block; border: 1px solid rgba(0,0,0,0.1);
  }
  .status-badge {
    display: inline-block; padding: 1px 6px; border-radius: 3px;
    font-size: 0.72rem; font-weight: bold; color: #fff;
    white-space: nowrap;
  }
  .projection-section { margin-top: 0.5rem; }
  .projection-table { width: auto; }
  .pattern-notes { margin-top: 0.5rem; }
  .pattern-notes textarea {
    width: 100%; min-height: 40px; resize: vertical;
    font-family: system-ui, sans-serif; font-size: .8rem;
    border: 1px solid #ccc; border-radius: 4px; padding: .3rem;
    field-sizing: content;
  }
  .pattern-notes textarea:focus { outline: 2px solid #4a90d9; border-color: transparent; }
  .legend-section {
    font-size: 0.8rem; margin-bottom: 1rem; padding: 0.5rem;
    background: #fff; border: 1px solid #ddd; border-radius: 4px;
    max-width: 700px;
  }
  .legend-section h3 { margin: 0 0 0.5rem; }
  .legend-row { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 4px; }
  .legend-swatch {
    width: 16px; height: 16px; border-radius: 2px;
    display: inline-block; border: 1px solid rgba(0,0,0,0.1);
    flex-shrink: 0;
  }
</style></head>
<body>

<h1>Item Model Diagnostic: ${escapeHtml(sessionName)}</h1>

<div class="toolbar">
  <button id="btn-copy" title="Copy all notes to clipboard">Copy notes</button>
  <button id="btn-save" title="Download notes as .md file">Save .md</button>
  <span class="status" id="status"></span>
</div>

<div class="config-summary">
  <span>baseline=${cfg.minTime}ms</span>
  <span>speedTarget=${cfg.speedTarget}ms</span>
  <span>alpha=${cfg.ewmaAlpha}</span>
  <span>initialStab=${cfg.initialStability}h</span>
  <span>maxStab=${cfg.maxStability}h</span>
  <span>growthBase=${cfg.stabilityGrowthBase}</span>
  <span>decayOnWrong=${cfg.stabilityDecayOnWrong}</span>
  <span>speedBonusMax=${cfg.speedBonusMax}</span>
  <span>selfCorrection&lt;${cfg.selfCorrectionThreshold}ms</span>
  <span>freshnessThreshold=${cfg.freshnessThreshold}</span>
</div>

<details open>
<summary style="cursor:pointer; font-weight:bold; margin-bottom:0.5rem;">How it works</summary>
<div class="legend-section">
  <h3>Model overview</h3>
  <p style="margin:0 0 0.5rem;"><strong>EWMA</strong> — exponentially weighted moving average of response times (alpha=${cfg.ewmaAlpha}).</p>
  <p style="margin:0 0 0.5rem;"><strong>Stability</strong> — half-life in hours. P(recall) = 2<sup>&minus;t/S</sup> where t = hours since last correct.</p>
  <p style="margin:0 0 0.5rem;"><strong>Speed score</strong> — maps EWMA to [0,1]. ${cfg.minTime}ms &rarr; 1.0, ${cfg.speedTarget}ms &rarr; 0.5. Status: &ge; 0.9 Automatic, &ge; 0.7 Solid, &ge; 0.3 Learning, &lt; 0.3 Hesitant.</p>
  <p style="margin:0 0 0.5rem;"><strong>Freshness</strong> — independent dimension. Fades heatmap color saturation as recall decays, but does not affect mastery status.</p>
  <h3 style="margin-top:0.75rem;">Heatmap color encoding</h3>
  <div class="legend-row">${
    colorCell('hsl(125,48%,33%)')
  }<span>Speed &gt; 0.9 — Automatic</span></div>
  <div class="legend-row">${
    colorCell('hsl(80,35%,40%)')
  }<span>Speed &gt; 0.75</span></div>
  <div class="legend-row">${
    colorCell('hsl(60,40%,46%)')
  }<span>Speed &gt; 0.55</span></div>
  <div class="legend-row">${
    colorCell('hsl(48,50%,52%)')
  }<span>Speed &gt; 0.3 — Learning</span></div>
  <div class="legend-row">${
    colorCell('hsl(40,60%,58%)')
  }<span>Speed &le; 0.3 — Hesitant</span></div>
  <div class="legend-row">${
    colorCell(NO_DATA_COLOR)
  }<span>No data — Not started</span></div>
  <p style="margin:0.5rem 0 0; font-size:0.78rem; color:#666;">Freshness fades saturation &amp; lightness toward grey as recall decays.</p>
  <h3 style="margin-top:0.75rem;">Sparkline</h3>
  <p style="margin:0; font-size:0.78rem; color:#666;">Green solid line = speed score. Orange dashed = projected decay. Background bands: Hesitant / Learning / Solid / Automatic.</p>
</div>
</details>

${patternSections}

<script>
var SESSION = ${JSON.stringify(sessionName)};
var PATTERNS = ${JSON.stringify(results.map((r) => r.pattern.name))};
var storagePrefix = 'item-model-' + SESSION + '-';

function loadNotes() {
  for (var i = 0; i < PATTERNS.length; i++) {
    var ta = document.getElementById(PATTERNS[i]);
    if (!ta) continue;
    var saved = localStorage.getItem(storagePrefix + PATTERNS[i]);
    if (saved) ta.value = saved;
  }
}

document.addEventListener('input', function(e) {
  if (e.target.tagName !== 'TEXTAREA') return;
  localStorage.setItem(storagePrefix + e.target.id, e.target.value);
});

loadNotes();

function buildSummary() {
  var lines = ['## Item Model Diagnostic — ' + SESSION, ''];
  for (var i = 0; i < PATTERNS.length; i++) {
    var ta = document.getElementById(PATTERNS[i]);
    if (ta && ta.value.trim()) {
      lines.push('**' + PATTERNS[i] + ':** ' + ta.value.trim());
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
    }).catch(function() { fallbackCopy(text, label); });
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

document.getElementById('btn-copy').addEventListener('click', function() {
  copyToClipboard(buildSummary(), 'notes');
});

document.getElementById('btn-save').addEventListener('click', function() {
  var text = buildSummary();
  var blob = new Blob([text], { type: 'text/markdown' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = SESSION + '-item-model.md';
  a.click();
  URL.revokeObjectURL(a.href);
  showStatus('Saved!');
});
</script>
</body></html>`;
}

// ---------------------------------------------------------------------------
// Session management (same pattern as recommendation-diagnostic.ts)
// ---------------------------------------------------------------------------

type Session = {
  generated: string; // ISO timestamp
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

function writeSession(name: string, session: Session): void {
  writeFileSync(sessionFile(name), JSON.stringify(session, null, 2) + '\n');
}

function listSessions(): string[] {
  if (!existsSync(DIAG_DIR)) return [];
  return readdirSync(DIAG_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(sessionFile(d.name)))
    .map((d) => d.name)
    .filter((name) => {
      // Only list item-model sessions (not recommendation-diagnostic ones)
      try {
        const s = JSON.parse(readFileSync(sessionFile(name), 'utf-8'));
        return 'generated' in s && !('rounds' in s);
      } catch {
        return false;
      }
    });
}

function autoSessionName(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `item-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
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
// Generate report
// ---------------------------------------------------------------------------

function generateReport(sessionName: string): void {
  const dir = sessionDir(sessionName);
  mkdirSync(dir, { recursive: true });

  console.log(
    `Generating item model diagnostic for ${PATTERNS.length} patterns...`,
  );

  const cfg = DEFAULT_CONFIG;
  const results: PatternResult[] = [];

  for (const pattern of PATTERNS) {
    console.log(`  ${pattern.name}...`);
    results.push(replayPattern(pattern, cfg));
  }

  // Write session file
  writeSession(sessionName, { generated: new Date().toISOString() });

  // Write review HTML
  const html = generateReviewHTML(sessionName, results);
  const reviewPath = path.join(dir, 'review.html');
  writeFileSync(reviewPath, html);
  console.log(`Generated ${reviewPath}`);

  return;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function usage(): never {
  console.log(
    `Item-level adaptive model diagnostic — session-based visualization.

Usage:
  deno task item-model [new] [session-name]   Generate report
  deno task item-model view [session]          Open report
  deno task item-model list                    List sessions
`,
  );
  process.exit(1);
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'new';
  if (command === '--help' || command === '-h') usage();

  switch (command) {
    case 'new': {
      const sessionName = args[1] || autoSessionName();

      if (existsSync(sessionFile(sessionName))) {
        console.error(
          `Session "${sessionName}" already exists. Choose a different name or use "view" to reopen.`,
        );
        process.exit(1);
      }

      generateReport(sessionName);
      const reviewPath = path.join(sessionDir(sessionName), 'review.html');
      console.log(`\nSession "${sessionName}" created.`);
      openInBrowser(reviewPath);
      break;
    }

    case 'view': {
      let sessionName = args[1];
      if (!sessionName) {
        const sessions = listSessions();
        if (sessions.length === 0) {
          console.error('No item-model sessions found.');
          process.exit(1);
        }
        sessionName = sessions[sessions.length - 1];
        console.log(`Using session: ${sessionName}`);
      }

      // Regenerate HTML (patterns may have changed)
      generateReport(sessionName);
      const reviewPath = path.join(sessionDir(sessionName), 'review.html');
      openInBrowser(reviewPath);
      console.log(`Opened ${reviewPath}`);
      break;
    }

    case 'list': {
      const sessions = listSessions();
      if (sessions.length === 0) {
        console.log('No item-model sessions found.');
      } else {
        for (const s of sessions) {
          const session = readSession(s);
          console.log(`  ${s}  (generated: ${session.generated})`);
        }
      }
      break;
    }

    default:
      // Bare arg that's not a command — treat as session name for "new"
      if (!command.startsWith('-')) {
        const sessionName = command;
        if (existsSync(sessionFile(sessionName))) {
          console.error(
            `Session "${sessionName}" already exists. Use "view" to reopen.`,
          );
          process.exit(1);
        }
        generateReport(sessionName);
        const reviewPath = path.join(sessionDir(sessionName), 'review.html');
        console.log(`\nSession "${sessionName}" created.`);
        openInBrowser(reviewPath);
      } else {
        console.error(`Unknown command: ${command}\n`);
        usage();
      }
  }
}

main();
