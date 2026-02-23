// Pure logic for Interval Math mode.
// No DOM, no hooks — just data in, data out.
// Unidirectional: "C + m3 = ?" → answer is a note name.
// Nearly identical to Semitone Math but with interval abbreviations.

import type { Interval, Note } from '../../types.ts';
import {
  displayNote,
  INTERVALS,
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

/** Intervals used in math mode (semitones 1–11, excluding unison and octave). */
export const MATH_INTERVALS = INTERVALS.filter((i) =>
  i.num >= 1 && i.num <= 11
);

/** Distance groups using interval names instead of semitone counts. */
export const DISTANCE_GROUPS = [
  { distances: [1, 2], label: 'm2 M2' },
  { distances: [3, 4], label: 'm3 M3' },
  { distances: [5, 6], label: 'P4 TT' },
  { distances: [7, 8], label: 'P5 m6' },
  { distances: [9, 10], label: 'M6 m7' },
  { distances: [11], label: 'M7' },
];

/**
 * Get all item IDs belonging to a distance group.
 * Groups are defined by semitone distance — this maps to interval abbreviations.
 *
 * @example getItemIdsForGroup(0) → ["C+m2","C-m2","C+M2","C-M2","C#+m2",...]
 */
export function getItemIdsForGroup(groupIndex: number): string[] {
  const distances = DISTANCE_GROUPS[groupIndex].distances;
  const intervals = MATH_INTERVALS.filter((i) => distances.includes(i.num));
  const items: string[] = [];
  for (const note of NOTES) {
    for (const interval of intervals) {
      items.push(note.name + '+' + interval.abbrev);
      items.push(note.name + '-' + interval.abbrev);
    }
  }
  return items;
}

/** All 264 item IDs: 12 notes × 11 intervals × 2 directions (+/-). */
export const ALL_ITEMS: string[] = buildMathIds(
  NOTES.map((n) => n.name),
  MATH_INTERVALS.map((i) => i.abbrev),
);

export const ALL_GROUP_INDICES = DISTANCE_GROUPS.map((_, i) => i);

// ---------------------------------------------------------------------------
// Question
// ---------------------------------------------------------------------------

export type Question = {
  note: Note;
  op: string;
  interval: Interval;
  answer: Note;
  useFlats: boolean;
  promptText: string;
};

/**
 * Parse an item ID and generate a question for the quiz engine.
 *
 * @example getQuestion("C+m3") → { note: C, op: "+", interval: m3, answer: D#, ... }
 * @example getQuestion("G-P5") → { note: G, op: "-", interval: P5, answer: C, ... }
 */
export function getQuestion(itemId: string): Question {
  const parsed = parseMathId(itemId);
  const noteName = parsed.note;
  const op = parsed.op;
  const abbrev = parsed.value;
  const note = NOTES.find((n) => n.name === noteName)!;
  const interval = MATH_INTERVALS.find((i) => i.abbrev === abbrev)!;
  const answer = op === '+'
    ? noteAdd(note.num, interval.num)
    : noteSub(note.num, interval.num);
  const useFlats = op === '-';
  const promptNoteName = displayNote(
    pickAccidentalName(note.displayName, useFlats),
  );
  return {
    note,
    op,
    interval,
    answer,
    useFlats,
    promptText: promptNoteName + ' ' + op + ' ' + interval.abbrev,
  };
}

// ---------------------------------------------------------------------------
// Answer checking
// ---------------------------------------------------------------------------

/**
 * Check whether the user's note name matches the expected answer.
 * Accepts any enharmonic equivalent.
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

/** Column labels for the stats grid (interval abbreviations). */
export const GRID_COL_LABELS = MATH_INTERVALS.map((i) => i.abbrev);

/**
 * Get the pair of item IDs (add + subtract) for a stats grid cell.
 *
 * @example getGridItemId("C", 0) → ["C+m2", "C-m2"]
 */
export function getGridItemId(
  noteName: string,
  colIdx: number,
): string[] {
  const abbrev = MATH_INTERVALS[colIdx].abbrev;
  return [noteName + '+' + abbrev, noteName + '-' + abbrev];
}
