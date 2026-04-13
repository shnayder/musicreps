// Pure logic for Semitone Math mode.
// No DOM, no hooks — just data in, data out.
// Unidirectional: "C + 3 = ?" → answer is a note name.

import type { Note } from '../../types.ts';
import {
  displayNote,
  noteAdd,
  NOTES,
  noteSub,
  pickAccidentalName,
  ROOT_CYCLE,
} from '../../music-data.ts';
import { buildMathIds, parseMathId } from '../../mode-utils.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Distance groups for scope selection (pairs of semitone counts). */
// Labels use: \u2013 = – (en dash)
export const DISTANCE_GROUPS = [
  {
    id: 'dist-1-2',
    distances: [1, 2],
    label: '1\u20132 semitones',
    longLabel: '1\u20132 semitones apart',
  },
  {
    id: 'dist-3-4',
    distances: [3, 4],
    label: '3\u20134 semitones',
    longLabel: '3\u20134 semitones apart',
  },
  {
    id: 'dist-5-6',
    distances: [5, 6],
    label: '5\u20136 semitones',
    longLabel: '5\u20136 semitones apart',
  },
  {
    id: 'dist-7-8',
    distances: [7, 8],
    label: '7\u20138 semitones',
    longLabel: '7\u20138 semitones apart',
  },
  {
    id: 'dist-9-11',
    distances: [9, 10, 11],
    label: '9\u201311 semitones',
    longLabel: '9\u201311 semitones apart',
  },
];

/**
 * Get all item IDs belonging to a distance group.
 *
 * @example getItemIdsForGroup('dist-1-2') → ["C+1","C-1","C+2","C-2","C#+1","C#-1",...]
 */
export function getItemIdsForGroup(groupId: string): string[] {
  const group = DISTANCE_GROUPS.find((g) => g.id === groupId);
  if (!group) return [];
  const items: string[] = [];
  // Outer: distance within group ascending; then direction (+ then -);
  // inner: ROOT_CYCLE (circle of fifths from C).
  for (const d of group.distances) {
    for (const sign of ['+', '-']) {
      for (const root of ROOT_CYCLE) {
        items.push(root + sign + d);
      }
    }
  }
  return items;
}

/** All 264 item IDs: 12 notes × 11 distances × 2 directions (+/-). */
export const ALL_ITEMS: string[] = buildMathIds(
  ROOT_CYCLE,
  Array.from({ length: 11 }, (_, i) => i + 1),
);

export const ALL_GROUP_IDS: string[] = DISTANCE_GROUPS.map((g) => g.id);

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
