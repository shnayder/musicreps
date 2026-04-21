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
//   5. Check expansion gate: all started levels ≥ Solid (P10 speed ≥ 0.7)
//      and none need review (P10 freshness ≥ 0.5). If open and not throttled,
//      insert an expand rec after review + practice, before automate.
//   6. Build recommended/enabled sets from recs, respecting maxWorkItems.
//
// Each step is a named, exported, individually tested function.
// The main `computeRecommendations` orchestrates them in sequence.

import type {
  GroupRecommendation,
  ItemStats,
  LevelRecommendation,
  RecommendationResult,
} from './types.ts';
import { getSpeedLevel, type SpeedLevel } from './speed-levels.ts';
// ---------------------------------------------------------------------------
// Review timing (pure math, shared with stats-display.ts)
// ---------------------------------------------------------------------------

const FRESHNESS_THRESHOLD = 0.5;

/** Review timing result. */
export type ReviewTiming = {
  status: 'soon' | 'scheduled';
  hours: number;
};

/**
 * Pure review timing from avg stability and avg freshness.
 * Single source of truth for whether a level needs review.
 *
 * Note: FRESHNESS_THRESHOLD is hard-coded at 0.5 here. If
 * AdaptiveConfig.freshnessThreshold is ever tuned, this should
 * accept the threshold as a parameter.
 */
export function computeReviewTiming(
  avgStability: number,
  avgFreshness: number,
): ReviewTiming {
  if (avgFreshness < FRESHNESS_THRESHOLD) return { status: 'soon', hours: 0 };
  const hoursRemaining = avgStability * (1 + Math.log2(avgFreshness));
  if (hoursRemaining <= 24) return { status: 'soon', hours: hoursRemaining };
  return { status: 'scheduled', hours: hoursRemaining };
}

/** Compute avg stability and avg freshness across items. Null if no data. */
function computeAvgStabilityFreshness(
  selector: RecommendationSelector,
  itemIds: string[],
): { avgStability: number; avgFreshness: number } | null {
  let stabilitySum = 0, stabilityCount = 0;
  let freshnessSum = 0, freshnessCount = 0;
  for (const id of itemIds) {
    const stats = selector.getStats(id);
    if (stats?.stability != null) {
      stabilitySum += stats.stability;
      stabilityCount++;
    }
    const fr = selector.getFreshness(id);
    if (fr !== null) {
      freshnessSum += fr;
      freshnessCount++;
    }
  }
  if (stabilityCount === 0 || freshnessCount === 0) return null;
  return {
    avgStability: stabilitySum / stabilityCount,
    avgFreshness: freshnessSum / freshnessCount,
  };
}

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
  getSpeedScore(id: string): number | null;
  getStats(id: string): ItemStats | null;
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

/** Per-level status computed from P10 speed and review timing. */
export type LevelStatus = {
  groupId: string;
  speed: number;
  speedLabel: SpeedLevel['key'];
  /** Review timing: 'soon' (stale), 'scheduled' (fresh), or null (no data). */
  reviewStatus: ReviewTiming['status'] | null;
  /** Hours until review needed, or null. UI formats into pill text. */
  reviewInHours: number | null;
};

/** Classify a single level's speed and review timing status. */
export function classifyLevelStatus(
  selector: RecommendationSelector,
  groupId: string,
  getItemIds: (id: string) => string[],
): LevelStatus {
  const itemIds = getItemIds(groupId);
  const { level: speed } = selector.getLevelSpeed(itemIds);
  const speedLabel = getSpeedLevel(speed).key;

  // Review timing only applies to Solid+ levels. Below-Solid levels just
  // need practice — showing a review pill would be confusing.
  let reviewStatus: ReviewTiming['status'] | null = null;
  let reviewInHours: number | null = null;
  if (speedLabel === 'solid' || speedLabel === 'automatic') {
    const avg = computeAvgStabilityFreshness(selector, itemIds);
    if (avg) {
      const timing = computeReviewTiming(avg.avgStability, avg.avgFreshness);
      reviewStatus = timing.status;
      reviewInHours = timing.hours;
    }
  }

  return {
    groupId,
    speed,
    speedLabel,
    reviewStatus,
    reviewInHours,
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

  // Priority 1: review — Solid+ levels where freshness is actually below
  // threshold. reviewInHours === 0 means avgFreshness < FRESHNESS_THRESHOLD.
  // Levels with reviewInHours > 0 aren't due yet — they still get a UI pill
  // ("Review in Xh") but no active recommendation to review now.
  for (const s of statuses) {
    if (
      s.reviewStatus === 'soon' && s.reviewInHours === 0 &&
      (s.speedLabel === 'solid' || s.speedLabel === 'automatic')
    ) {
      recs.push({ groupId: s.groupId, type: 'review' });
    }
  }

  // Priority 2: practice — any level not yet Solid.
  // Slow levels always need practice regardless of freshness.
  for (const s of statuses) {
    if (
      s.speedLabel === 'starting' || s.speedLabel === 'hesitant' ||
      s.speedLabel === 'learning'
    ) {
      recs.push({ groupId: s.groupId, type: 'practice' });
    }
  }

  // Priority 3: automate — Solid levels with no stability data yet.
  // Solid + 'scheduled' = practiced enough, no rec needed.
  // Solid + 'soon' = gets review (above), no automate.
  for (const s of statuses) {
    if (s.speedLabel === 'solid' && s.reviewStatus === null) {
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
 * All started levels must be ≥ Solid (P10 speed ≥ 0.7) and none actually
 * due for review (freshness below threshold, i.e. reviewInHours === 0).
 */
export function checkExpansionGate(statuses: LevelStatus[]): boolean {
  if (statuses.length === 0) return false;
  return statuses.every((s) =>
    s.speed >= 0.7 &&
    !(s.reviewStatus === 'soon' && s.reviewInHours === 0)
  );
}

// ---------------------------------------------------------------------------
// Step 6: shouldThrottleExpansion
// ---------------------------------------------------------------------------

/**
 * Check if expansion should be deprioritized (placed after automate).
 * When ≥3 levels are Solid (not Automatic), automating them takes priority.
 */
export function shouldThrottleExpansion(statuses: LevelStatus[]): boolean {
  const learnedCount = statuses.filter((s) => s.speedLabel === 'solid').length;
  return learnedCount >= 3;
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

/**
 * Compute which item groups to recommend and enable.
 * Orchestrates the pipeline steps above.
 */
export function computeRecommendations(
  selector: RecommendationSelector,
  allGroupIds: string[],
  getItemIds: (id: string) => string[],
  config: { maxWorkItems?: number },
  options?: { sortUnstarted?: GroupSortFn },
): RecommendationResult {
  const sortFn = options?.sortUnstarted;

  const recs = selector.getGroupRecommendations(allGroupIds, getItemIds);
  const { started, unstarted } = classifyGroups(recs);

  // Fresh start: no items practiced yet.
  if (started.length === 0) return freshStartResult(unstarted, sortFn);

  // Classify each started level.
  const statuses = started.map((r) =>
    classifyLevelStatus(selector, r.groupId, getItemIds)
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
    levelStatuses: statuses,
  };
}
