import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GUITAR, UKULELE } from '../../music-data.ts';
import {
  formatLabel,
  getAllGroupIds,
  getAllItems,
  getGroups,
  getItemIdsForGroup,
  getQuestion,
} from './logic.ts';

// ---------------------------------------------------------------------------
// Group structure (shared across instruments)
// ---------------------------------------------------------------------------

describe('fretboard groups', () => {
  const groups = getGroups(GUITAR);

  it('has 6 groups (3 fret ranges × natural/accidental)', () => {
    assert.equal(groups.length, 6);
  });

  it('alternates natural then accidental for each fret range', () => {
    for (let i = 0; i < groups.length; i += 2) {
      assert.equal(groups[i].noteFilter, 'natural');
      assert.equal(groups[i + 1].noteFilter, 'sharps-flats');
      assert.deepEqual(groups[i].frets, groups[i + 1].frets);
    }
  });

  it('covers frets 0-3, 4-8, 9-12', () => {
    assert.deepEqual(groups[0].frets, [0, 3]);
    assert.deepEqual(groups[2].frets, [4, 8]);
    assert.deepEqual(groups[4].frets, [9, 12]);
  });

  it('same groups for guitar and ukulele', () => {
    assert.deepEqual(getGroups(GUITAR), getGroups(UKULELE));
  });
});

// ---------------------------------------------------------------------------
// Guitar getItemIdsForGroup
// ---------------------------------------------------------------------------

describe('guitar getItemIdsForGroup', () => {
  it('frets 0-3 naturals: all items have frets 0-3', () => {
    const items = getItemIdsForGroup(GUITAR, 'frets-0-3-natural');
    assert.ok(items.length > 0);
    for (const id of items) {
      const fret = Number(id.split('-')[1]);
      assert.ok(fret >= 0 && fret <= 3, `fret ${fret} out of range`);
    }
  });

  it('frets 4-8 naturals: all items have frets 4-8', () => {
    const items = getItemIdsForGroup(GUITAR, 'frets-4-8-natural');
    assert.ok(items.length > 0);
    for (const id of items) {
      const fret = Number(id.split('-')[1]);
      assert.ok(fret >= 4 && fret <= 8, `fret ${fret} out of range`);
    }
  });

  it('frets 9-12 naturals: all items have frets 9-12', () => {
    const items = getItemIdsForGroup(GUITAR, 'frets-9-12-natural');
    assert.ok(items.length > 0);
    for (const id of items) {
      const fret = Number(id.split('-')[1]);
      assert.ok(fret >= 9 && fret <= 12, `fret ${fret} out of range`);
    }
  });

  it('all groups cover all 78 items', () => {
    const allFromGroups = new Set<string>();
    for (const id of getAllGroupIds(GUITAR)) {
      for (const itemId of getItemIdsForGroup(GUITAR, id)) {
        allFromGroups.add(itemId);
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
// Ukulele
// ---------------------------------------------------------------------------

describe('ukulele getItemIdsForGroup', () => {
  it('all groups cover all 52 items', () => {
    const allFromGroups = new Set<string>();
    for (const id of getAllGroupIds(UKULELE)) {
      for (const itemId of getItemIdsForGroup(UKULELE, id)) {
        allFromGroups.add(itemId);
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
  it('single group', () => {
    const label = formatLabel(GUITAR, new Set(['frets-0-3-natural']));
    assert.match(label, /Frets 0/);
  });

  it('all groups', () => {
    assert.equal(
      formatLabel(GUITAR, new Set(getAllGroupIds(GUITAR))),
      'all groups',
    );
  });

  it('multiple groups in definition order', () => {
    const label = formatLabel(
      GUITAR,
      new Set(['frets-4-8-natural', 'frets-0-3-natural']),
    );
    // Should be in definition order: 0-3 first, then 4-8
    assert.match(label, /0.*4/);
  });
});
