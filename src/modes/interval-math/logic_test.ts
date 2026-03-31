import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_ITEMS,
  DISTANCE_GROUPS,
  getGridItemId,
  getItemIdsForGroup,
  getQuestion,
  GRID_COL_LABELS,
  MATH_INTERVALS,
} from './logic.ts';

// ---------------------------------------------------------------------------
// MATH_INTERVALS
// ---------------------------------------------------------------------------

describe('MATH_INTERVALS', () => {
  it('has 11 intervals (semitones 1–11)', () => {
    assert.equal(MATH_INTERVALS.length, 11);
  });

  it('covers semitones 1 through 11 in order', () => {
    for (let i = 0; i < 11; i++) {
      assert.equal(MATH_INTERVALS[i].num, i + 1);
    }
  });

  it('first is m2, last is M7', () => {
    assert.equal(MATH_INTERVALS[0].abbrev, 'm2');
    assert.equal(MATH_INTERVALS[10].abbrev, 'M7');
  });

  it('excludes unison (0) and octave (12)', () => {
    assert.ok(!MATH_INTERVALS.some((i) => i.num === 0));
    assert.ok(!MATH_INTERVALS.some((i) => i.num === 12));
  });
});

// ---------------------------------------------------------------------------
// ALL_ITEMS
// ---------------------------------------------------------------------------

describe('ALL_ITEMS', () => {
  it('has 264 items (12 notes × 11 intervals × 2 directions)', () => {
    assert.equal(ALL_ITEMS.length, 264);
  });

  it('contains both + and - variants', () => {
    assert.ok(ALL_ITEMS.includes('C+m2'));
    assert.ok(ALL_ITEMS.includes('C-m2'));
    assert.ok(ALL_ITEMS.includes('C+M7'));
    assert.ok(ALL_ITEMS.includes('C-M7'));
    assert.ok(ALL_ITEMS.includes('B+P5'));
    assert.ok(ALL_ITEMS.includes('B-P5'));
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
  it('has 5 groups', () => {
    assert.equal(DISTANCE_GROUPS.length, 5);
  });

  it('each group has distances and label', () => {
    for (const group of DISTANCE_GROUPS) {
      assert.ok(Array.isArray(group.distances) && group.distances.length > 0);
      assert.ok(typeof group.label === 'string' && group.label.length > 0);
    }
  });

  it('groups cover semitone distances 1–11', () => {
    const allDistances = DISTANCE_GROUPS.flatMap((g) => g.distances);
    allDistances.sort((a, b) => a - b);
    assert.deepEqual(allDistances, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it('first group contains distances 1 and 2 (m2 and M2)', () => {
    assert.deepEqual(DISTANCE_GROUPS[0].distances, [1, 2]);
  });

  it('last group contains distances 9, 10, and 11 (M6 m7 M7)', () => {
    const last = DISTANCE_GROUPS[DISTANCE_GROUPS.length - 1];
    assert.deepEqual(last.distances, [9, 10, 11]);
  });
});

// ---------------------------------------------------------------------------
// getItemIdsForGroup
// ---------------------------------------------------------------------------

describe('getItemIdsForGroup', () => {
  it('group 0 contains items with m2 and M2', () => {
    const ids = getItemIdsForGroup('seconds');
    assert.ok(ids.includes('C+m2'));
    assert.ok(ids.includes('C-m2'));
    assert.ok(ids.includes('C+M2'));
    assert.ok(ids.includes('C-M2'));
  });

  it('group 0 does not contain m3 or higher', () => {
    const ids = getItemIdsForGroup('seconds');
    assert.ok(!ids.includes('C+m3'));
    assert.ok(!ids.includes('C-P4'));
  });

  it('group 0 has 48 items (12 notes × 2 intervals × 2 dirs)', () => {
    const ids = getItemIdsForGroup('seconds');
    assert.equal(ids.length, 48);
  });

  it('group 4 contains M6, m7, and M7 items', () => {
    const ids = getItemIdsForGroup('sixths-sevenths');
    assert.ok(ids.includes('C+M6'));
    assert.ok(ids.includes('C-M6'));
    assert.ok(ids.includes('C+m7'));
    assert.ok(ids.includes('C-m7'));
    assert.ok(ids.includes('C+M7'));
    assert.ok(ids.includes('C-M7'));
  });

  it('group 4 has 72 items (12 notes × 3 intervals × 2 dirs)', () => {
    const ids = getItemIdsForGroup('sixths-sevenths');
    assert.equal(ids.length, 72);
  });
});

// ---------------------------------------------------------------------------
// getQuestion
// ---------------------------------------------------------------------------

describe('getQuestion("C+m3")', () => {
  it('returns note.name "C", op "+", interval.abbrev "m3"', () => {
    const q = getQuestion('C+m3');
    assert.equal(q.note.name, 'C');
    assert.equal(q.op, '+');
    assert.equal(q.interval.abbrev, 'm3');
  });

  it('has useFlats false for addition', () => {
    const q = getQuestion('C+m3');
    assert.equal(q.useFlats, false);
  });

  it('answer is D# (C + minor 3rd = 3 semitones = D#)', () => {
    const q = getQuestion('C+m3');
    assert.equal(q.answer.num, 3);
  });

  it('promptText contains note name, op, and interval abbreviation', () => {
    const q = getQuestion('C+m3');
    assert.ok(q.promptText.includes('+'));
    assert.ok(q.promptText.includes('m3'));
  });
});

describe('getQuestion("G-P5")', () => {
  it('returns op "-", interval.abbrev "P5"', () => {
    const q = getQuestion('G-P5');
    assert.equal(q.op, '-');
    assert.equal(q.interval.abbrev, 'P5');
    assert.equal(q.note.name, 'G');
  });

  it('has useFlats true for subtraction', () => {
    const q = getQuestion('G-P5');
    assert.equal(q.useFlats, true);
  });

  it('answer is C (G - P5 = 7 semitones down)', () => {
    const q = getQuestion('G-P5');
    assert.equal(q.answer.name, 'C');
  });
});

describe('getQuestion edge cases', () => {
  it('C+m2 answer is C# (1 semitone up)', () => {
    const q = getQuestion('C+m2');
    assert.equal(q.answer.num, 1);
  });

  it('C-m2 answer is B (1 semitone down)', () => {
    const q = getQuestion('C-m2');
    assert.equal(q.answer.name, 'B');
  });

  it('B+m2 answer wraps to C (num 0)', () => {
    const q = getQuestion('B+m2');
    assert.equal(q.answer.name, 'C');
  });

  it('interval object has num property matching semitone count', () => {
    const q = getQuestion('C+P4');
    assert.equal(q.interval.num, 5); // P4 = 5 semitones
    assert.equal(q.answer.num, 5); // C + 5 = F
  });
});

// ---------------------------------------------------------------------------
// Expected values (used by answer spec)
// ---------------------------------------------------------------------------

describe('getQuestion expected values', () => {
  it('answer.name is the expected note value', () => {
    const q = getQuestion('C+M3');
    assert.equal(q.answer.name, 'E');
  });

  it('C+m2 answer.name is C#', () => {
    const q = getQuestion('C+m2');
    assert.equal(q.answer.name, 'C#');
  });

  it('D-m2 answer.name is C#', () => {
    const q = getQuestion('D-m2');
    assert.equal(q.answer.name, 'C#');
  });

  it('useFlats=false for addition, true for subtraction', () => {
    assert.equal(getQuestion('C+m3').useFlats, false);
    assert.equal(getQuestion('D-m2').useFlats, true);
  });
});

// ---------------------------------------------------------------------------
// GRID_COL_LABELS
// ---------------------------------------------------------------------------

describe('GRID_COL_LABELS', () => {
  it('has 11 labels (one per interval)', () => {
    assert.equal(GRID_COL_LABELS.length, 11);
  });

  it('labels are interval abbreviations (not numbers)', () => {
    assert.equal(GRID_COL_LABELS[0], 'm2');
    assert.equal(GRID_COL_LABELS[1], 'M2');
    assert.equal(GRID_COL_LABELS[6], 'P5');
    assert.equal(GRID_COL_LABELS[10], 'M7');
  });

  it('matches MATH_INTERVALS abbreviations in order', () => {
    for (let i = 0; i < 11; i++) {
      assert.equal(GRID_COL_LABELS[i], MATH_INTERVALS[i].abbrev);
    }
  });
});

// ---------------------------------------------------------------------------
// getGridItemId
// ---------------------------------------------------------------------------

describe('getGridItemId', () => {
  it('getGridItemId("C", 0) returns ["C+m2", "C-m2"]', () => {
    assert.deepEqual(getGridItemId('C', 0), ['C+m2', 'C-m2']);
  });

  it('getGridItemId("C", 6) returns ["C+P5", "C-P5"]', () => {
    assert.deepEqual(getGridItemId('C', 6), ['C+P5', 'C-P5']);
  });

  it('getGridItemId("G", 0) returns ["G+m2", "G-m2"]', () => {
    assert.deepEqual(getGridItemId('G', 0), ['G+m2', 'G-m2']);
  });

  it('always returns an array of 2 strings', () => {
    const result = getGridItemId('D', 4);
    assert.equal(result.length, 2);
    assert.ok(result[0].includes('+'));
    assert.ok(result[1].includes('-'));
  });

  it('last column (index 10) returns M7 items', () => {
    assert.deepEqual(getGridItemId('C', 10), ['C+M7', 'C-M7']);
  });
});
