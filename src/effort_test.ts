// Tests for effort tracking: computeSkillEffort, parseDailyReps,
// incrementDailyReps, computeGlobalEffort.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStorage } from './adaptive.ts';
import {
  computeGlobalEffort,
  computeSkillEffort,
  type DailyRepsStore,
  getGlobalEffort,
  getSkillEffort,
  incrementDailyReps,
  parseDailyReps,
  registerSkillForEffort,
  type SkillInfo,
  toLocalDateString,
} from './effort.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSkillInfo(
  id: string,
  items: string[],
  namespace?: string,
): SkillInfo {
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
// computeSkillEffort
// ---------------------------------------------------------------------------

describe('computeSkillEffort', () => {
  it('returns zeros for empty storage', () => {
    const storage = createMemoryStorage();
    const mode = makeSkillInfo('test', ['a', 'b', 'c']);
    const result = computeSkillEffort(mode, storage);
    assert.equal(result.totalReps, 0);
    assert.equal(result.itemsStarted, 0);
    assert.equal(result.totalItems, 3);
  });

  it('sums reps and counts started items', () => {
    const storage = createMemoryStorage();
    storage.saveStats('a', {
      recentTimes: [],
      ewma: 500,
      sampleCount: 10,
      stability: 1,
      lastSeen: Date.now(),
      lastCorrectAt: Date.now(),
    });
    storage.saveStats('b', {
      recentTimes: [],
      ewma: 600,
      sampleCount: 5,
      stability: 1,
      lastSeen: Date.now(),
      lastCorrectAt: Date.now(),
    });
    const mode = makeSkillInfo('test', ['a', 'b', 'c']);
    const result = computeSkillEffort(mode, storage);
    assert.equal(result.totalReps, 15);
    assert.equal(result.itemsStarted, 2);
    assert.equal(result.totalItems, 3);
  });

  it('ignores items with sampleCount 0', () => {
    const storage = createMemoryStorage();
    storage.saveStats('a', {
      recentTimes: [],
      ewma: 500,
      sampleCount: 0,
      stability: 0,
      lastSeen: 0,
      lastCorrectAt: null,
    });
    const mode = makeSkillInfo('test', ['a']);
    const result = computeSkillEffort(mode, storage);
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
// toLocalDateString
// ---------------------------------------------------------------------------

describe('toLocalDateString', () => {
  it('formats a local-time date as YYYY-MM-DD', () => {
    // Construct in local time — result is always 2024-03-15 regardless of TZ
    const date = new Date(2024, 2, 15, 12, 0, 0);
    assert.equal(toLocalDateString(date), '2024-03-15');
  });

  it('zero-pads single-digit month and day', () => {
    const date = new Date(2024, 0, 5, 12, 0, 0); // Jan 5
    assert.equal(toLocalDateString(date), '2024-01-05');
  });

  it('uses local date, not UTC', () => {
    // 2024-03-16 at 2am UTC = still March 15 in any UTC-3..UTC-12 timezone.
    // In UTC+ timezones this is March 16. Either way, the result must match
    // the *local* date parts, not the UTC date.
    const date = new Date('2024-03-16T02:00:00Z');
    const localExpected = `${date.getFullYear()}-${
      String(date.getMonth() + 1).padStart(2, '0')
    }-${String(date.getDate()).padStart(2, '0')}`;
    const utcExpected = `${date.getUTCFullYear()}-${
      String(date.getUTCMonth() + 1).padStart(2, '0')
    }-${String(date.getUTCDate()).padStart(2, '0')}`;
    const actual = toLocalDateString(date);
    assert.equal(actual, localExpected);
    if (localExpected !== utcExpected) {
      assert.notEqual(actual, utcExpected);
    }
  });
});

// ---------------------------------------------------------------------------
// incrementDailyReps
// ---------------------------------------------------------------------------

describe('incrementDailyReps', () => {
  it('creates first entry', () => {
    const store = memoryDailyStore();
    // Use local-time constructor so the expected date is stable across TZs
    incrementDailyReps(store, new Date(2024, 2, 15, 12, 0, 0));
    const data = JSON.parse(store.read()!);
    assert.equal(data['2024-03-15'], 1);
  });

  it('increments existing day', () => {
    const store = memoryDailyStore('{"2024-03-15":5}');
    incrementDailyReps(store, new Date(2024, 2, 15, 12, 0, 0));
    const data = JSON.parse(store.read()!);
    assert.equal(data['2024-03-15'], 6);
  });

  it('adds new day without affecting others', () => {
    const store = memoryDailyStore('{"2024-03-15":5}');
    incrementDailyReps(store, new Date(2024, 2, 16, 12, 0, 0));
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
    const skillEfforts = [
      {
        id: 'a',
        namespace: 'a',
        totalReps: 100,
        itemsStarted: 5,
        totalItems: 10,
      },
    ];
    const daily = { '2024-01-15': 50 };
    const result = computeGlobalEffort(skillEfforts, daily);
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

// ---------------------------------------------------------------------------
// Convenience wrappers (getGlobalEffort, getSkillEffort)
// ---------------------------------------------------------------------------

describe('getSkillEffort', () => {
  it('returns null for unknown mode', () => {
    assert.equal(getSkillEffort('nonexistent-skill-id'), null);
  });
});

describe('getGlobalEffort', () => {
  it('returns a GlobalEffort with totalReps and daysActive', () => {
    // Register a mode so the function exercises the registry path.
    // Uses real localStorage-backed storage, which is empty in test.
    registerSkillForEffort({
      id: '__test_effort__',
      namespace: '__test_effort__',
      allItems: ['x'],
    });
    const result = getGlobalEffort();
    assert.equal(typeof result.totalReps, 'number');
    assert.equal(typeof result.daysActive, 'number');
    assert.ok(result.totalReps >= 0);
  });
});
