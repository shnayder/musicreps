import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  adjustDeadline,
  computeInitialDeadline,
  createDeadlineTracker,
  DEFAULT_DEADLINE_CONFIG,
} from './deadline.js';
import { createMemoryStorage, DEFAULT_CONFIG } from './adaptive.js';

const dlCfg = DEFAULT_DEADLINE_CONFIG;

describe('computeInitialDeadline', () => {
  it('uses ewma * multiplier when ewma exists', () => {
    const deadline = computeInitialDeadline(1500, DEFAULT_CONFIG, dlCfg);
    assert.equal(deadline, 3000); // 1500 * 2.0
  });

  it('uses maxResponseTime when no ewma', () => {
    const deadline = computeInitialDeadline(null, DEFAULT_CONFIG, dlCfg);
    assert.equal(deadline, DEFAULT_CONFIG.maxResponseTime);
  });

  it('clamps to minDeadline when ewma is very low', () => {
    const deadline = computeInitialDeadline(100, DEFAULT_CONFIG, dlCfg);
    const expectedMin = Math.round(
      DEFAULT_CONFIG.minTime * dlCfg.minDeadlineMargin,
    );
    assert.equal(deadline, expectedMin);
  });

  it('clamps to maxResponseTime when ewma * multiplier exceeds it', () => {
    const deadline = computeInitialDeadline(5000, DEFAULT_CONFIG, dlCfg);
    assert.equal(deadline, DEFAULT_CONFIG.maxResponseTime);
  });

  it('works with scaled config (motor baseline)', () => {
    // Simulate baseline = 1500ms (scale = 1.5)
    const scaledCfg = {
      ...DEFAULT_CONFIG,
      minTime: 1500,
      maxResponseTime: 13500,
    };
    const deadline = computeInitialDeadline(null, scaledCfg, dlCfg);
    assert.equal(deadline, 13500);
  });
});

describe('adjustDeadline', () => {
  it('decreases deadline on correct answer', () => {
    const result = adjustDeadline(3000, true, DEFAULT_CONFIG, dlCfg);
    assert.equal(result, Math.round(3000 * 0.85)); // 2550
  });

  it('increases deadline on incorrect answer', () => {
    const result = adjustDeadline(3000, false, DEFAULT_CONFIG, dlCfg);
    assert.equal(result, Math.round(3000 * 1.4)); // 4200
  });

  it('does not go below minimum', () => {
    const minDeadline = Math.round(
      DEFAULT_CONFIG.minTime * dlCfg.minDeadlineMargin,
    );
    const result = adjustDeadline(minDeadline, true, DEFAULT_CONFIG, dlCfg);
    assert.equal(result, minDeadline);
  });

  it('does not go above maximum', () => {
    const result = adjustDeadline(
      DEFAULT_CONFIG.maxResponseTime,
      false,
      DEFAULT_CONFIG,
      dlCfg,
    );
    assert.equal(result, DEFAULT_CONFIG.maxResponseTime);
  });

  it('clamps to floor on very small deadline', () => {
    const minDeadline = Math.round(
      DEFAULT_CONFIG.minTime * dlCfg.minDeadlineMargin,
    );
    const result = adjustDeadline(500, true, DEFAULT_CONFIG, dlCfg);
    assert.equal(result, minDeadline);
  });

  it('uses response-time anchor when much faster than deadline', () => {
    // deadline=9000, response=2000: anchored=3000, staircase=7650
    // target=3000, floor=4500 → capped at 4500
    const result = adjustDeadline(9000, true, DEFAULT_CONFIG, dlCfg, 2000);
    assert.equal(result, 4500);
  });

  it('staircase wins when response is close to deadline', () => {
    // deadline=3000, response=2500: anchored=3750, staircase=2550
    // target=2550, floor=1500 → 2550
    const result = adjustDeadline(3000, true, DEFAULT_CONFIG, dlCfg, 2500);
    assert.equal(result, 2550);
  });

  it('max drop cap limits aggressive response-anchored decrease', () => {
    // deadline=6000, response=1500: anchored=2250, staircase=5100
    // target=2250, floor=3000 → capped at 3000
    const result = adjustDeadline(6000, true, DEFAULT_CONFIG, dlCfg, 1500);
    assert.equal(result, 3000);
  });

  it('ignores responseTime for incorrect answers', () => {
    // Wrong answers always use increaseFactor regardless of responseTime
    const result = adjustDeadline(3000, false, DEFAULT_CONFIG, dlCfg, 1000);
    assert.equal(result, Math.round(3000 * 1.4));
  });

  it('falls back to staircase when responseTime is null', () => {
    const result = adjustDeadline(9000, true, DEFAULT_CONFIG, dlCfg, null);
    assert.equal(result, Math.round(9000 * 0.85));
  });
});

describe('createDeadlineTracker', () => {
  it('cold starts from ewma * multiplier', () => {
    const storage = createMemoryStorage();
    const tracker = createDeadlineTracker(storage, DEFAULT_CONFIG);
    const deadline = tracker.getDeadline('item1', 2000);
    assert.equal(deadline, 4000); // 2000 * 2.0
  });

  it('cold starts from maxResponseTime when no ewma', () => {
    const storage = createMemoryStorage();
    const tracker = createDeadlineTracker(storage, DEFAULT_CONFIG);
    const deadline = tracker.getDeadline('item1', null);
    assert.equal(deadline, DEFAULT_CONFIG.maxResponseTime);
  });

  it('persists and retrieves deadline', () => {
    const storage = createMemoryStorage();
    const tracker = createDeadlineTracker(storage, DEFAULT_CONFIG);
    tracker.getDeadline('item1', 2000); // initializes to 4000
    const retrieved = tracker.getDeadline('item1', 2000);
    assert.equal(retrieved, 4000); // same value
  });

  it('recordOutcome decreases on correct', () => {
    const storage = createMemoryStorage();
    const tracker = createDeadlineTracker(storage, DEFAULT_CONFIG);
    tracker.getDeadline('item1', 2000); // 4000
    tracker.recordOutcome('item1', true);
    const after = tracker.getDeadline('item1', 2000);
    assert.equal(after, Math.round(4000 * 0.85)); // 3400
  });

  it('recordOutcome increases on incorrect', () => {
    const storage = createMemoryStorage();
    const tracker = createDeadlineTracker(storage, DEFAULT_CONFIG);
    tracker.getDeadline('item1', 2000); // 4000
    tracker.recordOutcome('item1', false);
    const after = tracker.getDeadline('item1', 2000);
    assert.equal(after, Math.round(4000 * 1.4)); // 5600
  });

  it('multiple adjustments converge', () => {
    const storage = createMemoryStorage();
    const tracker = createDeadlineTracker(storage, DEFAULT_CONFIG);
    tracker.getDeadline('item1', 2000); // 4000

    // 3 correct, 1 incorrect (75% success)
    tracker.recordOutcome('item1', true); // 4000 * 0.85 = 3400
    tracker.recordOutcome('item1', true); // 3400 * 0.85 = 2890
    tracker.recordOutcome('item1', true); // 2890 * 0.85 = 2457
    tracker.recordOutcome('item1', false); // 2457 * 1.4 = 3440

    const final = tracker.getDeadline('item1', 2000);
    // Should be close to but slightly below start (slow tightening)
    assert.ok(final < 4000, 'should be below initial');
    assert.ok(final > 2000, 'should be above floor');
  });

  it('uses persisted value over ewma on subsequent calls', () => {
    const storage = createMemoryStorage();
    const tracker = createDeadlineTracker(storage, DEFAULT_CONFIG);
    tracker.getDeadline('item1', 2000); // 4000
    tracker.recordOutcome('item1', true); // 3400
    // Even with different ewma, persisted value should be used
    const deadline = tracker.getDeadline('item1', 5000);
    assert.equal(deadline, Math.round(4000 * 0.85));
  });

  it('cold starts with scaled bounds for multi-response items', () => {
    const storage = createMemoryStorage();
    const tracker = createDeadlineTracker(storage, DEFAULT_CONFIG);
    // responseCount=3: scaledMax = 9000*3 = 27000
    const deadline = tracker.getDeadline('item1', null, 3);
    assert.equal(deadline, 27000);
  });

  it('clamps to scaled minimum for multi-response items', () => {
    const storage = createMemoryStorage();
    const tracker = createDeadlineTracker(storage, DEFAULT_CONFIG);
    // responseCount=3: scaledMin = 1000*3*1.3 = 3900
    const deadline = tracker.getDeadline('item1', 100, 3);
    assert.equal(deadline, Math.round(1000 * 3 * dlCfg.minDeadlineMargin));
  });

  it('recordOutcome clamps to scaled bounds', () => {
    const storage = createMemoryStorage();
    const tracker = createDeadlineTracker(storage, DEFAULT_CONFIG);
    const scaledMin = Math.round(1000 * 3 * dlCfg.minDeadlineMargin);
    // Start near minimum
    tracker.getDeadline('item1', 1500, 3); // 1500*2.0 = 3000, clamped to scaledMin=3900
    // Correct answer: 3900 * 0.85 = 3315, but clamped to scaledMin
    tracker.recordOutcome('item1', true, 3);
    const after = tracker.getDeadline('item1', null, 3);
    assert.equal(after, scaledMin);
  });

  it('recordOutcome uses response-time anchor for fast correct answers', () => {
    const storage = createMemoryStorage();
    const tracker = createDeadlineTracker(storage, DEFAULT_CONFIG);
    tracker.getDeadline('item1', null); // 9000 (maxResponseTime)
    // Fast response: 2000ms with 9000ms deadline
    // anchored=3000, staircase=7650, target=3000, floor=4500 → 4500
    tracker.recordOutcome('item1', true, 1, 2000);
    const after = tracker.getDeadline('item1', null);
    assert.equal(after, 4500);
  });

  it('updateConfig changes the adaptive config reference', () => {
    const storage = createMemoryStorage();
    const tracker = createDeadlineTracker(storage, DEFAULT_CONFIG);
    // Get deadline with default config
    tracker.getDeadline('item1', null); // maxResponseTime = 9000
    // Update config with scaled values
    const scaledCfg = {
      ...DEFAULT_CONFIG,
      minTime: 1500,
      maxResponseTime: 13500,
    };
    tracker.updateConfig(scaledCfg);
    // New unseen item should use new maxResponseTime
    const deadline = tracker.getDeadline('item2', null);
    assert.equal(deadline, 13500);
  });
});
