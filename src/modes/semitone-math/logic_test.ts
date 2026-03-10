import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_ITEMS,
  DISTANCE_GROUPS,
  getGridItemId,
  getItemIdsForGroup,
  getQuestion,
  GRID_COL_LABELS,
} from './logic.ts';

// ---------------------------------------------------------------------------
// ALL_ITEMS
// ---------------------------------------------------------------------------

describe('ALL_ITEMS', () => {
  it('has 264 items (12 notes × 11 distances × 2 directions)', () => {
    assert.equal(ALL_ITEMS.length, 264);
  });

  it('contains both + and - variants for each note/distance combo', () => {
    assert.ok(ALL_ITEMS.includes('C+1'));
    assert.ok(ALL_ITEMS.includes('C-1'));
    assert.ok(ALL_ITEMS.includes('C+11'));
    assert.ok(ALL_ITEMS.includes('C-11'));
    assert.ok(ALL_ITEMS.includes('B+5'));
    assert.ok(ALL_ITEMS.includes('B-5'));
  });

  it('all IDs contain + or - operator', () => {
    for (const id of ALL_ITEMS) {
      assert.ok(id.includes('+') || id.includes('-'), `unexpected id: ${id}`);
    }
  });
});

// ---------------------------------------------------------------------------
// DISTANCE_GROUPS
// ---------------------------------------------------------------------------

describe('DISTANCE_GROUPS', () => {
  it('has 6 groups', () => {
    assert.equal(DISTANCE_GROUPS.length, 6);
  });

  it('each group has distances and label', () => {
    for (const group of DISTANCE_GROUPS) {
      assert.ok(Array.isArray(group.distances) && group.distances.length > 0);
      assert.ok(typeof group.label === 'string' && group.label.length > 0);
    }
  });

  it('groups cover distances 1–11 without gaps', () => {
    const allDistances = DISTANCE_GROUPS.flatMap((g) => g.distances);
    allDistances.sort((a, b) => a - b);
    assert.deepEqual(allDistances, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it('last group contains only distance 11', () => {
    const last = DISTANCE_GROUPS[DISTANCE_GROUPS.length - 1];
    assert.deepEqual(last.distances, [11]);
  });
});

// ---------------------------------------------------------------------------
// getItemIdsForGroup
// ---------------------------------------------------------------------------

describe('getItemIdsForGroup', () => {
  it('group 0 contains items with distances 1 and 2', () => {
    const ids = getItemIdsForGroup(0);
    assert.ok(ids.includes('C+1'));
    assert.ok(ids.includes('C-1'));
    assert.ok(ids.includes('C+2'));
    assert.ok(ids.includes('C-2'));
  });

  it('group 0 does not contain distances 3 or higher', () => {
    const ids = getItemIdsForGroup(0);
    assert.ok(!ids.includes('C+3'));
    assert.ok(!ids.includes('C-3'));
  });

  it('group 0 has 48 items (12 notes × 2 distances × 2 dirs)', () => {
    const ids = getItemIdsForGroup(0);
    assert.equal(ids.length, 48);
  });

  it('group 5 contains only distance 11', () => {
    const ids = getItemIdsForGroup(5);
    assert.ok(ids.includes('C+11'));
    assert.ok(ids.includes('C-11'));
    assert.ok(!ids.includes('C+10'));
  });

  it('group 5 has 24 items (12 notes × 1 distance × 2 dirs)', () => {
    const ids = getItemIdsForGroup(5);
    assert.equal(ids.length, 24);
  });
});

// ---------------------------------------------------------------------------
// getQuestion
// ---------------------------------------------------------------------------

describe('getQuestion("C+3")', () => {
  it('returns note.name "C", op "+", semitones 3', () => {
    const q = getQuestion('C+3');
    assert.equal(q.note.name, 'C');
    assert.equal(q.op, '+');
    assert.equal(q.semitones, 3);
  });

  it('has useFlats false for addition', () => {
    const q = getQuestion('C+3');
    assert.equal(q.useFlats, false);
  });

  it('answer is D# (C + 3 semitones)', () => {
    const q = getQuestion('C+3');
    assert.equal(q.answer.num, 3); // D# = num 3
  });

  it('promptText contains note name, op, and semitone count', () => {
    const q = getQuestion('C+3');
    assert.ok(q.promptText.includes('+'));
    assert.ok(q.promptText.includes('3'));
  });
});

describe('getQuestion("G-5")', () => {
  it('returns op "-", semitones 5', () => {
    const q = getQuestion('G-5');
    assert.equal(q.op, '-');
    assert.equal(q.semitones, 5);
    assert.equal(q.note.name, 'G');
  });

  it('has useFlats true for subtraction', () => {
    const q = getQuestion('G-5');
    assert.equal(q.useFlats, true);
  });

  it('answer is D (G - 5 semitones = D)', () => {
    const q = getQuestion('G-5');
    assert.equal(q.answer.name, 'D');
  });
});

describe('getQuestion edge cases', () => {
  it('C+1 answer is C# (num 1)', () => {
    const q = getQuestion('C+1');
    assert.equal(q.answer.num, 1);
  });

  it('C-1 answer is B (num 11)', () => {
    const q = getQuestion('C-1');
    assert.equal(q.answer.name, 'B');
  });

  it('B+1 answer wraps to C (num 0)', () => {
    const q = getQuestion('B+1');
    assert.equal(q.answer.name, 'C');
  });
});

// ---------------------------------------------------------------------------
// Expected values (used by answer spec)
// ---------------------------------------------------------------------------

describe('getQuestion expected values', () => {
  it('answer.name is the expected note value', () => {
    const q = getQuestion('C+4');
    assert.equal(q.answer.name, 'E');
  });

  it('C+1 answer.name is C#', () => {
    const q = getQuestion('C+1');
    assert.equal(q.answer.name, 'C#');
  });

  it('D-1 answer.name is C#', () => {
    const q = getQuestion('D-1');
    assert.equal(q.answer.name, 'C#');
  });

  it('useFlats=false for addition, true for subtraction', () => {
    assert.equal(getQuestion('C+3').useFlats, false);
    assert.equal(getQuestion('D-1').useFlats, true);
  });
});

// ---------------------------------------------------------------------------
// GRID_COL_LABELS
// ---------------------------------------------------------------------------

describe('GRID_COL_LABELS', () => {
  it('has 11 labels', () => {
    assert.equal(GRID_COL_LABELS.length, 11);
  });

  it('labels are "1" through "11"', () => {
    for (let i = 0; i < 11; i++) {
      assert.equal(GRID_COL_LABELS[i], String(i + 1));
    }
  });
});

// ---------------------------------------------------------------------------
// getGridItemId
// ---------------------------------------------------------------------------

describe('getGridItemId', () => {
  it('getGridItemId("C", 2) returns ["C+3", "C-3"]', () => {
    assert.deepEqual(getGridItemId('C', 2), ['C+3', 'C-3']);
  });

  it('getGridItemId("C", 0) returns ["C+1", "C-1"]', () => {
    assert.deepEqual(getGridItemId('C', 0), ['C+1', 'C-1']);
  });

  it('getGridItemId("G", 10) returns ["G+11", "G-11"]', () => {
    assert.deepEqual(getGridItemId('G', 10), ['G+11', 'G-11']);
  });

  it('always returns an array of 2 strings', () => {
    const result = getGridItemId('D', 5);
    assert.equal(result.length, 2);
    assert.ok(result[0].includes('+'));
    assert.ok(result[1].includes('-'));
  });
});
