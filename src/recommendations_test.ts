import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { computeRecommendations } from './recommendations.ts';

// Helper: create a mock selector whose getStringRecommendations returns
// pre-built data keyed by index, and getLevelAutomaticity computes from
// per-item automaticity values derived from the group stats.
//
// Mock automaticity values:
//   Fluent items → 0.9   Working items → 0.3   Unseen items → 0 (null)
function mockSelector(
  dataByIndex: Record<number, {
    workingCount: number;
    unseenCount: number;
    fluentCount: number;
    totalCount: number;
  }>,
) {
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
        (b.workingCount + b.unseenCount) - (a.workingCount + a.unseenCount)
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
  dataByIndex: Record<number, {
    totalCount: number;
    [k: string]: number;
  }>,
) {
  return (i: number) => {
    const d = dataByIndex[i];
    const count = d ? d.totalCount : 1;
    return Array.from({ length: count }, (_, j) => `group-${i}-item-${j}`);
  };
}
const config = { expansionThreshold: 0.7 };

// ---------------------------------------------------------------------------
// No started items (first launch)
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
      {},
    );
    assert.ok(result.recommended.has(0), 'should recommend first group');
    assert.ok(result.enabled!.has(0), 'should enable first group');
    assert.equal(result.expandIndex, 0);
    assert.equal(result.expandNewCount, 10);
  });

  it('uses sortUnstarted on fresh start to pick first group', () => {
    const data = {
      0: { workingCount: 0, unseenCount: 10, fluentCount: 0, totalCount: 10 },
      1: { workingCount: 0, unseenCount: 5, fluentCount: 0, totalCount: 5 },
    };
    // Sort by totalCount ascending — should pick index 1 (5 items)
    const opts = {
      sortUnstarted: (a: any, b: any) => a.totalCount - b.totalCount,
    };
    const result = computeRecommendations(
      mockSelector(data),
      [0, 1],
      makeGetItemIds(data),
      config,
      opts,
    );
    assert.ok(result.recommended.has(1), 'should recommend sorted-first group');
    assert.equal(result.expandIndex, 1);
    assert.equal(result.expandNewCount, 5);
  });

  // ---------------------------------------------------------------------------
  // Single started item
  // ---------------------------------------------------------------------------

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
      {},
    );
    assert.ok(result.recommended.has(0));
    assert.ok(result.enabled!.has(0));
  });

  // ---------------------------------------------------------------------------
  // Level automaticity below threshold — no expansion
  // ---------------------------------------------------------------------------

  it('does not expand when level automaticity is below threshold', () => {
    // Group 0: 2F + 3W + 2U = 7 items. Mock autos: [0.9, 0.9, 0.3, 0.3, 0.3, 0, 0]
    // Sorted: [0, 0, 0.3, 0.3, 0.3, 0.9, 0.9]. p10 index=0 → level=0 < 0.7
    const data = {
      0: { workingCount: 3, unseenCount: 2, fluentCount: 2, totalCount: 7 },
      1: { workingCount: 0, unseenCount: 10, fluentCount: 0, totalCount: 10 },
    };
    const result = computeRecommendations(
      mockSelector(data),
      [0, 1],
      makeGetItemIds(data),
      config,
      {},
    );
    assert.ok(result.recommended.has(0));
    assert.ok(
      !result.recommended.has(1),
      'should not recommend unstarted index 1',
    );
  });

  // ---------------------------------------------------------------------------
  // Level automaticity above threshold — expansion
  // ---------------------------------------------------------------------------

  it('expands when level automaticity meets threshold', () => {
    // Group 0: all fluent → mock auto=0.9 for all. p10=0.9 >= 0.7 → gate opens
    const data = {
      0: { workingCount: 0, unseenCount: 0, fluentCount: 10, totalCount: 10 },
      1: { workingCount: 0, unseenCount: 10, fluentCount: 0, totalCount: 10 },
    };
    const result = computeRecommendations(
      mockSelector(data),
      [0, 1],
      makeGetItemIds(data),
      config,
      {},
    );
    assert.ok(result.recommended.has(1), 'should recommend unstarted index 1');
    assert.ok(result.enabled!.has(1));
  });

  // ---------------------------------------------------------------------------
  // Median-work ranking — recommends high-work items
  // ---------------------------------------------------------------------------

  it('recommends items above median work', () => {
    const data = {
      0: { workingCount: 8, unseenCount: 2, fluentCount: 0, totalCount: 10 }, // work=10
      1: { workingCount: 1, unseenCount: 0, fluentCount: 9, totalCount: 10 }, // work=1
      2: { workingCount: 5, unseenCount: 3, fluentCount: 2, totalCount: 10 }, // work=8
    };
    const result = computeRecommendations(
      mockSelector(data),
      [0, 1, 2],
      makeGetItemIds(data),
      config,
      {},
    );
    // median work = work of middle item after sort: [10, 8, 1] -> median = 8
    // Items with work > 8: index 0 (work=10)
    assert.ok(result.recommended.has(0));
    assert.ok(
      !result.recommended.has(1),
      'low-work item should not be recommended',
    );
  });

  // ---------------------------------------------------------------------------
  // sortUnstarted controls expansion order
  // ---------------------------------------------------------------------------

  it('uses sortUnstarted to pick expansion target', () => {
    // All fluent → level=0.9 >= 0.7 → gate opens
    const data = {
      0: { workingCount: 0, unseenCount: 0, fluentCount: 10, totalCount: 10 },
      1: { workingCount: 0, unseenCount: 10, fluentCount: 0, totalCount: 10 },
      2: { workingCount: 0, unseenCount: 10, fluentCount: 0, totalCount: 10 },
    };
    // Sort unstarted ascending by string index — should pick index 1
    const opts = { sortUnstarted: (a: any, b: any) => a.string - b.string };
    const result = computeRecommendations(
      mockSelector(data),
      [0, 1, 2],
      makeGetItemIds(data),
      config,
      opts,
    );
    assert.ok(result.recommended.has(1), 'should expand to lowest unstarted');
    assert.ok(
      !result.recommended.has(2),
      'should not expand to higher unstarted',
    );
  });

  it('without sortUnstarted, uses first unstarted from getStringRecommendations order', () => {
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
      {},
    );
    assert.ok(
      result.recommended.has(1) || result.recommended.has(2),
      'should expand to one of the unstarted items',
    );
    const unstartedCount = (result.recommended.has(1) ? 1 : 0) +
      (result.recommended.has(2) ? 1 : 0);
    assert.equal(unstartedCount, 1, 'should expand to exactly one unstarted');
  });

  // ---------------------------------------------------------------------------
  // At least one item always recommended
  // ---------------------------------------------------------------------------

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
      {},
    );
    assert.ok(result.recommended.size >= 1, 'should recommend at least one');
    assert.ok(result.enabled!.size >= 1, 'should enable at least one');
  });

  // ---------------------------------------------------------------------------
  // Expansion at exact threshold boundary
  // ---------------------------------------------------------------------------

  it('expands at exactly the threshold level', () => {
    // All fluent → level=0.9. Use expansionThreshold=0.9 to test exact boundary
    const data = {
      0: { workingCount: 0, unseenCount: 0, fluentCount: 10, totalCount: 10 },
      1: { workingCount: 0, unseenCount: 10, fluentCount: 0, totalCount: 10 },
    };
    const result = computeRecommendations(
      mockSelector(data),
      [0, 1],
      makeGetItemIds(data),
      { expansionThreshold: 0.9 },
      {},
    );
    assert.ok(result.recommended.has(1), 'should expand at exact threshold');
  });

  // ---------------------------------------------------------------------------
  // Skipped groups (call-site filtering)
  // ---------------------------------------------------------------------------

  it('skipped group is excluded from recommendations', () => {
    // 4 groups, group 1 skipped (not passed in allIndices)
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
      {},
    );
    assert.ok(!result.recommended.has(1), 'skipped group should not appear');
  });

  it('expansion skips past skipped group to next unstarted', () => {
    // Group 0 all fluent → expansion gate opens. Groups 1,2 unstarted.
    // Group 1 is skipped (not in allIndices), so expansion should go to 2.
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
      { sortUnstarted: (a: any, b: any) => a.string - b.string },
    );
    assert.equal(result.expandIndex, 2, 'should expand to group 2');
    assert.ok(!result.recommended.has(1), 'skipped group not recommended');
  });

  // ---------------------------------------------------------------------------
  // Cap active work items (maxWorkItems)
  // ---------------------------------------------------------------------------

  it('caps work items: 5 groups × 10 working → only ~3 recommended', () => {
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
      {},
    );
    assert.ok(
      result.consolidateWorkingCount <= 30,
      `working count ${result.consolidateWorkingCount} should be ≤ 30`,
    );
    assert.ok(
      result.consolidateIndices.length <= 3,
      `should have ≤3 groups, got ${result.consolidateIndices.length}`,
    );
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
      {},
    );
    assert.ok(result.recommended.has(0), 'should still recommend group 0');
    assert.equal(result.consolidateIndices.length, 1);
  });

  it('cap tie-break is deterministic when work counts are equal', () => {
    const data = {
      0: { workingCount: 13, unseenCount: 0, fluentCount: 0, totalCount: 13 },
      1: { workingCount: 13, unseenCount: 0, fluentCount: 0, totalCount: 13 },
      2: { workingCount: 12, unseenCount: 0, fluentCount: 0, totalCount: 12 },
      3: { workingCount: 12, unseenCount: 0, fluentCount: 0, totalCount: 12 },
      4: { workingCount: 12, unseenCount: 0, fluentCount: 0, totalCount: 12 },
    };
    const result = computeRecommendations(
      mockSelector(data),
      [4, 3, 2, 1, 0],
      makeGetItemIds(data),
      { expansionThreshold: 0.7, maxWorkItems: 13 },
      {},
    );
    assert.deepStrictEqual(result.consolidateIndices, [0]);
  });

  it('cap does not trim when under limit', () => {
    // 3 groups: work = 12, 10, 8. Sorted by work desc: [12, 10, 8].
    // Median work = 10 (middle). Groups above median: group 0 (work=12).
    // Only 1 group → 12 ≤ 30, no trimming needed.
    const data = {
      0: { workingCount: 12, unseenCount: 0, fluentCount: 0, totalCount: 12 },
      1: { workingCount: 10, unseenCount: 0, fluentCount: 0, totalCount: 10 },
      2: { workingCount: 8, unseenCount: 0, fluentCount: 0, totalCount: 8 },
    };
    const result = computeRecommendations(
      mockSelector(data),
      [0, 1, 2],
      makeGetItemIds(data),
      { expansionThreshold: 0.7, maxWorkItems: 30 },
      {},
    );
    assert.ok(
      result.consolidateWorkingCount <= 30,
      'should be within cap',
    );
    assert.ok(result.recommended.has(0), 'highest-work group recommended');
  });

  // ---------------------------------------------------------------------------
  // Review mode
  // ---------------------------------------------------------------------------

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
      {},
    );
    assert.equal(result.reviewMode, true, 'should be review mode');
    assert.ok(result.recommended.has(0), 'all groups recommended');
    assert.ok(result.recommended.has(1), 'all groups recommended');
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
      {},
    );
    assert.ok(!result.reviewMode, 'should not be review mode');
  });

  it('does not trigger review mode when unstarted groups exist', () => {
    const data = {
      0: { workingCount: 1, unseenCount: 0, fluentCount: 9, totalCount: 10 },
      1: { workingCount: 0, unseenCount: 10, fluentCount: 0, totalCount: 10 },
    };
    const result = computeRecommendations(
      mockSelector(data),
      [0, 1],
      makeGetItemIds(data),
      config,
      {},
    );
    assert.ok(!result.reviewMode, 'should not be review mode with unstarted');
  });

  // ---------------------------------------------------------------------------
  // Stale detection
  // ---------------------------------------------------------------------------

  it('marks group as stale when high speed + low freshness', () => {
    const data = {
      0: { workingCount: 5, unseenCount: 0, fluentCount: 5, totalCount: 10 },
    };
    const base = mockSelector(data);
    const sel = {
      ...base,
      getSpeedScore: () => 0.8,
      getFreshness: () => 0.2,
    };
    const result = computeRecommendations(
      sel,
      [0],
      makeGetItemIds(data),
      config,
      {},
    );
    assert.deepStrictEqual(result.staleIndices, [0]);
  });

  it('does not mark group as stale when freshness is high', () => {
    const data = {
      0: { workingCount: 5, unseenCount: 0, fluentCount: 5, totalCount: 10 },
    };
    const base = mockSelector(data);
    const sel = {
      ...base,
      getSpeedScore: () => 0.8,
      getFreshness: () => 0.8,
    };
    const result = computeRecommendations(
      sel,
      [0],
      makeGetItemIds(data),
      config,
      {},
    );
    assert.equal(result.staleIndices, undefined);
  });

  it('staleIndices is undefined when selector lacks speed/freshness', () => {
    const data = {
      0: { workingCount: 5, unseenCount: 0, fluentCount: 5, totalCount: 10 },
    };
    const result = computeRecommendations(
      mockSelector(data),
      [0],
      makeGetItemIds(data),
      config,
      {},
    );
    assert.equal(result.staleIndices, undefined);
  });

  it('does not expand just below the threshold level', () => {
    // Working items produce level=0.3. Threshold=0.3 should pass,
    // but threshold=0.31 should fail.
    const data = {
      0: { workingCount: 10, unseenCount: 0, fluentCount: 0, totalCount: 10 },
      1: { workingCount: 0, unseenCount: 10, fluentCount: 0, totalCount: 10 },
    };
    const result = computeRecommendations(
      mockSelector(data),
      [0, 1],
      makeGetItemIds(data),
      { expansionThreshold: 0.31 },
      {},
    );
    assert.ok(
      !result.recommended.has(1),
      'should not expand below threshold',
    );
  });

  it('uses a single timestamp across selector calls', () => {
    const calls: Array<{ fn: string; nowMs: number | undefined }> = [];
    const selector = {
      getStringRecommendations(
        indices: number[],
        _getItemIds: (i: number) => string[],
        nowMs?: number,
      ) {
        calls.push({ fn: 'getStringRecommendations', nowMs });
        return indices.map((i) => ({
          string: i,
          workingCount: 1,
          unseenCount: 0,
          fluentCount: 0,
          totalCount: 1,
        }));
      },
      getLevelAutomaticity(
        _itemIds: string[],
        _percentile?: number,
        nowMs?: number,
      ) {
        calls.push({ fn: 'getLevelAutomaticity', nowMs });
        return { level: 0, seen: 1 };
      },
      getSpeedScore(_id: string) {
        return 1;
      },
      getFreshness(_id: string, nowMs?: number) {
        calls.push({ fn: 'getFreshness', nowMs });
        return 1;
      },
    };

    computeRecommendations(
      selector,
      [0],
      (i) => [`item-${i}`],
      config,
      {},
    );

    assert.ok(calls.length >= 3);
    const nowValues = calls.map((c) => c.nowMs);
    assert.ok(nowValues.every((value) => value != null));
    assert.equal(new Set(nowValues).size, 1);
  });
});
