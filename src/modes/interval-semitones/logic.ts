// Pure logic for Interval ↔ Semitones mode.
// No DOM, no hooks — just data in, data out.
// Bidirectional: forward (interval → semitone count), reverse (count → interval).

import type { StatsTableRow } from '../../types.ts';
import { INTERVALS } from '../../music-data.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * All 24 item IDs: 12 intervals × 2 directions.
 * Order: direction outer (fwd first), intervals ascending by semitone.
 */
export const ALL_ITEMS: string[] = [
  ...INTERVALS.map((i) => i.abbrev + ':fwd'),
  ...INTERVALS.map((i) => i.abbrev + ':rev'),
];

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
