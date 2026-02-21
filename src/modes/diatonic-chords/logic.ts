// Pure logic for Diatonic Chords mode.
// No DOM, no hooks — just data in, data out.
// Bidirectional: forward (numeral in key → chord root), reverse (chord in key → numeral).
// 168 items: 12 keys × 7 degrees × 2 directions.

import type { DiatonicChord } from '../../types.ts';
import {
  DIATONIC_CHORDS,
  displayNote,
  getScaleDegreeNote,
  MAJOR_KEYS,
  spelledNoteMatchesSemitone,
} from '../../music-data.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Chord groups for scope selection, ordered by importance. */
export const CHORD_GROUPS = [
  { degrees: [1, 4, 5], label: 'I,IV,V' },
  { degrees: [2, 6], label: 'ii,vi' },
  { degrees: [3, 7], label: 'iii,vii\u00B0' }, // \u00B0 = ° (degree sign)
];

/**
 * Get all item IDs belonging to a chord group.
 * Item ID format: "key:degree:dir" (e.g. "Bb:4:fwd").
 *
 * @example getItemIdsForGroup(0) → ["C:1:fwd","C:1:rev","C:4:fwd",...,"C:5:rev",...]
 */
export function getItemIdsForGroup(groupIndex: number): string[] {
  const degrees = CHORD_GROUPS[groupIndex].degrees;
  const items: string[] = [];
  for (const key of MAJOR_KEYS) {
    for (const d of degrees) {
      items.push(key.root + ':' + d + ':fwd');
      items.push(key.root + ':' + d + ':rev');
    }
  }
  return items;
}

/** All 168 item IDs: 12 keys × 7 degrees × 2 directions. */
export const ALL_ITEMS: string[] = [];
for (const key of MAJOR_KEYS) {
  for (let d = 1; d <= 7; d++) {
    ALL_ITEMS.push(key.root + ':' + d + ':fwd');
    ALL_ITEMS.push(key.root + ':' + d + ':rev');
  }
}

export const ALL_GROUP_INDICES = CHORD_GROUPS.map((_, i) => i);

/** Row definitions for the stats grid (one row per key). */
export const GRID_NOTES = MAJOR_KEYS.map((k) => ({
  name: k.root,
  displayName: k.root,
}));

// ---------------------------------------------------------------------------
// Question
// ---------------------------------------------------------------------------

export type Question = {
  keyRoot: string;
  degree: number;
  chord: DiatonicChord;
  dir: 'fwd' | 'rev';
  rootNote: string;
};

/**
 * Parse a compound item ID and generate a question.
 * Item ID format: "keyRoot:degree:dir" (e.g. "Bb:4:fwd").
 *
 * @example getQuestion("Bb:4:fwd") → { keyRoot: "Bb", degree: 4, chord: IV, rootNote: "Eb" }
 * @example getQuestion("C:2:rev") → { keyRoot: "C", degree: 2, chord: ii, rootNote: "D" }
 */
export function getQuestion(itemId: string): Question {
  const parts = itemId.split(':');
  const keyRoot = parts[0];
  const degree = parseInt(parts[1]);
  const dir = parts[2] as 'fwd' | 'rev';
  const chord = DIATONIC_CHORDS[degree - 1];
  const rootNote = getScaleDegreeNote(keyRoot, degree);
  return { keyRoot, degree, chord, dir, rootNote };
}

// ---------------------------------------------------------------------------
// Answer checking
// ---------------------------------------------------------------------------

/**
 * Check the user's answer.
 *
 * Forward: user enters a note name. Correct if it matches the chord root.
 *   Shows full answer (e.g. "Eb minor").
 * Reverse: user enters a roman numeral. Correct if it matches the chord numeral.
 */
export function checkAnswer(
  q: Question,
  input: string,
): { correct: boolean; correctAnswer: string } {
  if (q.dir === 'fwd') {
    const correct = spelledNoteMatchesSemitone(q.rootNote, input);
    const fullAnswer = displayNote(q.rootNote) + ' ' + q.chord.quality;
    return { correct, correctAnswer: fullAnswer };
  }
  const expectedNumeral = q.chord.numeral;
  return {
    correct: input === expectedNumeral,
    correctAnswer: expectedNumeral,
  };
}

// ---------------------------------------------------------------------------
// Stats grid config
// ---------------------------------------------------------------------------

/**
 * Get the pair of item IDs (fwd + rev) for a stats grid cell.
 * Grid rows are keys, columns are degrees (using roman numerals).
 *
 * @example getGridItemId("Bb", 3) → ["Bb:4:fwd", "Bb:4:rev"]
 */
export function getGridItemId(
  keyRoot: string,
  colIdx: number,
): string[] {
  const d = colIdx + 1;
  return [keyRoot + ':' + d + ':fwd', keyRoot + ':' + d + ':rev'];
}
