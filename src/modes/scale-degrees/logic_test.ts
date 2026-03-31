import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_ITEMS,
  DEGREE_GROUPS,
  getGridItemId,
  getItemIdsForGroup,
  getQuestion,
  GRID_NOTES,
} from './logic.ts';

describe('ALL_ITEMS', () => {
  it('has 144 items (12 keys × 6 degrees × 2 directions)', () => {
    assert.equal(ALL_ITEMS.length, 144);
  });

  it('excludes 1st degree', () => {
    assert.ok(!ALL_ITEMS.includes('C:1:fwd'));
    assert.ok(!ALL_ITEMS.includes('C:1:rev'));
  });

  it('contains fwd and rev items for degrees 2–7', () => {
    assert.ok(ALL_ITEMS.includes('C:2:fwd'));
    assert.ok(ALL_ITEMS.includes('C:2:rev'));
    assert.ok(ALL_ITEMS.includes('C:7:fwd'));
    assert.ok(ALL_ITEMS.includes('C:7:rev'));
    assert.ok(ALL_ITEMS.includes('F#:4:fwd'));
    assert.ok(ALL_ITEMS.includes('F#:4:rev'));
  });
});

describe('DEGREE_GROUPS', () => {
  it('has 3 groups', () => {
    assert.equal(DEGREE_GROUPS.length, 3);
  });
});

describe('getItemIdsForGroup', () => {
  it('group 0 contains items for degrees 4 and 5', () => {
    const ids = getItemIdsForGroup('4th-5th');
    assert.ok(ids.includes('C:4:fwd'));
    assert.ok(ids.includes('C:4:rev'));
    assert.ok(ids.includes('C:5:fwd'));
    assert.ok(ids.includes('C:5:rev'));
    assert.ok(ids.includes('D:4:fwd'));
    assert.ok(ids.includes('D:5:fwd'));
  });

  it('group 0 does not include degree 1, 3, or 6', () => {
    const ids = getItemIdsForGroup('4th-5th');
    assert.ok(!ids.includes('C:1:fwd'));
    assert.ok(!ids.includes('C:3:fwd'));
    assert.ok(!ids.includes('C:6:fwd'));
  });

  it('group 0 has 48 items (12 keys × 2 degrees × 2 directions)', () => {
    const ids = getItemIdsForGroup('4th-5th');
    assert.equal(ids.length, 48);
  });
});

describe('getQuestion', () => {
  it('C:3:fwd returns keyRoot "C", degree 3, dir "fwd", noteName "E"', () => {
    const q = getQuestion('C:3:fwd');
    assert.equal(q.keyRoot, 'C');
    assert.equal(q.degree, 3);
    assert.equal(q.dir, 'fwd');
    assert.equal(q.noteName, 'E');
  });

  it('D:5:rev returns degree 5, dir "rev", noteName "A"', () => {
    const q = getQuestion('D:5:rev');
    assert.equal(q.keyRoot, 'D');
    assert.equal(q.degree, 5);
    assert.equal(q.dir, 'rev');
    assert.equal(q.noteName, 'A');
  });

  it('G:4:fwd returns noteName "C"', () => {
    // 4th degree of G major is C
    const q = getQuestion('G:4:fwd');
    assert.equal(q.noteName, 'C');
  });
});

describe('getQuestion expected values', () => {
  it('fwd: noteName is the expected note answer', () => {
    const q = getQuestion('C:3:fwd');
    assert.equal(q.noteName, 'E');
  });

  it('rev: degree is the expected degree answer', () => {
    const q = getQuestion('C:3:rev');
    assert.equal(String(q.degree), '3');
  });

  it('D:5:fwd noteName is "A"', () => {
    const q = getQuestion('D:5:fwd');
    assert.equal(q.noteName, 'A');
  });
});

describe('GRID_NOTES', () => {
  it('has 12 entries (one per key)', () => {
    assert.equal(GRID_NOTES.length, 12);
  });

  it('each entry has name and displayName', () => {
    for (const entry of GRID_NOTES) {
      assert.ok(entry.name, 'entry should have name');
      assert.ok(entry.displayName, 'entry should have displayName');
    }
  });
});

describe('getGridItemId', () => {
  it('"C", 1 returns ["C:3:fwd", "C:3:rev"] (colIdx 1 → degree 3)', () => {
    const result = getGridItemId('C', 1);
    assert.deepEqual(result, ['C:3:fwd', 'C:3:rev']);
  });

  it('"D", 3 returns ["D:5:fwd", "D:5:rev"] (colIdx 3 → degree 5)', () => {
    const result = getGridItemId('D', 3);
    assert.deepEqual(result, ['D:5:fwd', 'D:5:rev']);
  });

  it('"C", 0 returns ["C:2:fwd", "C:2:rev"] (colIdx 0 → degree 2)', () => {
    const result = getGridItemId('C', 0);
    assert.deepEqual(result, ['C:2:fwd', 'C:2:rev']);
  });
});
