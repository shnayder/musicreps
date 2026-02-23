// Pure logic for Scale Degrees mode.
// No DOM, no hooks — just data in, data out.
// Bidirectional: forward (degree in key → note), reverse (note in key → degree).
// 168 items: 12 keys × 7 degrees × 2 directions.

import {
  displayNote,
  getScaleDegreeNote,
  MAJOR_KEYS,
  spelledNoteMatchesSemitone,
} from '../../music-data.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DEGREE_LABELS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th'];

/** Degree groups for scope selection, ordered by importance. */
export const DEGREE_GROUPS = [
  { degrees: [1, 5], label: '1st,5th' },
  { degrees: [4], label: '4th' },
  { degrees: [3, 7], label: '3rd,7th' },
  { degrees: [2, 6], label: '2nd,6th' },
];

/**
 * Get all item IDs belonging to a degree group.
 * Item ID format: "key:degree:dir" (e.g. "D:5:fwd").
 *
 * @example getItemIdsForGroup(0) → ["C:1:fwd","C:1:rev","C:5:fwd","C:5:rev",...]
 */
export function getItemIdsForGroup(groupIndex: number): string[] {
  const degrees = DEGREE_GROUPS[groupIndex].degrees;
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

export const ALL_GROUP_INDICES = DEGREE_GROUPS.map((_, i) => i);

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
  dir: 'fwd' | 'rev';
  noteName: string;
};

/**
 * Parse a compound item ID and generate a question.
 * Item ID format: "keyRoot:degree:dir" (e.g. "D:5:fwd").
 *
 * @example getQuestion("D:5:fwd") → { keyRoot: "D", degree: 5, dir: "fwd", noteName: "A" }
 * @example getQuestion("C:3:rev") → { keyRoot: "C", degree: 3, dir: "rev", noteName: "E" }
 */
export function getQuestion(itemId: string): Question {
  const parts = itemId.split(':');
  const keyRoot = parts[0];
  const degree = parseInt(parts[1]);
  const dir = parts[2] as 'fwd' | 'rev';
  const noteName = getScaleDegreeNote(keyRoot, degree);
  return { keyRoot, degree, dir, noteName };
}

// ---------------------------------------------------------------------------
// Answer checking
// ---------------------------------------------------------------------------

/**
 * Check the user's answer.
 *
 * Forward: user enters a note name. Correct if it matches the scale degree note.
 * Reverse: user enters a degree number (1–7). Correct if it matches the degree.
 */
export function checkAnswer(
  q: Question,
  input: string,
): { correct: boolean; correctAnswer: string } {
  if (q.dir === 'fwd') {
    const correct = spelledNoteMatchesSemitone(q.noteName, input);
    return {
      correct,
      correctAnswer: displayNote(q.noteName),
    };
  }
  const expectedDegree = String(q.degree);
  return {
    correct: input === expectedDegree,
    correctAnswer: DEGREE_LABELS[q.degree - 1],
  };
}

// ---------------------------------------------------------------------------
// Stats grid config
// ---------------------------------------------------------------------------

/**
 * Get the pair of item IDs (fwd + rev) for a stats grid cell.
 * Grid rows are keys, columns are degrees.
 *
 * @example getGridItemId("D", 4) → ["D:5:fwd", "D:5:rev"]
 */
export function getGridItemId(
  keyRoot: string,
  colIdx: number,
): string[] {
  const d = colIdx + 1;
  return [keyRoot + ':' + d + ':fwd', keyRoot + ':' + d + ':rev'];
}
