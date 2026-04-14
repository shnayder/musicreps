// Item-selection bucketing diagnostic.
//
// For each hand-authored scenario, feeds a list of items (with simulated
// speed/freshness values) through `computeBuckets` from src/adaptive.ts
// and renders the resulting active / review / fastFresh / overflow buckets
// as rows of colored dots. The dot color uses the real
// `getSpeedFreshnessColor` encoding so the output matches the in-app
// per-item stats view.
//
// This is a diagnostic aid for understanding which items the selector
// actually draws from on a given trial — no random draws are simulated.
// Overflow items (items that don't fit within the dynamic active cap —
// see `effectiveActiveCap` — or the review cap) are the key thing to
// notice: they are never drawn, even though they've been started.
//
// Usage:
//   deno task item-selection         # generate report
//   open screenshots/item-selection-diagnostic.html
//
// The output path is gitignored (`screenshots/` is in .gitignore).

import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  computeBuckets,
  DEFAULT_CONFIG,
  effectiveActiveCap,
  M_REVIEW,
  N_ACTIVE,
  N_ACTIVE_EXPANDED,
} from '../src/adaptive.ts';
import { getSpeedFreshnessColor } from '../src/stats-display.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'screenshots', 'item-selection-diagnostic.html');

// ---------------------------------------------------------------------------
// Scenario types
// ---------------------------------------------------------------------------

/** One simulated item. `null` speed = unseen. */
type SimItem = {
  /** speedScore in [0, 1], or null for unseen. */
  speed: number | null;
  /** freshness in [0, 1], or null for unseen / no stability data. */
  freshness: number | null;
};

type Scenario = {
  name: string;
  description: string;
  /** Items in learning order — matches the `orderedItems` walk. */
  items: SimItem[];
};

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------
//
// Speed reference:
//   null       — unseen
//   < 0.9      — active-learning bucket (still learning)
//   >= 0.9     — fast: then fresh-or-review depending on freshness
// Freshness reference:
//   >= 0.5     — fresh
//   < 0.5      — due for review
//
// Levels are modeled on a 15-item "fret range" level (e.g. guitar fretboard
// frets 0–4 × 3 strings). Real levels are larger; 15 is enough to trigger
// the N_ACTIVE=5 / M_REVIEW=10 caps.

const SCENARIOS: Scenario[] = [
  {
    name: 'Just starting',
    description: 'Zero reps. Every item is unseen.',
    items: Array.from({ length: 15 }, () => ({ speed: null, freshness: null })),
  },

  {
    name: 'First 3 slow reps',
    description:
      'User has answered the first 3 items once each. Still slow, rest unseen.',
    items: [
      { speed: 0.3, freshness: 0.95 },
      { speed: 0.25, freshness: 0.95 },
      { speed: 0.35, freshness: 0.95 },
      ...Array.from({ length: 12 }, () => ({ speed: null, freshness: null })),
    ],
  },

  {
    name: '8 items started, none fast',
    description:
      'User has touched 8 items; all still below the Automatic line. ' +
      'Review is empty so the active cap expands to 7 — only item 8 ' +
      'is overflow this trial.',
    items: [
      { speed: 0.4, freshness: 0.9 },
      { speed: 0.55, freshness: 0.9 },
      { speed: 0.3, freshness: 0.9 },
      { speed: 0.7, freshness: 0.9 },
      { speed: 0.5, freshness: 0.9 },
      { speed: 0.45, freshness: 0.9 },
      { speed: 0.35, freshness: 0.9 },
      { speed: 0.6, freshness: 0.9 },
      ...Array.from({ length: 7 }, () => ({ speed: null, freshness: null })),
    ],
  },

  {
    name: '10 items started, none fast',
    description:
      '10 items below the Automatic line, nothing to review. Active ' +
      'caps at ' + N_ACTIVE_EXPANDED + ' — items 8, 9, 10 overflow. ' +
      'Still drills only the first 7 until one graduates.',
    items: [
      { speed: 0.4, freshness: 0.9 },
      { speed: 0.55, freshness: 0.9 },
      { speed: 0.3, freshness: 0.9 },
      { speed: 0.7, freshness: 0.9 },
      { speed: 0.5, freshness: 0.9 },
      { speed: 0.45, freshness: 0.9 },
      { speed: 0.35, freshness: 0.9 },
      { speed: 0.6, freshness: 0.9 },
      { speed: 0.5, freshness: 0.9 },
      { speed: 0.4, freshness: 0.9 },
      ...Array.from({ length: 5 }, () => ({ speed: null, freshness: null })),
    ],
  },

  {
    name: 'Half mastered, half still learning',
    description:
      '7 items fast-and-fresh, 5 still in active learning, 3 unseen. ' +
      'Active bucket fills from the 5 slow + overflow-trigger on any ' +
      'unseen — here there are exactly 5 slow so no overflow yet.',
    items: [
      { speed: 0.95, freshness: 0.9 },
      { speed: 0.95, freshness: 0.9 },
      { speed: 0.92, freshness: 0.9 },
      { speed: 0.94, freshness: 0.9 },
      { speed: 0.91, freshness: 0.9 },
      { speed: 0.93, freshness: 0.9 },
      { speed: 0.97, freshness: 0.9 },
      { speed: 0.6, freshness: 0.9 },
      { speed: 0.55, freshness: 0.9 },
      { speed: 0.4, freshness: 0.9 },
      { speed: 0.7, freshness: 0.9 },
      { speed: 0.5, freshness: 0.9 },
      { speed: null, freshness: null },
      { speed: null, freshness: null },
      { speed: null, freshness: null },
    ],
  },

  {
    name: 'Mostly mastered, 3 stale',
    description:
      '12 items previously mastered; 3 of them have decayed below the ' +
      'freshness threshold and drop into the review bucket. No active ' +
      'items, so 70% of trials still go to active → review fallback.',
    items: [
      { speed: 0.95, freshness: 0.3 },
      { speed: 0.92, freshness: 0.25 },
      { speed: 0.94, freshness: 0.4 },
      { speed: 0.95, freshness: 0.9 },
      { speed: 0.93, freshness: 0.9 },
      { speed: 0.95, freshness: 0.9 },
      { speed: 0.94, freshness: 0.9 },
      { speed: 0.92, freshness: 0.9 },
      { speed: 0.96, freshness: 0.9 },
      { speed: 0.93, freshness: 0.9 },
      { speed: 0.95, freshness: 0.9 },
      { speed: 0.94, freshness: 0.9 },
      { speed: null, freshness: null },
      { speed: null, freshness: null },
      { speed: null, freshness: null },
    ],
  },

  {
    name: 'Massively stale (review cap hit)',
    description: '12 items stale — review is capped at ' + M_REVIEW +
      ', so 2 overflow. No active bucket, so review + fastFresh are ' +
      'the only draws.',
    items: [
      { speed: 0.95, freshness: 0.2 },
      { speed: 0.92, freshness: 0.15 },
      { speed: 0.94, freshness: 0.3 },
      { speed: 0.95, freshness: 0.1 },
      { speed: 0.93, freshness: 0.25 },
      { speed: 0.95, freshness: 0.4 },
      { speed: 0.94, freshness: 0.2 },
      { speed: 0.92, freshness: 0.15 },
      { speed: 0.96, freshness: 0.3 },
      { speed: 0.93, freshness: 0.1 },
      { speed: 0.95, freshness: 0.25 },
      { speed: 0.94, freshness: 0.4 },
      { speed: 0.95, freshness: 0.9 },
      { speed: 0.92, freshness: 0.9 },
      { speed: 0.94, freshness: 0.9 },
    ],
  },

  {
    name: 'All fast and fresh',
    description: 'Every item mastered. Selection falls through to fastFresh.',
    items: Array.from({ length: 15 }, (_, i) => ({
      speed: 0.9 + ((i % 5) * 0.02),
      freshness: 0.9,
    })),
  },

  {
    name: 'Both caps full',
    description: '7 unseen/slow items + 12 stale items. Active caps at ' +
      N_ACTIVE +
      ' (2 overflow), review caps at ' + M_REVIEW + ' (2 overflow). ' +
      'Overflow items are invisible to the selector this trial.',
    items: [
      { speed: 0.3, freshness: 0.9 },
      { speed: 0.4, freshness: 0.9 },
      { speed: 0.5, freshness: 0.9 },
      { speed: 0.35, freshness: 0.9 },
      { speed: 0.45, freshness: 0.9 },
      { speed: 0.55, freshness: 0.9 },
      { speed: 0.4, freshness: 0.9 },
      { speed: 0.95, freshness: 0.2 },
      { speed: 0.92, freshness: 0.15 },
      { speed: 0.94, freshness: 0.3 },
      { speed: 0.95, freshness: 0.1 },
      { speed: 0.93, freshness: 0.25 },
      { speed: 0.95, freshness: 0.4 },
      { speed: 0.94, freshness: 0.2 },
      { speed: 0.92, freshness: 0.15 },
      { speed: 0.96, freshness: 0.3 },
      { speed: 0.93, freshness: 0.1 },
      { speed: 0.95, freshness: 0.25 },
      { speed: 0.94, freshness: 0.4 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Bucketing
// ---------------------------------------------------------------------------

type Category = 'active' | 'review' | 'fastFresh' | 'overflow';

type Classified = {
  id: string;
  index: number;
  item: SimItem;
  category: Category;
};

function classifyScenario(scenario: Scenario): Classified[] {
  const ids = scenario.items.map((_, i) => String(i + 1));
  const speedMap = new Map(
    ids.map((id, i) => [id, scenario.items[i].speed]),
  );
  const freshMap = new Map(
    ids.map((id, i) => [id, scenario.items[i].freshness]),
  );
  const buckets = computeBuckets(
    ids,
    (id) => speedMap.get(id) ?? null,
    (id) => freshMap.get(id) ?? null,
    null,
    DEFAULT_CONFIG.freshnessThreshold,
  );
  const activeSet = new Set(buckets.active);
  const reviewSet = new Set(buckets.review);
  const fastFreshSet = new Set(buckets.fastFresh);

  return ids.map((id, i): Classified => {
    let category: Category = 'overflow';
    if (activeSet.has(id)) category = 'active';
    else if (reviewSet.has(id)) category = 'review';
    else if (fastFreshSet.has(id)) category = 'fastFresh';
    return { id, index: i, item: scenario.items[i], category };
  });
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function dotHtml(c: Classified): string {
  const color = getSpeedFreshnessColor(c.item.speed, c.item.freshness);
  const label = c.index + 1;
  const speedStr = c.item.speed == null ? 'unseen' : c.item.speed.toFixed(2);
  const freshStr = c.item.freshness == null
    ? 'unseen'
    : c.item.freshness.toFixed(2);
  const title =
    `#${label}  speed=${speedStr}  freshness=${freshStr}  (${c.category})`;
  // Dark backgrounds (lightness ≤ 50) need light text; simple parse.
  const m = color.match(/,\s*(\d+)%\s*\)/);
  const darkBg = m ? parseInt(m[1], 10) <= 50 : false;
  const fg = darkBg ? '#fff' : '#222';
  return `<span class="dot" style="background:${color};color:${fg}" title="${title}">${label}</span>`;
}

function dotsRow(items: Classified[]): string {
  if (items.length === 0) return '<span class="empty">—</span>';
  return items.map(dotHtml).join('');
}

function renderScenarioRow(scenario: Scenario): string {
  const classified = classifyScenario(scenario);
  const active = classified.filter((c) => c.category === 'active');
  const review = classified.filter((c) => c.category === 'review');
  const fastFresh = classified.filter((c) => c.category === 'fastFresh');
  const overflow = classified.filter((c) => c.category === 'overflow');
  return `
    <tr>
      <td class="name">
        <div class="scenario-name">${escapeHtml(scenario.name)}</div>
        <div class="scenario-desc">${escapeHtml(scenario.description)}</div>
      </td>
      <td class="dots all">${dotsRow(classified)}</td>
      <td class="dots">${dotsRow(active)}<div class="cap">${active.length}/${
    effectiveActiveCap(review.length)
  }</div></td>
      <td class="dots">${
    dotsRow(review)
  }<div class="cap">${review.length}/${M_REVIEW}</div></td>
      <td class="dots">${dotsRow(fastFresh)}</td>
      <td class="dots overflow">${dotsRow(overflow)}</td>
    </tr>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderReport(): string {
  const rows = SCENARIOS.map(renderScenarioRow).join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Item Selection Diagnostic</title>
<style>
  body {
    font-family: -apple-system, system-ui, sans-serif;
    margin: 2em;
    color: #222;
    background: #fafafa;
  }
  h1 { font-size: 1.4em; margin-bottom: 0.2em; }
  .subtitle { color: #666; margin-bottom: 1.5em; font-size: 0.9em; }
  .legend {
    display: flex;
    gap: 1.5em;
    margin-bottom: 1em;
    padding: 0.8em 1em;
    background: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    font-size: 0.85em;
  }
  .legend-item { display: flex; align-items: center; gap: 0.4em; }
  table { border-collapse: collapse; width: 100%; background: #fff; }
  th, td {
    border: 1px solid #e0e0e0;
    padding: 0.6em 0.8em;
    vertical-align: top;
  }
  th {
    background: #f0f0f0;
    text-align: left;
    font-size: 0.85em;
    font-weight: 600;
  }
  td.name { width: 18%; }
  .scenario-name { font-weight: 600; margin-bottom: 0.3em; }
  .scenario-desc { font-size: 0.8em; color: #666; line-height: 1.4; }
  td.dots { min-width: 120px; }
  td.dots.all { width: 22%; }
  td.dots.overflow { background: #fff5f5; }
  .dot {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    margin: 2px;
    font-size: 0.7em;
    font-weight: 600;
    cursor: default;
    border: 1px solid rgba(0,0,0,0.1);
  }
  .empty { color: #ccc; font-style: italic; }
  .cap {
    font-size: 0.7em;
    color: #888;
    margin-top: 0.3em;
  }
</style>
</head>
<body>
  <h1>Item Selection — bucket classification per scenario</h1>
  <div class="subtitle">
    Each scenario feeds its items through <code>computeBuckets</code>
    (<code>N_ACTIVE=${N_ACTIVE}</code>..<code>${N_ACTIVE_EXPANDED}</code>
    dynamic, <code>M_REVIEW=${M_REVIEW}</code>,
    <code>freshnessThreshold=${DEFAULT_CONFIG.freshnessThreshold}</code>).
    Active cap expands when review is empty (→ 7) or small (→ 6).
    Hover a dot for speed / freshness / category. Numbers inside dots are
    the item's position in learning order.
  </div>
  <div class="legend">
    <div class="legend-item">
      <span class="dot" style="background:hsl(30,5%,86%);color:#222">·</span>
      unseen
    </div>
    <div class="legend-item">
      <span class="dot" style="background:hsl(40,60%,58%);color:#222">·</span>
      slow
    </div>
    <div class="legend-item">
      <span class="dot" style="background:hsl(80,35%,40%);color:#fff">·</span>
      fast
    </div>
    <div class="legend-item">
      <span class="dot" style="background:hsl(125,48%,33%);color:#fff">·</span>
      automatic
    </div>
    <div class="legend-item">
      <span>Faded saturation/lightness = decayed freshness.</span>
    </div>
    <div class="legend-item">
      <span>Red-tinted column = <b>overflow</b> (never drawn this trial).</span>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Scenario</th>
        <th>Items (learning order)</th>
        <th>Active</th>
        <th>Review</th>
        <th>Fast &amp; fresh</th>
        <th>On deck / overflow</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  mkdirSync(path.dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, renderReport());
  console.log('Wrote ' + path.relative(ROOT, OUTPUT));
}

main();
