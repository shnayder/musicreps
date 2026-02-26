// Recommendation diagnostic scenario definitions.
// Each scenario specifies per-group stats for semitone-math mode and optional
// soft checks. Used by scripts/recommendation-diagnostic.ts to generate an
// HTML report showing how the recommendation algorithm behaves.

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
  masteredCount: number;
  dueCount: number;
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
 * - Mastered: ewma ~1200ms, stability 48h, lastCorrectAt 2h ago → fluent
 * - Due: ewma ~3000ms, stability 4h, lastCorrectAt 24h ago → due
 * - Unseen: no entry
 */
export function generateLocalStorageData(
  namespace: string,
  groupStats: Record<number, GroupSpec>,
  now: number = Date.now(),
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [groupIdxStr, spec] of Object.entries(groupStats)) {
    const groupIdx = Number(groupIdxStr);
    const itemIds = getItemIdsForGroup(groupIdx);
    let itemOffset = 0;

    // Mastered items
    for (
      let i = 0;
      i < spec.masteredCount && itemOffset < itemIds.length;
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

    // Due items
    for (let i = 0; i < spec.dueCount && itemOffset < itemIds.length; i++) {
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
      0: { masteredCount: 0, dueCount: 0, unseenCount: 48, totalCount: 48 },
      1: { masteredCount: 0, dueCount: 0, unseenCount: 48, totalCount: 48 },
      2: { masteredCount: 0, dueCount: 0, unseenCount: 48, totalCount: 48 },
      3: { masteredCount: 0, dueCount: 0, unseenCount: 48, totalCount: 48 },
      4: { masteredCount: 0, dueCount: 0, unseenCount: 48, totalCount: 48 },
      5: { masteredCount: 0, dueCount: 0, unseenCount: 24, totalCount: 24 },
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
        label: 'Status is "Ready to start"',
        check: (o) =>
          o.practiceSummary.statusLabel === 'Ready to start'
            ? null
            : `statusLabel = "${o.practiceSummary.statusLabel}"`,
      },
    ],
  },

  {
    name: 'early-learning',
    description: 'G0 partially learned (10M/15D/23U), rest unseen',
    groupStats: {
      0: { masteredCount: 10, dueCount: 15, unseenCount: 23, totalCount: 48 },
      1: { masteredCount: 0, dueCount: 0, unseenCount: 48, totalCount: 48 },
      2: { masteredCount: 0, dueCount: 0, unseenCount: 48, totalCount: 48 },
      3: { masteredCount: 0, dueCount: 0, unseenCount: 48, totalCount: 48 },
      4: { masteredCount: 0, dueCount: 0, unseenCount: 48, totalCount: 48 },
      5: { masteredCount: 0, dueCount: 0, unseenCount: 24, totalCount: 24 },
    },
    checks: [
      {
        label: 'Blocks expansion (ratio ≈ 0.40)',
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
    description: 'G0 struggling (5M/30D/13U) — mostly due, few mastered',
    groupStats: {
      0: { masteredCount: 5, dueCount: 30, unseenCount: 13, totalCount: 48 },
      1: { masteredCount: 0, dueCount: 0, unseenCount: 48, totalCount: 48 },
      2: { masteredCount: 0, dueCount: 0, unseenCount: 48, totalCount: 48 },
      3: { masteredCount: 0, dueCount: 0, unseenCount: 48, totalCount: 48 },
      4: { masteredCount: 0, dueCount: 0, unseenCount: 48, totalCount: 48 },
      5: { masteredCount: 0, dueCount: 0, unseenCount: 24, totalCount: 24 },
    },
    checks: [
      {
        label: 'Blocks expansion (ratio ≈ 0.14)',
        check: (o) =>
          o.recommendation.expandIndex === null
            ? null
            : `expandIndex = ${o.recommendation.expandIndex}, expected null`,
      },
    ],
  },

  {
    name: 'ready-to-expand',
    description: 'G0 nearly mastered (40M/5D/3U), ready to add G1',
    groupStats: {
      0: { masteredCount: 40, dueCount: 5, unseenCount: 3, totalCount: 48 },
      1: { masteredCount: 0, dueCount: 0, unseenCount: 48, totalCount: 48 },
      2: { masteredCount: 0, dueCount: 0, unseenCount: 48, totalCount: 48 },
      3: { masteredCount: 0, dueCount: 0, unseenCount: 48, totalCount: 48 },
      4: { masteredCount: 0, dueCount: 0, unseenCount: 48, totalCount: 48 },
      5: { masteredCount: 0, dueCount: 0, unseenCount: 24, totalCount: 24 },
    },
    checks: [
      {
        label: 'Opens expansion gate (ratio ≈ 0.89)',
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
    description: 'G0 mastered, G1 partially learned (18M/20D/10U)',
    groupStats: {
      0: { masteredCount: 40, dueCount: 8, unseenCount: 0, totalCount: 48 },
      1: { masteredCount: 18, dueCount: 20, unseenCount: 10, totalCount: 48 },
      2: { masteredCount: 0, dueCount: 0, unseenCount: 48, totalCount: 48 },
      3: { masteredCount: 0, dueCount: 0, unseenCount: 48, totalCount: 48 },
      4: { masteredCount: 0, dueCount: 0, unseenCount: 48, totalCount: 48 },
      5: { masteredCount: 0, dueCount: 0, unseenCount: 24, totalCount: 24 },
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
        label: 'Status is "Getting started" or "Building"',
        check: (o) =>
          o.practiceSummary.statusLabel === 'Getting started' ||
            o.practiceSummary.statusLabel === 'Building'
            ? null
            : `statusLabel = "${o.practiceSummary.statusLabel}"`,
      },
    ],
  },

  {
    name: 'nearly-done',
    description: 'All 6 groups started, mostly mastered with some due',
    groupStats: {
      0: { masteredCount: 45, dueCount: 3, unseenCount: 0, totalCount: 48 },
      1: { masteredCount: 44, dueCount: 4, unseenCount: 0, totalCount: 48 },
      2: { masteredCount: 42, dueCount: 6, unseenCount: 0, totalCount: 48 },
      3: { masteredCount: 40, dueCount: 8, unseenCount: 0, totalCount: 48 },
      4: { masteredCount: 38, dueCount: 10, unseenCount: 0, totalCount: 48 },
      5: { masteredCount: 20, dueCount: 4, unseenCount: 0, totalCount: 24 },
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
        label: 'Status is "Solid" or "Strong"',
        check: (o) =>
          o.practiceSummary.statusLabel === 'Solid' ||
            o.practiceSummary.statusLabel === 'Strong'
            ? null
            : `statusLabel = "${o.practiceSummary.statusLabel}"`,
      },
    ],
  },

  {
    name: 'fully-mastered',
    description: 'All groups fully mastered, no due or unseen items',
    groupStats: {
      0: { masteredCount: 48, dueCount: 0, unseenCount: 0, totalCount: 48 },
      1: { masteredCount: 48, dueCount: 0, unseenCount: 0, totalCount: 48 },
      2: { masteredCount: 48, dueCount: 0, unseenCount: 0, totalCount: 48 },
      3: { masteredCount: 48, dueCount: 0, unseenCount: 0, totalCount: 48 },
      4: { masteredCount: 48, dueCount: 0, unseenCount: 0, totalCount: 48 },
      5: { masteredCount: 24, dueCount: 0, unseenCount: 0, totalCount: 24 },
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
        label: 'Status is "Strong"',
        check: (o) =>
          o.practiceSummary.statusLabel === 'Strong'
            ? null
            : `statusLabel = "${o.practiceSummary.statusLabel}"`,
      },
    ],
  },
];
