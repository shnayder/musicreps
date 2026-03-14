// Consolidate-before-expanding recommendation algorithm.
//
// The algorithm decides which item groups a learner should practice next.
// It follows a pipeline:
//
//   1. Classify groups into started (has any seen items) vs unstarted.
//   2. If nothing started, recommend the first unstarted group (fresh start).
//   3. If all started and ≥80% automatic, enter review mode (all groups active).
//   4. Otherwise, select consolidation groups — those with above-median work
//      (working + unseen items). If all are at the median, fall back to the
//      highest-work group.
//   5. Cap consolidation if total work exceeds maxWorkItems (default 30).
//   6. If all started levels are Solid (P10 speed ≥ 0.7) and Fresh (P10
//      freshness ≥ 0.5), suggest one unstarted group for expansion.
//   7. Detect stale groups — fast (speed ≥ 0.5) but decayed (freshness < 0.5).
//
// Each step is a named, exported, individually tested function.
// The main `computeRecommendations` orchestrates them in sequence.

import type { RecommendationResult, StringRecommendation } from './types.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Sort comparator for StringRecommendation arrays. */
export type GroupSortFn = (
  a: StringRecommendation,
  b: StringRecommendation,
) => number;

/** Dependency-injected selector methods used by the recommendation pipeline. */
export type RecommendationSelector = {
  getStringRecommendations(
    indices: number[],
    getItemIds: (index: number) => string[],
  ): StringRecommendation[];
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
// Step 1: workCount helper
// ---------------------------------------------------------------------------

/** Items needing work in a group: working (slow/decayed) + unseen. */
export function workCount(r: StringRecommendation): number {
  return r.workingCount + r.unseenCount;
}

// ---------------------------------------------------------------------------
// Step 2: classifyGroups
// ---------------------------------------------------------------------------

/** Split groups into started (has any seen items) and unstarted (all unseen). */
export function classifyGroups(recs: StringRecommendation[]): {
  started: StringRecommendation[];
  unstarted: StringRecommendation[];
} {
  const started: StringRecommendation[] = [];
  const unstarted: StringRecommendation[] = [];
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
// Step 3: freshStartResult
// ---------------------------------------------------------------------------

/**
 * Handle the no-started-groups case (brand new learner).
 * Returns the first unstarted group (by sortFn order) as both the expansion
 * target and the only enabled group. If no groups exist at all, returns an
 * empty result.
 */
export function freshStartResult(
  unstarted: StringRecommendation[],
  sortFn?: GroupSortFn,
): RecommendationResult {
  if (unstarted.length > 0) {
    const sorted = sortFn ? [...unstarted].sort(sortFn) : unstarted;
    const first = sorted[0];
    return {
      recommended: new Set([first.string]),
      enabled: new Set([first.string]),
      consolidateIndices: [],
      consolidateWorkingCount: 0,
      expandIndex: first.string,
      expandNewCount: first.totalCount,
    };
  }
  return {
    recommended: new Set(),
    enabled: null,
    consolidateIndices: [],
    consolidateWorkingCount: 0,
    expandIndex: null,
    expandNewCount: 0,
  };
}

// ---------------------------------------------------------------------------
// Step 4: checkReviewMode
// ---------------------------------------------------------------------------

/**
 * Detect review mode: all groups started and ≥80% of items are automatic.
 * Returns a RecommendationResult with all groups active, or null if
 * conditions aren't met (unstarted groups exist, or mastery too low).
 */
export function checkReviewMode(
  started: StringRecommendation[],
  hasUnstarted: boolean,
): RecommendationResult | null {
  if (hasUnstarted) return null;
  const totalAutomatic = started.reduce((s, r) => s + r.automaticCount, 0);
  const totalItems = started.reduce((s, r) => s + r.totalCount, 0);
  if (totalItems === 0 || totalAutomatic / totalItems < 0.8) return null;
  const allIndices = started.map((r) => r.string);
  const allWork = started.reduce((s, r) => s + workCount(r), 0);
  return {
    recommended: new Set(allIndices),
    enabled: new Set(allIndices),
    consolidateIndices: allIndices,
    consolidateWorkingCount: allWork,
    expandIndex: null,
    expandNewCount: 0,
    reviewMode: true,
  };
}

// ---------------------------------------------------------------------------
// Step 5: selectConsolidation
// ---------------------------------------------------------------------------

/**
 * Select groups with above-median work for consolidation.
 * Groups are sorted by work descending (tie-broken by string index for
 * determinism). The median is computed from the sorted list. Groups with
 * work strictly above the median are selected. If none qualify (all equal),
 * the highest-work group is used as fallback.
 */
export function selectConsolidation(
  started: StringRecommendation[],
): { indices: number[]; totalWork: number } {
  const sorted = [...started].sort(
    (a, b) => workCount(b) - workCount(a) || a.string - b.string,
  );
  const medianWork = workCount(sorted[Math.floor(sorted.length / 2)]);
  const indices: number[] = [];
  let totalWork = 0;
  for (const r of sorted) {
    if (workCount(r) > medianWork) {
      indices.push(r.string);
      totalWork += workCount(r);
    }
  }
  // Fallback: always include at least one group.
  if (indices.length === 0) {
    const r = sorted[0];
    indices.push(r.string);
    totalWork = workCount(r);
  }
  return { indices, totalWork };
}

// ---------------------------------------------------------------------------
// Step 6: capConsolidation
// ---------------------------------------------------------------------------

/**
 * Trim consolidation groups to fit within a work budget.
 * Takes groups by descending work order until the budget would be exceeded.
 * Always keeps at least one group, even if it alone exceeds the budget.
 */
export function capConsolidation(
  indices: number[],
  getWork: (idx: number) => number,
  maxWork: number,
): { indices: number[]; totalWork: number } {
  if (indices.length <= 1) {
    return { indices, totalWork: indices.length > 0 ? getWork(indices[0]) : 0 };
  }
  // Sort by work descending, tie-break by index for determinism.
  const sorted = [...indices].sort(
    (a, b) => getWork(b) - getWork(a) || a - b,
  );
  const kept: number[] = [];
  let keptWork = 0;
  for (const idx of sorted) {
    const w = getWork(idx);
    if (kept.length > 0 && keptWork + w > maxWork) break;
    kept.push(idx);
    keptWork += w;
  }
  return { indices: kept, totalWork: keptWork };
}

// ---------------------------------------------------------------------------
// Step 7: selectExpansion
// ---------------------------------------------------------------------------

/**
 * Pick the next unstarted group for expansion, if the learner is ready.
 * The gate checks global P10 across all started items (not per-group):
 * P10 speed ≥ 0.7 (Solid) AND P10 freshness ≥ 0.5 (Fresh).
 * Returns null when conditions aren't met or no unstarted groups remain.
 */
export function selectExpansion(
  levelSpeed: number,
  levelFreshness: number,
  unstarted: StringRecommendation[],
  sortFn?: GroupSortFn,
): { index: number; count: number } | null {
  if (levelSpeed < 0.7 || levelFreshness < 0.5 || unstarted.length === 0) {
    return null;
  }
  const sorted = sortFn ? [...unstarted].sort(sortFn) : unstarted;
  return { index: sorted[0].string, count: sorted[0].totalCount };
}

// ---------------------------------------------------------------------------
// Step 8: detectStaleGroups
// ---------------------------------------------------------------------------

/** Speed score threshold for "was fast" in stale detection. */
export const STALE_SPEED_THRESHOLD = 0.5;
/** Freshness threshold for "has decayed" in stale detection. */
export const STALE_FRESHNESS_THRESHOLD = 0.5;

/**
 * Identify consolidation groups that are stale: items are fast (avg speed
 * score ≥ STALE_SPEED_THRESHOLD) but decayed (avg freshness <
 * STALE_FRESHNESS_THRESHOLD). These groups need refreshing even though
 * the learner was once proficient.
 */
export function detectStaleGroups(
  indices: number[],
  getItemIds: (idx: number) => string[],
  getSpeedScore: (id: string) => number | null,
  getFreshness: (id: string) => number | null,
): number[] | undefined {
  const stale: number[] = [];
  for (const idx of indices) {
    const ids = getItemIds(idx);
    let speedSum = 0;
    let freshSum = 0;
    let count = 0;
    for (const id of ids) {
      const sp = getSpeedScore(id);
      const fr = getFreshness(id);
      if (sp !== null && fr !== null) {
        speedSum += sp;
        freshSum += fr;
        count++;
      }
    }
    if (
      count > 0 &&
      speedSum / count >= STALE_SPEED_THRESHOLD &&
      freshSum / count < STALE_FRESHNESS_THRESHOLD
    ) {
      stale.push(idx);
    }
  }
  return stale.length > 0 ? stale : undefined;
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
  allIndices: number[],
  getItemIds: (index: number) => string[],
  config: { maxWorkItems?: number },
  options?: { sortUnstarted?: GroupSortFn },
): RecommendationResult {
  // Single timestamp for consistent freshness across all calls.
  const nowMs = Date.now();
  const sortFn = options?.sortUnstarted;

  const recs = selector.getStringRecommendations(
    allIndices,
    getItemIds,
  );
  const { started, unstarted } = classifyGroups(recs);

  // Fresh start: no items practiced yet.
  if (started.length === 0) return freshStartResult(unstarted, sortFn);

  // Review mode: everything started and mostly automatic.
  const review = checkReviewMode(started, unstarted.length > 0);
  if (review) return review;

  // Consolidation: focus on groups with the most work remaining.
  let { indices, totalWork } = selectConsolidation(started);

  // Cap: trim to budget if too many work items.
  const maxWork = config.maxWorkItems ?? 30;
  if (totalWork > maxWork && indices.length > 1) {
    // Build a work lookup from the recs array.
    const workByIndex = new Map(recs.map((r) => [r.string, workCount(r)]));
    const capped = capConsolidation(
      indices,
      (idx) => workByIndex.get(idx) ?? 0,
      maxWork,
    );
    indices = capped.indices;
    totalWork = capped.totalWork;
  }

  // Build recommended + enabled sets from consolidation.
  const recommended = new Set(indices);
  const enabled = new Set(indices);

  // Expansion: suggest one new group if the learner is ready.
  // All started levels must be Solid (P10 speed ≥ 0.7) and Fresh (P10
  // freshness ≥ 0.5).
  const startedItemIds = started.flatMap((r) => getItemIds(r.string));
  const { level: levelSpeed } = selector.getLevelSpeed(startedItemIds);
  const { level: levelFreshness } = selector.getLevelFreshness(
    startedItemIds,
    undefined,
    nowMs,
  );
  const expansion = selectExpansion(
    levelSpeed,
    levelFreshness,
    unstarted,
    sortFn,
  );
  let expandIndex: number | null = null;
  let expandNewCount = 0;
  if (expansion) {
    expandIndex = expansion.index;
    expandNewCount = expansion.count;
    recommended.add(expandIndex);
    enabled.add(expandIndex);
  }

  // Stale detection: fast but decayed groups.
  const getFresh = (id: string) => selector.getFreshness(id, nowMs);
  const staleIndices = detectStaleGroups(
    indices,
    getItemIds,
    selector.getSpeedScore,
    getFresh,
  );

  return {
    recommended,
    enabled,
    consolidateIndices: indices,
    consolidateWorkingCount: totalWork,
    expandIndex,
    expandNewCount,
    staleIndices,
  };
}
