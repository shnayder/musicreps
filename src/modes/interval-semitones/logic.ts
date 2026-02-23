// Pure logic for Interval ↔ Semitones mode.
// No DOM, no hooks — just data in, data out.
// Bidirectional: forward (interval → semitone count), reverse (count → interval).

import type { StatsTableRow } from '../../types.ts';
import { intervalMatchesInput, INTERVALS } from '../../music-data.ts';
import { buildBidirectionalIds } from '../../mode-utils.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** All 24 item IDs: 12 intervals × 2 directions (fwd + rev). */
export const ALL_ITEMS = buildBidirectionalIds(
  INTERVALS.map((i) => i.abbrev),
);

// ---------------------------------------------------------------------------
// Question
// ---------------------------------------------------------------------------

export type Question = {
  abbrev: string;
  name: string;
  num: number;
  dir: 'fwd' | 'rev';
};

/**
 * Parse an item ID and generate a question for the quiz engine.
 *
 * @example getQuestion("m2:fwd") → { abbrev: "m2", name: "minor 2nd", num: 1, dir: "fwd" }
 * @example getQuestion("P5:rev") → { abbrev: "P5", name: "perfect 5th", num: 7, dir: "rev" }
 */
export function getQuestion(itemId: string): Question {
  const [abbrev, dir] = itemId.split(':');
  const interval = INTERVALS.find((i) => i.abbrev === abbrev)!;
  return {
    abbrev: interval.abbrev,
    name: interval.name,
    num: interval.num,
    dir: dir as 'fwd' | 'rev',
  };
}

// ---------------------------------------------------------------------------
// Answer checking
// ---------------------------------------------------------------------------

/**
 * Check the user's answer against the expected answer.
 *
 * Forward: user enters a semitone number (1–12). Correct if it matches interval.num.
 * Reverse: user enters an interval abbreviation. Correct if it matches the interval.
 *
 * @returns { correct, correctAnswer } where correctAnswer is the display-formatted
 *   expected answer.
 */
export function checkAnswer(
  q: Question,
  input: string,
): { correct: boolean; correctAnswer: string } {
  if (q.dir === 'fwd') {
    const correct = parseInt(input, 10) === q.num;
    return {
      correct,
      correctAnswer: String(q.num),
    };
  }
  const interval = INTERVALS.find((i) => i.abbrev === q.abbrev)!;
  const correct = intervalMatchesInput(interval, input);
  return { correct, correctAnswer: q.abbrev };
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

/**
 * Build stats table rows for the progress tab.
 * One row per interval, with fwd/rev item IDs for the two-column table.
 */
export function getStatsRows(): StatsTableRow[] {
  return INTERVALS.map((interval) => ({
    label: interval.abbrev,
    sublabel: String(interval.num),
    _colHeader: 'Interval',
    fwdItemId: interval.abbrev + ':fwd',
    revItemId: interval.abbrev + ':rev',
  }));
}
