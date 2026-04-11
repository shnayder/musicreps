// Recommendation diagnostic scenario definitions.
// Each scenario specifies per-group stats for semitone-math mode and optional
// soft checks. Used by scripts/recommendation-diagnostic.ts to generate an
// HTML report showing how the recommendation algorithm behaves.
//
// Key concepts (see guides/architecture.md § "Recommendation Pipeline (v4)"):
//
//   Automatic (A) — speed ≥ 0.9
//   Working (W)   — seen but speed < 0.9
//   Unseen (U)    — no data yet
//
//   Per-level status: P10 speed → Automatic/Solid/Learning/Hesitant/Starting
//   Per-level freshness: P10 freshness → Fresh (≥0.5) / Needs review (<0.5)
//   Recs in priority order: review (Solid+ stale) → practice → expand → automate
//   Review only for stale levels with speed ≥ 0.7 (Solid+). Stale + slow = practice.
//   Expansion gate: all started levels ≥ Solid (P10 speed ≥ 0.7), none stale.

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
  automaticCount: number;
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
  groupStats: Record<string, GroupSpec>;
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
 * - Automatic: ewma ~1200ms, stability 48h, lastCorrectAt 2h ago → speed ≥ 0.9
 * - Working: ewma ~3000ms, stability 4h, lastCorrectAt 24h ago → speed < 0.9
 * - Unseen: no entry
 */
export function generateLocalStorageData(
  namespace: string,
  groupStats: Record<string, GroupSpec>,
  now: number = Date.now(),
  getItemIds?: (groupId: string) => string[],
): Record<string, string> {
  const getIds = getItemIds ?? getItemIdsForGroup;
  const result: Record<string, string> = {};

  for (const [groupId, spec] of Object.entries(groupStats)) {
    const groupIdx = groupId.charCodeAt(0); // deterministic hash seed from ID
    const itemIds = getIds(groupId);
    let itemOffset = 0;

    // Automatic items
    for (
      let i = 0;
      i < spec.automaticCount && itemOffset < itemIds.length;
      i++
    ) {
      const h = hashIndex(itemOffset + groupIdx * 100);
      const ewma = 300 + h * 200; // 300-500ms (fast — at or below scaled minTime)
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
// Scenario definitions (all semitone-math: 5 groups, 264 items)
// Group sizes: 0-3 = 48 items each, 4 = 72 items (±9–11)
// ---------------------------------------------------------------------------

export const SCENARIOS: RecommendationScenario[] = [
  {
    name: 'fresh-start',
    description: 'All 5 groups unseen — brand new learner',
    groupStats: {
      'dist-1-2': {
        automaticCount: 0,
        workingCount: 0,
        unseenCount: 48,
        totalCount: 48,
      },
      'dist-3-4': {
        automaticCount: 0,
        workingCount: 0,
        unseenCount: 48,
        totalCount: 48,
      },
      'dist-5-6': {
        automaticCount: 0,
        workingCount: 0,
        unseenCount: 48,
        totalCount: 48,
      },
      'dist-7-8': {
        automaticCount: 0,
        workingCount: 0,
        unseenCount: 48,
        totalCount: 48,
      },
      'dist-9-11': {
        automaticCount: 0,
        workingCount: 0,
        unseenCount: 72,
        totalCount: 72,
      },
    },
    checks: [
      {
        label: 'Recommends group dist-1-2',
        check: (o) =>
          o.recommendation.expandIndex === 'dist-1-2'
            ? null
            : `expandIndex = ${o.recommendation.expandIndex}, expected dist-1-2`,
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
    description: 'G0 partially learned (10A/15W/23U), rest unseen',
    groupStats: {
      'dist-1-2': {
        automaticCount: 10,
        workingCount: 15,
        unseenCount: 23,
        totalCount: 48,
      },
      'dist-3-4': {
        automaticCount: 0,
        workingCount: 0,
        unseenCount: 48,
        totalCount: 48,
      },
      'dist-5-6': {
        automaticCount: 0,
        workingCount: 0,
        unseenCount: 48,
        totalCount: 48,
      },
      'dist-7-8': {
        automaticCount: 0,
        workingCount: 0,
        unseenCount: 48,
        totalCount: 48,
      },
      'dist-9-11': {
        automaticCount: 0,
        workingCount: 0,
        unseenCount: 72,
        totalCount: 72,
      },
    },
    checks: [
      {
        label: 'Blocks expansion (level speed low)',
        check: (o) =>
          o.recommendation.expandIndex === null
            ? null
            : `expandIndex = ${o.recommendation.expandIndex}, expected null`,
      },
      {
        label: 'Recommends group dist-1-2',
        check: (o) =>
          o.recommendation.recommended.has('dist-1-2')
            ? null
            : `recommended does not include dist-1-2`,
      },
    ],
  },

  {
    name: 'struggling',
    description: 'G0 struggling (5A/30W/13U) — mostly working, few automatic',
    groupStats: {
      'dist-1-2': {
        automaticCount: 5,
        workingCount: 30,
        unseenCount: 13,
        totalCount: 48,
      },
      'dist-3-4': {
        automaticCount: 0,
        workingCount: 0,
        unseenCount: 48,
        totalCount: 48,
      },
      'dist-5-6': {
        automaticCount: 0,
        workingCount: 0,
        unseenCount: 48,
        totalCount: 48,
      },
      'dist-7-8': {
        automaticCount: 0,
        workingCount: 0,
        unseenCount: 48,
        totalCount: 48,
      },
      'dist-9-11': {
        automaticCount: 0,
        workingCount: 0,
        unseenCount: 72,
        totalCount: 72,
      },
    },
    checks: [
      {
        label: 'Blocks expansion (level speed low)',
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
      'G0 nearly all automatic (46A/2W/0U) — level speed high enough to expand',
    groupStats: {
      'dist-1-2': {
        automaticCount: 46,
        workingCount: 2,
        unseenCount: 0,
        totalCount: 48,
      },
      'dist-3-4': {
        automaticCount: 0,
        workingCount: 0,
        unseenCount: 48,
        totalCount: 48,
      },
      'dist-5-6': {
        automaticCount: 0,
        workingCount: 0,
        unseenCount: 48,
        totalCount: 48,
      },
      'dist-7-8': {
        automaticCount: 0,
        workingCount: 0,
        unseenCount: 48,
        totalCount: 48,
      },
      'dist-9-11': {
        automaticCount: 0,
        workingCount: 0,
        unseenCount: 72,
        totalCount: 72,
      },
    },
    checks: [
      {
        label: 'Opens expansion gate (high level speed)',
        check: (o) =>
          o.recommendation.expandIndex !== null
            ? null
            : 'expandIndex is null, expected expansion',
      },
      {
        label: 'Expands to group dist-3-4',
        check: (o) =>
          o.recommendation.expandIndex === 'dist-3-4'
            ? null
            : `expandIndex = ${o.recommendation.expandIndex}, expected dist-3-4`,
      },
    ],
  },

  {
    name: 'mid-progression',
    description: 'G0 mostly automatic, G1 partially learned (18A/20W/10U)',
    groupStats: {
      'dist-1-2': {
        automaticCount: 40,
        workingCount: 8,
        unseenCount: 0,
        totalCount: 48,
      },
      'dist-3-4': {
        automaticCount: 18,
        workingCount: 20,
        unseenCount: 10,
        totalCount: 48,
      },
      'dist-5-6': {
        automaticCount: 0,
        workingCount: 0,
        unseenCount: 48,
        totalCount: 48,
      },
      'dist-7-8': {
        automaticCount: 0,
        workingCount: 0,
        unseenCount: 48,
        totalCount: 48,
      },
      'dist-9-11': {
        automaticCount: 0,
        workingCount: 0,
        unseenCount: 72,
        totalCount: 72,
      },
    },
    checks: [
      {
        label: 'Recommends dist-3-4',
        check: (o) =>
          o.recommendation.recommended.has('dist-3-4')
            ? null
            : `recommended does not include dist-3-4`,
      },
      {
        label: 'Status is "Hesitant" or "Learning"',
        check: (o) =>
          o.practiceSummary.statusLabel === 'Hesitant' ||
            o.practiceSummary.statusLabel === 'Learning'
            ? null
            : `statusLabel = "${o.practiceSummary.statusLabel}"`,
      },
    ],
  },

  {
    name: 'nearly-done',
    description: 'All 5 groups started, mostly automatic with few working',
    groupStats: {
      'dist-1-2': {
        automaticCount: 46,
        workingCount: 2,
        unseenCount: 0,
        totalCount: 48,
      },
      'dist-3-4': {
        automaticCount: 45,
        workingCount: 3,
        unseenCount: 0,
        totalCount: 48,
      },
      'dist-5-6': {
        automaticCount: 44,
        workingCount: 4,
        unseenCount: 0,
        totalCount: 48,
      },
      'dist-7-8': {
        automaticCount: 43,
        workingCount: 5,
        unseenCount: 0,
        totalCount: 48,
      },
      'dist-9-11': {
        automaticCount: 66,
        workingCount: 6,
        unseenCount: 0,
        totalCount: 72,
      },
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
        label: 'Status is "Learning", "Solid", or "Automatic"',
        check: (o) =>
          o.practiceSummary.statusLabel === 'Learning' ||
            o.practiceSummary.statusLabel === 'Solid' ||
            o.practiceSummary.statusLabel === 'Automatic'
            ? null
            : `statusLabel = "${o.practiceSummary.statusLabel}"`,
      },
    ],
  },

  {
    name: 'fully-mastered',
    description: 'All groups fully automatic, no working or unseen items',
    groupStats: {
      'dist-1-2': {
        automaticCount: 48,
        workingCount: 0,
        unseenCount: 0,
        totalCount: 48,
      },
      'dist-3-4': {
        automaticCount: 48,
        workingCount: 0,
        unseenCount: 0,
        totalCount: 48,
      },
      'dist-5-6': {
        automaticCount: 48,
        workingCount: 0,
        unseenCount: 0,
        totalCount: 48,
      },
      'dist-7-8': {
        automaticCount: 48,
        workingCount: 0,
        unseenCount: 0,
        totalCount: 48,
      },
      'dist-9-11': {
        automaticCount: 72,
        workingCount: 0,
        unseenCount: 0,
        totalCount: 72,
      },
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
