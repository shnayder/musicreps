import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { computeRecommendations } from "./recommendations.js";

// Helper: create a mock selector whose getStringRecommendations returns
// pre-built data keyed by index.
function mockSelector(dataByIndex: Record<number, {
  dueCount: number; unseenCount: number; masteredCount: number; totalCount: number;
}>) {
  return {
    getStringRecommendations(indices: number[], getItemIds: (i: number) => string[]) {
      // Mimic the real selector: build results, sort by work descending
      const results = indices.map(i => {
        const d = dataByIndex[i] ?? { dueCount: 0, unseenCount: 0, masteredCount: 0, totalCount: 0 };
        return { string: i, ...d };
      });
      results.sort((a, b) => (b.dueCount + b.unseenCount) - (a.dueCount + a.unseenCount));
      return results;
    },
  };
}

const stubGetItemIds = (_i: number) => ["stub"];
const config = { expansionThreshold: 0.7 };

// ---------------------------------------------------------------------------
// No started items (first launch)
// ---------------------------------------------------------------------------

describe("computeRecommendations", () => {
  it("recommends first unstarted group on fresh start", () => {
    const sel = mockSelector({
      0: { dueCount: 0, unseenCount: 10, masteredCount: 0, totalCount: 10 },
      1: { dueCount: 0, unseenCount: 10, masteredCount: 0, totalCount: 10 },
    });
    const result = computeRecommendations(sel, [0, 1], stubGetItemIds, config, {});
    assert.ok(result.recommended.has(0), "should recommend first group");
    assert.ok(result.enabled!.has(0), "should enable first group");
    assert.equal(result.expandIndex, 0);
    assert.equal(result.expandNewCount, 10);
  });

  it("uses sortUnstarted on fresh start to pick first group", () => {
    const sel = mockSelector({
      0: { dueCount: 0, unseenCount: 10, masteredCount: 0, totalCount: 10 },
      1: { dueCount: 0, unseenCount: 5, masteredCount: 0, totalCount: 5 },
    });
    // Sort by totalCount ascending — should pick index 1 (5 items)
    const opts = { sortUnstarted: (a: any, b: any) => a.totalCount - b.totalCount };
    const result = computeRecommendations(sel, [0, 1], stubGetItemIds, config, opts);
    assert.ok(result.recommended.has(1), "should recommend sorted-first group");
    assert.equal(result.expandIndex, 1);
    assert.equal(result.expandNewCount, 5);
  });

  // ---------------------------------------------------------------------------
  // Single started item
  // ---------------------------------------------------------------------------

  it("recommends the single started item", () => {
    const sel = mockSelector({
      0: { dueCount: 3, unseenCount: 5, masteredCount: 2, totalCount: 10 },
      1: { dueCount: 0, unseenCount: 10, masteredCount: 0, totalCount: 10 },
    });
    const result = computeRecommendations(sel, [0, 1], stubGetItemIds, config, {});
    assert.ok(result.recommended.has(0));
    assert.ok(result.enabled!.has(0));
  });

  // ---------------------------------------------------------------------------
  // Consolidation below threshold — no expansion
  // ---------------------------------------------------------------------------

  it("does not expand when consolidation ratio is below threshold", () => {
    // 2 mastered out of 5 seen = 0.4, below 0.7
    const sel = mockSelector({
      0: { dueCount: 3, unseenCount: 2, masteredCount: 2, totalCount: 7 },
      1: { dueCount: 0, unseenCount: 10, masteredCount: 0, totalCount: 10 },
    });
    const result = computeRecommendations(sel, [0, 1], stubGetItemIds, config, {});
    assert.ok(result.recommended.has(0));
    assert.ok(!result.recommended.has(1), "should not recommend unstarted index 1");
  });

  // ---------------------------------------------------------------------------
  // Consolidation above threshold — expansion
  // ---------------------------------------------------------------------------

  it("expands to next unstarted when consolidation ratio meets threshold", () => {
    // 8 mastered out of 10 seen = 0.8, above 0.7
    const sel = mockSelector({
      0: { dueCount: 2, unseenCount: 0, masteredCount: 8, totalCount: 10 },
      1: { dueCount: 0, unseenCount: 10, masteredCount: 0, totalCount: 10 },
    });
    const result = computeRecommendations(sel, [0, 1], stubGetItemIds, config, {});
    assert.ok(result.recommended.has(1), "should recommend unstarted index 1");
    assert.ok(result.enabled!.has(1));
  });

  // ---------------------------------------------------------------------------
  // Median-work ranking — recommends high-work items
  // ---------------------------------------------------------------------------

  it("recommends items above median work", () => {
    const sel = mockSelector({
      0: { dueCount: 8, unseenCount: 2, masteredCount: 0, totalCount: 10 },  // work=10
      1: { dueCount: 1, unseenCount: 0, masteredCount: 9, totalCount: 10 },  // work=1
      2: { dueCount: 5, unseenCount: 3, masteredCount: 2, totalCount: 10 },  // work=8
    });
    const result = computeRecommendations(sel, [0, 1, 2], stubGetItemIds, config, {});
    // median work = work of middle item after sort: [10, 8, 1] -> median = 8
    // Items with work > 8: index 0 (work=10)
    assert.ok(result.recommended.has(0));
    assert.ok(!result.recommended.has(1), "low-work item should not be recommended");
  });

  // ---------------------------------------------------------------------------
  // sortUnstarted controls expansion order
  // ---------------------------------------------------------------------------

  it("uses sortUnstarted to pick expansion target", () => {
    // 8/10 = 0.8, above threshold
    const sel = mockSelector({
      0: { dueCount: 2, unseenCount: 0, masteredCount: 8, totalCount: 10 },
      1: { dueCount: 0, unseenCount: 10, masteredCount: 0, totalCount: 10 },
      2: { dueCount: 0, unseenCount: 10, masteredCount: 0, totalCount: 10 },
    });
    // Sort unstarted ascending by string index — should pick index 1
    const opts = { sortUnstarted: (a: any, b: any) => a.string - b.string };
    const result = computeRecommendations(sel, [0, 1, 2], stubGetItemIds, config, opts);
    assert.ok(result.recommended.has(1), "should expand to lowest unstarted");
    assert.ok(!result.recommended.has(2), "should not expand to higher unstarted");
  });

  it("without sortUnstarted, uses first unstarted from getStringRecommendations order", () => {
    const sel = mockSelector({
      0: { dueCount: 2, unseenCount: 0, masteredCount: 8, totalCount: 10 },
      1: { dueCount: 0, unseenCount: 10, masteredCount: 0, totalCount: 10 },
      2: { dueCount: 0, unseenCount: 10, masteredCount: 0, totalCount: 10 },
    });
    // No sortUnstarted — uses unstarted array as returned by filter
    const result = computeRecommendations(sel, [0, 1, 2], stubGetItemIds, config, {});
    // Both 1 and 2 have same work, so order depends on the mock sort — both at top
    // The first unstarted after filtering should be picked
    assert.ok(result.recommended.has(1) || result.recommended.has(2),
      "should expand to one of the unstarted items");
    // Only one unstarted should be added
    const unstartedCount = (result.recommended.has(1) ? 1 : 0) + (result.recommended.has(2) ? 1 : 0);
    assert.equal(unstartedCount, 1, "should expand to exactly one unstarted");
  });

  // ---------------------------------------------------------------------------
  // At least one item always recommended
  // ---------------------------------------------------------------------------

  it("always recommends at least one item when data exists", () => {
    // All items have same work (0 due + 0 unseen) — all mastered
    const sel = mockSelector({
      0: { dueCount: 0, unseenCount: 0, masteredCount: 10, totalCount: 10 },
      1: { dueCount: 0, unseenCount: 0, masteredCount: 10, totalCount: 10 },
    });
    const result = computeRecommendations(sel, [0, 1], stubGetItemIds, config, {});
    assert.ok(result.recommended.size >= 1, "should recommend at least one");
    assert.ok(result.enabled!.size >= 1, "should enable at least one");
  });

  // ---------------------------------------------------------------------------
  // Expansion at exact threshold boundary
  // ---------------------------------------------------------------------------

  it("expands at exactly the threshold ratio", () => {
    // 7 mastered out of 10 seen = 0.7, exactly at 0.7 threshold
    const sel = mockSelector({
      0: { dueCount: 3, unseenCount: 0, masteredCount: 7, totalCount: 10 },
      1: { dueCount: 0, unseenCount: 10, masteredCount: 0, totalCount: 10 },
    });
    const result = computeRecommendations(sel, [0, 1], stubGetItemIds, config, {});
    assert.ok(result.recommended.has(1), "should expand at exact threshold");
  });
});
