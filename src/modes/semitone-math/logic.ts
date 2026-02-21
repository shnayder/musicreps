// Pure logic for Semitone Math mode.
// No DOM, no hooks — just data in, data out.
// Unidirectional: "C + 3 = ?" → answer is a note name.

import type { Note } from '../../types.ts';
import {
  displayNote,
  noteAdd,
  noteMatchesInput,
  NOTES,
  noteSub,
  pickAccidentalName,
} from '../../music-data.ts';
import { buildMathIds, parseMathId } from '../../mode-utils.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Distance groups for scope selection (pairs of semitone counts). */
// Labels use: \u00B1 = ± (plus-minus), \u2013 = – (en dash)
export const DISTANCE_GROUPS = [
  { distances: [1, 2], label: '\u00B11\u20132' },
  { distances: [3, 4], label: '\u00B13\u20134' },
  { distances: [5, 6], label: '\u00B15\u20136' },
  { distances: [7, 8], label: '\u00B17\u20138' },
  { distances: [9, 10], label: '\u00B19\u201310' },
  { distances: [11], label: '\u00B111' },
];

/**
 * Get all item IDs belonging to a distance group.
 *
 * @example getItemIdsForGroup(0) → ["C+1","C-1","C+2","C-2","C#+1","C#-1",...]
 */
export function getItemIdsForGroup(groupIndex: number): string[] {
  const distances = DISTANCE_GROUPS[groupIndex].distances;
  const items: string[] = [];
  for (const note of NOTES) {
    for (const d of distances) {
      items.push(note.name + '+' + d);
      items.push(note.name + '-' + d);
    }
  }
  return items;
}

/** All 264 item IDs: 12 notes × 11 distances × 2 directions (+/-). */
export const ALL_ITEMS: string[] = buildMathIds(
  NOTES.map((n) => n.name),
  Array.from({ length: 11 }, (_, i) => i + 1),
);

export const ALL_GROUP_INDICES = DISTANCE_GROUPS.map((_, i) => i);

// ---------------------------------------------------------------------------
// Question
// ---------------------------------------------------------------------------

export type Question = {
  note: Note;
  op: string;
  semitones: number;
  answer: Note;
  useFlats: boolean;
  promptText: string;
};

/**
 * Parse an item ID and generate a question for the quiz engine.
 * Uses flat accidentals for subtraction to match conventional music notation.
 *
 * @example getQuestion("C+3") → { note: C, op: "+", semitones: 3, answer: D#, ... }
 * @example getQuestion("G-5") → { note: G, op: "-", semitones: 5, answer: D, ... }
 */
export function getQuestion(itemId: string): Question {
  const parsed = parseMathId(itemId);
  const noteName = parsed.note;
  const op = parsed.op;
  const semitones = parseInt(parsed.value);
  const note = NOTES.find((n) => n.name === noteName)!;
  const answer = op === '+'
    ? noteAdd(note.num, semitones)
    : noteSub(note.num, semitones);
  const useFlats = op === '-';
  const promptNoteName = displayNote(
    pickAccidentalName(note.displayName, useFlats),
  );
  return {
    note,
    op,
    semitones,
    answer,
    useFlats,
    promptText: promptNoteName + ' ' + op + ' ' + semitones,
  };
}

// ---------------------------------------------------------------------------
// Answer checking
// ---------------------------------------------------------------------------

/**
 * Check whether the user's note name matches the expected answer.
 * Accepts any enharmonic equivalent (e.g. both "C#" and "Db" for the same pitch).
 *
 * @returns { correct, correctAnswer } where correctAnswer uses flats for
 *   subtraction and sharps for addition.
 */
export function checkAnswer(
  q: Question,
  input: string,
): { correct: boolean; correctAnswer: string } {
  const correct = noteMatchesInput(q.answer, input);
  return {
    correct,
    correctAnswer: displayNote(
      pickAccidentalName(q.answer.displayName, q.useFlats),
    ),
  };
}

// ---------------------------------------------------------------------------
// Stats grid config
// ---------------------------------------------------------------------------

/** Column labels for the stats grid (distances 1–11). */
export const GRID_COL_LABELS = Array.from(
  { length: 11 },
  (_, i) => String(i + 1),
);

/**
 * Get the pair of item IDs (add + subtract) for a stats grid cell.
 *
 * @example getGridItemId("C", 2) → ["C+3", "C-3"]
 */
export function getGridItemId(
  noteName: string,
  colIdx: number,
): string[] {
  const n = colIdx + 1;
  return [noteName + '+' + n, noteName + '-' + n];
}
