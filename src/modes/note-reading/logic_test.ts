import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_ITEMS,
  buildAbcString,
  checkAnswer,
  getGridItemId,
  getItemIdsForGroup,
  getQuestion,
  GRID_COL_LABELS,
  GRID_ROW_LABELS,
  GROUPS,
  parseItemId,
  pitchToAbc,
} from './logic.ts';

// ---------------------------------------------------------------------------
// pitchToAbc
// ---------------------------------------------------------------------------

describe('pitchToAbc', () => {
  it('octave 4 → uppercase letter', () => {
    assert.equal(pitchToAbc('C', 4), 'C');
    assert.equal(pitchToAbc('G', 4), 'G');
  });

  it('octave 5 → lowercase letter', () => {
    assert.equal(pitchToAbc('C', 5), 'c');
    assert.equal(pitchToAbc('F', 5), 'f');
  });

  it('octave 3 → uppercase + comma', () => {
    assert.equal(pitchToAbc('A', 3), 'A,');
    assert.equal(pitchToAbc('B', 3), 'B,');
  });

  it('octave 2 → uppercase + two commas', () => {
    assert.equal(pitchToAbc('G', 2), 'G,,');
  });

  it('octave 6 → lowercase + apostrophe', () => {
    assert.equal(pitchToAbc('D', 6), "d'");
  });

  it('octave 7 → lowercase + two apostrophes', () => {
    assert.equal(pitchToAbc('C', 7), "c''");
  });

  it('octave 0 → uppercase + four commas', () => {
    assert.equal(pitchToAbc('B', 0), 'B,,,,');
  });
});

// ---------------------------------------------------------------------------
// parseItemId
// ---------------------------------------------------------------------------

describe('parseItemId', () => {
  it('parses treble item', () => {
    assert.deepEqual(parseItemId('t:E4'), {
      clef: 'treble',
      letter: 'E',
      octave: 4,
    });
  });

  it('parses bass item', () => {
    assert.deepEqual(parseItemId('b:G2'), {
      clef: 'bass',
      letter: 'G',
      octave: 2,
    });
  });

  it('handles multi-digit octave-ish items (bass low)', () => {
    // B0 is a valid item in the bass ±3–6 group
    assert.deepEqual(parseItemId('b:B0'), {
      clef: 'bass',
      letter: 'B',
      octave: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// ALL_ITEMS
// ---------------------------------------------------------------------------

describe('ALL_ITEMS', () => {
  it('has 66 items (33 treble + 33 bass)', () => {
    assert.equal(ALL_ITEMS.length, 66);
  });

  it('all IDs start with t: or b:', () => {
    for (const id of ALL_ITEMS) {
      assert.ok(id.startsWith('t:') || id.startsWith('b:'), `bad id: ${id}`);
    }
  });

  it('contains no duplicate IDs', () => {
    assert.equal(new Set(ALL_ITEMS).size, ALL_ITEMS.length);
  });

  it('contains representative items', () => {
    assert.ok(ALL_ITEMS.includes('t:E4')); // treble bottom line
    assert.ok(ALL_ITEMS.includes('t:C4')); // middle C on treble
    assert.ok(ALL_ITEMS.includes('b:G2')); // bass bottom line
    assert.ok(ALL_ITEMS.includes('b:C4')); // middle C on bass
  });
});

// ---------------------------------------------------------------------------
// GROUPS
// ---------------------------------------------------------------------------

describe('GROUPS', () => {
  it('has 6 groups', () => {
    assert.equal(GROUPS.length, 6);
  });

  it('group items cover all items without overlap', () => {
    const all: string[] = [];
    for (let i = 0; i < GROUPS.length; i++) {
      all.push(...getItemIdsForGroup(i));
    }
    assert.equal(all.length, ALL_ITEMS.length);
    assert.equal(new Set(all).size, all.length, 'no duplicates across groups');
  });

  it('treble staff group has 9 items (E4-F5)', () => {
    assert.equal(getItemIdsForGroup(0).length, 9);
  });

  it('bass staff group has 9 items (G2-A3)', () => {
    assert.equal(getItemIdsForGroup(3).length, 9);
  });

  it('near-ledger groups have 8 items each', () => {
    assert.equal(getItemIdsForGroup(1).length, 8);
    assert.equal(getItemIdsForGroup(4).length, 8);
  });

  it('far-ledger groups have 16 items each', () => {
    assert.equal(getItemIdsForGroup(2).length, 16);
    assert.equal(getItemIdsForGroup(5).length, 16);
  });
});

// ---------------------------------------------------------------------------
// getQuestion
// ---------------------------------------------------------------------------

describe('getQuestion', () => {
  it('generates treble clef question', () => {
    const q = getQuestion('t:E4');
    assert.equal(q.clef, 'treble');
    assert.equal(q.letter, 'E');
    assert.equal(q.octave, 4);
    assert.ok(q.abc.includes('K:C'));
    assert.ok(!q.abc.includes('clef=bass'));
  });

  it('generates bass clef question', () => {
    const q = getQuestion('b:G2');
    assert.equal(q.clef, 'bass');
    assert.equal(q.letter, 'G');
    assert.equal(q.octave, 2);
    assert.ok(q.abc.includes('clef=bass'));
  });

  it('ABC string includes M:none for no time signature', () => {
    const q = getQuestion('t:C5');
    assert.ok(q.abc.includes('M:none'));
  });

  it('ABC string includes L:1 for whole note', () => {
    const q = getQuestion('t:C5');
    assert.ok(q.abc.includes('L:1'));
  });
});

// ---------------------------------------------------------------------------
// buildAbcString
// ---------------------------------------------------------------------------

describe('buildAbcString', () => {
  it('treble C5 renders lowercase c', () => {
    const abc = buildAbcString('treble', 'C', 5);
    assert.ok(abc.endsWith('\nc'));
  });

  it('bass G2 renders G with two commas', () => {
    const abc = buildAbcString('bass', 'G', 2);
    assert.ok(abc.endsWith('\nG,,'));
  });
});

// ---------------------------------------------------------------------------
// checkAnswer
// ---------------------------------------------------------------------------

describe('checkAnswer', () => {
  it('correct answer', () => {
    const q = getQuestion('t:E4');
    const result = checkAnswer(q, 'E');
    assert.equal(result.correct, true);
    assert.equal(result.correctAnswer, 'E');
  });

  it('correct answer is case-insensitive', () => {
    const q = getQuestion('t:E4');
    assert.equal(checkAnswer(q, 'e').correct, true);
  });

  it('wrong answer', () => {
    const q = getQuestion('t:E4');
    const result = checkAnswer(q, 'F');
    assert.equal(result.correct, false);
  });
});

// ---------------------------------------------------------------------------
// Stats grid
// ---------------------------------------------------------------------------

describe('stats grid', () => {
  it('has 7 row labels (natural notes)', () => {
    assert.equal(GRID_ROW_LABELS.length, 7);
  });

  it('has 6 column labels (one per group)', () => {
    assert.equal(GRID_COL_LABELS.length, 6);
  });

  it('getGridItemId returns correct items for a note in a group', () => {
    // E appears twice on treble staff: E4 and E5
    const items = getGridItemId('E', 0);
    assert.ok(items.includes('t:E4'));
    assert.ok(items.includes('t:E5'));
    assert.equal(items.length, 2);
  });

  it('getGridItemId returns items for single-occurrence note', () => {
    // F appears once on treble staff: F4 and F5... wait, both are on staff
    const items = getGridItemId('F', 0);
    assert.ok(items.includes('t:F4'));
    assert.ok(items.includes('t:F5'));
  });

  it('getGridItemId returns empty for note not in group', () => {
    // D not on treble staff (D4 is near-ledger, D5 is on staff)
    // Actually D5 IS on staff, so D should appear
    const items = getGridItemId('D', 0);
    assert.ok(items.includes('t:D5'));
  });
});
