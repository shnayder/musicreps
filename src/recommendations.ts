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
  LevelRecommendation,
  RecommendationResult,
  StringRecommendation,
} from './types.ts';

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
// Step 1: classifyGroups
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
// Step 2: freshStartResult
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
      expandIndex: first.string,
      expandNewCount: first.totalCount,
      levelRecs: [{ index: first.string, type: 'expand' }],
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
  index: number;
  speed: number;
  freshness: number;
  speedLabel: 'automatic' | 'learned' | 'learning' | 'hesitant' | 'starting';
  needsReview: boolean;
};

/** Classify a single level's speed and freshness status. */
export function classifyLevelStatus(
  selector: RecommendationSelector,
  index: number,
  getItemIds: (index: number) => string[],
  nowMs?: number,
): LevelStatus {
  const itemIds = getItemIds(index);
  const { level: speed } = selector.getLevelSpeed(itemIds);
  const { level: freshness } = selector.getLevelFreshness(
    itemIds,
    undefined,
    nowMs,
  );

  let speedLabel: LevelStatus['speedLabel'];
  if (speed >= 0.9) speedLabel = 'automatic';
  else if (speed >= 0.7) speedLabel = 'learned';
  else if (speed >= 0.3) speedLabel = 'learning';
  else if (speed > 0) speedLabel = 'hesitant';
  else speedLabel = 'starting';

  return {
    index,
    speed,
    freshness,
    speedLabel,
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

  // Priority 1: review — any level that needs review
  for (const s of statuses) {
    if (s.needsReview) {
      recs.push({ index: s.index, type: 'review' });
    }
  }

  // Priority 2: practice — any level Starting/Hesitant/Learning
  for (const s of statuses) {
    if (
      s.speedLabel === 'starting' || s.speedLabel === 'hesitant' ||
      s.speedLabel === 'learning'
    ) {
      recs.push({ index: s.index, type: 'practice' });
    }
  }

  // Priority 3: automate — any level Learned (not yet Automatic)
  // (Priority for expand is handled by the expansion gate in computeRecommendations)
  for (const s of statuses) {
    if (s.speedLabel === 'learned') {
      recs.push({ index: s.index, type: 'automate' });
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
    statuses.filter((s) => s.speedLabel === 'learned').length;
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
  allIndices: number[],
  getItemIds: (index: number) => string[],
  config: { maxWorkItems?: number },
  options?: { sortUnstarted?: GroupSortFn },
): RecommendationResult {
  // Single timestamp for consistent freshness across all calls.
  const nowMs = Date.now();
  const sortFn = options?.sortUnstarted;

  const recs = selector.getStringRecommendations(allIndices, getItemIds);
  const { started, unstarted } = classifyGroups(recs);

  // Fresh start: no items practiced yet.
  if (started.length === 0) return freshStartResult(unstarted, sortFn);

  // Classify each started level.
  const statuses = started.map((r) =>
    classifyLevelStatus(selector, r.string, getItemIds, nowMs)
  );

  // Build per-level recs (review → practice → automate).
  const levelRecs = computeLevelRecs(statuses);

  // Expansion gate check.
  const gateOpen = checkExpansionGate(statuses);
  let expandIndex: number | null = null;
  let expandNewCount = 0;

  if (gateOpen && unstarted.length > 0) {
    const sorted = sortFn ? [...unstarted].sort(sortFn) : unstarted;
    expandIndex = sorted[0].string;
    expandNewCount = sorted[0].totalCount;

    const expandRec: LevelRecommendation = {
      index: expandIndex,
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
  const recommended = new Set<number>();
  const enabled = new Set<number>();
  let budget = maxWork;

  for (const rec of levelRecs) {
    if (recommended.has(rec.index)) continue; // already included
    const itemCount = getItemIds(rec.index).length;
    if (recommended.size > 0 && budget - itemCount < 0) continue;
    recommended.add(rec.index);
    enabled.add(rec.index);
    budget -= itemCount;
  }

  // If no recs produced (all automatic, no unstarted), include all started.
  if (recommended.size === 0) {
    for (const s of statuses) {
      recommended.add(s.index);
      enabled.add(s.index);
    }
  }

  return {
    recommended,
    enabled,
    expandIndex,
    expandNewCount,
    levelRecs,
  };
}
