import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  capConsolidation,
  checkReviewMode,
  classifyGroups,
  computeRecommendations,
  detectStaleGroups,
  freshStartResult,
  type RecommendationSelector,
  selectConsolidation,
  selectExpansion,
  workCount,
} from './recommendations.ts';
import { buildRecommendationText } from './mode-ui-state.ts';
import { createAdaptiveSelector, createMemoryStorage } from './adaptive.ts';
import type { ItemStats, StringRecommendation } from './types.ts';
import { GUITAR } from './music-data.ts';
import { getItemIdsForGroup as guitarGetItemIds } from './modes/fretboard/logic.ts';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Shorthand to build a StringRecommendation. */
function rec(
  string: number,
  working: number,
  unseen: number,
  fluent: number,
): StringRecommendation {
  return {
    string,
    workingCount: working,
    unseenCount: unseen,
    fluentCount: fluent,
    totalCount: working + unseen + fluent,
  };
}

// Mock selector that returns pre-built data and computes level automaticity
// from encoded item IDs: fluent items → 0.9, working → 0.3, unseen → 0.
function mockSelector(
  dataByIndex: Record<number, {
    workingCount: number;
    unseenCount: number;
    fluentCount: number;
    totalCount: number;
  }>,
): RecommendationSelector {
  return {
    getStringRecommendations(
      indices: number[],
      _getItemIds: (i: number) => string[],
    ) {
      const results = indices.map((i) => {
        const d = dataByIndex[i] ??
          { workingCount: 0, unseenCount: 0, fluentCount: 0, totalCount: 0 };
        return { string: i, ...d };
      });
      results.sort((a, b) =>
        (b.workingCount + b.unseenCount) - (a.workingCount + a.unseenCount) ||
        a.string - b.string
      );
      return results;
    },
    getLevelAutomaticity(
      itemIds: string[],
      percentile: number = 0.1,
    ): { level: number; seen: number } {
      const values = itemIds.map((id) => {
        const parts = id.split('-');
        const groupIdx = parseInt(parts[1], 10);
        const itemIdx = parseInt(parts[3], 10);
        const d = dataByIndex[groupIdx];
        if (!d) return 0;
        if (itemIdx < d.fluentCount) return 0.9;
        if (itemIdx < d.fluentCount + d.workingCount) return 0.3;
        return 0; // unseen
      });
      values.sort((a, b) => a - b);
      const index = Math.max(0, Math.ceil(values.length * percentile) - 1);
      const seen = values.filter((v) => v > 0).length;
      return { level: values[index], seen };
    },
  };
}

// Generate item IDs that encode group and item index so the mock
// getLevelAutomaticity can decode them.
function makeGetItemIds(
  dataByIndex: Record<number, { totalCount: number; [k: string]: number }>,
) {
  return (i: number) => {
    const d = dataByIndex[i];
    const count = d ? d.totalCount : 1;
    return Array.from({ length: count }, (_, j) => `group-${i}-item-${j}`);
  };
}

const config = { expansionThreshold: 0.7 };

// ---------------------------------------------------------------------------
// workCount
// ---------------------------------------------------------------------------

describe('workCount', () => {
  it('sums working + unseen', () => {
    assert.equal(workCount(rec(0, 3, 5, 2)), 8);
  });

  it('returns 0 when all fluent', () => {
    assert.equal(workCount(rec(0, 0, 0, 10)), 0);
  });
});

// ---------------------------------------------------------------------------
// classifyGroups
// ---------------------------------------------------------------------------

describe('classifyGroups', () => {
  it('splits started from unstarted', () => {
    const recs = [
      rec(0, 3, 5, 2), // started: unseen < total
      rec(1, 0, 10, 0), // unstarted: unseen === total
      rec(2, 0, 0, 10), // started: unseen < total (all fluent)
    ];
    const { started, unstarted } = classifyGroups(recs);
    assert.equal(started.length, 2);
    assert.equal(unstarted.length, 1);
    assert.equal(unstarted[0].string, 1);
  });

  it('returns empty arrays for empty input', () => {
    const { started, unstarted } = classifyGroups([]);
    assert.equal(started.length, 0);
    assert.equal(unstarted.length, 0);
  });
});

// ---------------------------------------------------------------------------
// freshStartResult
// ---------------------------------------------------------------------------

describe('freshStartResult', () => {
  it('recommends the first unstarted group', () => {
    const unstarted = [rec(0, 0, 10, 0), rec(1, 0, 5, 0)];
    const result = freshStartResult(unstarted);
    assert.ok(result.recommended.has(0));
    assert.equal(result.expandIndex, 0);
    assert.equal(result.expandNewCount, 10);
  });

  it('respects sortFn', () => {
    const unstarted = [rec(0, 0, 10, 0), rec(1, 0, 5, 0)];
    const result = freshStartResult(
      unstarted,
      (a, b) => a.totalCount - b.totalCount,
    );
    assert.equal(result.expandIndex, 1);
    assert.equal(result.expandNewCount, 5);
  });

  it('returns empty result when no groups exist', () => {
    const result = freshStartResult([]);
    assert.equal(result.recommended.size, 0);
    assert.equal(result.enabled, null);
    assert.equal(result.expandIndex, null);
  });
});

// ---------------------------------------------------------------------------
// checkReviewMode
// ---------------------------------------------------------------------------

describe('checkReviewMode', () => {
  it('returns review result when ≥80% fluent and no unstarted', () => {
    const started = [rec(0, 1, 0, 9), rec(1, 1, 0, 9)]; // 18/20 = 90%
    const result = checkReviewMode(started, false);
    assert.ok(result);
    assert.equal(result!.reviewMode, true);
    assert.ok(result!.recommended.has(0));
    assert.ok(result!.recommended.has(1));
  });

  it('returns null when fluent ratio < 80%', () => {
    const started = [rec(0, 5, 0, 5)]; // 50%
    assert.equal(checkReviewMode(started, false), null);
  });

  it('returns null when unstarted groups exist', () => {
    const started = [rec(0, 1, 0, 9)]; // 90% but has unstarted
    assert.equal(checkReviewMode(started, true), null);
  });

  it('returns null for empty started', () => {
    assert.equal(checkReviewMode([], false), null);
  });
});

// ---------------------------------------------------------------------------
// selectConsolidation
// ---------------------------------------------------------------------------

describe('selectConsolidation', () => {
  it('selects groups above median work', () => {
    const started = [rec(0, 8, 2, 0), rec(1, 1, 0, 9), rec(2, 5, 3, 2)];
    // work: [10, 1, 8]. Sorted desc: [10, 8, 1]. Median = 8. Above 8: group 0 (10).
    const { indices, totalWork } = selectConsolidation(started);
    assert.deepStrictEqual(indices, [0]);
    assert.equal(totalWork, 10);
  });

  it('falls back to highest-work group when all equal', () => {
    const started = [rec(0, 5, 0, 5), rec(1, 5, 0, 5)];
    // work: [5, 5]. Median = 5. None > 5 → fallback to first (index 0, lower).
    const { indices } = selectConsolidation(started);
    assert.equal(indices.length, 1);
    assert.equal(indices[0], 0);
  });

  it('breaks ties deterministically by string index', () => {
    const started = [rec(3, 5, 5, 0), rec(1, 5, 5, 0), rec(5, 5, 5, 0)];
    // All work=10. Median=10. None > 10 → fallback. Sorted by work desc
    // then string asc: [1, 3, 5]. Fallback = 1.
    const { indices } = selectConsolidation(started);
    assert.equal(indices[0], 1);
  });
});

// ---------------------------------------------------------------------------
// capConsolidation
// ---------------------------------------------------------------------------

describe('capConsolidation', () => {
  it('trims groups to fit budget', () => {
    const getWork = (idx: number) => idx === 0 ? 15 : idx === 1 ? 12 : 10;
    const { indices, totalWork } = capConsolidation([0, 1, 2], getWork, 30);
    // Sorted by work desc: [0(15), 1(12), 2(10)]. 15+12=27 ≤ 30. 27+10=37 > 30.
    assert.deepStrictEqual(indices, [0, 1]);
    assert.equal(totalWork, 27);
  });

  it('keeps at least one group even if it exceeds budget', () => {
    const { indices, totalWork } = capConsolidation([0], () => 50, 30);
    assert.deepStrictEqual(indices, [0]);
    assert.equal(totalWork, 50);
  });

  it('returns empty for empty input', () => {
    const { indices, totalWork } = capConsolidation([], () => 0, 30);
    assert.deepStrictEqual(indices, []);
    assert.equal(totalWork, 0);
  });

  it('breaks ties deterministically by index', () => {
    // Indices 5, 2, 8 all have work=10. Budget=15 → keeps only one.
    // Sorted: 2(10), 5(10), 8(10) by work desc then index asc → all equal
    // work → sorted by index: [2, 5, 8]. Takes 2 (10 ≤ 15), then 5 would
    // be 20 > 15 → stop.
    const { indices } = capConsolidation([5, 2, 8], () => 10, 15);
    assert.equal(indices[0], 2);
    assert.equal(indices.length, 1);
  });
});

// ---------------------------------------------------------------------------
// selectExpansion
// ---------------------------------------------------------------------------

describe('selectExpansion', () => {
  it('returns first unstarted group when level meets threshold', () => {
    const unstarted = [rec(1, 0, 10, 0), rec(2, 0, 10, 0)];
    const result = selectExpansion(0.8, 0.7, unstarted);
    assert.ok(result);
    assert.equal(result!.index, 1);
    assert.equal(result!.count, 10);
  });

  it('respects sortFn', () => {
    const unstarted = [rec(1, 0, 10, 0), rec(2, 0, 5, 0)];
    const result = selectExpansion(
      0.8,
      0.7,
      unstarted,
      (a, b) => a.totalCount - b.totalCount,
    );
    assert.equal(result!.index, 2);
  });

  it('returns null when level below threshold', () => {
    const unstarted = [rec(1, 0, 10, 0)];
    assert.equal(selectExpansion(0.5, 0.7, unstarted), null);
  });

  it('returns null when no unstarted groups', () => {
    assert.equal(selectExpansion(0.8, 0.7, []), null);
  });

  it('expands at exact threshold', () => {
    const unstarted = [rec(1, 0, 10, 0)];
    const result = selectExpansion(0.7, 0.7, unstarted);
    assert.ok(result);
  });
});

// ---------------------------------------------------------------------------
// detectStaleGroups
// ---------------------------------------------------------------------------

describe('detectStaleGroups', () => {
  it('detects stale groups (fast speed, low freshness)', () => {
    const result = detectStaleGroups(
      [0],
      () => ['a', 'b'],
      () => 0.8,
      () => 0.2,
    );
    assert.deepStrictEqual(result, [0]);
  });

  it('returns undefined when freshness is high', () => {
    assert.equal(
      detectStaleGroups([0], () => ['a'], () => 0.8, () => 0.8),
      undefined,
    );
  });

  it('returns undefined when speed is low', () => {
    assert.equal(
      detectStaleGroups([0], () => ['a'], () => 0.3, () => 0.2),
      undefined,
    );
  });

  it('skips items with null scores', () => {
    // Only item has null speed → count=0 → not stale.
    assert.equal(
      detectStaleGroups([0], () => ['a'], () => null, () => 0.2),
      undefined,
    );
  });
});

// ---------------------------------------------------------------------------
// computeRecommendations — integration tests
// ---------------------------------------------------------------------------

describe('computeRecommendations', () => {
  it('recommends first unstarted group on fresh start', () => {
    const data = {
      0: { workingCount: 0, unseenCount: 10, fluentCount: 0, totalCount: 10 },
      1: { workingCount: 0, unseenCount: 10, fluentCount: 0, totalCount: 10 },
    };
    const result = computeRecommendations(
      mockSelector(data),
      [0, 1],
      makeGetItemIds(data),
      config,
    );
    assert.ok(result.recommended.has(0));
    assert.equal(result.expandIndex, 0);
    assert.equal(result.expandNewCount, 10);
  });

  it('uses sortUnstarted on fresh start', () => {
    const data = {
      0: { workingCount: 0, unseenCount: 10, fluentCount: 0, totalCount: 10 },
      1: { workingCount: 0, unseenCount: 5, fluentCount: 0, totalCount: 5 },
    };
    const result = computeRecommendations(
      mockSelector(data),
      [0, 1],
      makeGetItemIds(data),
      config,
      { sortUnstarted: (a, b) => a.totalCount - b.totalCount },
    );
    assert.equal(result.expandIndex, 1);
    assert.equal(result.expandNewCount, 5);
  });

  it('recommends the single started item', () => {
    const data = {
      0: { workingCount: 3, unseenCount: 5, fluentCount: 2, totalCount: 10 },
      1: { workingCount: 0, unseenCount: 10, fluentCount: 0, totalCount: 10 },
    };
    const result = computeRecommendations(
      mockSelector(data),
      [0, 1],
      makeGetItemIds(data),
      config,
    );
    assert.ok(result.recommended.has(0));
    assert.ok(result.enabled!.has(0));
  });

  it('does not expand when level automaticity below threshold', () => {
    const data = {
      0: { workingCount: 3, unseenCount: 2, fluentCount: 2, totalCount: 7 },
      1: { workingCount: 0, unseenCount: 10, fluentCount: 0, totalCount: 10 },
    };
    const result = computeRecommendations(
      mockSelector(data),
      [0, 1],
      makeGetItemIds(data),
      config,
    );
    assert.ok(!result.recommended.has(1));
  });

  it('expands when level automaticity meets threshold', () => {
    const data = {
      0: { workingCount: 0, unseenCount: 0, fluentCount: 10, totalCount: 10 },
      1: { workingCount: 0, unseenCount: 10, fluentCount: 0, totalCount: 10 },
    };
    const result = computeRecommendations(
      mockSelector(data),
      [0, 1],
      makeGetItemIds(data),
      config,
    );
    assert.ok(result.recommended.has(1));
    assert.ok(result.enabled!.has(1));
  });

  it('recommends items above median work', () => {
    const data = {
      0: { workingCount: 8, unseenCount: 2, fluentCount: 0, totalCount: 10 },
      1: { workingCount: 1, unseenCount: 0, fluentCount: 9, totalCount: 10 },
      2: { workingCount: 5, unseenCount: 3, fluentCount: 2, totalCount: 10 },
    };
    const result = computeRecommendations(
      mockSelector(data),
      [0, 1, 2],
      makeGetItemIds(data),
      config,
    );
    assert.ok(result.recommended.has(0));
    assert.ok(!result.recommended.has(1));
  });

  it('uses sortUnstarted to pick expansion target', () => {
    const data = {
      0: { workingCount: 0, unseenCount: 0, fluentCount: 10, totalCount: 10 },
      1: { workingCount: 0, unseenCount: 10, fluentCount: 0, totalCount: 10 },
      2: { workingCount: 0, unseenCount: 10, fluentCount: 0, totalCount: 10 },
    };
    const result = computeRecommendations(
      mockSelector(data),
      [0, 1, 2],
      makeGetItemIds(data),
      config,
      { sortUnstarted: (a, b) => a.string - b.string },
    );
    assert.ok(result.recommended.has(1));
    assert.ok(!result.recommended.has(2));
  });

  it('always recommends at least one item when data exists', () => {
    const data = {
      0: { workingCount: 0, unseenCount: 0, fluentCount: 10, totalCount: 10 },
      1: { workingCount: 0, unseenCount: 0, fluentCount: 10, totalCount: 10 },
    };
    const result = computeRecommendations(
      mockSelector(data),
      [0, 1],
      makeGetItemIds(data),
      config,
    );
    assert.ok(result.recommended.size >= 1);
    assert.ok(result.enabled!.size >= 1);
  });

  it('expands at exactly the threshold level', () => {
    const data = {
      0: { workingCount: 0, unseenCount: 0, fluentCount: 10, totalCount: 10 },
      1: { workingCount: 0, unseenCount: 10, fluentCount: 0, totalCount: 10 },
    };
    const result = computeRecommendations(
      mockSelector(data),
      [0, 1],
      makeGetItemIds(data),
      { expansionThreshold: 0.9 },
    );
    assert.ok(result.recommended.has(1));
  });

  it('does not expand just below the threshold', () => {
    const data = {
      0: { workingCount: 10, unseenCount: 0, fluentCount: 0, totalCount: 10 },
      1: { workingCount: 0, unseenCount: 10, fluentCount: 0, totalCount: 10 },
    };
    const result = computeRecommendations(
      mockSelector(data),
      [0, 1],
      makeGetItemIds(data),
      { expansionThreshold: 0.31 },
    );
    assert.ok(!result.recommended.has(1));
  });

  // --- Skipped groups ---

  it('skipped group is excluded from recommendations', () => {
    const data = {
      0: { workingCount: 5, unseenCount: 0, fluentCount: 5, totalCount: 10 },
      1: { workingCount: 5, unseenCount: 5, fluentCount: 0, totalCount: 10 },
      2: { workingCount: 0, unseenCount: 10, fluentCount: 0, totalCount: 10 },
      3: { workingCount: 0, unseenCount: 10, fluentCount: 0, totalCount: 10 },
    };
    const result = computeRecommendations(
      mockSelector(data),
      [0, 2, 3], // group 1 skipped
      makeGetItemIds(data),
      config,
    );
    assert.ok(!result.recommended.has(1));
  });

  it('expansion skips past skipped group', () => {
    const data = {
      0: { workingCount: 0, unseenCount: 0, fluentCount: 10, totalCount: 10 },
      1: { workingCount: 0, unseenCount: 10, fluentCount: 0, totalCount: 10 },
      2: { workingCount: 0, unseenCount: 10, fluentCount: 0, totalCount: 10 },
    };
    const result = computeRecommendations(
      mockSelector(data),
      [0, 2], // group 1 skipped
      makeGetItemIds(data),
      config,
      { sortUnstarted: (a, b) => a.string - b.string },
    );
    assert.equal(result.expandIndex, 2);
  });

  // --- Cap ---

  it('caps work items: 5 groups × 10 working → ≤3 recommended', () => {
    const data = {
      0: { workingCount: 10, unseenCount: 0, fluentCount: 0, totalCount: 10 },
      1: { workingCount: 10, unseenCount: 0, fluentCount: 0, totalCount: 10 },
      2: { workingCount: 10, unseenCount: 0, fluentCount: 0, totalCount: 10 },
      3: { workingCount: 10, unseenCount: 0, fluentCount: 0, totalCount: 10 },
      4: { workingCount: 10, unseenCount: 0, fluentCount: 0, totalCount: 10 },
    };
    const result = computeRecommendations(
      mockSelector(data),
      [0, 1, 2, 3, 4],
      makeGetItemIds(data),
      { expansionThreshold: 0.7, maxWorkItems: 30 },
    );
    assert.ok(result.consolidateWorkingCount <= 30);
    assert.ok(result.consolidateIndices.length <= 3);
  });

  it('cap keeps at least one group even if it exceeds cap', () => {
    const data = {
      0: { workingCount: 40, unseenCount: 0, fluentCount: 0, totalCount: 40 },
    };
    const result = computeRecommendations(
      mockSelector(data),
      [0],
      makeGetItemIds(data),
      { expansionThreshold: 0.7, maxWorkItems: 30 },
    );
    assert.ok(result.recommended.has(0));
    assert.equal(result.consolidateIndices.length, 1);
  });

  // --- Review mode ---

  it('triggers review mode when all started and ≥80% fluent', () => {
    const data = {
      0: { workingCount: 1, unseenCount: 0, fluentCount: 9, totalCount: 10 },
      1: { workingCount: 1, unseenCount: 0, fluentCount: 9, totalCount: 10 },
    };
    const result = computeRecommendations(
      mockSelector(data),
      [0, 1],
      makeGetItemIds(data),
      config,
    );
    assert.equal(result.reviewMode, true);
    assert.ok(result.recommended.has(0));
    assert.ok(result.recommended.has(1));
  });

  it('does not trigger review mode when fluent ratio < 80%', () => {
    const data = {
      0: { workingCount: 5, unseenCount: 0, fluentCount: 5, totalCount: 10 },
      1: { workingCount: 5, unseenCount: 0, fluentCount: 5, totalCount: 10 },
    };
    const result = computeRecommendations(
      mockSelector(data),
      [0, 1],
      makeGetItemIds(data),
      config,
    );
    assert.ok(!result.reviewMode);
  });

  it('does not trigger review mode with unstarted groups', () => {
    const data = {
      0: { workingCount: 1, unseenCount: 0, fluentCount: 9, totalCount: 10 },
      1: { workingCount: 0, unseenCount: 10, fluentCount: 0, totalCount: 10 },
    };
    const result = computeRecommendations(
      mockSelector(data),
      [0, 1],
      makeGetItemIds(data),
      config,
    );
    assert.ok(!result.reviewMode);
  });

  // --- Stale detection ---

  it('marks stale group (high speed + low freshness)', () => {
    const data = {
      0: { workingCount: 5, unseenCount: 0, fluentCount: 5, totalCount: 10 },
    };
    const sel: RecommendationSelector = {
      ...mockSelector(data),
      getSpeedScore: () => 0.8,
      getFreshness: () => 0.2,
    };
    const result = computeRecommendations(
      sel,
      [0],
      makeGetItemIds(data),
      config,
    );
    assert.deepStrictEqual(result.staleIndices, [0]);
  });

  it('no stale when freshness is high', () => {
    const data = {
      0: { workingCount: 5, unseenCount: 0, fluentCount: 5, totalCount: 10 },
    };
    const sel: RecommendationSelector = {
      ...mockSelector(data),
      getSpeedScore: () => 0.8,
      getFreshness: () => 0.8,
    };
    const result = computeRecommendations(
      sel,
      [0],
      makeGetItemIds(data),
      config,
    );
    assert.equal(result.staleIndices, undefined);
  });

  it('staleIndices undefined when selector lacks speed/freshness', () => {
    const data = {
      0: { workingCount: 5, unseenCount: 0, fluentCount: 5, totalCount: 10 },
    };
    const result = computeRecommendations(
      mockSelector(data),
      [0],
      makeGetItemIds(data),
      config,
    );
    assert.equal(result.staleIndices, undefined);
  });

  // --- Skip/unskip symmetry ---

  it('unskipped group reappears in recommendations', () => {
    const data = {
      0: { workingCount: 0, unseenCount: 0, fluentCount: 10, totalCount: 10 },
      1: { workingCount: 0, unseenCount: 10, fluentCount: 0, totalCount: 10 },
      2: { workingCount: 0, unseenCount: 10, fluentCount: 0, totalCount: 10 },
    };
    const sel = mockSelector(data);
    const getIds = makeGetItemIds(data);
    const sort = { sortUnstarted: (a: any, b: any) => a.string - b.string };

    const r1 = computeRecommendations(sel, [0, 1, 2], getIds, config, sort);
    assert.equal(r1.expandIndex, 1);

    const r2 = computeRecommendations(sel, [0, 2], getIds, config, sort);
    assert.equal(r2.expandIndex, 2);

    const r3 = computeRecommendations(sel, [0, 1, 2], getIds, config, sort);
    assert.equal(r3.expandIndex, 1);
  });

  it('unskipped consolidation group reappears', () => {
    const data = {
      0: { workingCount: 8, unseenCount: 2, fluentCount: 0, totalCount: 10 },
      1: { workingCount: 7, unseenCount: 2, fluentCount: 1, totalCount: 10 },
      2: { workingCount: 1, unseenCount: 0, fluentCount: 9, totalCount: 10 },
      3: { workingCount: 1, unseenCount: 0, fluentCount: 9, totalCount: 10 },
    };
    const sel = mockSelector(data);
    const getIds = makeGetItemIds(data);

    const r1 = computeRecommendations(sel, [0, 1, 2, 3], getIds, config);
    assert.ok(r1.recommended.has(0));
    assert.ok(r1.recommended.has(1));

    const r2 = computeRecommendations(sel, [0, 2, 3], getIds, config);
    assert.ok(!r2.recommended.has(1));

    const r3 = computeRecommendations(sel, [0, 1, 2, 3], getIds, config);
    assert.ok(r3.recommended.has(0));
    assert.ok(r3.recommended.has(1));
  });
});

// ---------------------------------------------------------------------------
// Timestamp consistency — all selector calls receive the same nowMs
// ---------------------------------------------------------------------------

describe('single-timestamp consistency', () => {
  it('passes the same nowMs to getStringRecommendations and getLevelAutomaticity', () => {
    const timestamps: number[] = [];
    const data = {
      0: { workingCount: 3, unseenCount: 2, fluentCount: 5, totalCount: 10 },
      1: { workingCount: 0, unseenCount: 10, fluentCount: 0, totalCount: 10 },
    };
    const sel: RecommendationSelector = {
      getStringRecommendations(indices, getIds, nowMs) {
        timestamps.push(nowMs!);
        return mockSelector(data).getStringRecommendations(indices, getIds);
      },
      getLevelAutomaticity(itemIds, percentile, nowMs) {
        timestamps.push(nowMs!);
        return mockSelector(data).getLevelAutomaticity(itemIds, percentile);
      },
    };
    computeRecommendations(sel, [0, 1], makeGetItemIds(data), config);
    assert.equal(timestamps.length, 2);
    assert.equal(timestamps[0], timestamps[1]);
  });

  it('passes nowMs to getFreshness for stale detection', () => {
    const freshnessTimestamps: number[] = [];
    const data = {
      0: { workingCount: 5, unseenCount: 0, fluentCount: 5, totalCount: 10 },
    };
    const sel: RecommendationSelector = {
      ...mockSelector(data),
      getSpeedScore: () => 0.8,
      getFreshness: (_id: string, nowMs?: number) => {
        if (nowMs !== undefined) freshnessTimestamps.push(nowMs);
        return 0.2;
      },
    };
    computeRecommendations(sel, [0], makeGetItemIds(data), config);
    // All freshness calls should have received the same timestamp.
    assert.ok(freshnessTimestamps.length > 0);
    const first = freshnessTimestamps[0];
    for (const ts of freshnessTimestamps) {
      assert.equal(ts, first);
    }
  });
});

// ---------------------------------------------------------------------------
// Real data: determinism and skip/unskip symmetry with real AdaptiveSelector
// ---------------------------------------------------------------------------

// Exact localStorage snapshot from a user who reported the bug.
const REAL_FRETBOARD_DATA: Record<string, string> = JSON.parse(
  '{"adaptive_fretboard_4-8":"{\\"recentTimes\\":[3772],\\"ewma\\":3772,\\"sampleCount\\":1,\\"lastSeen\\":1773248142139,\\"stability\\":4,\\"lastCorrectAt\\":1773248142139}","adaptive_fretboard_5-8":"{\\"recentTimes\\":[3987,3086,1428,648,1078,1420,8136,4734,1815,1313],\\"ewma\\":2747.0773782019996,\\"sampleCount\\":11,\\"lastSeen\\":1773182605495,\\"stability\\":336,\\"lastCorrectAt\\":1773182605495}","adaptive_fretboard_3-5":"{\\"recentTimes\\":[3856,8136,6713,7970,1357],\\"ewma\\":4830.631,\\"sampleCount\\":5,\\"lastSeen\\":1773248132425,\\"stability\\":16.759656083650363,\\"lastCorrectAt\\":1773248132425}","adaptive_fretboard_1-8":"{\\"recentTimes\\":[871,5096,1876,1728,828,3890,1736,1263,799,1664],\\"ewma\\":1817.5409725226998,\\"sampleCount\\":10,\\"lastSeen\\":1771203823812,\\"stability\\":336,\\"lastCorrectAt\\":1771203823812}","adaptive_fretboard_3-12":"{\\"recentTimes\\":[2778,2031,1850,4208,4587,4209,2371,1471],\\"ewma\\":2726.7801710999993,\\"sampleCount\\":8,\\"lastSeen\\":1773248151535,\\"stability\\":336,\\"lastCorrectAt\\":1773248151535}","adaptive_fretboard_0-2":"{\\"recentTimes\\":[2950,7254,4332,5710,1821],\\"ewma\\":3836.9356,\\"sampleCount\\":5,\\"lastSeen\\":1771872295786,\\"stability\\":10.740694789081886,\\"lastCorrectAt\\":1771872295786}","adaptive_fretboard_2-7":"{\\"recentTimes\\":[7254,7254,3371,5182],\\"ewma\\":5816.969999999999,\\"sampleCount\\":4,\\"lastSeen\\":1772142000564,\\"stability\\":4,\\"lastCorrectAt\\":1772141995919}","adaptive_fretboard_3-7":"{\\"recentTimes\\":[3405,5021],\\"ewma\\":3889.8,\\"sampleCount\\":2,\\"lastSeen\\":1772492901801,\\"stability\\":7.445796460176991,\\"lastCorrectAt\\":1772492901801}","adaptive_fretboard_0-6":"{\\"recentTimes\\":[3722,6921,5081,7254,7254],\\"ewma\\":6052.270099999998,\\"sampleCount\\":5,\\"lastSeen\\":1771871799787,\\"stability\\":4,\\"lastCorrectAt\\":1771871799787}","adaptive_fretboard_0-7":"{\\"recentTimes\\":[2120,1414,1098,1411,1682,891,1221,1461,1593,2949],\\"ewma\\":1944.8417878070168,\\"sampleCount\\":16,\\"lastSeen\\":1773182636154,\\"stability\\":336,\\"lastCorrectAt\\":1773182636154}","adaptive_fretboard_2-1":"{\\"recentTimes\\":[1973,2243,6467],\\"ewma\\":6729.695999999998,\\"sampleCount\\":3,\\"lastSeen\\":1772002972408,\\"stability\\":4,\\"lastCorrectAt\\":1771817189850}","adaptive_fretboard_2-5":"{\\"recentTimes\\":[3564],\\"ewma\\":3564,\\"sampleCount\\":1,\\"lastSeen\\":1771954933997,\\"stability\\":4,\\"lastCorrectAt\\":1771954933997}","adaptive_fretboard_2-3":"{\\"recentTimes\\":[3187,3029],\\"ewma\\":3139.5999999999995,\\"sampleCount\\":2,\\"lastSeen\\":1771895882544,\\"stability\\":4,\\"lastCorrectAt\\":1771807982121}","adaptive_fretboard_1-1":"{\\"recentTimes\\":[1126,1186,875,1988],\\"ewma\\":1340.71,\\"sampleCount\\":4,\\"lastSeen\\":1773248153764,\\"stability\\":336,\\"lastCorrectAt\\":1773248153764}","adaptive_fretboard_5-1":"{\\"recentTimes\\":[1306,1092,1139,1442,1083,1264,940,1129,1083,1311],\\"ewma\\":1168.6572755495697,\\"sampleCount\\":12,\\"lastSeen\\":1773182615007,\\"stability\\":336,\\"lastCorrectAt\\":1773182615007}","adaptive_fretboard_2-2":"{\\"recentTimes\\":[],\\"ewma\\":7254,\\"sampleCount\\":0,\\"lastSeen\\":1771883879332,\\"stability\\":4,\\"lastCorrectAt\\":null}","adaptive_fretboard_3-0":"{\\"recentTimes\\":[2060,1954,1782,2544,8136],\\"ewma\\":3932.6665999999996,\\"sampleCount\\":5,\\"lastSeen\\":1772645217331,\\"stability\\":74.25266141736529,\\"lastCorrectAt\\":1772645217331}","adaptive_fretboard_5-7":"{\\"recentTimes\\":[1597,1524,1174,2224,1521,1274,1035,1419,1132,1821],\\"ewma\\":1465.8730388109996,\\"sampleCount\\":10,\\"lastSeen\\":1773182613409,\\"stability\\":336,\\"lastCorrectAt\\":1773182613409}","adaptive_fretboard_2-6":"{\\"recentTimes\\":[3405,7254,1973],\\"ewma\\":6644.309999999999,\\"sampleCount\\":3,\\"lastSeen\\":1771895920470,\\"stability\\":10.55210918114144,\\"lastCorrectAt\\":1771895920470}","adaptive_fretboard_0-11":"{\\"recentTimes\\":[5090,4761,7254,4816,2968,2469],\\"ewma\\":4016.7797299999993,\\"sampleCount\\":6,\\"lastSeen\\":1771871808434,\\"stability\\":23.146650585866542,\\"lastCorrectAt\\":1771871808434}","adaptive_fretboard_0-8":"{\\"recentTimes\\":[1329,1005,1478,1466,1710,1523,1391,1271,2051,3728],\\"ewma\\":2357.428194300008,\\"sampleCount\\":13,\\"lastSeen\\":1773182629753,\\"stability\\":336,\\"lastCorrectAt\\":1773182629753}","adaptive_fretboard_0-3":"{\\"recentTimes\\":[1300,1400,1495,1157,6247,1738,1260,1396,3053],\\"ewma\\":2243.7255024999995,\\"sampleCount\\":9,\\"lastSeen\\":1773182620005,\\"stability\\":336,\\"lastCorrectAt\\":1773182620005}","adaptive_fretboard_5-3":"{\\"recentTimes\\":[1010,2281,1446,2201,1163,1076,1463,1374,1823,3189],\\"ewma\\":2056.984586621854,\\"sampleCount\\":15,\\"lastSeen\\":1773182623376,\\"stability\\":336,\\"lastCorrectAt\\":1773182623376}","adaptive_fretboard_3-3":"{\\"recentTimes\\":[3971,3760],\\"ewma\\":3907.7,\\"sampleCount\\":2,\\"lastSeen\\":1773248130547,\\"stability\\":8.84070796460177,\\"lastCorrectAt\\":1773248130547}","adaptive_fretboard_0-12":"{\\"recentTimes\\":[4518,1274,1616,2290,1010,1023,933,926,881,1118],\\"ewma\\":1142.6651644639396,\\"sampleCount\\":12,\\"lastSeen\\":1773182625935,\\"stability\\":336,\\"lastCorrectAt\\":1773182625935}","adaptive_fretboard_5-10":"{\\"recentTimes\\":[1131,2771,4251,1110,1798,2693,1065,4937,1645,2765],\\"ewma\\":2609.3688168630997,\\"sampleCount\\":14,\\"lastSeen\\":1773248156807,\\"stability\\":336,\\"lastCorrectAt\\":1773248156807}","adaptive_fretboard_2-11":"{\\"recentTimes\\":[5818],\\"ewma\\":6823.199999999999,\\"sampleCount\\":1,\\"lastSeen\\":1772092282506,\\"stability\\":4,\\"lastCorrectAt\\":1772092267707}","adaptive_fretboard_0-1":"{\\"recentTimes\\":[797,1691,1171,1123,1007,1027,1261,1325,1094],\\"ewma\\":1155.7061870599998,\\"sampleCount\\":9,\\"lastSeen\\":1773182633102,\\"stability\\":336,\\"lastCorrectAt\\":1773182633102}","adaptive_fretboard_1-6":"{\\"recentTimes\\":[1928,7019,6005,1661,3408,8136,6842],\\"ewma\\":5446.325320999999,\\"sampleCount\\":7,\\"lastSeen\\":1773248163895,\\"stability\\":14.106073898891264,\\"lastCorrectAt\\":1773248163895}","adaptive_fretboard_5-0":"{\\"recentTimes\\":[620,1472,1433,867,996,1060,792,993,893,1215],\\"ewma\\":1061.1927460891998,\\"sampleCount\\":11,\\"lastSeen\\":1773182591852,\\"stability\\":336,\\"lastCorrectAt\\":1773182591852}","adaptive_fretboard_5-5":"{\\"recentTimes\\":[2727,3301,1312,1933,1880,1299,6191,1012,763,1479],\\"ewma\\":1818.4871432764696,\\"sampleCount\\":12,\\"lastSeen\\":1773182600575,\\"stability\\":336,\\"lastCorrectAt\\":1773182600575}","adaptive_fretboard_3-6":"{\\"recentTimes\\":[7254,2890,7254,4523,1695,8136],\\"ewma\\":5596.2369629999985,\\"sampleCount\\":6,\\"lastSeen\\":1772668743879,\\"stability\\":15.703749769256847,\\"lastCorrectAt\\":1772492918342}","adaptive_fretboard_2-12":"{\\"recentTimes\\":[2824,3075,3514,2451],\\"ewma\\":2893.897,\\"sampleCount\\":4,\\"lastSeen\\":1772002981759,\\"stability\\":49.39632811142708,\\"lastCorrectAt\\":1772002981759}","adaptive_fretboard_0-10":"{\\"recentTimes\\":[3047,1263,1202,1481,1302,1480,1004,2531,1368,3122],\\"ewma\\":2121.869794115104,\\"sampleCount\\":16,\\"lastSeen\\":1773248101097,\\"stability\\":336,\\"lastCorrectAt\\":1773248101097}","adaptive_fretboard_0-9":"{\\"recentTimes\\":[7254,7254],\\"ewma\\":7090.829999999999,\\"sampleCount\\":2,\\"lastSeen\\":1771872277429,\\"stability\\":4,\\"lastCorrectAt\\":1771870196896}","adaptive_fretboard_2-8":"{\\"recentTimes\\":[2903,7254],\\"ewma\\":8540.88,\\"sampleCount\\":2,\\"lastSeen\\":1772003009806,\\"stability\\":9.398263027295286,\\"lastCorrectAt\\":1772003009806}","adaptive_fretboard_1-12":"{\\"recentTimes\\":[1588,1197,939,1118,1059],\\"ewma\\":1194.9630999999997,\\"sampleCount\\":5,\\"lastSeen\\":1771203821883,\\"stability\\":324,\\"lastCorrectAt\\":1771203821883}","adaptive_fretboard_5-12":"{\\"recentTimes\\":[982,614,1369,2712,1189],\\"ewma\\":1426.4218,\\"sampleCount\\":5,\\"lastSeen\\":1773182624714,\\"stability\\":255.2944855486987,\\"lastCorrectAt\\":1773182624714}","adaptive_fretboard_1-0":"{\\"recentTimes\\":[4632,871,1528,942,1821],\\"ewma\\":2170.5050999999994,\\"sampleCount\\":5,\\"lastSeen\\":1773248108008,\\"stability\\":292.3879443851083,\\"lastCorrectAt\\":1773248108008}","adaptive_fretboard_1-3":"{\\"recentTimes\\":[3451,849,2379,4952,2029,1269,678,1082,1092,3008],\\"ewma\\":1941.7493432139995,\\"sampleCount\\":10,\\"lastSeen\\":1773248145673,\\"stability\\":336,\\"lastCorrectAt\\":1773248145673}","adaptive_fretboard_1-5":"{\\"recentTimes\\":[1550,970,1638,736],\\"ewma\\":1239.02,\\"sampleCount\\":4,\\"lastSeen\\":1771203830314,\\"stability\\":105.70344827586206,\\"lastCorrectAt\\":1771203830314}","adaptive_fretboard_3-11":"{\\"recentTimes\\":[6921,6552,3270,4505,5941,7015,4263,4687],\\"ewma\\":5234.460704699999,\\"sampleCount\\":8,\\"lastSeen\\":1772668741109,\\"stability\\":150.50826248134035,\\"lastCorrectAt\\":1772668741109}","adaptive_fretboard_3-1":"{\\"recentTimes\\":[2580,4877,6917,1827,5275,5408],\\"ewma\\":5045.2806359999995,\\"sampleCount\\":6,\\"lastSeen\\":1772646207221,\\"stability\\":37.25533204757478,\\"lastCorrectAt\\":1772646207221}","adaptive_fretboard_3-4":"{\\"recentTimes\\":[7254,3007,7254,7254,6555,8136,5304],\\"ewma\\":6537.329012999999,\\"sampleCount\\":7,\\"lastSeen\\":1772646200809,\\"stability\\":4,\\"lastCorrectAt\\":1772492878606}","adaptive_fretboard_2-4":"{\\"recentTimes\\":[10565,5106,7254,6996],\\"ewma\\":7996.516999999998,\\"sampleCount\\":4,\\"lastSeen\\":1772141980041,\\"stability\\":5.261061946902655,\\"lastCorrectAt\\":1772141980041}","adaptive_fretboard_2-9":"{\\"recentTimes\\":[8321,2529,6559,7254,3833,1604],\\"ewma\\":4608.063439999999,\\"sampleCount\\":6,\\"lastSeen\\":1772141998525,\\"stability\\":24.58407936212702,\\"lastCorrectAt\\":1772141998525}","adaptive_fretboard_0-5":"{\\"recentTimes\\":[3156,3344,2787,2059,5734,1165,1826,1201,1387,1552],\\"ewma\\":1835.1253162541996,\\"sampleCount\\":11,\\"lastSeen\\":1773182590089,\\"stability\\":336,\\"lastCorrectAt\\":1773182590089}","adaptive_fretboard_3-10":"{\\"recentTimes\\":[4316,6314,1322,4897,6469,8136,4307,3808],\\"ewma\\":5184.526058879998,\\"sampleCount\\":8,\\"lastSeen\\":1773248105552,\\"stability\\":336,\\"lastCorrectAt\\":1773248105552}","adaptive_fretboard_3-9":"{\\"recentTimes\\":[4160,4412,8136,2109],\\"ewma\\":4416.704,\\"sampleCount\\":4,\\"lastSeen\\":1773248126437,\\"stability\\":10.667035398230087,\\"lastCorrectAt\\":1773248126437}","adaptive_fretboard_0-0":"{\\"recentTimes\\":[1302,755,2624,1041,979,1148,1108,1007,1510,1428],\\"ewma\\":1306.763557239,\\"sampleCount\\":10,\\"lastSeen\\":1773248149679,\\"stability\\":336,\\"lastCorrectAt\\":1773248149679}","adaptive_fretboard_3-8":"{\\"recentTimes\\":[7254,6350,7254,3970,8136],\\"ewma\\":6735.938399999999,\\"sampleCount\\":5,\\"lastSeen\\":1772646185066,\\"stability\\":8.074441687344912,\\"lastCorrectAt\\":1772646185066}","adaptive_fretboard_1-10":"{\\"recentTimes\\":[1671,1249,1364],\\"ewma\\":1490.28,\\"sampleCount\\":3,\\"lastSeen\\":1771203815249,\\"stability\\":35.864367816091956,\\"lastCorrectAt\\":1771203815249}","adaptive_fretboard_0-4":"{\\"recentTimes\\":[5254,4069,4075,7254,5317],\\"ewma\\":5397.6505,\\"sampleCount\\":5,\\"lastSeen\\":1771872292963,\\"stability\\":4,\\"lastCorrectAt\\":1771871790763}"}',
);

const GUITAR_GROUP_LABELS = [
  'E e',
  'A',
  'D',
  'G',
  'B',
  'E A \u266F\u266D',
  'D G \u266F\u266D',
  'B e \u266F\u266D',
];
const ALL_GUITAR_GROUPS = [0, 1, 2, 3, 4, 5, 6, 7];

/** Load the real user data snapshot into a memory-backed selector. */
function createRealDataSelector() {
  const storage = createMemoryStorage();
  const prefix = 'adaptive_fretboard_';
  for (const [key, value] of Object.entries(REAL_FRETBOARD_DATA)) {
    if (key.startsWith(prefix)) {
      const itemId = key.slice(prefix.length);
      storage.saveStats(itemId, JSON.parse(value) as ItemStats);
    }
  }
  return createAdaptiveSelector(storage);
}

function getItemIds(groupIndex: number): string[] {
  return guitarGetItemIds(GUITAR, groupIndex);
}

function recText(
  selector: ReturnType<typeof createAdaptiveSelector>,
  indices: number[],
) {
  const rec = computeRecommendations(
    selector,
    indices,
    getItemIds,
    { expansionThreshold: 0.7 },
    { sortUnstarted: (a, b) => a.string - b.string },
  );
  const text = buildRecommendationText(
    rec,
    (i) => GUITAR_GROUP_LABELS[i],
  );
  return { rec, text };
}

describe('computeRecommendations — real fretboard data', () => {
  it('is deterministic: two consecutive calls produce identical results', () => {
    const sel = createRealDataSelector();
    const r1 = recText(sel, ALL_GUITAR_GROUPS);
    const r2 = recText(sel, ALL_GUITAR_GROUPS);
    assert.equal(r1.text, r2.text);
    assert.deepStrictEqual(
      r1.rec.consolidateIndices,
      r2.rec.consolidateIndices,
    );
    assert.equal(
      r1.rec.consolidateWorkingCount,
      r2.rec.consolidateWorkingCount,
    );
  });

  it('skip/unskip group 7 is symmetric', () => {
    const sel = createRealDataSelector();
    const before = recText(sel, ALL_GUITAR_GROUPS);
    recText(sel, [0, 1, 2, 3, 4, 5, 6]); // skip group 7
    const after = recText(sel, ALL_GUITAR_GROUPS);
    assert.equal(
      after.text,
      before.text,
      `unskip should restore original text.\n` +
        `  before: ${JSON.stringify(before.text)}\n` +
        `  after:  ${JSON.stringify(after.text)}`,
    );
  });

  it('skip/unskip every group is symmetric', () => {
    const sel = createRealDataSelector();
    const baseline = recText(sel, ALL_GUITAR_GROUPS);
    for (let i = 0; i < 8; i++) {
      const withoutI = ALL_GUITAR_GROUPS.filter((g) => g !== i);
      recText(sel, withoutI); // skip
      const restored = recText(sel, ALL_GUITAR_GROUPS); // unskip
      assert.equal(
        restored.text,
        baseline.text,
        `group ${i} "${
          GUITAR_GROUP_LABELS[i]
        }": unskip should restore baseline.`,
      );
    }
  });
});
