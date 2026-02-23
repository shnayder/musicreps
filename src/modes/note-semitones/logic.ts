// Pure logic for Note ↔ Semitones mode.
// No DOM, no hooks, no side effects — just data in, data out.
// Bidirectional: forward (note → semitone number), reverse (number → note).

import type { StatsTableRow } from '../../types.ts';
import {
  displayNote,
  noteMatchesInput,
  NOTES,
  pickRandomAccidental,
} from '../../music-data.ts';
import { buildBidirectionalIds } from '../../mode-utils.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** All 24 item IDs: 12 notes × 2 directions (fwd + rev). */
export const ALL_ITEMS = buildBidirectionalIds(NOTES.map((n) => n.name));

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
// Answer checking
// ---------------------------------------------------------------------------

/**
 * Check the user's answer against the expected answer for a question.
 *
 * Forward: user enters a semitone number (0–11). Correct if it matches note.num.
 * Reverse: user enters a note name. Correct if it matches the note (any enharmonic).
 *
 * @returns { correct: boolean, correctAnswer: string } where correctAnswer is
 *   the display-formatted expected answer.
 */
export function checkAnswer(
  q: Question,
  input: string,
): { correct: boolean; correctAnswer: string } {
  if (q.dir === 'fwd') {
    const correct = parseInt(input, 10) === q.noteNum;
    return {
      correct,
      correctAnswer: String(q.noteNum),
    };
  }
  const note = NOTES.find((n) => n.name === q.noteName)!;
  const correct = noteMatchesInput(note, input);
  return {
    correct,
    correctAnswer: displayNote(q.accidentalChoice),
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
