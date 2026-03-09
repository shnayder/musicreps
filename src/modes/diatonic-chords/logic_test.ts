import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_ITEMS,
  CHORD_GROUPS,
  getGridItemId,
  getItemIdsForGroup,
  getQuestion,
  normalizeNumeralInput,
} from './logic.ts';

describe('ALL_ITEMS', () => {
  it('has 168 items (12 keys × 7 degrees × 2 directions)', () => {
    assert.equal(ALL_ITEMS.length, 168);
  });

  it('contains fwd and rev for expected items', () => {
    assert.ok(ALL_ITEMS.includes('C:1:fwd'));
    assert.ok(ALL_ITEMS.includes('C:1:rev'));
    assert.ok(ALL_ITEMS.includes('Bb:4:fwd'));
    assert.ok(ALL_ITEMS.includes('Bb:4:rev'));
  });
});

describe('CHORD_GROUPS', () => {
  it('has 3 groups', () => {
    assert.equal(CHORD_GROUPS.length, 3);
  });
});

describe('getItemIdsForGroup', () => {
  it('group 0 contains items for degrees 1, 4, and 5', () => {
    const ids = getItemIdsForGroup(0);
    assert.ok(ids.includes('C:1:fwd'));
    assert.ok(ids.includes('C:1:rev'));
    assert.ok(ids.includes('C:4:fwd'));
    assert.ok(ids.includes('C:4:rev'));
    assert.ok(ids.includes('C:5:fwd'));
    assert.ok(ids.includes('C:5:rev'));
  });

  it('group 0 does not include degree 2, 3, 6, or 7', () => {
    const ids = getItemIdsForGroup(0);
    assert.ok(!ids.includes('C:2:fwd'));
    assert.ok(!ids.includes('C:3:fwd'));
    assert.ok(!ids.includes('C:6:fwd'));
    assert.ok(!ids.includes('C:7:fwd'));
  });

  it('group 0 has 72 items (12 keys × 3 degrees × 2 directions)', () => {
    const ids = getItemIdsForGroup(0);
    assert.equal(ids.length, 72);
  });
});

describe('getQuestion', () => {
  it('C:1:fwd returns keyRoot "C", degree 1, chord with numeral "I", dir "fwd"', () => {
    const q = getQuestion('C:1:fwd');
    assert.equal(q.keyRoot, 'C');
    assert.equal(q.degree, 1);
    assert.equal(q.chord.numeral, 'I');
    assert.equal(q.dir, 'fwd');
    assert.equal(q.rootNote, 'C');
  });

  it('Bb:4:rev returns degree 4, chord with numeral "IV", dir "rev"', () => {
    const q = getQuestion('Bb:4:rev');
    assert.equal(q.keyRoot, 'Bb');
    assert.equal(q.degree, 4);
    assert.equal(q.chord.numeral, 'IV');
    assert.equal(q.dir, 'rev');
  });

  it('C:2:fwd returns numeral "ii" and rootNote "D"', () => {
    const q = getQuestion('C:2:fwd');
    assert.equal(q.chord.numeral, 'ii');
    assert.equal(q.rootNote, 'D');
  });

  it('Bb:4:fwd returns rootNote "Eb" (4th degree of Bb major)', () => {
    const q = getQuestion('Bb:4:fwd');
    assert.equal(q.rootNote, 'Eb');
  });
});

describe('getQuestion expected values', () => {
  it('fwd: rootNote is the expected note answer', () => {
    const q = getQuestion('C:1:fwd');
    assert.equal(q.rootNote, 'C');
  });

  it('fwd: Bb:4 rootNote is "Eb"', () => {
    const q = getQuestion('Bb:4:fwd');
    assert.equal(q.rootNote, 'Eb');
  });

  it('rev: chord.numeral is the expected answer', () => {
    const q = getQuestion('C:1:rev');
    assert.equal(q.chord.numeral, 'I');
  });

  it('rev: Bb:4 chord.numeral is "IV"', () => {
    const q = getQuestion('Bb:4:rev');
    assert.equal(q.chord.numeral, 'IV');
  });
});

describe('normalizeNumeralInput', () => {
  it('"4" → "IV"', () => {
    assert.equal(normalizeNumeralInput('4'), 'IV');
  });

  it('"1" → "I"', () => {
    assert.equal(normalizeNumeralInput('1'), 'I');
  });

  it('"7" → "vii\u00B0"', () => {
    assert.equal(normalizeNumeralInput('7'), 'vii\u00B0');
  });

  it('"vii" → "vii\u00B0" (adds degree sign)', () => {
    assert.equal(normalizeNumeralInput('vii'), 'vii\u00B0');
  });

  it('"IV" passes through unchanged', () => {
    assert.equal(normalizeNumeralInput('IV'), 'IV');
  });

  it('"vii\u00B0" passes through unchanged', () => {
    assert.equal(normalizeNumeralInput('vii\u00B0'), 'vii\u00B0');
  });
});

describe('getGridItemId', () => {
  it('"C", 0 returns ["C:1:fwd", "C:1:rev"] (colIdx 0 → degree 1)', () => {
    const result = getGridItemId('C', 0);
    assert.deepEqual(result, ['C:1:fwd', 'C:1:rev']);
  });

  it('"Bb", 3 returns ["Bb:4:fwd", "Bb:4:rev"] (colIdx 3 → degree 4)', () => {
    const result = getGridItemId('Bb', 3);
    assert.deepEqual(result, ['Bb:4:fwd', 'Bb:4:rev']);
  });

  it('"G", 6 returns ["G:7:fwd", "G:7:rev"] (colIdx 6 → degree 7)', () => {
    const result = getGridItemId('G', 6);
    assert.deepEqual(result, ['G:7:fwd', 'G:7:rev']);
  });
});
