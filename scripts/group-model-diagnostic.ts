// Group-level adaptive model diagnostic report generator.
// The "missing middle" between item-model diagnostic (single item, many events)
// and recommendation diagnostic (many groups, cross-group logic).
//
// Given a group with items at various individual states, what group-level
// summary do we get? This determines when the recommendation algorithm tells
// users to move on.
//
// Session-based workflow:
//   deno task group-model [new] [session-name]   # Generate report
//   deno task group-model view [session]          # Open report
//   deno task group-model list                    # List sessions

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
  computeAutomaticityForDisplay,
  computeFreshness,
  computeSpeedScore,
  createAdaptiveSelector,
  createMemoryStorage,
  DEFAULT_CONFIG,
} from '../src/adaptive.ts';
import {
  computeLevelAutomaticity,
  statusLabelFromLevel,
} from '../src/mode-ui-state.ts';
import type { AdaptiveConfig, ItemStats } from '../src/types.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const DIAG_DIR = path.join(ROOT, 'screenshots', 'diagnostic');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ItemSpec = {
  label: string; // e.g. "fast-mastered", "slow-correct"
  ewmaMs: number; // EWMA response time
  stabilityHours: number; // Half-life
  lastCorrectHoursAgo: number; // Hours since last correct → recall/freshness
  sampleCount: number; // Correct answer count
};

type GroupScenario = {
  name: string;
  description: string;
  items: ItemSpec[]; // Seen items
  unseenCount: number; // Additional unseen items
};

type ItemResult = {
  label: string;
  unseen: boolean;
  ewma: number | null;
  stability: number | null;
  recall: number | null;
  freshness: number | null;
  speedScore: number | null;
  automaticity: number | null;
  heatmapColor: string;
  statusClass: 'unseen' | 'needs-work' | 'fluent' | 'automatic';
};

type GroupResult = {
  scenario: GroupScenario;
  items: ItemResult[];
  fluent: number;
  working: number;
  unseen: number;
  levelAutomaticity: number;
  seen: number;
  total: number;
  statusLabel: string;
  statusDetail: string;
};

// ---------------------------------------------------------------------------
// Heatmap color (inline computation, same as item-model diagnostic)
// ---------------------------------------------------------------------------

const SPEED_HSL: [number, number, number][] = [
  [44, 65, 58], // needs work
  [54, 45, 52],
  [68, 30, 46],
  [90, 38, 38],
  [122, 46, 33], // automatic
];
const FRESHNESS_FLOOR = 0.25;
const NEUTRAL_L = 78;
const NO_DATA_COLOR = 'hsl(30, 4%, 85%)';

function getSpeedFreshnessColor(
  speedScore: number | null,
  freshness: number | null,
): string {
  if (speedScore === null || freshness === null) return NO_DATA_COLOR;
  const level = speedScore > 0.8
    ? 4
    : speedScore > 0.6
    ? 3
    : speedScore > 0.4
    ? 2
    : speedScore > 0.2
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
// Scenarios
// ---------------------------------------------------------------------------

const SCENARIOS: GroupScenario[] = [
  {
    name: 'all-unseen',
    description: 'Fresh group — 12 unseen items. No data yet.',
    items: [],
    unseenCount: 12,
  },
  {
    name: 'just-started',
    description:
      '3 seen items (slow ~3s, low stability), 9 unseen. First session.',
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
    description:
      '6 mastered (mix fast/medium), 6 unseen. Mid-progress — consolidation gate likely closed.',
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
        label: 'medium-1',
        ewmaMs: 1800,
        stabilityHours: 24,
        lastCorrectHoursAgo: 8,
        sampleCount: 6,
      },
      {
        label: 'medium-2',
        ewmaMs: 2000,
        stabilityHours: 20,
        lastCorrectHoursAgo: 5,
        sampleCount: 5,
      },
      {
        label: 'medium-3',
        ewmaMs: 1600,
        stabilityHours: 30,
        lastCorrectHoursAgo: 3,
        sampleCount: 6,
      },
      {
        label: 'medium-4',
        ewmaMs: 1900,
        stabilityHours: 18,
        lastCorrectHoursAgo: 10,
        sampleCount: 5,
      },
    ],
    unseenCount: 6,
  },
  {
    name: 'mostly-mastered',
    description:
      '10 mastered (4 fast, 4 medium, 2 slow), 2 unseen. Near-complete.',
    items: [
      {
        label: 'fast-1',
        ewmaMs: 1100,
        stabilityHours: 72,
        lastCorrectHoursAgo: 2,
        sampleCount: 12,
      },
      {
        label: 'fast-2',
        ewmaMs: 1200,
        stabilityHours: 60,
        lastCorrectHoursAgo: 3,
        sampleCount: 10,
      },
      {
        label: 'fast-3',
        ewmaMs: 1150,
        stabilityHours: 80,
        lastCorrectHoursAgo: 1,
        sampleCount: 14,
      },
      {
        label: 'fast-4',
        ewmaMs: 1250,
        stabilityHours: 50,
        lastCorrectHoursAgo: 5,
        sampleCount: 9,
      },
      {
        label: 'medium-1',
        ewmaMs: 1800,
        stabilityHours: 36,
        lastCorrectHoursAgo: 4,
        sampleCount: 7,
      },
      {
        label: 'medium-2',
        ewmaMs: 1900,
        stabilityHours: 30,
        lastCorrectHoursAgo: 6,
        sampleCount: 6,
      },
      {
        label: 'medium-3',
        ewmaMs: 2000,
        stabilityHours: 28,
        lastCorrectHoursAgo: 8,
        sampleCount: 5,
      },
      {
        label: 'medium-4',
        ewmaMs: 1700,
        stabilityHours: 40,
        lastCorrectHoursAgo: 3,
        sampleCount: 8,
      },
      {
        label: 'slow-1',
        ewmaMs: 2800,
        stabilityHours: 20,
        lastCorrectHoursAgo: 2,
        sampleCount: 5,
      },
      {
        label: 'slow-2',
        ewmaMs: 3000,
        stabilityHours: 16,
        lastCorrectHoursAgo: 4,
        sampleCount: 4,
      },
    ],
    unseenCount: 2,
  },
  {
    name: 'fully-automatic',
    description:
      '12 fast items (<1.3s), high stability, recent. Best case — everything green.',
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
    description:
      '12 correct items, high recall, but ~3.5s EWMA. Speed-limited automaticity.',
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
    description:
      '12 items with varying stability. Some still mastered, some now due. Post-break state.',
    items: [
      // Still mastered (recent enough relative to stability)
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
      // Due (elapsed > stability → recall < 0.5)
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
    name: 'mixed-realistic',
    description:
      '4 automatic + 3 fluent-speed + 2 slow + 3 unseen. Typical mid-practice group.',
    items: [
      // Automatic (fast + high recall)
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
      // Fluent speed but not quite automatic
      {
        label: 'fluent-1',
        ewmaMs: 1800,
        stabilityHours: 30,
        lastCorrectHoursAgo: 6,
        sampleCount: 7,
      },
      {
        label: 'fluent-2',
        ewmaMs: 2000,
        stabilityHours: 24,
        lastCorrectHoursAgo: 8,
        sampleCount: 6,
      },
      {
        label: 'fluent-3',
        ewmaMs: 1700,
        stabilityHours: 36,
        lastCorrectHoursAgo: 4,
        sampleCount: 8,
      },
      // Slow
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
    name: 'medium-speed-mix',
    description:
      '6 items at ~1800ms, 3 at ~2200ms, 3 unseen. Mid-speed mix — "Developing" expected.',
    items: [
      ...Array.from({ length: 6 }, (_, i) => ({
        label: `medium-${i + 1}`,
        ewmaMs: 1750 + (i % 3) * 100,
        stabilityHours: 24 + i * 4,
        lastCorrectHoursAgo: 2 + (i % 4),
        sampleCount: 5 + i,
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        label: `slow-${i + 1}`,
        ewmaMs: 2100 + (i % 2) * 200,
        stabilityHours: 12 + i * 3,
        lastCorrectHoursAgo: 4 + i * 2,
        sampleCount: 3 + i,
      })),
    ],
    unseenCount: 3,
  },
  {
    name: 'slow-progress',
    description:
      '4 items at ~2500ms, 4 at ~1600ms, 4 unseen. Mixed slow/medium progress.',
    items: [
      ...Array.from({ length: 4 }, (_, i) => ({
        label: `slow-${i + 1}`,
        ewmaMs: 2400 + (i % 3) * 100,
        stabilityHours: 8 + i * 2,
        lastCorrectHoursAgo: 3 + i,
        sampleCount: 3 + i,
      })),
      ...Array.from({ length: 4 }, (_, i) => ({
        label: `medium-${i + 1}`,
        ewmaMs: 1500 + (i % 3) * 100,
        stabilityHours: 20 + i * 5,
        lastCorrectHoursAgo: 2 + i,
        sampleCount: 6 + i,
      })),
    ],
    unseenCount: 4,
  },
  {
    name: 'nearly-fluent',
    description:
      '10 items at ~1500ms (auto ~0.6-0.7), 2 fast items. Near the fluent/automatic boundary.',
    items: [
      ...Array.from({ length: 10 }, (_, i) => ({
        label: `near-fluent-${i + 1}`,
        ewmaMs: 1400 + (i % 4) * 75,
        stabilityHours: 30 + i * 5,
        lastCorrectHoursAgo: 3 + (i % 5),
        sampleCount: 7 + i,
      })),
      ...Array.from({ length: 2 }, (_, i) => ({
        label: `fast-${i + 1}`,
        ewmaMs: 1100 + i * 50,
        stabilityHours: 80 + i * 20,
        lastCorrectHoursAgo: 1 + i,
        sampleCount: 12 + i,
      })),
    ],
    unseenCount: 0,
  },
  {
    name: 'nearly-automatic',
    description:
      '11 automatic items, 1 lagging behind (~3s). One straggler effect on group status.',
    items: [
      ...Array.from({ length: 11 }, (_, i) => ({
        label: `auto-${i + 1}`,
        ewmaMs: 1050 + (i % 3) * 50,
        stabilityHours: 80 + i * 10,
        lastCorrectHoursAgo: 1 + (i % 4),
        sampleCount: 14 + i,
      })),
      {
        label: 'straggler',
        ewmaMs: 3000,
        stabilityHours: 10,
        lastCorrectHoursAgo: 2,
        sampleCount: 4,
      },
    ],
    unseenCount: 0,
  },
  {
    name: 'rebuilt-after-break',
    description:
      '6 re-mastered (short stability from fresh rebuild), 4 due, 2 unseen. Post-break recovery.',
    items: [
      // Re-mastered: correct again but stability is low (rebuilt, not long-term)
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
      // Due: not yet re-practiced
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
// Build ItemStats from ItemSpec
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

// ---------------------------------------------------------------------------
// Analyze one scenario
// ---------------------------------------------------------------------------

function analyzeScenario(
  scenario: GroupScenario,
  cfg: AdaptiveConfig,
  nowMs: number,
): GroupResult {
  const storage = createMemoryStorage();
  const selector = createAdaptiveSelector(storage, cfg);

  const allItemIds: string[] = [];

  // Populate seen items
  for (let i = 0; i < scenario.items.length; i++) {
    const spec = scenario.items[i];
    const itemId = `item-${i}`;
    allItemIds.push(itemId);
    const stats = buildItemStats(spec, nowMs);
    storage.saveStats(itemId, stats);
  }

  // Unseen items
  for (let i = 0; i < scenario.unseenCount; i++) {
    allItemIds.push(`unseen-${i}`);
  }

  // Compute per-item results
  const items: ItemResult[] = [];
  let fluentCount = 0;
  let workingCount = 0;
  let unseenCount = 0;

  for (let i = 0; i < scenario.items.length; i++) {
    const spec = scenario.items[i];
    const itemId = `item-${i}`;
    const stats = storage.getStats(itemId)!;

    const recall = selector.getRecall(itemId);
    const freshness = computeFreshness(
      stats.stability,
      stats.lastCorrectAt,
      nowMs,
    );
    const speedScore = computeSpeedScore(stats.ewma, cfg);
    const automaticity = computeAutomaticityForDisplay(
      recall,
      speedScore,
      true,
    );
    const heatmapColor = getSpeedFreshnessColor(speedScore, freshness);

    const statusClass: 'unseen' | 'needs-work' | 'fluent' | 'automatic' =
      automaticity === null
        ? 'unseen'
        : automaticity > 0.8
        ? 'automatic'
        : automaticity > 0.4
        ? 'fluent'
        : 'needs-work';

    if (statusClass === 'automatic') fluentCount++;
    else workingCount++;

    items.push({
      label: spec.label,
      unseen: false,
      ewma: stats.ewma,
      stability: stats.stability,
      recall,
      freshness,
      speedScore,
      automaticity,
      heatmapColor,
      statusClass,
    });
  }

  for (let i = 0; i < scenario.unseenCount; i++) {
    unseenCount++;
    items.push({
      label: `unseen-${i + 1}`,
      unseen: true,
      ewma: null,
      stability: null,
      recall: null,
      freshness: null,
      speedScore: null,
      automaticity: null,
      heatmapColor: NO_DATA_COLOR,
      statusClass: 'unseen',
    });
  }

  // Group-level aggregates
  const seen = fluentCount + workingCount;
  const total = allItemIds.length;

  const { level } = computeLevelAutomaticity(
    allItemIds,
    (id) => selector.getAutomaticity(id),
  );

  let statusLabel: string;
  let statusDetail: string;
  if (seen === 0) {
    statusLabel = 'Not started';
    statusDetail = `${total} items to learn`;
  } else {
    statusLabel = statusLabelFromLevel(level);
    statusDetail = `${fluentCount} of ${total} items fluent`;
  }

  return {
    scenario,
    items,
    fluent: fluentCount,
    working: workingCount,
    unseen: unseenCount,
    levelAutomaticity: level,
    seen,
    total,
    statusLabel,
    statusDetail,
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

function fmt(v: number | null, decimals: number = 2): string {
  if (v === null) return '\u2014';
  return v.toFixed(decimals);
}

function colorCell(color: string): string {
  return `<div class="color-swatch" style="background:${color}"></div>`;
}

function miniHeatmap(items: ItemResult[]): string {
  return items
    .map(
      (item) =>
        `<div class="mini-swatch" style="background:${item.heatmapColor}" title="${
          escapeHtml(item.label)
        }"></div>`,
    )
    .join('');
}

function statusBadge(statusClass: string): string {
  const colors: Record<string, string> = {
    unseen: '#888',
    'needs-work': '#c63',
    fluent: '#6a4',
    automatic: '#2a7',
  };
  const color = colors[statusClass] || '#888';
  return `<span class="status-badge" style="background:${color}">${statusClass}</span>`;
}

function generateReviewHTML(
  sessionName: string,
  results: GroupResult[],
): string {
  const cfg = DEFAULT_CONFIG;

  let scenarioSections = '';
  for (const result of results) {
    const { scenario, items } = result;

    // Summary bar
    const summaryHtml = `
      <div class="summary-bar">
        <span class="summary-status">${escapeHtml(result.statusLabel)}</span>
        <span class="summary-detail">${escapeHtml(result.statusDetail)}</span>
        <span class="summary-fwu">
          <span class="fluent">${result.fluent}F</span>
          <span class="working">${result.working}W</span>
          <span class="unseen-count">${result.unseen}U</span>
        </span>
        <span class="summary-ratio">level: ${
      result.levelAutomaticity.toFixed(2)
    }</span>
      </div>`;

    // Mini heatmap
    const heatmapHtml = `
      <div class="mini-heatmap">
        ${miniHeatmap(items)}
      </div>`;

    // Per-item table
    let itemRows = '';
    for (const item of items) {
      itemRows += `
      <tr class="${item.unseen ? 'unseen-row' : ''}">
        <td>${escapeHtml(item.label)}</td>
        <td>${item.ewma !== null ? fmt(item.ewma, 0) + 'ms' : '\u2014'}</td>
        <td>${
        item.stability !== null ? fmt(item.stability, 1) + 'h' : '\u2014'
      }</td>
        <td>${fmt(item.recall)}</td>
        <td>${fmt(item.speedScore)}</td>
        <td>${fmt(item.automaticity)}</td>
        <td>${colorCell(item.heatmapColor)}</td>
        <td>${statusBadge(item.statusClass)}</td>
      </tr>`;
    }

    const noteId = escapeHtml(scenario.name);

    scenarioSections += `
    <div class="scenario-section">
      <div class="scenario-header">
        <h2>${escapeHtml(scenario.name)}</h2>
        <span class="scenario-desc">${escapeHtml(scenario.description)}</span>
      </div>

      ${summaryHtml}
      ${heatmapHtml}

      <table class="item-table">
        <thead>
          <tr>
            <th>Label</th>
            <th>EWMA</th>
            <th>Stability</th>
            <th>Recall</th>
            <th>Speed</th>
            <th>Automaticity</th>
            <th>Color</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${itemRows}
        </tbody>
      </table>

      <div class="scenario-notes">
        <textarea id="${noteId}" placeholder="Notes on ${
      escapeHtml(scenario.name)
    }..." rows="2"></textarea>
      </div>
    </div>`;
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Group Model Diagnostic: ${
    escapeHtml(sessionName)
  }</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; margin: 0; padding: 1rem;
         background: #f5f5f5; font-size: 13px; }
  h1 { font-size: 1.4rem; margin: 0 0 0.5rem; }
  h2 { font-size: 1.1rem; margin: 0; }
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
  .scenario-section {
    background: #fff; border: 1px solid #ddd; border-radius: 6px;
    padding: 1rem; margin-bottom: 1.5rem;
  }
  .scenario-header { margin-bottom: 0.75rem; }
  .scenario-desc { color: #666; font-size: 0.85rem; display: block; margin-top: 4px; }
  .summary-bar {
    display: flex; align-items: center; gap: 1rem;
    padding: 0.5rem 0.75rem; margin-bottom: 0.75rem;
    background: #f8f8f8; border: 1px solid #e0e0e0; border-radius: 4px;
    font-size: 0.9rem;
  }
  .summary-status { font-weight: bold; font-size: 1rem; }
  .summary-detail { color: #555; }
  .summary-fwu { font-family: monospace; }
  .fluent { color: #2a7; font-weight: bold; }
  .working { color: #c63; font-weight: bold; }
  .unseen-count { color: #888; font-weight: bold; }
  .summary-ratio { color: #666; font-size: 0.85rem; margin-left: auto; }
  .mini-heatmap {
    display: flex; gap: 3px; margin-bottom: 0.75rem; flex-wrap: wrap;
  }
  .mini-swatch {
    width: 24px; height: 24px; border-radius: 3px;
    border: 1px solid rgba(0,0,0,0.1);
  }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ddd; padding: 4px 8px; text-align: center;
           font-size: 0.82rem; }
  th { background: #e8e8e8; font-size: 0.78rem; white-space: nowrap; }
  .unseen-row { color: #999; }
  .color-swatch {
    width: 20px; height: 20px; border-radius: 3px;
    display: inline-block; border: 1px solid rgba(0,0,0,0.1);
  }
  .status-badge {
    display: inline-block; padding: 1px 6px; border-radius: 3px;
    font-size: 0.72rem; font-weight: bold; color: #fff;
    white-space: nowrap;
  }
  .scenario-notes { margin-top: 0.5rem; }
  .scenario-notes textarea {
    width: 100%; min-height: 40px; resize: vertical;
    font-family: system-ui, sans-serif; font-size: .8rem;
    border: 1px solid #ccc; border-radius: 4px; padding: .3rem;
    field-sizing: content;
  }
  .scenario-notes textarea:focus { outline: 2px solid #4a90d9; border-color: transparent; }
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

<h1>Group Model Diagnostic: ${escapeHtml(sessionName)}</h1>

<div class="toolbar">
  <button id="btn-copy" title="Copy all notes to clipboard">Copy notes</button>
  <button id="btn-save" title="Download notes as .md file">Save .md</button>
  <span class="status" id="status"></span>
</div>

<div class="config-summary">
  <span>baseline=${cfg.minTime}ms</span>
  <span>target=${cfg.automaticityTarget}ms</span>
  <span>alpha=${cfg.ewmaAlpha}</span>
  <span>initialStab=${cfg.initialStability}h</span>
  <span>maxStab=${cfg.maxStability}h</span>
  <span>recallThreshold=${cfg.recallThreshold}</span>
  <span>automaticityThreshold=${cfg.automaticityThreshold}</span>
</div>

<details open>
<summary style="cursor:pointer; font-weight:bold; margin-bottom:0.5rem;">How it works</summary>
<div class="legend-section">
  <h3>Group-level aggregation</h3>
  <p style="margin:0 0 0.5rem;">Each item in the group has independent freshness (half-life model) and speed (EWMA). Automaticity = speed \u00d7 freshness. Group metrics aggregate these:</p>
  <p style="margin:0 0 0.5rem;"><strong>F/W/U</strong> \u2014 Fluent (automaticity &gt; ${cfg.automaticityThreshold}), Working (automaticity \u2264 ${cfg.automaticityThreshold}), Unseen (no data). Per-item status uses finer scale: automatic (&gt;0.8), fluent (&gt;0.4), needs-work (\u22640.4).</p>
  <p style="margin:0 0 0.5rem;"><strong>Level automaticity</strong> = 10th percentile of per-item automaticity values (unseen \u2192 0). Expansion gate opens at \u2265 ${cfg.expansionThreshold}.</p>
  <p style="margin:0 0 0.5rem;"><strong>Fluent count</strong> \u2014 items with automaticity &gt; ${cfg.automaticityThreshold}. Automaticity = recall \u00d7 speed score.</p>
  <p style="margin:0 0 0.5rem;"><strong>Status label</strong> \u2014 from level automaticity: Automatic (\u22650.8), Fluent (\u22650.5), Developing (\u22650.2), Learning (&lt;0.2), Not started (0 seen).</p>
  <h3 style="margin-top:0.75rem;">Heatmap color encoding</h3>
  <div class="legend-row">${
    colorCell('hsl(122,46%,33%)')
  }<span>Speed &gt; 0.8 (automatic)</span></div>
  <div class="legend-row">${
    colorCell('hsl(90,38%,38%)')
  }<span>Speed &gt; 0.6</span></div>
  <div class="legend-row">${
    colorCell('hsl(68,30%,46%)')
  }<span>Speed &gt; 0.4</span></div>
  <div class="legend-row">${
    colorCell('hsl(54,45%,52%)')
  }<span>Speed &gt; 0.2</span></div>
  <div class="legend-row">${
    colorCell('hsl(44,65%,58%)')
  }<span>Speed \u2264 0.2 (needs work)</span></div>
  <div class="legend-row">${
    colorCell(NO_DATA_COLOR)
  }<span>No data (unseen)</span></div>
  <p style="margin:0.5rem 0 0; font-size:0.78rem; color:#666;">Freshness fades saturation &amp; lightness toward grey as recall decays.</p>
</div>
</details>

${scenarioSections}

<script>
var SESSION = ${JSON.stringify(sessionName)};
var SCENARIOS = ${JSON.stringify(results.map((r) => r.scenario.name))};
var storagePrefix = 'group-model-' + SESSION + '-';

function loadNotes() {
  for (var i = 0; i < SCENARIOS.length; i++) {
    var ta = document.getElementById(SCENARIOS[i]);
    if (!ta) continue;
    var saved = localStorage.getItem(storagePrefix + SCENARIOS[i]);
    if (saved) ta.value = saved;
  }
}

document.addEventListener('input', function(e) {
  if (e.target.tagName !== 'TEXTAREA') return;
  localStorage.setItem(storagePrefix + e.target.id, e.target.value);
});

loadNotes();

function buildSummary() {
  var lines = ['## Group Model Diagnostic \u2014 ' + SESSION, ''];
  for (var i = 0; i < SCENARIOS.length; i++) {
    var ta = document.getElementById(SCENARIOS[i]);
    if (ta && ta.value.trim()) {
      lines.push('**' + SCENARIOS[i] + ':** ' + ta.value.trim());
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
  a.download = SESSION + '-group-model.md';
  a.click();
  URL.revokeObjectURL(a.href);
  showStatus('Saved!');
});
</script>
</body></html>`;
}

// ---------------------------------------------------------------------------
// Session management (same pattern as item-model diagnostic)
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
      // Only list group-model sessions (has "generated", no "rounds", name starts with "group-")
      try {
        const s = JSON.parse(readFileSync(sessionFile(name), 'utf-8'));
        return 'generated' in s && !('rounds' in s) &&
          name.startsWith('group-');
      } catch {
        return false;
      }
    });
}

function autoSessionName(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `group-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
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
    `Generating group model diagnostic for ${SCENARIOS.length} scenarios...`,
  );

  const cfg = DEFAULT_CONFIG;
  const nowMs = Date.now();
  const results: GroupResult[] = [];

  for (const scenario of SCENARIOS) {
    console.log(`  ${scenario.name}...`);
    results.push(analyzeScenario(scenario, cfg, nowMs));
  }

  // Write session file
  writeSession(sessionName, { generated: new Date().toISOString() });

  // Write review HTML
  const html = generateReviewHTML(sessionName, results);
  const reviewPath = path.join(dir, 'review.html');
  writeFileSync(reviewPath, html);
  console.log(`Generated ${reviewPath}`);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function usage(): never {
  console.log(
    `Group-level adaptive model diagnostic — session-based visualization.

Usage:
  deno task group-model [new] [session-name]   Generate report
  deno task group-model view [session]          Open report
  deno task group-model list                    List sessions
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
          console.error('No group-model sessions found.');
          process.exit(1);
        }
        sessionName = sessions[sessions.length - 1];
        console.log(`Using session: ${sessionName}`);
      }

      // Regenerate HTML (scenarios may have changed)
      generateReport(sessionName);
      const reviewPath = path.join(sessionDir(sessionName), 'review.html');
      openInBrowser(reviewPath);
      console.log(`Opened ${reviewPath}`);
      break;
    }

    case 'list': {
      const sessions = listSessions();
      if (sessions.length === 0) {
        console.log('No group-model sessions found.');
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
