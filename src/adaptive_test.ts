import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  computeEwma,
  computeWeight,
  selectWeighted,
  createAdaptiveSelector,
  createMemoryStorage,
  DEFAULT_CONFIG,
  type ItemStats,
} from "./adaptive.ts";

// ---------------------------------------------------------------------------
// computeEwma
// ---------------------------------------------------------------------------

describe("computeEwma", () => {
  it("returns newTime when alpha=1 (full weight to new observation)", () => {
    assert.equal(computeEwma(2000, 1000, 1.0), 1000);
  });

  it("returns oldEwma when alpha=0 (ignore new observation)", () => {
    assert.equal(computeEwma(2000, 1000, 0.0), 2000);
  });

  it("blends old and new with default alpha=0.3", () => {
    const result = computeEwma(2000, 1000, 0.3);
    assert.equal(result, 0.3 * 1000 + 0.7 * 2000); // 1700
  });
});

// ---------------------------------------------------------------------------
// computeWeight
// ---------------------------------------------------------------------------

describe("computeWeight", () => {
  const cfg = DEFAULT_CONFIG; // minTime=1000, unseenBoost=3

  it("returns unseenBoost for null (never-seen) stats", () => {
    assert.equal(computeWeight(null, cfg), cfg.unseenBoost);
  });

  it("returns ewma/minTime for seen items", () => {
    const stats: ItemStats = {
      recentTimes: [2000],
      ewma: 2000,
      sampleCount: 1,
      lastSeen: 0,
    };
    assert.equal(computeWeight(stats, cfg), 2.0);
  });

  it("floors weight at 1.0 via minTime clamp", () => {
    const stats: ItemStats = {
      recentTimes: [500],
      ewma: 500,
      sampleCount: 5,
      lastSeen: 0,
    };
    // max(500, 1000) / 1000 = 1.0
    assert.equal(computeWeight(stats, cfg), 1.0);
  });

  // --- THE BUG FIX ---
  it("unseen items outweigh recently-seen items with typical response times", () => {
    const unseenWeight = computeWeight(null, cfg);
    // Typical first response: 2000ms
    const seenOnce: ItemStats = {
      recentTimes: [2000],
      ewma: 2000,
      sampleCount: 1,
      lastSeen: 0,
    };
    const seenWeight = computeWeight(seenOnce, cfg);
    assert.ok(
      unseenWeight > seenWeight,
      `unseen (${unseenWeight}) should be > seen-once @ 2000ms (${seenWeight})`,
    );
  });

  it("unseen items outweigh seen items unless the seen item is very slow", () => {
    const unseenWeight = computeWeight(null, cfg);
    // Only items slower than unseenBoost * minTime (3000ms) outweigh unseen
    const mediumSlow: ItemStats = {
      recentTimes: [2500],
      ewma: 2500,
      sampleCount: 2,
      lastSeen: 0,
    };
    assert.ok(
      unseenWeight > computeWeight(mediumSlow, cfg),
      "unseen should outweigh 2500ms item",
    );

    // A very slow item (>3000ms) *should* outweigh unseen — that's correct
    // behavior: it means the user genuinely struggles with it.
    const verySlow: ItemStats = {
      recentTimes: [5000],
      ewma: 5000,
      sampleCount: 2,
      lastSeen: 0,
    };
    assert.ok(
      computeWeight(verySlow, cfg) > unseenWeight,
      "5000ms item should outweigh unseen (user struggles with it)",
    );
  });
});

// ---------------------------------------------------------------------------
// selectWeighted
// ---------------------------------------------------------------------------

describe("selectWeighted", () => {
  it("picks the only item when there is one", () => {
    assert.equal(selectWeighted(["a"], [1], 0.5), "a");
  });

  it("picks first item when rand=0", () => {
    assert.equal(selectWeighted(["a", "b", "c"], [1, 1, 1], 0.0), "a");
  });

  it("picks last item when rand approaches 1", () => {
    assert.equal(selectWeighted(["a", "b", "c"], [1, 1, 1], 0.999), "c");
  });

  it("skips zero-weight items", () => {
    // Only "b" has weight; "a" and "c" have 0
    assert.equal(selectWeighted(["a", "b", "c"], [0, 5, 0], 0.5), "b");
  });

  it("falls back to uniform random when all weights are zero", () => {
    // rand=0.5 with 3 items → floor(0.5*3) = 1 → "b"
    assert.equal(selectWeighted(["a", "b", "c"], [0, 0, 0], 0.5), "b");
  });

  it("respects weight proportions", () => {
    // weights [3, 1] → total 4. rand=0.5 → remaining=2.0, after "a" (3): -1 → picks "a"
    assert.equal(selectWeighted(["a", "b"], [3, 1], 0.5), "a");
    // rand=0.9 → remaining=3.6, after "a" (3): 0.6, after "b" (1): -0.4 → picks "b"
    assert.equal(selectWeighted(["a", "b"], [3, 1], 0.9), "b");
  });
});

// ---------------------------------------------------------------------------
// createAdaptiveSelector integration
// ---------------------------------------------------------------------------

describe("createAdaptiveSelector", () => {
  it("selects from valid items without errors", () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);
    const result = selector.selectNext(["0-0", "0-1", "0-2"]);
    assert.ok(["0-0", "0-1", "0-2"].includes(result));
  });

  it("throws on empty validItems", () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);
    assert.throws(() => selector.selectNext([]), /cannot be empty/);
  });

  it("returns the only item when validItems has one element", () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);
    assert.equal(selector.selectNext(["solo"]), "solo");
  });

  it("never repeats last selected (when more than 1 item)", () => {
    const storage = createMemoryStorage();
    let callCount = 0;
    const selector = createAdaptiveSelector(
      storage,
      DEFAULT_CONFIG,
      () => {
        // Alternate between low and high random values
        return (callCount++ % 2) * 0.99;
      },
    );
    const items = ["a", "b"];
    const first = selector.selectNext(items);
    const second = selector.selectNext(items);
    assert.notEqual(first, second, "should not repeat last selected");
  });

  it("recordResponse creates stats and updates ewma", () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);
    selector.recordResponse("0-0", 2000);

    const stats = selector.getStats("0-0");
    assert.ok(stats);
    assert.equal(stats!.ewma, 2000);
    assert.equal(stats!.sampleCount, 1);
    assert.deepEqual(stats!.recentTimes, [2000]);
  });

  it("recordResponse updates existing stats with EWMA", () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);
    selector.recordResponse("0-0", 2000);
    selector.recordResponse("0-0", 1000);

    const stats = selector.getStats("0-0");
    assert.ok(stats);
    // ewma = 0.3 * 1000 + 0.7 * 2000 = 1700
    assert.equal(stats!.ewma, 1700);
    assert.equal(stats!.sampleCount, 2);
  });

  it("caps stored recent times at maxStoredTimes", () => {
    const storage = createMemoryStorage();
    const cfg = { ...DEFAULT_CONFIG, maxStoredTimes: 3 };
    const selector = createAdaptiveSelector(storage, cfg);
    for (let i = 0; i < 5; i++) {
      selector.recordResponse("x", 1000 + i * 100);
    }
    const stats = selector.getStats("x");
    assert.equal(stats!.recentTimes.length, 3);
  });

  it("clamps outlier response times to maxResponseTime", () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);

    // First normal response
    selector.recordResponse("0-0", 2000);
    // Distracted: 5 minutes later
    selector.recordResponse("0-0", 300_000);

    const stats = selector.getStats("0-0");
    assert.ok(stats);
    // Should have clamped to 9000, not used 300000
    // ewma = 0.3 * 9000 + 0.7 * 2000 = 4100
    assert.equal(stats!.ewma, 4100);
    assert.deepEqual(stats!.recentTimes, [2000, 9000]);
  });

  it("clamps outlier on first response too", () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);
    selector.recordResponse("0-0", 60_000);

    const stats = selector.getStats("0-0");
    assert.equal(stats!.ewma, 9000);
    assert.deepEqual(stats!.recentTimes, [9000]);
  });

  // --- THE KEY BUG-FIX TEST ---
  it("prefers unseen items over recently-seen items at startup", () => {
    const storage = createMemoryStorage();
    // Deterministic: always pick first non-zero-weight item
    const selector = createAdaptiveSelector(storage, DEFAULT_CONFIG, () => 0.0);

    const items = ["a", "b", "c", "d", "e"];

    // Record a response for "a" — simulating it's been asked once
    selector.recordResponse("a", 2000);
    // Also select "a" so it becomes lastSelected
    // (selectNext will skip "a" because it was lastSelected, AND because
    //  unseen items should be weighted higher)

    // Now select next: "a" was just selected, "b"-"e" are unseen
    // The selector should prefer unseen items.
    storage.setLastSelected("a");

    const weights = items.map((id) => selector.getWeight(id));
    const unseenWeight = weights[1]; // "b" — unseen
    const seenWeight = weights[0]; // "a" — seen once at 2000ms

    assert.ok(
      unseenWeight > seenWeight,
      `unseen weight (${unseenWeight}) must be > seen weight (${seenWeight})`,
    );
  });

  it("distributes selections across unseen items, not just the first few", () => {
    const storage = createMemoryStorage();
    let randomIndex = 0;
    // Cycle through different random values to simulate real randomness
    const randoms = [0.1, 0.3, 0.5, 0.7, 0.9, 0.2, 0.4, 0.6, 0.8, 0.0];
    const selector = createAdaptiveSelector(
      storage,
      DEFAULT_CONFIG,
      () => randoms[randomIndex++ % randoms.length],
    );

    const items = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const seen = new Set<string>();

    // Simulate 16 rounds: each time we pick an item and record a ~2s response
    for (let i = 0; i < 16; i++) {
      const pick = selector.selectNext(items);
      seen.add(pick);
      selector.recordResponse(pick, 1800 + Math.floor(i * 50));
    }

    // With the bug fix, we should explore most items within 16 rounds
    // (8 items, 16 rounds = 2x coverage). With the old bug, it would
    // get stuck on the first 2-3 items.
    assert.ok(
      seen.size >= 5,
      `Expected to explore >= 5 of 8 items in 16 rounds, but only saw ${seen.size}: ${[...seen]}`,
    );
  });
});
