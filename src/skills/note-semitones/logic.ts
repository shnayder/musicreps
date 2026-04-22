// Pure logic for Note ↔ Semitones mode.
// No DOM, no hooks, no side effects — just data in, data out.
// Bidirectional: forward (note → semitone number), reverse (number → note).

import type { StatsTableRow } from '../../types.ts';
import {
  displayNote,
  NOTES,
  pickRandomAccidental,
  ROOT_CYCLE,
} from '../../music-data.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * All 24 item IDs: 12 notes × 2 directions.
 * Order: direction outer (fwd first), ROOT_CYCLE inner.
 */
export const ALL_ITEMS: string[] = [
  ...ROOT_CYCLE.map((n) => n + ':fwd'),
  ...ROOT_CYCLE.map((n) => n + ':rev'),
];

// ---------------------------------------------------------------------------
// Question
// ---------------------------------------------------------------------------

export type Question = {
  noteName: string;
  noteNum: number;
  dir: 'fwd' | 'rev';
  /** Randomly chosen accidental variant for display (e.g. "C#" vs "Db"). */
  accidentalChoice: string;
};

/**
 * Parse an item ID and generate a question for the quiz engine.
 *
 * @example getQuestion("C:fwd") → { noteName: "C", noteNum: 0, dir: "fwd", accidentalChoice: "C" }
 * @example getQuestion("C#:rev") → { noteName: "C#", noteNum: 1, dir: "rev", accidentalChoice: "Db" }
 */
export function getQuestion(itemId: string): Question {
  const [noteName, dir] = itemId.split(':');
  const note = NOTES.find((n) => n.name === noteName)!;
  return {
    noteName: note.name,
    noteNum: note.num,
    dir: dir as 'fwd' | 'rev',
    accidentalChoice: pickRandomAccidental(note.displayName),
  };
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

/**
 * Build stats table rows for the progress tab.
 * One row per note, with fwd/rev item IDs for the two-column table.
 */
export function getStatsRows(): StatsTableRow[] {
  return NOTES.map((note) => ({
    label: displayNote(note.name),
    sublabel: String(note.num),
    _colHeader: 'Note',
    fwdItemId: note.name + ':fwd',
    revItemId: note.name + ':rev',
  }));
}
