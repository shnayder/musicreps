import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getUseSolfege,
  GUITAR,
  setUseSolfege,
  UKULELE,
} from '../../music-data.ts';
import {
  formatLabel,
  getAllGroupIndices,
  getAllItems,
  getGroups,
  getItemIdsForGroup,
  getQuestion,
} from './logic.ts';

// ---------------------------------------------------------------------------
// Guitar groups
// ---------------------------------------------------------------------------

describe('guitar groups', () => {
  const groups = getGroups(GUITAR);

  it('has 8 groups (5 natural + 3 accidental)', () => {
    assert.equal(groups.length, 8);
  });

  it('natural groups cover all 6 strings', () => {
    const naturalStrings = new Set<number>();
    for (let i = 0; i < 5; i++) {
      assert.equal(groups[i].noteFilter, 'natural');
      for (const s of groups[i].strings) naturalStrings.add(s);
    }
    assert.equal(naturalStrings.size, 6);
  });

  it('accidental groups cover all 6 strings', () => {
    const accStrings = new Set<number>();
    for (let i = 5; i < 8; i++) {
      assert.equal(groups[i].noteFilter, 'sharps-flats');
      for (const s of groups[i].strings) accStrings.add(s);
    }
    assert.equal(accStrings.size, 6);
  });

  it('E e group has strings 5 and 0', () => {
    assert.deepEqual(groups[0].strings, [5, 0]);
    assert.equal(groups[0].label(), 'E e');
  });
});

describe('guitar getItemIdsForGroup', () => {
  it('E e naturals: 2 strings × 8 naturals = 16 items', () => {
    const items = getItemIdsForGroup(GUITAR, 0);
    assert.equal(items.length, 16);
    // All items should be on strings 5 or 0
    assert.ok(items.every((id) => id.startsWith('5-') || id.startsWith('0-')));
  });

  it('A naturals: 1 string × 8 naturals = 8 items', () => {
    const items = getItemIdsForGroup(GUITAR, 1);
    assert.equal(items.length, 8);
    assert.ok(items.every((id) => id.startsWith('4-')));
  });

  it('E A accidentals: 2 strings × 5 accidentals = 10 items', () => {
    const items = getItemIdsForGroup(GUITAR, 5);
    assert.equal(items.length, 10);
    assert.ok(items.every((id) => id.startsWith('5-') || id.startsWith('4-')));
  });

  it('all groups cover all 78 items', () => {
    const allFromGroups = new Set<string>();
    for (const i of getAllGroupIndices(GUITAR)) {
      for (const id of getItemIdsForGroup(GUITAR, i)) {
        allFromGroups.add(id);
      }
    }
    assert.equal(allFromGroups.size, 78); // 6 strings × 13 frets
  });
});

describe('guitar getAllItems', () => {
  it('returns 78 items (6 strings × 13 frets)', () => {
    assert.equal(getAllItems(GUITAR).length, 78);
  });
});

// ---------------------------------------------------------------------------
// Ukulele groups
// ---------------------------------------------------------------------------

describe('ukulele groups', () => {
  const groups = getGroups(UKULELE);

  it('has 6 groups (4 natural + 2 accidental)', () => {
    assert.equal(groups.length, 6);
  });

  it('all groups cover all 52 items', () => {
    const allFromGroups = new Set<string>();
    for (const i of getAllGroupIndices(UKULELE)) {
      for (const id of getItemIdsForGroup(UKULELE, i)) {
        allFromGroups.add(id);
      }
    }
    assert.equal(allFromGroups.size, 52); // 4 strings × 13 frets
  });
});

describe('ukulele getAllItems', () => {
  it('returns 52 items (4 strings × 13 frets)', () => {
    assert.equal(getAllItems(UKULELE).length, 52);
  });
});

// ---------------------------------------------------------------------------
// Question / answer
// ---------------------------------------------------------------------------

describe('getQuestion', () => {
  it('parses guitar item 5-0 to low E string fret 0 = E', () => {
    const q = getQuestion(GUITAR, '5-0');
    assert.equal(q.currentString, 5);
    assert.equal(q.currentFret, 0);
    assert.equal(q.currentNote, 'E');
  });

  it('parses ukulele item 2-0 to C string fret 0 = C', () => {
    const q = getQuestion(UKULELE, '2-0');
    assert.equal(q.currentString, 2);
    assert.equal(q.currentFret, 0);
    assert.equal(q.currentNote, 'C');
  });
});

describe('getQuestion expected values', () => {
  it('currentNote is the canonical note name', () => {
    const q = getQuestion(GUITAR, '5-0');
    assert.equal(q.currentNote, 'E');
  });

  it('position 5-1 has natural note F', () => {
    const q = getQuestion(GUITAR, '5-1');
    assert.equal(q.currentNote, 'F');
  });
});

// ---------------------------------------------------------------------------
// Label formatting
// ---------------------------------------------------------------------------

describe('formatLabel', () => {
  it('single group in letter mode', () => {
    assert.equal(formatLabel(GUITAR, new Set([0])), 'E e');
  });

  it('all groups', () => {
    assert.equal(
      formatLabel(GUITAR, new Set(getAllGroupIndices(GUITAR))),
      'all groups',
    );
  });

  it('multiple groups sorted', () => {
    const label = formatLabel(GUITAR, new Set([2, 0]));
    assert.equal(label, 'E e, D');
  });

  it('uses solfège names in solfège mode', () => {
    const original = getUseSolfege();
    try {
      setUseSolfege(true);
      assert.equal(formatLabel(GUITAR, new Set([0])), 'Mi mi');
      assert.equal(formatLabel(GUITAR, new Set([1])), 'La');
      assert.equal(formatLabel(GUITAR, new Set([2])), 'Re');
    } finally {
      setUseSolfege(original);
    }
  });
});
