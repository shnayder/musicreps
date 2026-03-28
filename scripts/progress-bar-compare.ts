// Progress bar visual comparison — compact grid of bar variants across scenarios.
// No tables, no per-item details. Just bars side-by-side for design evaluation.
//
// Usage:
//   deno task bar-compare              # Generate and open
//   deno task bar-compare view         # Reopen last

import { spawn } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  computeFreshness,
  computeSpeedScore,
  createAdaptiveSelector,
  createMemoryStorage,
  DEFAULT_CONFIG,
} from '../src/adaptive.ts';
import type { AdaptiveConfig, ItemStats } from '../src/types.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'screenshots', 'diagnostic');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ItemSpec = {
  label: string;
  ewmaMs: number;
  stabilityHours: number;
  lastCorrectHoursAgo: number;
  sampleCount: number;
};

type GroupScenario = {
  name: string;
  description: string;
  items: ItemSpec[];
  unseenCount: number;
};

type ItemResult = {
  speedScore: number | null;
  freshness: number | null;
  heatmapColor: string;
};

type ScenarioResult = {
  scenario: GroupScenario;
  items: ItemResult[];
  automatic: number;
  working: number;
  unseen: number;
  total: number;
};

// ---------------------------------------------------------------------------
// Color functions
// ---------------------------------------------------------------------------

const SPEED_HSL: [number, number, number][] = [
  [40, 60, 58],
  [48, 50, 52],
  [60, 40, 46],
  [80, 35, 40],
  [125, 48, 33],
];
const FRESHNESS_FLOOR = 0.25;
const NEUTRAL_L = 78;
const NO_DATA = 'hsl(30, 4%, 85%)';

function speedLevel(sp: number): number {
  return sp > 0.9 ? 4 : sp > 0.75 ? 3 : sp > 0.55 ? 2 : sp > 0.3 ? 1 : 0;
}

function speedFreshnessColor(
  sp: number | null,
  fr: number | null,
): string {
  if (sp === null || fr === null) return NO_DATA;
  const [h, s, l] = SPEED_HSL[speedLevel(sp)];
  const f = FRESHNESS_FLOOR +
    (1 - FRESHNESS_FLOOR) * Math.max(0, Math.min(1, fr));
  return `hsl(${h}, ${Math.round(s * f)}%, ${
    Math.round(l + (NEUTRAL_L - l) * (1 - f))
  }%)`;
}

function speedOnlyColor(sp: number | null): string {
  if (sp === null) return NO_DATA;
  const [h, s, l] = SPEED_HSL[speedLevel(sp)];
  return `hsl(${h}, ${s}%, ${l}%)`;
}

// ---------------------------------------------------------------------------
// Scenarios (same as group-model-diagnostic)
// ---------------------------------------------------------------------------

const SCENARIOS: GroupScenario[] = [
  {
    name: 'all-unseen',
    description: 'Fresh group, no data yet',
    items: [],
    unseenCount: 12,
  },
  {
    name: 'just-started',
    description: '3 slow items, 9 unseen',
    items: [
      {
        label: 'slow-1',
        ewmaMs: 3200,
        stabilityHours: 4,
        lastCorrectHoursAgo: 0.5,
        sampleCount: 2,
      },
      {
        label: 'slow-2',
        ewmaMs: 2800,
        stabilityHours: 4,
        lastCorrectHoursAgo: 0.3,
        sampleCount: 3,
      },
      {
        label: 'slow-3',
        ewmaMs: 3500,
        stabilityHours: 4,
        lastCorrectHoursAgo: 0.2,
        sampleCount: 1,
      },
    ],
    unseenCount: 9,
  },
  {
    name: 'half-learned',
    description: '6 fast/medium, 6 unseen',
    items: [
      {
        label: 'fast-1',
        ewmaMs: 1200,
        stabilityHours: 48,
        lastCorrectHoursAgo: 4,
        sampleCount: 8,
      },
      {
        label: 'fast-2',
        ewmaMs: 1300,
        stabilityHours: 36,
        lastCorrectHoursAgo: 6,
        sampleCount: 7,
      },
      {
        label: 'med-1',
        ewmaMs: 1800,
        stabilityHours: 24,
        lastCorrectHoursAgo: 8,
        sampleCount: 6,
      },
      {
        label: 'med-2',
        ewmaMs: 2000,
        stabilityHours: 20,
        lastCorrectHoursAgo: 5,
        sampleCount: 5,
      },
      {
        label: 'med-3',
        ewmaMs: 1600,
        stabilityHours: 30,
        lastCorrectHoursAgo: 3,
        sampleCount: 6,
      },
      {
        label: 'med-4',
        ewmaMs: 1900,
        stabilityHours: 18,
        lastCorrectHoursAgo: 10,
        sampleCount: 5,
      },
    ],
    unseenCount: 6,
  },
  {
    name: 'mixed-realistic',
    description: '4 auto + 3 solid + 2 slow + 3 unseen',
    items: [
      {
        label: 'auto-1',
        ewmaMs: 1100,
        stabilityHours: 72,
        lastCorrectHoursAgo: 2,
        sampleCount: 12,
      },
      {
        label: 'auto-2',
        ewmaMs: 1200,
        stabilityHours: 60,
        lastCorrectHoursAgo: 4,
        sampleCount: 10,
      },
      {
        label: 'auto-3',
        ewmaMs: 1150,
        stabilityHours: 48,
        lastCorrectHoursAgo: 3,
        sampleCount: 11,
      },
      {
        label: 'auto-4',
        ewmaMs: 1250,
        stabilityHours: 55,
        lastCorrectHoursAgo: 5,
        sampleCount: 9,
      },
      {
        label: 'solid-1',
        ewmaMs: 1800,
        stabilityHours: 30,
        lastCorrectHoursAgo: 6,
        sampleCount: 7,
      },
      {
        label: 'solid-2',
        ewmaMs: 2000,
        stabilityHours: 24,
        lastCorrectHoursAgo: 8,
        sampleCount: 6,
      },
      {
        label: 'solid-3',
        ewmaMs: 1700,
        stabilityHours: 36,
        lastCorrectHoursAgo: 4,
        sampleCount: 8,
      },
      {
        label: 'slow-1',
        ewmaMs: 3200,
        stabilityHours: 12,
        lastCorrectHoursAgo: 3,
        sampleCount: 4,
      },
      {
        label: 'slow-2',
        ewmaMs: 3500,
        stabilityHours: 8,
        lastCorrectHoursAgo: 2,
        sampleCount: 3,
      },
    ],
    unseenCount: 3,
  },
  {
    name: 'fully-automatic',
    description: '12 fast, high stability, recent',
    items: Array.from({ length: 12 }, (_, i) => ({
      label: `auto-${i + 1}`,
      ewmaMs: 1000 + (i % 4) * 75,
      stabilityHours: 100 + i * 10,
      lastCorrectHoursAgo: 1 + (i % 3),
      sampleCount: 15 + i,
    })),
    unseenCount: 0,
  },
  {
    name: 'mastered-but-slow',
    description: '12 correct, high recall, ~3.5s EWMA',
    items: Array.from({ length: 12 }, (_, i) => ({
      label: `slow-${i + 1}`,
      ewmaMs: 3300 + (i % 4) * 100,
      stabilityHours: 80 + i * 8,
      lastCorrectHoursAgo: 2 + (i % 5),
      sampleCount: 10 + i,
    })),
    unseenCount: 0,
  },
  {
    name: 'decayed',
    description: '3 stable, 2 fading, 7 due. Post-break.',
    items: [
      {
        label: 'stable-1',
        ewmaMs: 1400,
        stabilityHours: 168,
        lastCorrectHoursAgo: 48,
        sampleCount: 12,
      },
      {
        label: 'stable-2',
        ewmaMs: 1300,
        stabilityHours: 120,
        lastCorrectHoursAgo: 24,
        sampleCount: 10,
      },
      {
        label: 'stable-3',
        ewmaMs: 1500,
        stabilityHours: 96,
        lastCorrectHoursAgo: 20,
        sampleCount: 9,
      },
      {
        label: 'fading-1',
        ewmaMs: 1600,
        stabilityHours: 48,
        lastCorrectHoursAgo: 36,
        sampleCount: 8,
      },
      {
        label: 'fading-2',
        ewmaMs: 1800,
        stabilityHours: 36,
        lastCorrectHoursAgo: 30,
        sampleCount: 7,
      },
      {
        label: 'due-1',
        ewmaMs: 1500,
        stabilityHours: 24,
        lastCorrectHoursAgo: 72,
        sampleCount: 6,
      },
      {
        label: 'due-2',
        ewmaMs: 1700,
        stabilityHours: 20,
        lastCorrectHoursAgo: 60,
        sampleCount: 5,
      },
      {
        label: 'due-3',
        ewmaMs: 2000,
        stabilityHours: 16,
        lastCorrectHoursAgo: 80,
        sampleCount: 4,
      },
      {
        label: 'due-4',
        ewmaMs: 1900,
        stabilityHours: 12,
        lastCorrectHoursAgo: 48,
        sampleCount: 4,
      },
      {
        label: 'due-5',
        ewmaMs: 2200,
        stabilityHours: 8,
        lastCorrectHoursAgo: 72,
        sampleCount: 3,
      },
      {
        label: 'due-6',
        ewmaMs: 2500,
        stabilityHours: 10,
        lastCorrectHoursAgo: 96,
        sampleCount: 3,
      },
      {
        label: 'due-7',
        ewmaMs: 2800,
        stabilityHours: 6,
        lastCorrectHoursAgo: 50,
        sampleCount: 2,
      },
    ],
    unseenCount: 0,
  },
  {
    name: 'fast-not-automatic',
    description: '10 at ~1450ms, 2 truly fast',
    items: [
      ...Array.from({ length: 10 }, (_, i) => ({
        label: `near-${i + 1}`,
        ewmaMs: 1400 + (i % 4) * 75,
        stabilityHours: 30 + i * 5,
        lastCorrectHoursAgo: 3 + (i % 5),
        sampleCount: 7 + i,
      })),
      {
        label: 'fast-1',
        ewmaMs: 1100,
        stabilityHours: 80,
        lastCorrectHoursAgo: 1,
        sampleCount: 12,
      },
      {
        label: 'fast-2',
        ewmaMs: 1150,
        stabilityHours: 100,
        lastCorrectHoursAgo: 2,
        sampleCount: 13,
      },
    ],
    unseenCount: 0,
  },
  {
    name: 'mastered-then-away',
    description: 'All fast, 3 weeks without practice',
    items: Array.from({ length: 12 }, (_, i) => ({
      label: `was-auto-${i + 1}`,
      ewmaMs: 1050 + (i % 4) * 50,
      stabilityHours: 60 + i * 10,
      lastCorrectHoursAgo: 500 + i * 10,
      sampleCount: 12 + i,
    })),
    unseenCount: 0,
  },
  {
    name: 'rebuilt-after-break',
    description: '6 re-mastered, 4 due, 2 unseen',
    items: [
      {
        label: 'rebuilt-1',
        ewmaMs: 1500,
        stabilityHours: 8,
        lastCorrectHoursAgo: 1,
        sampleCount: 3,
      },
      {
        label: 'rebuilt-2',
        ewmaMs: 1600,
        stabilityHours: 6,
        lastCorrectHoursAgo: 0.5,
        sampleCount: 2,
      },
      {
        label: 'rebuilt-3',
        ewmaMs: 1400,
        stabilityHours: 10,
        lastCorrectHoursAgo: 2,
        sampleCount: 4,
      },
      {
        label: 'rebuilt-4',
        ewmaMs: 1700,
        stabilityHours: 7,
        lastCorrectHoursAgo: 1.5,
        sampleCount: 3,
      },
      {
        label: 'rebuilt-5',
        ewmaMs: 1550,
        stabilityHours: 9,
        lastCorrectHoursAgo: 0.8,
        sampleCount: 3,
      },
      {
        label: 'rebuilt-6',
        ewmaMs: 1800,
        stabilityHours: 5,
        lastCorrectHoursAgo: 1,
        sampleCount: 2,
      },
      {
        label: 'due-1',
        ewmaMs: 2000,
        stabilityHours: 12,
        lastCorrectHoursAgo: 72,
        sampleCount: 5,
      },
      {
        label: 'due-2',
        ewmaMs: 2200,
        stabilityHours: 8,
        lastCorrectHoursAgo: 48,
        sampleCount: 4,
      },
      {
        label: 'due-3',
        ewmaMs: 2500,
        stabilityHours: 6,
        lastCorrectHoursAgo: 60,
        sampleCount: 3,
      },
      {
        label: 'due-4',
        ewmaMs: 2800,
        stabilityHours: 4,
        lastCorrectHoursAgo: 50,
        sampleCount: 2,
      },
    ],
    unseenCount: 2,
  },
];

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

function buildItemStats(spec: ItemSpec, nowMs: number): ItemStats {
  const lastCorrectAt = nowMs - spec.lastCorrectHoursAgo * 3600000;
  return {
    recentTimes: [spec.ewmaMs],
    ewma: spec.ewmaMs,
    sampleCount: spec.sampleCount,
    lastSeen: lastCorrectAt,
    stability: spec.stabilityHours,
    lastCorrectAt,
  };
}

function analyze(
  scenario: GroupScenario,
  cfg: AdaptiveConfig,
  nowMs: number,
): ScenarioResult {
  const storage = createMemoryStorage();
  createAdaptiveSelector(storage, cfg); // initialize storage
  const items: ItemResult[] = [];
  let automatic = 0, working = 0;

  for (let i = 0; i < scenario.items.length; i++) {
    const spec = scenario.items[i];
    const id = `item-${i}`;
    storage.saveStats(id, buildItemStats(spec, nowMs));
    const sp = computeSpeedScore(spec.ewmaMs, cfg);
    const stats = storage.getStats(id)!;
    const fr = computeFreshness(stats.stability, stats.lastCorrectAt, nowMs);
    items.push({
      speedScore: sp,
      freshness: fr,
      heatmapColor: speedFreshnessColor(sp, fr),
    });
    if (sp !== null && sp >= 0.9) automatic++;
    else working++;
  }

  for (let i = 0; i < scenario.unseenCount; i++) {
    items.push({ speedScore: null, freshness: null, heatmapColor: NO_DATA });
  }

  return {
    scenario,
    items,
    automatic,
    working,
    unseen: scenario.unseenCount,
    total: scenario.items.length + scenario.unseenCount,
  };
}

// ---------------------------------------------------------------------------
// Bar renderers
// ---------------------------------------------------------------------------

type BarVariant = {
  name: string;
  render: (r: ScenarioResult) => string;
};

function sortBySpeed(items: ItemResult[]): ItemResult[] {
  return items.slice().sort((a, b) =>
    (b.speedScore ?? -1) - (a.speedScore ?? -1)
  );
}

function bar(
  items: ItemResult[],
  colorFn: (it: ItemResult) => string,
  cls = 'bar',
  extraClsFn?: (it: ItemResult) => string,
): string {
  const w = items.length > 0 ? 100 / items.length : 0;
  return `<div class="${cls}">` +
    items.map((it) =>
      `<div class="s${
        extraClsFn ? extraClsFn(it) : ''
      }" style="width:${w}%;background:${colorFn(it)}"></div>`
    ).join('') +
    '</div>';
}

// Stale color — warm amber/tan, distinct from speed hues and grey
const STALE_COLOR = 'hsl(32, 80%, 55%)'; // lighter tint of notice/secondary

// Three-zone color: speed if fresh, stale color if not, grey if unseen
function freshOrStaleColor(it: ItemResult): string {
  if (it.speedScore === null) return NO_DATA;
  if (it.freshness !== null && it.freshness < 0.5) return STALE_COLOR;
  return speedOnlyColor(it.speedScore);
}

// Sort: fresh items by speed desc, then stale items, then unseen
function sortFreshStaleUnseen(items: ItemResult[]): ItemResult[] {
  return items.slice().sort((a, b) => {
    const aZone = a.speedScore === null
      ? 2
      : (a.freshness !== null && a.freshness < 0.5)
      ? 1
      : 0;
    const bZone = b.speedScore === null
      ? 2
      : (b.freshness !== null && b.freshness < 0.5)
      ? 1
      : 0;
    if (aZone !== bZone) return aZone - bZone;
    return (b.speedScore ?? -1) - (a.speedScore ?? -1);
  });
}

// ---------------------------------------------------------------------------
// Group-level freshness (speed-weighted average, with mastery gate)
// ---------------------------------------------------------------------------

type GroupFreshness = {
  /** Speed-weighted average freshness across seen items (null if none seen) */
  weightedFreshness: number | null;
  /** Is the group at solid+ level (speed >= 0.7)? */
  isSolid: boolean;
  /** Should we show a freshness indicator? (solid + has data) */
  showIndicator: boolean;
};

function computeGroupFreshness(r: ScenarioResult): GroupFreshness {
  let sumWeighted = 0, sumWeights = 0;
  for (const it of r.items) {
    if (it.speedScore === null) continue;
    const weight = Math.max(it.speedScore, 0.1);
    sumWeighted += (it.freshness ?? 0) * weight;
    sumWeights += weight;
  }
  const weightedFreshness = sumWeights > 0 ? sumWeighted / sumWeights : null;

  // Gate: compute group level speed as p10 (matching real algorithm)
  const speeds = r.items.map((it) => it.speedScore ?? 0).sort((a, b) => a - b);
  const p10idx = Math.floor(speeds.length * 0.1);
  const levelSpeed = speeds.length > 0 ? speeds[p10idx] : 0;
  const isSolid = levelSpeed >= 0.7;

  return {
    weightedFreshness,
    isSolid,
    showIndicator: isSolid && weightedFreshness !== null,
  };
}

// ---------------------------------------------------------------------------
// Freshness indicator renderers
// ---------------------------------------------------------------------------

/** Binary: "Review" pill or nothing. Icon variant uses ↻. */
function binaryReviewIndicator(gf: GroupFreshness): string {
  if (!gf.showIndicator) return '';
  if (gf.weightedFreshness! >= 0.5) return '';
  const title = `freshness: ${gf.weightedFreshness!.toFixed(2)}`;
  return `<span class="fi-pill review" title="${title}">\u21bb Review</span>` +
    `<span class="fi-icon review" title="${title}">\u21bb</span>`;
}

/** Trinary: "Review soon" / "Overdue" pill, or nothing. */
function trinaryReviewIndicator(gf: GroupFreshness): string {
  if (!gf.showIndicator) return '';
  const f = gf.weightedFreshness!;
  const title = `freshness: ${f.toFixed(2)}`;
  if (f >= 0.5) return '';
  if (f >= 0.25) {
    return `<span class="fi-pill soon" title="${title}">Review soon</span>`;
  }
  return `<span class="fi-pill overdue" title="${title}">Overdue</span>`;
}

/** Countdown ring: SVG donut showing fill = freshness. */
function countdownRing(gf: GroupFreshness): string {
  const size = 14;
  const stroke = 2.5;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const circumference = 2 * Math.PI * r;

  if (!gf.showIndicator) {
    // Grey empty ring for below-solid groups
    return `<svg class="fi-ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="#ddd" stroke-width="${stroke}"/>
    </svg>`;
  }

  const f = Math.max(0, Math.min(1, gf.weightedFreshness!));
  const filled = circumference * f;
  const gap = circumference - filled;

  // Color: green when full, amber when half, warm red when empty
  let hue: number, sat: number, lgt: number;
  if (f > 0.6) {
    hue = 125;
    sat = 40;
    lgt = 38;
  } else if (f > 0.3) {
    hue = 40;
    sat = 55;
    lgt = 45;
  } else {
    hue = 12;
    sat = 55;
    lgt = 45;
  }
  const color = `hsl(${hue}, ${sat}%, ${lgt}%)`;

  // Emphasize when nearly empty
  const emphasis = f < 0.25 ? ' fi-ring-urgent' : '';
  const title = `freshness: ${f.toFixed(2)}`;

  // Rotate -90deg so fill starts at top, draws clockwise
  return `<svg class="fi-ring${emphasis}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" title="${title}">
    <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="#e0e0e0" stroke-width="${stroke}"/>
    <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
      stroke-dasharray="${filled} ${gap}" stroke-linecap="round"
      transform="rotate(-90 ${cx} ${cx})"/>
  </svg>`;
}

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

function speedBar(r: ScenarioResult): string {
  return bar(sortBySpeed(r.items), (it) => speedOnlyColor(it.speedScore));
}

const VARIANTS: BarVariant[] = [
  {
    name: 'Current (speed + freshness fade)',
    render: (r) => bar(sortBySpeed(r.items), (it) => it.heatmapColor),
  },
  {
    name: 'Speed only',
    render: (r) => speedBar(r),
  },
  {
    name: 'Fresh / stale / unseen',
    render: (r) => bar(sortFreshStaleUnseen(r.items), freshOrStaleColor),
  },
  {
    name: 'Speed + binary review (pill & icon)',
    render: (r) => {
      const gf = computeGroupFreshness(r);
      return `<div class="bar-plus">${speedBar(r)}${
        binaryReviewIndicator(gf)
      }</div>`;
    },
  },
  {
    name: 'Speed + trinary (soon / overdue)',
    render: (r) => {
      const gf = computeGroupFreshness(r);
      return `<div class="bar-plus">${speedBar(r)}${
        trinaryReviewIndicator(gf)
      }</div>`;
    },
  },
  {
    name: 'Speed + countdown ring',
    render: (r) => {
      const gf = computeGroupFreshness(r);
      return `<div class="bar-plus">${speedBar(r)}${countdownRing(gf)}</div>`;
    },
  },
];

// ---------------------------------------------------------------------------
// HTML generation
// ---------------------------------------------------------------------------

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function generateHTML(results: ScenarioResult[]): string {
  // Column headers
  const headers = results.map((r) => {
    const gf = computeGroupFreshness(r);
    const fStr = gf.weightedFreshness !== null
      ? gf.weightedFreshness.toFixed(2)
      : '--';
    const gate = gf.isSolid ? 'solid+' : 'below';
    return `<th><div class="col-name">${esc(r.scenario.name)}</div>` +
      `<div class="col-desc">${esc(r.scenario.description)}</div>` +
      `<div class="col-counts">${r.automatic}A ${r.working}W ${r.unseen}U</div>` +
      `<div class="col-counts">fresh: ${fStr} (${gate})</div></th>`;
  }).join('\n');

  // One row per variant
  const rows = VARIANTS.map((v) => {
    const cells = results.map((r) => `<td>${v.render(r)}</td>`).join('');
    return `<tr><th class="row-label">${esc(v.name)}</th>${cells}</tr>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>Progress Bar Comparison</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: system-ui, sans-serif; margin: 0; padding: 1rem;
    background: #f5f5f5; font-size: 13px;
  }
  h1 { font-size: 1.3rem; margin: 0 0 1rem; }
  table { border-collapse: collapse; }
  th, td {
    border: 1px solid #ddd; padding: 8px 10px; text-align: left;
    vertical-align: middle;
  }
  thead th {
    background: #e8e8e8; min-width: 130px; vertical-align: top;
  }
  .col-name { font-size: 0.85rem; font-weight: 700; }
  .col-desc { font-size: 0.72rem; color: #666; margin-top: 2px; }
  .col-counts {
    font-size: 0.72rem; font-family: monospace; margin-top: 3px; color: #555;
  }
  .row-label {
    background: #f0f0f0; font-size: 0.8rem; font-weight: 600;
    white-space: nowrap; position: sticky; left: 0; z-index: 1;
  }
  td { background: #fff; }

  /* bars */
  .bar {
    display: flex; height: 10px; border-radius: 3px;
    overflow: hidden; background: #e8e8e8; width: 120px;
  }
  .s { min-width: 1px; }

  /* bar + indicator layouts */
  .bar-plus {
    display: flex; align-items: center; gap: 6px;
  }

  /* freshness indicators — pills */
  .fi-pill {
    display: inline-block; font-size: 0.65rem; font-weight: 600;
    padding: 1px 6px; border-radius: 3px; white-space: nowrap;
    line-height: 1.4;
  }
  .fi-pill.review { background: hsl(35, 50%, 88%); color: hsl(30, 50%, 35%); }
  .fi-pill.soon { background: hsl(40, 55%, 90%); color: hsl(35, 55%, 35%); }
  .fi-pill.overdue { background: hsl(12, 55%, 88%); color: hsl(10, 50%, 38%); font-weight: 700; }

  /* freshness indicators — icon */
  .fi-icon {
    font-size: 13px; line-height: 1; flex-shrink: 0; margin-left: 2px;
  }
  .fi-icon.review { color: hsl(30, 50%, 45%); }

  /* freshness indicators — countdown ring */
  .fi-ring { flex-shrink: 0; }
  .fi-ring-urgent { filter: drop-shadow(0 0 2px hsl(12, 50%, 55%)); }
  }

  /* scrollable wrapper */
  .table-wrap { overflow-x: auto; max-width: 100%; }

  /* notes */
  .notes { margin-top: 1.5rem; }
  .notes textarea {
    width: 100%; min-height: 80px; resize: vertical;
    font-family: system-ui, sans-serif; font-size: .85rem;
    border: 1px solid #ccc; border-radius: 4px; padding: .5rem;
    field-sizing: content;
  }
</style>
</head><body>

<h1>Progress Bar Comparison</h1>

<div class="table-wrap">
<table>
  <thead>
    <tr><th class="row-label">Variant</th>${headers}</tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
</table>
</div>

<div class="notes">
  <textarea id="notes" placeholder="Notes..."></textarea>
</div>

<script>
var ta = document.getElementById('notes');
var key = 'bar-compare-notes';
var saved = localStorage.getItem(key);
if (saved) ta.value = saved;
ta.addEventListener('input', function() {
  localStorage.setItem(key, ta.value);
});
</script>
</body></html>`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function openInBrowser(filePath: string): void {
  try {
    spawn('open', [filePath], { detached: true, stdio: 'ignore' }).unref();
  } catch {
    console.log(`Open manually: ${filePath}`);
  }
}

function main() {
  const outPath = path.join(OUT_DIR, 'bar-compare.html');
  mkdirSync(OUT_DIR, { recursive: true });

  const cfg = DEFAULT_CONFIG;
  const nowMs = Date.now();
  const results = SCENARIOS.map((s) => analyze(s, cfg, nowMs));

  writeFileSync(outPath, generateHTML(results));
  console.log(`Generated ${outPath}`);

  if (process.argv[2] !== '--no-open') {
    openInBrowser(outPath);
  }
}

main();
