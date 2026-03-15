import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  computeEwma,
  computeFreshness,
  computeMedian,
  computeRecall,
  computeSpeedScore,
  computeStabilityAfterWrong,
  computeWeight,
  createAdaptiveSelector,
  createMemoryStorage,
  DEFAULT_CONFIG,
  deriveScaledConfig,
  selectWeighted,
  updateStability,
} from './adaptive.ts';

// ---------------------------------------------------------------------------
// computeEwma
// ---------------------------------------------------------------------------

describe('computeEwma', () => {
  it('returns newTime when alpha=1 (full weight to new observation)', () => {
    assert.equal(computeEwma(2000, 1000, 1.0), 1000);
  });

  it('returns oldEwma when alpha=0 (ignore new observation)', () => {
    assert.equal(computeEwma(2000, 1000, 0.0), 2000);
  });

  it('blends old and new with default alpha=0.3', () => {
    const result = computeEwma(2000, 1000, 0.3);
    assert.equal(result, 0.3 * 1000 + 0.7 * 2000); // 1700
  });
});

// ---------------------------------------------------------------------------
// computeWeight
// ---------------------------------------------------------------------------

describe('computeWeight', () => {
  const cfg = DEFAULT_CONFIG; // minTime=1000, unseenBoost=3

  it('returns unseenBoost for null (never-seen) stats', () => {
    assert.equal(computeWeight(null, cfg), cfg.unseenBoost);
  });

  it('returns ewma/minTime for seen items', () => {
    const stats = {
      recentTimes: [2000],
      ewma: 2000,
      sampleCount: 1,
      lastSeen: 0,
      stability: null,
      lastCorrectAt: null,
    };
    assert.equal(computeWeight(stats, cfg), 2.0);
  });

  it('floors weight at 1.0 via minTime clamp', () => {
    const stats = {
      recentTimes: [500],
      ewma: 500,
      sampleCount: 5,
      lastSeen: 0,
      stability: null,
      lastCorrectAt: null,
    };
    // max(500, 1000) / 1000 = 1.0
    assert.equal(computeWeight(stats, cfg), 1.0);
  });

  // --- THE BUG FIX ---
  it('unseen items outweigh recently-seen items with typical response times', () => {
    const unseenWeight = computeWeight(null, cfg);
    // Typical first response: 2000ms
    const seenOnce = {
      recentTimes: [2000],
      ewma: 2000,
      sampleCount: 1,
      lastSeen: 0,
      stability: null,
      lastCorrectAt: null,
    };
    const seenWeight = computeWeight(seenOnce, cfg);
    assert.ok(
      unseenWeight > seenWeight,
      `unseen (${unseenWeight}) should be > seen-once @ 2000ms (${seenWeight})`,
    );
  });

  it('unseen items outweigh seen items unless the seen item is very slow', () => {
    const unseenWeight = computeWeight(null, cfg);
    // Only items slower than unseenBoost * minTime (3000ms) outweigh unseen
    const mediumSlow = {
      recentTimes: [2500],
      ewma: 2500,
      sampleCount: 2,
      lastSeen: 0,
      stability: null,
      lastCorrectAt: null,
    };
    assert.ok(
      unseenWeight > computeWeight(mediumSlow, cfg),
      'unseen should outweigh 2500ms item',
    );

    // A very slow item (>3000ms) *should* outweigh unseen — that's correct
    // behavior: it means the user genuinely struggles with it.
    const verySlow = {
      recentTimes: [5000],
      ewma: 5000,
      sampleCount: 2,
      lastSeen: 0,
      stability: null,
      lastCorrectAt: null,
    };
    assert.ok(
      computeWeight(verySlow, cfg) > unseenWeight,
      '5000ms item should outweigh unseen (user struggles with it)',
    );
  });
});

// ---------------------------------------------------------------------------
// computeRecall
// ---------------------------------------------------------------------------

describe('computeRecall', () => {
  it('returns 1 when no time has elapsed', () => {
    assert.equal(computeRecall(4, 0), 1);
  });

  it('returns 0.5 at exactly one half-life', () => {
    assert.equal(computeRecall(4, 4), 0.5);
  });

  it('returns 0.25 at two half-lives', () => {
    assert.equal(computeRecall(4, 8), 0.25);
  });

  it('returns null for unseen items', () => {
    assert.equal(computeRecall(null, 10), null);
    assert.equal(computeRecall(undefined as any, 10), null);
    assert.equal(computeRecall(4, null), null);
  });

  it('returns 0 for zero stability', () => {
    assert.equal(computeRecall(0, 5), 0);
  });

  it('decays over time', () => {
    const r1 = computeRecall(4, 1)!;
    const r2 = computeRecall(4, 10)!;
    assert.ok(
      r1 > r2,
      `recall at 1h (${r1}) should be > recall at 10h (${r2})`,
    );
  });
});

// ---------------------------------------------------------------------------
// computeFreshness
// ---------------------------------------------------------------------------

describe('computeFreshness', () => {
  const HOUR = 3600_000;

  it('returns null for unseen items', () => {
    assert.equal(computeFreshness(null, null, 1000), null);
    assert.equal(computeFreshness(4, null, 1000), null);
    assert.equal(computeFreshness(null, 500, 1000), null);
  });

  it('returns 0 for zero stability', () => {
    assert.equal(computeFreshness(0, 1000, 2000), 0);
  });

  it('returns 1 when no time has elapsed', () => {
    const now = Date.now();
    assert.equal(computeFreshness(4, now, now), 1);
  });

  it('returns 1 for future timestamps', () => {
    const now = Date.now();
    assert.equal(computeFreshness(4, now + 1000, now), 1);
  });

  it('returns 0.5 at exactly one half-life', () => {
    const now = Date.now();
    const lastCorrect = now - 4 * HOUR; // 4 hours ago, stability = 4h
    assert.equal(computeFreshness(4, lastCorrect, now), 0.5);
  });

  it('returns 0.25 at two half-lives', () => {
    const now = Date.now();
    const lastCorrect = now - 8 * HOUR; // 8 hours ago, stability = 4h
    assert.equal(computeFreshness(4, lastCorrect, now), 0.25);
  });

  it('decays over time', () => {
    const now = Date.now();
    const f1 = computeFreshness(4, now - 1 * HOUR, now)!;
    const f2 = computeFreshness(4, now - 10 * HOUR, now)!;
    assert.ok(f1 > f2, `freshness at 1h (${f1}) should be > at 10h (${f2})`);
  });
});

// ---------------------------------------------------------------------------
// computeSpeedScore
// ---------------------------------------------------------------------------

describe('computeSpeedScore', () => {
  const cfg = DEFAULT_CONFIG;

  it('returns 1.0 at minTime', () => {
    const score = computeSpeedScore(cfg.minTime, cfg);
    assert.ok(
      Math.abs(score! - 1.0) < 0.01,
      `at minTime should be ~1.0, got ${score}`,
    );
  });

  it('returns ~0.5 at speedTarget', () => {
    const score = computeSpeedScore(cfg.speedTarget, cfg);
    assert.ok(
      Math.abs(score! - 0.5) < 0.01,
      `at target should be ~0.5, got ${score}`,
    );
  });

  it('returns low value for very slow responses', () => {
    const score = computeSpeedScore(8000, cfg);
    assert.ok(score! < 0.1, `at 8000ms should be < 0.1, got ${score}`);
  });

  it('returns null for null input', () => {
    assert.equal(computeSpeedScore(null, cfg), null);
  });

  it('decreases monotonically as EWMA increases', () => {
    const s1 = computeSpeedScore(1000, cfg)!;
    const s2 = computeSpeedScore(2000, cfg)!;
    const s3 = computeSpeedScore(4000, cfg)!;
    assert.ok(s1 > s2 && s2 > s3, `should decrease: ${s1} > ${s2} > ${s3}`);
  });

  it('scales proportionally with responseCount', () => {
    // At responseCount=3, effective target = 3000*3 = 9000, effective min = 1000*3 = 3000
    // So 9000ms at rc=3 should give same score as 3000ms at rc=1
    const singleAt3000 = computeSpeedScore(3000, cfg, 1);
    const tripleAt9000 = computeSpeedScore(9000, cfg, 3);
    assert.ok(
      Math.abs(singleAt3000! - tripleAt9000!) < 0.01,
      `3000ms@rc=1 (${singleAt3000}) should equal 9000ms@rc=3 (${tripleAt9000})`,
    );
  });

  it('returns ~1.0 at scaled minTime for multi-response', () => {
    const score = computeSpeedScore(4000, cfg, 4); // 4*1000 = scaled minTime
    assert.ok(
      Math.abs(score! - 1.0) < 0.01,
      `at scaled minTime should be ~1.0, got ${score}`,
    );
  });

  it('defaults to responseCount=1 when omitted', () => {
    const withDefault = computeSpeedScore(2000, cfg);
    const withExplicit = computeSpeedScore(2000, cfg, 1);
    assert.equal(withDefault, withExplicit);
  });
});

// ---------------------------------------------------------------------------
// updateStability
// ---------------------------------------------------------------------------

describe('updateStability', () => {
  const cfg = DEFAULT_CONFIG;

  it('returns initialStability for first correct answer', () => {
    assert.equal(updateStability(null, 2000, null, cfg), cfg.initialStability);
  });

  it('grows stability on subsequent correct answers', () => {
    const newS = updateStability(4, 2000, 4, cfg);
    assert.ok(newS > 4, `new stability (${newS}) should be > old (4)`);
  });

  it('grows more when freshness is low (item was due)', () => {
    // elapsed = stability → freshness = 0.5 → growth = 1 + 0.9*0.5 = 1.45x
    const atDue = updateStability(4, 2000, 4, cfg);
    // elapsed << stability → freshness ≈ 1.0 → growth ≈ 1.0x
    const fresh = updateStability(4, 2000, 0.1, cfg);
    assert.ok(
      atDue > fresh,
      `due review (${atDue}) should grow more than fresh review (${fresh})`,
    );
  });

  it('barely grows for within-session reviews (freshness ≈ 1)', () => {
    // 1 minute gap, stability = 4h → freshness ≈ 0.997
    const newS = updateStability(4, 2000, 1 / 60, cfg);
    assert.ok(
      newS < 4.05,
      `within-session growth (${newS}) should be minimal`,
    );
  });

  it('speed does not affect stability growth', () => {
    // Both above selfCorrectionThreshold to isolate speed from self-correction
    const fast = updateStability(4, 1600, 4, cfg);
    const slow = updateStability(4, 8000, 4, cfg);
    assert.equal(fast, slow, 'speed should not affect stability growth');
  });

  it('self-corrects: fast answer after long gap boosts stability', () => {
    // Fast answer (1000ms) after 100 hours away, oldS=4
    // self-correction: 100 * 1.5 = 150h
    const newS = updateStability(4, 1000, 100, cfg);
    assert.ok(
      newS >= 150,
      `self-corrected stability (${newS}) should be >= 150`,
    );
  });

  it('self-correction is capped at maxStability', () => {
    const newS = updateStability(4, 1000, 720, cfg);
    assert.equal(newS, cfg.maxStability);
  });

  it('does NOT self-correct for medium speed answers', () => {
    // 3000ms is above selfCorrectionThreshold (1500ms) — no self-correction
    const newS = updateStability(4, 3000, 720, cfg);
    assert.ok(
      newS < 100,
      `medium speed stability (${newS}) should not self-correct`,
    );
  });

  it('does NOT self-correct for slow answers after long gap', () => {
    const newS = updateStability(4, 7000, 720, cfg);
    assert.ok(
      newS < 100,
      `slow answer stability (${newS}) should not self-correct`,
    );
  });

  it('caps stability at maxStability even from normal growth', () => {
    const newS = updateStability(300, 2000, 300, cfg);
    assert.equal(newS, cfg.maxStability);
  });
});

// ---------------------------------------------------------------------------
// computeStabilityAfterWrong
// ---------------------------------------------------------------------------

describe('computeStabilityAfterWrong', () => {
  const cfg = DEFAULT_CONFIG;

  it('returns initialStability for null (unseen) items', () => {
    assert.equal(computeStabilityAfterWrong(null, cfg), cfg.initialStability);
  });

  it('reduces stability but floors at initialStability', () => {
    // 10 * 0.3 = 3, but floor is initialStability (4)
    assert.equal(computeStabilityAfterWrong(10, cfg), 4);
  });

  it('reduces high stability items proportionally', () => {
    // 100 * 0.3 = 30, which is > initialStability (4)
    assert.equal(computeStabilityAfterWrong(100, cfg), 30);
  });
});

// ---------------------------------------------------------------------------
// selectWeighted
// ---------------------------------------------------------------------------

describe('selectWeighted', () => {
  it('picks the only item when there is one', () => {
    assert.equal(selectWeighted(['a'], [1], 0.5), 'a');
  });

  it('picks first item when rand=0', () => {
    assert.equal(selectWeighted(['a', 'b', 'c'], [1, 1, 1], 0.0), 'a');
  });

  it('picks last item when rand approaches 1', () => {
    assert.equal(selectWeighted(['a', 'b', 'c'], [1, 1, 1], 0.999), 'c');
  });

  it('skips zero-weight items', () => {
    // Only "b" has weight; "a" and "c" have 0
    assert.equal(selectWeighted(['a', 'b', 'c'], [0, 5, 0], 0.5), 'b');
  });

  it('falls back to uniform random when all weights are zero', () => {
    // rand=0.5 with 3 items → floor(0.5*3) = 1 → "b"
    assert.equal(selectWeighted(['a', 'b', 'c'], [0, 0, 0], 0.5), 'b');
  });

  it('respects weight proportions', () => {
    // weights [3, 1] → total 4. rand=0.5 → remaining=2.0, after "a" (3): -1 → picks "a"
    assert.equal(selectWeighted(['a', 'b'], [3, 1], 0.5), 'a');
    // rand=0.9 → remaining=3.6, after "a" (3): 0.6, after "b" (1): -0.4 → picks "b"
    assert.equal(selectWeighted(['a', 'b'], [3, 1], 0.9), 'b');
  });
});

// ---------------------------------------------------------------------------
// createAdaptiveSelector integration
// ---------------------------------------------------------------------------

describe('createAdaptiveSelector', () => {
  it('selects from valid items without errors', () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);
    const result = selector.selectNext(['0-0', '0-1', '0-2']);
    assert.ok(['0-0', '0-1', '0-2'].includes(result));
  });

  it('throws on empty validItems', () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);
    assert.throws(() => selector.selectNext([]), /cannot be empty/);
  });

  it('returns the only item when validItems has one element', () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);
    assert.equal(selector.selectNext(['solo']), 'solo');
  });

  it('never repeats last selected (when more than 1 item)', () => {
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
    const items = ['a', 'b'];
    const first = selector.selectNext(items);
    const second = selector.selectNext(items);
    assert.notEqual(first, second, 'should not repeat last selected');
  });

  it('recordResponse creates stats and updates ewma', () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);
    selector.recordResponse('0-0', 2000);

    const stats = selector.getStats('0-0');
    assert.ok(stats);
    assert.equal(stats.ewma, 2000);
    assert.equal(stats.sampleCount, 1);
    assert.deepEqual(stats.recentTimes, [2000]);
  });

  it('recordResponse updates existing stats with EWMA', () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);
    selector.recordResponse('0-0', 2000);
    selector.recordResponse('0-0', 1000);

    const stats = selector.getStats('0-0');
    assert.ok(stats);
    // ewma = 0.3 * 1000 + 0.7 * 2000 = 1700
    assert.equal(stats.ewma, 1700);
    assert.equal(stats.sampleCount, 2);
  });

  it('caps stored recent times at maxStoredTimes', () => {
    const storage = createMemoryStorage();
    const cfg = { ...DEFAULT_CONFIG, maxStoredTimes: 3 };
    const selector = createAdaptiveSelector(storage, cfg);
    for (let i = 0; i < 5; i++) {
      selector.recordResponse('x', 1000 + i * 100);
    }
    const stats = selector.getStats('x');
    assert.equal(stats!.recentTimes.length, 3);
  });

  it('clamps outlier response times to maxResponseTime', () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);

    // First normal response
    selector.recordResponse('0-0', 2000);
    // Distracted: 5 minutes later
    selector.recordResponse('0-0', 300_000);

    const stats = selector.getStats('0-0');
    assert.ok(stats);
    // Should have clamped to 9000, not used 300000
    // ewma = 0.3 * 9000 + 0.7 * 2000 = 4100
    assert.equal(stats.ewma, 4100);
    assert.deepEqual(stats.recentTimes, [2000, 9000]);
  });

  it('clamps outlier on first response too', () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);
    selector.recordResponse('0-0', 60_000);

    const stats = selector.getStats('0-0');
    assert.equal(stats!.ewma, 9000);
    assert.deepEqual(stats!.recentTimes, [9000]);
  });

  // --- THE KEY BUG-FIX TEST ---
  it('prefers unseen items over recently-seen items at startup', () => {
    const storage = createMemoryStorage();
    // Deterministic: always pick first non-zero-weight item
    const selector = createAdaptiveSelector(storage, DEFAULT_CONFIG, () => 0.0);

    const items = ['a', 'b', 'c', 'd', 'e'];

    // Record a response for "a" — simulating it's been asked once
    selector.recordResponse('a', 2000);

    // Now select next: "a" was just selected, "b"-"e" are unseen
    // The selector should prefer unseen items.
    storage.setLastSelected('a');

    const weights = items.map((id) => selector.getWeight(id));
    const unseenWeight = weights[1]; // "b" — unseen
    const seenWeight = weights[0]; // "a" — seen once at 2000ms

    assert.ok(
      unseenWeight > seenWeight,
      `unseen weight (${unseenWeight}) must be > seen weight (${seenWeight})`,
    );
  });

  it('distributes selections across unseen items, not just the first few', () => {
    const storage = createMemoryStorage();
    let randomIndex = 0;
    // Cycle through different random values to simulate real randomness
    const randoms = [0.1, 0.3, 0.5, 0.7, 0.9, 0.2, 0.4, 0.6, 0.8, 0.0];
    const selector = createAdaptiveSelector(
      storage,
      DEFAULT_CONFIG,
      () => randoms[randomIndex++ % randoms.length],
    );

    const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
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
      `Expected to explore >= 5 of 8 items in 16 rounds, but only saw ${seen.size}: ${[
        ...seen,
      ]}`,
    );
  });

  it('recordResponse sets stability and lastCorrectAt on correct answer', () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);
    selector.recordResponse('0-0', 2000);

    const stats = selector.getStats('0-0');
    assert.ok(stats);
    assert.equal(stats!.stability, DEFAULT_CONFIG.initialStability);
    assert.ok(stats!.lastCorrectAt! > 0);
  });

  it('recordResponse grows stability on subsequent correct answers', () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);
    // First response sets initialStability
    selector.recordResponse('0-0', 2000);
    const s1 = selector.getStats('0-0')!.stability;
    // Simulate time passing (stability = 4h, wait 4h → freshness ≈ 0.5)
    const stats = selector.getStats('0-0')!;
    storage.saveStats('0-0', {
      ...stats,
      lastCorrectAt: stats.lastCorrectAt! - 4 * 3600000,
    });
    selector.recordResponse('0-0', 2000);
    const s2 = selector.getStats('0-0')!.stability;
    assert.ok(s2! > s1!, `stability should grow: ${s2} > ${s1}`);
  });

  it('recordResponse with correct=false reduces stability', () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);
    // Build up stability with time gaps
    selector.recordResponse('0-0', 2000);
    // Simulate 4h gap to allow growth
    const stats1 = selector.getStats('0-0')!;
    storage.saveStats('0-0', {
      ...stats1,
      lastCorrectAt: stats1.lastCorrectAt! - 4 * 3600000,
    });
    selector.recordResponse('0-0', 2000);
    // Another 6h gap
    const stats2 = selector.getStats('0-0')!;
    storage.saveStats('0-0', {
      ...stats2,
      lastCorrectAt: stats2.lastCorrectAt! - 6 * 3600000,
    });
    selector.recordResponse('0-0', 2000);
    const beforeWrong = selector.getStats('0-0')!.stability;

    selector.recordResponse('0-0', 3000, false);
    const afterWrong = selector.getStats('0-0')!.stability;
    assert.ok(
      afterWrong! < beforeWrong!,
      `stability should decrease on wrong: ${afterWrong} < ${beforeWrong}`,
    );
  });

  it('recordResponse with correct=false does not change EWMA or sampleCount', () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);
    selector.recordResponse('0-0', 2000);
    const before = selector.getStats('0-0')!;

    selector.recordResponse('0-0', 3000, false);
    const after = selector.getStats('0-0')!;
    assert.equal(after.ewma, before.ewma);
    assert.equal(after.sampleCount, before.sampleCount);
  });

  it('recordResponse with correct=false on unseen item creates stats', () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);
    selector.recordResponse('0-0', 3000, false);

    const stats = selector.getStats('0-0');
    assert.ok(stats);
    assert.equal(stats.sampleCount, 0);
    assert.equal(stats.lastCorrectAt, null);
    assert.equal(stats.stability, DEFAULT_CONFIG.initialStability);
  });

  it('getRecall returns null for unseen items', () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);
    assert.equal(selector.getRecall('0-0'), null);
  });

  it('getRecall returns high value immediately after correct answer', () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);
    selector.recordResponse('0-0', 2000);

    const recall = selector.getRecall('0-0');
    assert.ok(recall !== null);
    // Just answered — recall should be very close to 1
    assert.ok(
      recall! > 0.99,
      `recall immediately after answer should be ~1, got ${recall}`,
    );
  });

  it('checkAllAutomatic returns true when all items are fast and recently answered', () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);
    // Fast answers (1200ms) → speedScore ≈ 0.93 ≥ 0.9
    selector.recordResponse('a', 1200);
    selector.recordResponse('b', 1200);

    assert.equal(selector.checkAllAutomatic(['a', 'b']), true);
  });

  it('checkAllAutomatic returns false when items are slow', () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);
    // Slow answers (3000ms) → speedScore = 0.5, recall ≈ 1.0 → auto ≈ 0.5 < 0.8
    selector.recordResponse('a', 3000);
    selector.recordResponse('b', 3000);

    assert.equal(selector.checkAllAutomatic(['a', 'b']), false);
  });

  it('checkAllAutomatic returns false when some items are unseen', () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);
    selector.recordResponse('a', 1200);
    // "b" never seen
    assert.equal(selector.checkAllAutomatic(['a', 'b']), false);
  });

  it('checkAllAutomatic returns false for empty items array', () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);
    assert.equal(selector.checkAllAutomatic([]), false);
  });

  it('checkAllAutomatic returns false when recall is high but speed is low', () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);
    // Recently answered (recall ≈ 1.0) but slow (4000ms → speedScore ≈ 0.35)
    // → speed ≈ 0.35 < 0.9
    selector.recordResponse('a', 4000);

    // Recall is high (just answered), but speed is low (slow response)
    assert.ok(
      selector.getRecall('a')! > 0.9,
      'recall should be high for recently answered item',
    );
    assert.equal(
      selector.checkAllAutomatic(['a']),
      false,
      'automatic check fails because speed is low',
    );
  });

  it('checkNeedsReview returns true when all items were fast but freshness decayed', () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);

    // Both items were fast (ewma 1500ms → speedScore ~0.87) but freshness decayed
    const longAgo = Date.now() - 48 * 3600000;
    storage.saveStats('a', {
      recentTimes: [1500],
      ewma: 1500,
      sampleCount: 5,
      lastSeen: longAgo,
      stability: 4, // 4h half-life, 48h elapsed → recall ≈ 0
      lastCorrectAt: longAgo,
    });
    storage.saveStats('b', {
      recentTimes: [2000],
      ewma: 2000,
      sampleCount: 5,
      lastSeen: longAgo,
      stability: 4,
      lastCorrectAt: longAgo,
    });

    assert.equal(selector.checkNeedsReview(['a', 'b']), true);
  });

  it('checkNeedsReview returns false when all items are freshly answered', () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);
    selector.recordResponse('a', 1500);
    selector.recordResponse('b', 1500);

    // Just answered — speed is high and fresh
    assert.equal(selector.checkNeedsReview(['a', 'b']), false);
  });

  it('checkNeedsReview returns false when any item is unseen', () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);

    // "a" was fast and decayed, but "b" is unseen → not all previously automatic
    storage.saveStats('a', {
      recentTimes: [1500],
      ewma: 1500,
      sampleCount: 5,
      lastSeen: Date.now() - 48 * 3600000,
      stability: 4,
      lastCorrectAt: Date.now() - 48 * 3600000,
    });

    assert.equal(selector.checkNeedsReview(['a', 'b']), false);
  });

  it('checkNeedsReview returns false when any item was slow (never automatic)', () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);

    const longAgo = Date.now() - 48 * 3600000;
    // "a" was fast
    storage.saveStats('a', {
      recentTimes: [1500],
      ewma: 1500,
      sampleCount: 5,
      lastSeen: longAgo,
      stability: 4,
      lastCorrectAt: longAgo,
    });
    // "b" was slow (ewma 5000ms → speedScore ~0.13, well below 0.5)
    storage.saveStats('b', {
      recentTimes: [5000],
      ewma: 5000,
      sampleCount: 2,
      lastSeen: longAgo,
      stability: 4,
      lastCorrectAt: longAgo,
    });

    assert.equal(selector.checkNeedsReview(['a', 'b']), false);
  });

  it('checkNeedsReview returns false for empty items array', () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);
    assert.equal(selector.checkNeedsReview([]), false);
  });

  it('checkNeedsReview returns false when items were only answered wrong', () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);
    // Wrong answer: lastCorrectAt stays null
    selector.recordResponse('a', 3000, false);
    assert.equal(selector.checkNeedsReview(['a']), false);
  });

  it('checkNeedsReview returns false when item has only one correct answer', () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);

    // Single fast correct answer long ago — sampleCount is 1
    storage.saveStats('a', {
      recentTimes: [1200],
      ewma: 1200,
      sampleCount: 1,
      lastSeen: Date.now() - 48 * 3600000,
      stability: 4,
      lastCorrectAt: Date.now() - 48 * 3600000,
    });

    assert.equal(selector.checkNeedsReview(['a']), false);
  });

  it('getLevelSpeed returns 0 for all unseen items', () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);
    const result = selector.getLevelSpeed(['a', 'b', 'c']);
    assert.equal(result.level, 0);
    assert.equal(result.seen, 0);
  });

  it('getLevelSpeed returns high level when all items are fast and recent', () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);
    // Fast answers → high speed score
    selector.recordResponse('a', 1200);
    selector.recordResponse('b', 1200);
    selector.recordResponse('c', 1200);
    const result = selector.getLevelSpeed(['a', 'b', 'c']);
    assert.ok(result.level > 0.8, `level should be > 0.8, got ${result.level}`);
    assert.equal(result.seen, 3);
  });

  it('getLevelSpeed reflects weakest items', () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);
    // 2 fast + 1 unseen → level should be 0 (unseen → 0)
    selector.recordResponse('a', 1200);
    selector.recordResponse('b', 1200);
    const result = selector.getLevelSpeed(['a', 'b', 'c']);
    assert.equal(result.level, 0);
    assert.equal(result.seen, 2);
  });

  it('getLevelSpeed picks correct percentile index', () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);
    // 12 items: 10 fast + 2 unseen
    // p=0.1: index = ceil(12*0.1)-1 = 1 → 2nd lowest (unseen=0)
    for (let i = 0; i < 10; i++) {
      selector.recordResponse(`item-${i}`, 1200);
    }
    const ids = Array.from({ length: 12 }, (_, i) => `item-${i}`);
    const result = selector.getLevelSpeed(ids);
    // sorted: [0, 0, high, high, ...] → index 1 = 0
    assert.equal(result.level, 0);
    assert.equal(result.seen, 10);
  });

  it('getStringRecommendations ranks strings by work (working + unseen)', () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);

    // String 0: fast items answered recently → speed ≥ 0.9 → automatic
    selector.recordResponse('0-0', 1200);
    selector.recordResponse('0-1', 1200);

    // String 1: no items answered (all unseen)
    // (no recordResponse calls)

    const recs = selector.getStringRecommendations(
      [0, 1],
      (s) => [`${s}-0`, `${s}-1`],
    );

    assert.equal(recs.length, 2);
    // String 1 should be first (more unseen items = more work)
    assert.equal(recs[0].string, 1);
    assert.equal(recs[0].unseenCount, 2);
    assert.equal(recs[0].workingCount, 0);
    assert.equal(recs[0].automaticCount, 0);
    assert.equal(recs[1].string, 0);
    assert.equal(recs[1].unseenCount, 0);
    assert.equal(recs[1].workingCount, 0);
    assert.equal(recs[1].automaticCount, 2); // fast + just answered = automatic
  });

  it('getStringRecommendations separates unseen from working items', () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);

    // String 0: item 0-0 answered fast and recently → automatic, item 0-1 unseen
    selector.recordResponse('0-0', 1200);

    const recs = selector.getStringRecommendations(
      [0],
      (s) => [`${s}-0`, `${s}-1`],
    );

    assert.equal(recs[0].unseenCount, 1); // 0-1 unseen
    assert.equal(recs[0].automaticCount, 1); // 0-0 fast + just answered = automatic
    assert.equal(recs[0].workingCount, 0);
  });

  it('getStringRecommendations counts working items (seen but not automatic)', () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);

    // Item was fast once but 100h ago with 4h stability → freshness ≈ 0
    // speedScore ≈ 0.63, speed < 0.9 → working
    storage.saveStats('0-0', {
      recentTimes: [2000],
      ewma: 2000,
      sampleCount: 1,
      lastSeen: Date.now() - 100 * 3600000,
      stability: 4, // 4h half-life, 100h elapsed → freshness ≈ 0
      lastCorrectAt: Date.now() - 100 * 3600000,
    });

    const recs = selector.getStringRecommendations(
      [0],
      (s) => [`${s}-0`, `${s}-1`],
    );

    assert.equal(recs[0].workingCount, 1); // 0-0 seen but speed < 0.9
    assert.equal(recs[0].unseenCount, 1); // 0-1 never seen
    assert.equal(recs[0].automaticCount, 0);
  });

  it('getStringRecommendations classifies slow-but-recent items as working', () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);

    // Slow answer (3500ms) just now → speedScore ≈ 0.38 < 0.9 → working, not automatic
    selector.recordResponse('0-0', 3500);

    const recs = selector.getStringRecommendations(
      [0],
      (s) => [`${s}-0`],
    );

    assert.equal(recs[0].workingCount, 1); // slow = not automatic
    assert.equal(recs[0].automaticCount, 0);
  });

  it('getStringRecommendations breaks ties deterministically by string index', () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);
    // Three groups with identical work counts (all unseen, 1 item each).
    // Without tie-breaking, order could be arbitrary. With tie-breaking,
    // equal-work groups sort by string index ascending.
    const recs = selector.getStringRecommendations(
      [5, 2, 8],
      (s) => [`${s}-0`],
    );
    // All have work=1 (1 unseen). Tie-break → sorted by string: 2, 5, 8.
    assert.equal(recs[0].string, 2);
    assert.equal(recs[1].string, 5);
    assert.equal(recs[2].string, 8);
  });

  it('updateConfig changes config used by selector', () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);
    const original = selector.getConfig();
    assert.equal(original.minTime, 1000);

    selector.updateConfig({ minTime: 1500 });
    assert.equal(selector.getConfig().minTime, 1500);
    // Other fields preserved
    assert.equal(
      selector.getConfig().speedTarget,
      original.speedTarget,
    );
  });

  it('getConfig returns current config', () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);
    const cfg = selector.getConfig();
    assert.equal(cfg.minTime, DEFAULT_CONFIG.minTime);
    assert.equal(cfg.speedTarget, DEFAULT_CONFIG.speedTarget);
  });
});

// ---------------------------------------------------------------------------
// deriveScaledConfig
// ---------------------------------------------------------------------------

describe('deriveScaledConfig', () => {
  it('scales all timing thresholds proportionally', () => {
    const scaled = deriveScaledConfig(1500);
    assert.equal(scaled.minTime, 1500);
    assert.equal(scaled.speedTarget, 4500);
    assert.equal(scaled.selfCorrectionThreshold, 2250);
    assert.equal(scaled.maxResponseTime, 13500);
  });

  it('with baseline=1000 returns same as defaults', () => {
    const scaled = deriveScaledConfig(1000);
    assert.equal(scaled.minTime, DEFAULT_CONFIG.minTime);
    assert.equal(scaled.speedTarget, DEFAULT_CONFIG.speedTarget);
    assert.equal(
      scaled.selfCorrectionThreshold,
      DEFAULT_CONFIG.selfCorrectionThreshold,
    );
    assert.equal(scaled.maxResponseTime, DEFAULT_CONFIG.maxResponseTime);
  });

  it('with baseline=700 (fast keyboard user) scales down', () => {
    const scaled = deriveScaledConfig(700);
    assert.equal(scaled.minTime, 700);
    assert.equal(scaled.speedTarget, 2100);
    assert.equal(scaled.selfCorrectionThreshold, 1050);
    assert.equal(scaled.maxResponseTime, 6300);
  });

  it('preserves non-timing fields from base config', () => {
    const scaled = deriveScaledConfig(1500);
    assert.equal(scaled.unseenBoost, DEFAULT_CONFIG.unseenBoost);
    assert.equal(scaled.ewmaAlpha, DEFAULT_CONFIG.ewmaAlpha);
    assert.equal(scaled.initialStability, DEFAULT_CONFIG.initialStability);
  });

  it('uses provided base config', () => {
    const custom = {
      ...DEFAULT_CONFIG,
      minTime: 2000,
      speedTarget: 6000,
    };
    const scaled = deriveScaledConfig(1500, custom);
    // scale = 1500 / 1000 = 1.5
    assert.equal(scaled.minTime, 3000);
    assert.equal(scaled.speedTarget, 9000);
  });
});

// ---------------------------------------------------------------------------
// computeMedian
// ---------------------------------------------------------------------------
// Response-count scaling
// ---------------------------------------------------------------------------

describe('createAdaptiveSelector with responseCountFn', () => {
  it('scales response time clamping for multi-response items', () => {
    const storage = createMemoryStorage();
    // responseCount of 3 for all items
    const sel = createAdaptiveSelector(
      storage,
      DEFAULT_CONFIG,
      Math.random,
      () => 3,
    );

    // Record a response of 20000ms (exceeds base maxResponseTime 9000ms
    // but within scaled max 9000*3 = 27000ms)
    sel.recordResponse('item1', 20000, true);
    const stats = sel.getStats('item1');
    assert.equal(
      stats!.ewma,
      20000,
      'should not clamp to base maxResponseTime',
    );
  });

  it('getSpeedScore uses scaled config', () => {
    const storage = createMemoryStorage();
    // responseCount=3: effectiveTarget=9000, effectiveMin=3000
    const sel = createAdaptiveSelector(
      storage,
      DEFAULT_CONFIG,
      Math.random,
      () => 3,
    );

    // Record fast response (3000ms = scaled minTime → speedScore ≈ 1.0)
    sel.recordResponse('item1', 3000, true);
    const speed = sel.getSpeedScore('item1');
    assert.ok(speed !== null);
    assert.ok(speed! > 0.9, `expected high speed score, got ${speed}`);
  });

  it('checkNeedsReview works correctly with responseCountFn', () => {
    const storage = createMemoryStorage();
    const sel = createAdaptiveSelector(
      storage,
      DEFAULT_CONFIG,
      Math.random,
      () => 3,
    );

    // Record multiple fast responses to build history
    // 4000ms with rc=3 → speedScore well above 0.5 (effectiveTarget=9000)
    sel.recordResponse('item1', 4000, true);
    sel.recordResponse('item1', 4000, true);
    // checkNeedsReview needs sampleCount >= 2 and speed >= 0.5
    // Without response-count scaling, 4000ms against base target 3000ms
    // would give speed < 0.5, incorrectly returning false
    const result = sel.checkNeedsReview(['item1']);
    // No decay yet so should be false (recall still high), but no crash
    assert.equal(result, false);
  });

  it('getWeight uses scaled config for selection', () => {
    const storage = createMemoryStorage();
    const sel = createAdaptiveSelector(
      storage,
      DEFAULT_CONFIG,
      Math.random,
      () => 4,
    );

    // 4000ms with rc=4 is scaled minTime (4*1000=4000), so weight should be low
    sel.recordResponse('item1', 4000, true);
    const weight = sel.getWeight('item1');
    // With scaled minTime=4000, speedWeight = max(4000, 4000) / 4000 = 1.0
    assert.ok(
      weight < 2.0,
      `expected low weight for fast multi-response item, got ${weight}`,
    );
  });

  it('defaults to responseCount=1 when no fn provided', () => {
    const storage = createMemoryStorage();
    const sel = createAdaptiveSelector(storage, DEFAULT_CONFIG, Math.random);

    sel.recordResponse('item1', 10000, true);
    const stats = sel.getStats('item1');
    // Should clamp to base maxResponseTime (9000)
    assert.equal(stats!.ewma, 9000);
  });
});

// ---------------------------------------------------------------------------

describe('computeMedian', () => {
  it('returns null for empty array', () => {
    assert.equal(computeMedian([]), null);
  });

  it('returns the single element for array of length 1', () => {
    assert.equal(computeMedian([500]), 500);
  });

  it('returns middle value for odd-length array', () => {
    assert.equal(computeMedian([100, 500, 300]), 300);
  });

  it('returns average of two middle values for even-length array', () => {
    assert.equal(computeMedian([100, 200, 300, 400]), 250);
  });

  it('handles unsorted input', () => {
    assert.equal(computeMedian([900, 100, 500, 300, 700]), 500);
  });

  it('does not mutate input array', () => {
    const arr = [3, 1, 2];
    computeMedian(arr);
    assert.deepEqual(arr, [3, 1, 2]);
  });
});
