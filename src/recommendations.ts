// Recommendation pipeline (v4).
//
// Per-level status → cross-level recs → expansion gate → item budget.
//
// The algorithm decides which item groups a learner should practice next:
//
//   1. Classify groups into started (has any seen items) vs unstarted.
//   2. If nothing started, recommend the first unstarted group (fresh start).
//   3. For each started level, compute speed/freshness status (P10).
//   4. Build per-level recommendations in priority order:
//      review (stale) → practice (slow) → automate (learned, not automatic).
//   5. Check expansion gate: all started levels ≥ Learned (P10 speed ≥ 0.7)
//      and none need review (P10 freshness ≥ 0.5). If open and not throttled,
//      insert an expand rec after review + practice, before automate.
//   6. Build recommended/enabled sets from recs, respecting maxWorkItems.
//
// Each step is a named, exported, individually tested function.
// The main `computeRecommendations` orchestrates them in sequence.

import type {
  GroupRecommendation,
  LevelRecommendation,
  RecommendationResult,
} from './types.ts';
import { getSpeedLevel, type SpeedLevel } from './speed-levels.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Sort comparator for GroupRecommendation arrays. */
export type GroupSortFn = (
  a: GroupRecommendation,
  b: GroupRecommendation,
) => number;

/** Dependency-injected selector methods used by the recommendation pipeline. */
export type RecommendationSelector = {
  getGroupRecommendations(
    groupIds: string[],
    getItemIds: (id: string) => string[],
  ): GroupRecommendation[];
  getLevelSpeed(
    itemIds: string[],
    percentile?: number,
  ): { level: number; seen: number };
  getLevelFreshness(
    itemIds: string[],
    percentile?: number,
    nowMs?: number,
  ): { level: number; seen: number };
  getSpeedScore(id: string): number | null;
  getFreshness(id: string, nowMs?: number): number | null;
};

// ---------------------------------------------------------------------------
// Step 1: classifyGroups
// ---------------------------------------------------------------------------

/** Split groups into started (has any seen items) and unstarted (all unseen). */
export function classifyGroups(recs: GroupRecommendation[]): {
  started: GroupRecommendation[];
  unstarted: GroupRecommendation[];
} {
  const started: GroupRecommendation[] = [];
  const unstarted: GroupRecommendation[] = [];
  for (const r of recs) {
    if (r.unseenCount < r.totalCount) {
      started.push(r);
    } else {
      unstarted.push(r);
    }
  }
  return { started, unstarted };
}

// ---------------------------------------------------------------------------
// Step 2: freshStartResult
// ---------------------------------------------------------------------------

/**
 * Handle the no-started-groups case (brand new learner).
 * Returns the first unstarted group (by sortFn order) as both the expansion
 * target and the only enabled group. If no groups exist at all, returns an
 * empty result.
 */
export function freshStartResult(
  unstarted: GroupRecommendation[],
  sortFn?: GroupSortFn,
): RecommendationResult {
  if (unstarted.length > 0) {
    const sorted = sortFn ? [...unstarted].sort(sortFn) : unstarted;
    const first = sorted[0];
    return {
      recommended: new Set([first.groupId]),
      enabled: new Set([first.groupId]),
      expandIndex: first.groupId,
      expandNewCount: first.totalCount,
      levelRecs: [{ groupId: first.groupId, type: 'expand' }],
    };
  }
  return {
    recommended: new Set(),
    enabled: null,
    expandIndex: null,
    expandNewCount: 0,
    levelRecs: [],
  };
}

// ---------------------------------------------------------------------------
// Step 3: classifyLevelStatus
// ---------------------------------------------------------------------------

/** Per-level status computed from P10 speed and freshness. */
export type LevelStatus = {
  groupId: string;
  speed: number;
  freshness: number;
  speedLabel: SpeedLevel['key'];
  needsReview: boolean;
};

/** Classify a single level's speed and freshness status. */
export function classifyLevelStatus(
  selector: RecommendationSelector,
  groupId: string,
  getItemIds: (id: string) => string[],
  nowMs?: number,
): LevelStatus {
  const itemIds = getItemIds(groupId);
  const { level: speed } = selector.getLevelSpeed(itemIds);
  const { level: freshness } = selector.getLevelFreshness(
    itemIds,
    undefined,
    nowMs,
  );

  return {
    groupId,
    speed,
    freshness,
    speedLabel: getSpeedLevel(speed).key,
    needsReview: freshness < 0.5,
  };
}

// ---------------------------------------------------------------------------
// Step 4: computeLevelRecs
// ---------------------------------------------------------------------------

/**
 * Build per-level recommendations in priority order.
 * Does NOT include expand recs — those are added by the gate check.
 */
export function computeLevelRecs(
  statuses: LevelStatus[],
): LevelRecommendation[] {
  const recs: LevelRecommendation[] = [];

  // Priority 1: review — stale levels that were Solid+ (speed >= 0.7).
  // Stale levels that are still slow get 'practice' instead — you're not
  // reviewing something you once knew, just need more practice.
  for (const s of statuses) {
    if (
      s.needsReview &&
      (s.speedLabel === 'solid' || s.speedLabel === 'automatic')
    ) {
      recs.push({ groupId: s.groupId, type: 'review' });
    }
  }

  // Priority 2: practice — any level not yet Solid (Starting/Hesitant/Learning),
  // regardless of freshness.
  for (const s of statuses) {
    if (
      s.speedLabel === 'starting' || s.speedLabel === 'hesitant' ||
      s.speedLabel === 'learning'
    ) {
      recs.push({ groupId: s.groupId, type: 'practice' });
    }
  }

  // Priority 3: automate — any level Learned (not yet Automatic), fresh.
  // (Priority for expand is handled by the expansion gate in computeRecommendations)
  for (const s of statuses) {
    if (s.speedLabel === 'solid' && !s.needsReview) {
      recs.push({ groupId: s.groupId, type: 'automate' });
    }
  }

  return recs;
}

// ---------------------------------------------------------------------------
// Step 5: checkExpansionGate
// ---------------------------------------------------------------------------

/**
 * Check whether the expansion gate is open.
 * All started levels must be ≥ Learned (P10 speed ≥ 0.7) and none need review.
 */
export function checkExpansionGate(statuses: LevelStatus[]): boolean {
  if (statuses.length === 0) return false;
  return statuses.every((s) => s.speed >= 0.7 && !s.needsReview);
}

// ---------------------------------------------------------------------------
// Step 6: shouldThrottleExpansion
// ---------------------------------------------------------------------------

/**
 * Check if expansion should be deprioritized (placed after automate).
 * When ≥3 levels are Learned (not Automatic), automating them takes priority.
 */
export function shouldThrottleExpansion(statuses: LevelStatus[]): boolean {
  const learnedCount =
    statuses.filter((s) => s.speedLabel === 'solid').length;
  return learnedCount >= 3;
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

/**
 * Compute which item groups to recommend and enable.
 * Orchestrates the pipeline steps above. Captures a single timestamp at
 * entry so all selector calls see consistent freshness values.
 */
export function computeRecommendations(
  selector: RecommendationSelector,
  allGroupIds: string[],
  getItemIds: (id: string) => string[],
  config: { maxWorkItems?: number },
  options?: { sortUnstarted?: GroupSortFn },
): RecommendationResult {
  // Single timestamp for consistent freshness across all calls.
  const nowMs = Date.now();
  const sortFn = options?.sortUnstarted;

  const recs = selector.getGroupRecommendations(allGroupIds, getItemIds);
  const { started, unstarted } = classifyGroups(recs);

  // Fresh start: no items practiced yet.
  if (started.length === 0) return freshStartResult(unstarted, sortFn);

  // Classify each started level.
  const statuses = started.map((r) =>
    classifyLevelStatus(selector, r.groupId, getItemIds, nowMs)
  );

  // Build per-level recs (review → practice → automate).
  const levelRecs = computeLevelRecs(statuses);

  // Expansion gate check.
  const gateOpen = checkExpansionGate(statuses);
  let expandIndex: string | null = null;
  let expandNewCount = 0;

  if (gateOpen && unstarted.length > 0) {
    const sorted = sortFn ? [...unstarted].sort(sortFn) : unstarted;
    expandIndex = sorted[0].groupId;
    expandNewCount = sorted[0].totalCount;

    const expandRec: LevelRecommendation = {
      groupId: expandIndex,
      type: 'expand',
    };

    if (shouldThrottleExpansion(statuses)) {
      // After automate recs.
      levelRecs.push(expandRec);
    } else {
      // After review + practice, before automate.
      // Find the index where automate recs start.
      const automateStart = levelRecs.findIndex((r) => r.type === 'automate');
      if (automateStart === -1) {
        levelRecs.push(expandRec);
      } else {
        levelRecs.splice(automateStart, 0, expandRec);
      }
    }
  }

  // Build recommended/enabled sets from recs, respecting maxWorkItems budget.
  const maxWork = config.maxWorkItems ?? 30;
  const recommended = new Set<string>();
  const enabled = new Set<string>();
  let budget = maxWork;

  for (const rec of levelRecs) {
    if (recommended.has(rec.groupId)) continue; // already included
    const itemCount = getItemIds(rec.groupId).length;
    if (recommended.size > 0 && budget - itemCount < 0) continue;
    recommended.add(rec.groupId);
    enabled.add(rec.groupId);
    budget -= itemCount;
  }

  // If no recs produced (all automatic, no unstarted), include all started.
  if (recommended.size === 0) {
    for (const s of statuses) {
      recommended.add(s.groupId);
      enabled.add(s.groupId);
    }
  }

  // Filter levelRecs to only include entries that fit in the budget.
  // This keeps levelRecs consistent with recommended/enabled so that
  // buildRecommendationText shows only what applyRecommendation applies.
  const filteredRecs = levelRecs.filter((r) => recommended.has(r.groupId));

  // Update expandIndex if it was excluded by budget.
  if (expandIndex !== null && !recommended.has(expandIndex)) {
    expandIndex = null;
    expandNewCount = 0;
  }

  return {
    recommended,
    enabled,
    expandIndex,
    expandNewCount,
    levelRecs: filteredRecs,
  };
}
