// Tests for effort tracking: computeModeEffort, parseDailyReps,
// incrementDailyReps, computeGlobalEffort.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStorage } from './adaptive.ts';
import {
  computeGlobalEffort,
  computeModeEffort,
  type DailyRepsStore,
  incrementDailyReps,
  type ModeInfo,
  parseDailyReps,
} from './effort.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeModeInfo(
  id: string,
  items: string[],
  namespace?: string,
): ModeInfo {
  return { id, namespace: namespace ?? id, allItems: items };
}

function memoryDailyStore(initial?: string | null): DailyRepsStore {
  let data: string | null = initial ?? null;
  return {
    read: () => data,
    write: (json) => {
      data = json;
    },
  };
}

// ---------------------------------------------------------------------------
// computeModeEffort
// ---------------------------------------------------------------------------

describe('computeModeEffort', () => {
  it('returns zeros for empty storage', () => {
    const storage = createMemoryStorage();
    const mode = makeModeInfo('test', ['a', 'b', 'c']);
    const result = computeModeEffort(mode, storage);
    assert.equal(result.totalReps, 0);
    assert.equal(result.itemsStarted, 0);
    assert.equal(result.totalItems, 3);
  });

  it('sums reps and counts started items', () => {
    const storage = createMemoryStorage();
    storage.saveStats('a', {
      ewma: 500,
      sampleCount: 10,
      stability: 1,
      lastSeen: Date.now(),
    });
    storage.saveStats('b', {
      ewma: 600,
      sampleCount: 5,
      stability: 1,
      lastSeen: Date.now(),
    });
    const mode = makeModeInfo('test', ['a', 'b', 'c']);
    const result = computeModeEffort(mode, storage);
    assert.equal(result.totalReps, 15);
    assert.equal(result.itemsStarted, 2);
    assert.equal(result.totalItems, 3);
  });

  it('ignores items with sampleCount 0', () => {
    const storage = createMemoryStorage();
    storage.saveStats('a', {
      ewma: 500,
      sampleCount: 0,
      stability: 0,
      lastSeen: 0,
    });
    const mode = makeModeInfo('test', ['a']);
    const result = computeModeEffort(mode, storage);
    assert.equal(result.totalReps, 0);
    assert.equal(result.itemsStarted, 0);
  });
});

// ---------------------------------------------------------------------------
// parseDailyReps
// ---------------------------------------------------------------------------

describe('parseDailyReps', () => {
  it('returns empty for null', () => {
    assert.deepEqual(parseDailyReps(null), {});
  });

  it('returns empty for invalid JSON', () => {
    assert.deepEqual(parseDailyReps('not json'), {});
  });

  it('returns empty for array', () => {
    assert.deepEqual(parseDailyReps('[1,2,3]'), {});
  });

  it('parses valid date keys', () => {
    const result = parseDailyReps('{"2024-01-15":5,"2024-01-16":3}');
    assert.equal(result['2024-01-15'], 5);
    assert.equal(result['2024-01-16'], 3);
  });

  it('rejects non-date keys', () => {
    const result = parseDailyReps('{"hello":5,"2024-01-15":3}');
    assert.equal(result['hello' as string], undefined);
    assert.equal(result['2024-01-15'], 3);
  });

  it('rejects __proto__ key', () => {
    const result = parseDailyReps('{"__proto__":5,"2024-01-15":3}');
    assert.equal(Object.keys(result).length, 1);
  });

  it('rejects negative values', () => {
    const result = parseDailyReps('{"2024-01-15":-1}');
    assert.deepEqual(Object.keys(result), []);
  });

  it('rejects NaN/Infinity', () => {
    // JSON.parse can't produce NaN/Infinity, but string values would fail
    const result = parseDailyReps('{"2024-01-15":"NaN"}');
    assert.deepEqual(Object.keys(result), []);
  });
});

// ---------------------------------------------------------------------------
// incrementDailyReps
// ---------------------------------------------------------------------------

describe('incrementDailyReps', () => {
  it('creates first entry', () => {
    const store = memoryDailyStore();
    incrementDailyReps(store, new Date('2024-03-15T12:00:00Z'));
    const data = JSON.parse(store.read()!);
    assert.equal(data['2024-03-15'], 1);
  });

  it('increments existing day', () => {
    const store = memoryDailyStore('{"2024-03-15":5}');
    incrementDailyReps(store, new Date('2024-03-15T12:00:00Z'));
    const data = JSON.parse(store.read()!);
    assert.equal(data['2024-03-15'], 6);
  });

  it('adds new day without affecting others', () => {
    const store = memoryDailyStore('{"2024-03-15":5}');
    incrementDailyReps(store, new Date('2024-03-16T12:00:00Z'));
    const data = JSON.parse(store.read()!);
    assert.equal(data['2024-03-15'], 5);
    assert.equal(data['2024-03-16'], 1);
  });
});

// ---------------------------------------------------------------------------
// computeGlobalEffort
// ---------------------------------------------------------------------------

describe('computeGlobalEffort', () => {
  it('returns zeros for empty data', () => {
    const result = computeGlobalEffort([], {});
    assert.equal(result.totalReps, 0);
    assert.equal(result.daysActive, 0);
  });

  it('uses max of daily and mode totals', () => {
    const modeEfforts = [
      {
        id: 'a',
        namespace: 'a',
        totalReps: 100,
        itemsStarted: 5,
        totalItems: 10,
      },
    ];
    const daily = { '2024-01-15': 50 };
    const result = computeGlobalEffort(modeEfforts, daily);
    assert.equal(result.totalReps, 100); // mode total > daily total
    assert.equal(result.daysActive, 1);
  });

  it('counts days with reps > 0', () => {
    const daily = {
      '2024-01-15': 5,
      '2024-01-16': 0,
      '2024-01-17': 3,
    };
    const result = computeGlobalEffort([], daily);
    assert.equal(result.daysActive, 2); // day with 0 excluded
    assert.equal(result.totalReps, 8);
  });
});
