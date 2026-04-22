import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GUITAR, UKULELE } from '../../music-data.ts';
import {
  ALL_ITEMS,
  getEnabledNotes,
  getNoteAtPosition,
  getPositionsForNote,
} from './logic.ts';

// Guitar: STRING_OFFSETS = [4, 11, 7, 2, 9, 4]
// string 0 = high e (offset 4 = E)
// string 1 = B (offset 11 = B)
// string 2 = G (offset 7 = G)
// string 3 = D (offset 2 = D)
// string 4 = A (offset 9 = A)
// string 5 = low E (offset 4 = E)

// Ukulele: STRING_OFFSETS = [9, 4, 0, 7]
// string 0 = A (offset 9 = A)
// string 1 = E (offset 4 = E)
// string 2 = C (offset 0 = C)
// string 3 = G (offset 7 = G)

describe('ALL_ITEMS', () => {
  it('has 12 items (one per chromatic note)', () => {
    assert.equal(ALL_ITEMS.length, 12);
  });

  it('contains all 12 chromatic note names', () => {
    const expected = [
      'C',
      'C#',
      'D',
      'D#',
      'E',
      'F',
      'F#',
      'G',
      'G#',
      'A',
      'A#',
      'B',
    ];
    assert.deepEqual(ALL_ITEMS, expected);
  });
});

describe('getNoteAtPosition (guitar)', () => {
  it('string 0 (high e) fret 0 = E', () => {
    assert.equal(getNoteAtPosition(GUITAR, 0, 0), 'E');
  });

  it('string 5 (low E) fret 0 = E', () => {
    assert.equal(getNoteAtPosition(GUITAR, 5, 0), 'E');
  });

  it('string 5 (low E) fret 3 = G', () => {
    assert.equal(getNoteAtPosition(GUITAR, 5, 3), 'G');
  });

  it('string 1 (B) fret 0 = B', () => {
    assert.equal(getNoteAtPosition(GUITAR, 1, 0), 'B');
  });

  it('string 2 (G) fret 0 = G', () => {
    assert.equal(getNoteAtPosition(GUITAR, 2, 0), 'G');
  });

  it('string 3 (D) fret 0 = D', () => {
    assert.equal(getNoteAtPosition(GUITAR, 3, 0), 'D');
  });

  it('string 4 (A) fret 0 = A', () => {
    assert.equal(getNoteAtPosition(GUITAR, 4, 0), 'A');
  });

  it('wraps around at 12 semitones (string 5 fret 12 = E)', () => {
    assert.equal(getNoteAtPosition(GUITAR, 5, 12), 'E');
  });

  it('string 5 fret 1 = F', () => {
    assert.equal(getNoteAtPosition(GUITAR, 5, 1), 'F');
  });
});

describe('getNoteAtPosition (ukulele)', () => {
  it('string 0 (A) fret 0 = A', () => {
    assert.equal(getNoteAtPosition(UKULELE, 0, 0), 'A');
  });

  it('string 1 (E) fret 0 = E', () => {
    assert.equal(getNoteAtPosition(UKULELE, 1, 0), 'E');
  });

  it('string 2 (C) fret 0 = C', () => {
    assert.equal(getNoteAtPosition(UKULELE, 2, 0), 'C');
  });

  it('string 3 (G) fret 0 = G', () => {
    assert.equal(getNoteAtPosition(UKULELE, 3, 0), 'G');
  });

  it('string 2 (C) fret 4 = E', () => {
    // offset 0 + 4 = 4 = E
    assert.equal(getNoteAtPosition(UKULELE, 2, 4), 'E');
  });

  it('wraps around at 12 semitones (string 0 fret 12 = A)', () => {
    assert.equal(getNoteAtPosition(UKULELE, 0, 12), 'A');
  });
});

describe('getPositionsForNote (guitar)', () => {
  it('"E" returns multiple positions', () => {
    const positions = getPositionsForNote(GUITAR, 'E');
    assert.ok(
      positions.length > 1,
      'E should appear on multiple strings/frets',
    );
  });

  it('"E" positions all map back to "E" via getNoteAtPosition', () => {
    const positions = getPositionsForNote(GUITAR, 'E');
    for (const { string, fret } of positions) {
      assert.equal(
        getNoteAtPosition(GUITAR, string, fret),
        'E',
        `position string=${string} fret=${fret} should be E`,
      );
    }
  });

  it('"E" includes string 0 fret 0 (high e open)', () => {
    const positions = getPositionsForNote(GUITAR, 'E');
    assert.ok(
      positions.some((p) => p.string === 0 && p.fret === 0),
      'E should include string=0 fret=0',
    );
  });

  it('"E" includes string 5 fret 0 (low E open)', () => {
    const positions = getPositionsForNote(GUITAR, 'E');
    assert.ok(
      positions.some((p) => p.string === 5 && p.fret === 0),
      'E should include string=5 fret=0',
    );
  });

  it('"C" positions all map back to "C" via getNoteAtPosition', () => {
    const positions = getPositionsForNote(GUITAR, 'C');
    for (const { string, fret } of positions) {
      assert.equal(
        getNoteAtPosition(GUITAR, string, fret),
        'C',
        `position string=${string} fret=${fret} should be C`,
      );
    }
  });

  it('"C" returns multiple positions', () => {
    const positions = getPositionsForNote(GUITAR, 'C');
    assert.ok(
      positions.length > 1,
      'C should appear on multiple strings/frets',
    );
  });

  it('all positions have valid string (0–5) and fret (0–12) values', () => {
    for (const note of ALL_ITEMS) {
      const positions = getPositionsForNote(GUITAR, note);
      for (const { string, fret } of positions) {
        assert.ok(
          string >= 0 && string <= 5,
          `string ${string} out of range for note ${note}`,
        );
        assert.ok(
          fret >= 0 && fret <= 12,
          `fret ${fret} out of range for note ${note}`,
        );
      }
    }
  });
});

describe('getPositionsForNote (ukulele)', () => {
  it('"C" includes string 2 fret 0 (open C string)', () => {
    const positions = getPositionsForNote(UKULELE, 'C');
    assert.ok(
      positions.some((p) => p.string === 2 && p.fret === 0),
      'C should include string=2 fret=0',
    );
  });

  it('"C" positions all map back to "C"', () => {
    const positions = getPositionsForNote(UKULELE, 'C');
    for (const { string, fret } of positions) {
      assert.equal(
        getNoteAtPosition(UKULELE, string, fret),
        'C',
        `position string=${string} fret=${fret} should be C`,
      );
    }
  });

  it('all positions have valid string (0–3) and fret (0–12) values', () => {
    for (const note of ALL_ITEMS) {
      const positions = getPositionsForNote(UKULELE, note);
      for (const { string, fret } of positions) {
        assert.ok(
          string >= 0 && string <= 3,
          `string ${string} out of range for note ${note}`,
        );
        assert.ok(
          fret >= 0 && fret <= 12,
          `fret ${fret} out of range for note ${note}`,
        );
      }
    }
  });

  it('has fewer positions than guitar for any note', () => {
    for (const note of ALL_ITEMS) {
      const guitarPositions = getPositionsForNote(GUITAR, note);
      const ukulelePositions = getPositionsForNote(UKULELE, note);
      assert.ok(
        ukulelePositions.length < guitarPositions.length,
        `ukulele should have fewer positions than guitar for ${note}`,
      );
    }
  });
});

describe('getEnabledNotes', () => {
  it('"natural" returns 7 notes (C D E F G A B)', () => {
    const notes = getEnabledNotes('natural');
    assert.equal(notes.length, 7);
    assert.deepEqual(notes, ['C', 'D', 'E', 'F', 'G', 'A', 'B']);
  });

  it('"sharps-flats" returns 5 notes (the accidentals)', () => {
    const notes = getEnabledNotes('sharps-flats');
    assert.equal(notes.length, 5);
    assert.deepEqual(notes, ['C#', 'D#', 'F#', 'G#', 'A#']);
  });

  it('"none" returns empty array', () => {
    const notes = getEnabledNotes('none');
    assert.equal(notes.length, 0);
  });

  it('"all" returns 12 notes', () => {
    const notes = getEnabledNotes('all');
    assert.equal(notes.length, 12);
  });

  it('"all" contains all 12 chromatic notes', () => {
    const notes = getEnabledNotes('all');
    const expected = [
      'C',
      'C#',
      'D',
      'D#',
      'E',
      'F',
      'F#',
      'G',
      'G#',
      'A',
      'A#',
      'B',
    ];
    assert.deepEqual(notes, expected);
  });

  it('"natural" and "sharps-flats" are disjoint and together cover all 12 notes', () => {
    const naturals = getEnabledNotes('natural');
    const accidentals = getEnabledNotes('sharps-flats');
    const all = getEnabledNotes('all');
    const combined = new Set([...naturals, ...accidentals]);
    assert.equal(combined.size, 12);
    for (const note of all) {
      assert.ok(
        combined.has(note),
        `${note} should be in natural or sharps-flats`,
      );
    }
  });

  it('"natural" returns a fresh copy (mutation-safe)', () => {
    const first = getEnabledNotes('natural');
    first.push('X');
    const second = getEnabledNotes('natural');
    assert.equal(second.length, 7);
  });
});
