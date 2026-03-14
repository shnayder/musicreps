// Recommendation diagnostic scenario definitions.
// Each scenario specifies per-group stats for semitone-math mode and optional
// soft checks. Used by scripts/recommendation-diagnostic.ts to generate an
// HTML report showing how the recommendation algorithm behaves.
//
// Key concepts (see guides/architecture.md § "Consolidate Before Expanding"):
//
//   F (Fluent)   — automaticity > threshold (fast + fresh)
//   W (Working)  — seen but automaticity ≤ threshold (slow or decayed)
//   U (Unseen)   — no data yet
//
//   Level automaticity = 10th percentile of per-item automaticity (unseen → 0).
//   Expansion gate opens when level >= 0.7 (expansionThreshold).
//   Groups above the median work count (W + U) are recommended for consolidation.
//   One unstarted group is suggested for expansion when the gate is open.

import type { ItemStats, RecommendationResult } from '../types.ts';
import type { PracticeSummaryState } from '../types.ts';
import { getItemIdsForGroup } from '../modes/semitone-math/logic.ts';

// ---------------------------------------------------------------------------
// Helpers (shared with heatmap-scenarios.ts)
// ---------------------------------------------------------------------------

const HOUR = 3600_000;

function makeStats(overrides: Partial<ItemStats>): ItemStats {
  return {
    recentTimes: [],
    ewma: 0,
    sampleCount: 0,
    lastSeen: 0,
    stability: null,
    lastCorrectAt: null,
    ...overrides,
  };
}

function statsEntry(
  namespace: string,
  itemId: string,
  stats: ItemStats,
): [string, string] {
  return [`adaptive_${namespace}_${itemId}`, JSON.stringify(stats)];
}

/** Deterministic pseudo-random from item index. */
function hashIndex(i: number): number {
  return ((i * 2654435761) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GroupSpec = {
  fluentCount: number;
  workingCount: number;
  unseenCount: number;
  totalCount: number;
};

export type ScenarioOutput = {
  recommendation: RecommendationResult;
  recommendationText: string;
  practiceSummary: PracticeSummaryState;
};

export type RecommendationScenario = {
  name: string;
  description: string;
  groupStats: Record<number, GroupSpec>;
  checks?: {
    label: string;
    check: (output: ScenarioOutput) => string | null;
  }[];
};

// ---------------------------------------------------------------------------
// localStorage data generator
// ---------------------------------------------------------------------------

/**
 * Convert group specs into realistic ItemStats localStorage entries.
 * Uses real getItemIdsForGroup() to map group indices to item IDs.
 *
 * Values are deterministic (hashIndex-based):
 * - Fluent: ewma ~1200ms, stability 48h, lastCorrectAt 2h ago → high automaticity
 * - Working: ewma ~3000ms, stability 4h, lastCorrectAt 24h ago → low automaticity
 * - Unseen: no entry
 */
export function generateLocalStorageData(
  namespace: string,
  groupStats: Record<number, GroupSpec>,
  now: number = Date.now(),
  getItemIds?: (groupIndex: number) => string[],
): Record<string, string> {
  const getIds = getItemIds ?? getItemIdsForGroup;
  const result: Record<string, string> = {};

  for (const [groupIdxStr, spec] of Object.entries(groupStats)) {
    const groupIdx = Number(groupIdxStr);
    const itemIds = getIds(groupIdx);
    let itemOffset = 0;

    // Fluent items
    for (
      let i = 0;
      i < spec.fluentCount && itemOffset < itemIds.length;
      i++
    ) {
      const h = hashIndex(itemOffset + groupIdx * 100);
      const ewma = 1000 + h * 400; // 1000-1400ms (fast)
      const stats = makeStats({
        recentTimes: [ewma * 0.95, ewma, ewma * 1.05],
        ewma,
        sampleCount: 10 + Math.floor(h * 20),
        lastSeen: now - HOUR * (1 + h * 3),
        stability: 48 + h * 100, // 48-148 hours
        lastCorrectAt: now - HOUR * (1 + h * 3), // 1-4 hours ago
      });
      const [key, value] = statsEntry(namespace, itemIds[itemOffset], stats);
      result[key] = value;
      itemOffset++;
    }

    // Working items
    for (let i = 0; i < spec.workingCount && itemOffset < itemIds.length; i++) {
      const h = hashIndex(itemOffset + groupIdx * 100);
      const ewma = 2500 + h * 1000; // 2500-3500ms (slow)
      const stats = makeStats({
        recentTimes: [ewma * 0.9, ewma, ewma * 1.1],
        ewma,
        sampleCount: 3 + Math.floor(h * 5),
        lastSeen: now - 24 * HOUR - h * 12 * HOUR,
        stability: 3 + h * 2, // 3-5 hours
        lastCorrectAt: now - 24 * HOUR - h * 12 * HOUR, // 24-36h ago
      });
      const [key, value] = statsEntry(namespace, itemIds[itemOffset], stats);
      result[key] = value;
      itemOffset++;
    }

    // Unseen items: no entries (itemOffset..end skipped)
  }

  return result;
}

// ---------------------------------------------------------------------------
// Scenario definitions (all semitone-math: 6 groups, 264 items)
// Group sizes: 0-4 = 48 items each, 5 = 24 items
// ---------------------------------------------------------------------------

export const SCENARIOS: RecommendationScenario[] = [
  {
    name: 'fresh-start',
    description: 'All 6 groups unseen — brand new learner',
    groupStats: {
      0: { fluentCount: 0, workingCount: 0, unseenCount: 48, totalCount: 48 },
      1: { fluentCount: 0, workingCount: 0, unseenCount: 48, totalCount: 48 },
      2: { fluentCount: 0, workingCount: 0, unseenCount: 48, totalCount: 48 },
      3: { fluentCount: 0, workingCount: 0, unseenCount: 48, totalCount: 48 },
      4: { fluentCount: 0, workingCount: 0, unseenCount: 48, totalCount: 48 },
      5: { fluentCount: 0, workingCount: 0, unseenCount: 24, totalCount: 24 },
    },
    checks: [
      {
        label: 'Recommends group 0',
        check: (o) =>
          o.recommendation.expandIndex === 0
            ? null
            : `expandIndex = ${o.recommendation.expandIndex}, expected 0`,
      },
      {
        label: 'Status is "Not started"',
        check: (o) =>
          o.practiceSummary.statusLabel === 'Not started'
            ? null
            : `statusLabel = "${o.practiceSummary.statusLabel}"`,
      },
    ],
  },

  {
    name: 'early-learning',
    description: 'G0 partially learned (10F/15W/23U), rest unseen',
    groupStats: {
      0: { fluentCount: 10, workingCount: 15, unseenCount: 23, totalCount: 48 },
      1: { fluentCount: 0, workingCount: 0, unseenCount: 48, totalCount: 48 },
      2: { fluentCount: 0, workingCount: 0, unseenCount: 48, totalCount: 48 },
      3: { fluentCount: 0, workingCount: 0, unseenCount: 48, totalCount: 48 },
      4: { fluentCount: 0, workingCount: 0, unseenCount: 48, totalCount: 48 },
      5: { fluentCount: 0, workingCount: 0, unseenCount: 24, totalCount: 24 },
    },
    checks: [
      {
        label: 'Blocks expansion (level auto low)',
        check: (o) =>
          o.recommendation.expandIndex === null
            ? null
            : `expandIndex = ${o.recommendation.expandIndex}, expected null`,
      },
      {
        label: 'Consolidates group 0',
        check: (o) =>
          o.recommendation.consolidateIndices.includes(0)
            ? null
            : `consolidateIndices = [${o.recommendation.consolidateIndices}]`,
      },
    ],
  },

  {
    name: 'struggling',
    description: 'G0 struggling (5F/30W/13U) — mostly working, few fluent',
    groupStats: {
      0: { fluentCount: 5, workingCount: 30, unseenCount: 13, totalCount: 48 },
      1: { fluentCount: 0, workingCount: 0, unseenCount: 48, totalCount: 48 },
      2: { fluentCount: 0, workingCount: 0, unseenCount: 48, totalCount: 48 },
      3: { fluentCount: 0, workingCount: 0, unseenCount: 48, totalCount: 48 },
      4: { fluentCount: 0, workingCount: 0, unseenCount: 48, totalCount: 48 },
      5: { fluentCount: 0, workingCount: 0, unseenCount: 24, totalCount: 24 },
    },
    checks: [
      {
        label: 'Blocks expansion (level auto low)',
        check: (o) =>
          o.recommendation.expandIndex === null
            ? null
            : `expandIndex = ${o.recommendation.expandIndex}, expected null`,
      },
    ],
  },

  {
    name: 'ready-to-expand',
    description:
      'G0 nearly all fluent (46F/2W/0U) — level auto high enough to expand',
    groupStats: {
      0: { fluentCount: 46, workingCount: 2, unseenCount: 0, totalCount: 48 },
      1: { fluentCount: 0, workingCount: 0, unseenCount: 48, totalCount: 48 },
      2: { fluentCount: 0, workingCount: 0, unseenCount: 48, totalCount: 48 },
      3: { fluentCount: 0, workingCount: 0, unseenCount: 48, totalCount: 48 },
      4: { fluentCount: 0, workingCount: 0, unseenCount: 48, totalCount: 48 },
      5: { fluentCount: 0, workingCount: 0, unseenCount: 24, totalCount: 24 },
    },
    checks: [
      {
        label: 'Opens expansion gate (high level auto)',
        check: (o) =>
          o.recommendation.expandIndex !== null
            ? null
            : 'expandIndex is null, expected expansion',
      },
      {
        label: 'Expands to group 1',
        check: (o) =>
          o.recommendation.expandIndex === 1
            ? null
            : `expandIndex = ${o.recommendation.expandIndex}, expected 1`,
      },
    ],
  },

  {
    name: 'mid-progression',
    description: 'G0 mostly fluent, G1 partially learned (18F/20W/10U)',
    groupStats: {
      0: { fluentCount: 40, workingCount: 8, unseenCount: 0, totalCount: 48 },
      1: { fluentCount: 18, workingCount: 20, unseenCount: 10, totalCount: 48 },
      2: { fluentCount: 0, workingCount: 0, unseenCount: 48, totalCount: 48 },
      3: { fluentCount: 0, workingCount: 0, unseenCount: 48, totalCount: 48 },
      4: { fluentCount: 0, workingCount: 0, unseenCount: 48, totalCount: 48 },
      5: { fluentCount: 0, workingCount: 0, unseenCount: 24, totalCount: 24 },
    },
    checks: [
      {
        label: 'Consolidates G1 (most work)',
        check: (o) =>
          o.recommendation.consolidateIndices.includes(1)
            ? null
            : `consolidateIndices = [${o.recommendation.consolidateIndices}]`,
      },
      {
        label: 'Status is "Slow" or "Getting faster"',
        check: (o) =>
          o.practiceSummary.statusLabel === 'Slow' ||
            o.practiceSummary.statusLabel === 'Getting faster'
            ? null
            : `statusLabel = "${o.practiceSummary.statusLabel}"`,
      },
    ],
  },

  {
    name: 'nearly-done',
    description: 'All 6 groups started, mostly fluent with few working',
    groupStats: {
      0: { fluentCount: 46, workingCount: 2, unseenCount: 0, totalCount: 48 },
      1: { fluentCount: 45, workingCount: 3, unseenCount: 0, totalCount: 48 },
      2: { fluentCount: 44, workingCount: 4, unseenCount: 0, totalCount: 48 },
      3: { fluentCount: 43, workingCount: 5, unseenCount: 0, totalCount: 48 },
      4: { fluentCount: 42, workingCount: 6, unseenCount: 0, totalCount: 48 },
      5: { fluentCount: 22, workingCount: 2, unseenCount: 0, totalCount: 24 },
    },
    checks: [
      {
        label: 'No expansion (all started)',
        check: (o) =>
          o.recommendation.expandIndex === null
            ? null
            : `expandIndex = ${o.recommendation.expandIndex}, expected null`,
      },
      {
        label: 'Status is "Getting faster" or "Automatic"',
        check: (o) =>
          o.practiceSummary.statusLabel === 'Getting faster' ||
            o.practiceSummary.statusLabel === 'Automatic'
            ? null
            : `statusLabel = "${o.practiceSummary.statusLabel}"`,
      },
    ],
  },

  {
    name: 'fully-mastered',
    description: 'All groups fully fluent, no working or unseen items',
    groupStats: {
      0: { fluentCount: 48, workingCount: 0, unseenCount: 0, totalCount: 48 },
      1: { fluentCount: 48, workingCount: 0, unseenCount: 0, totalCount: 48 },
      2: { fluentCount: 48, workingCount: 0, unseenCount: 0, totalCount: 48 },
      3: { fluentCount: 48, workingCount: 0, unseenCount: 0, totalCount: 48 },
      4: { fluentCount: 48, workingCount: 0, unseenCount: 0, totalCount: 48 },
      5: { fluentCount: 24, workingCount: 0, unseenCount: 0, totalCount: 24 },
    },
    checks: [
      {
        label: 'No expansion needed',
        check: (o) =>
          o.recommendation.expandIndex === null
            ? null
            : `expandIndex = ${o.recommendation.expandIndex}`,
      },
      {
        label: 'Status is "Automatic"',
        check: (o) =>
          o.practiceSummary.statusLabel === 'Automatic'
            ? null
            : `statusLabel = "${o.practiceSummary.statusLabel}"`,
      },
    ],
  },
];
