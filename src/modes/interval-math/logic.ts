// Pure logic for Interval Math mode.
// No DOM, no hooks — just data in, data out.
// Unidirectional: "C + m3 = ?" → answer is a spelled note name.
// Answers respect interval-number spelling (D + m2 = Eb, G# - m2 = F##).

import type { Interval, Note } from '../../types.ts';
import {
  addInterval,
  displayNote,
  INTERVALS,
  NOTES,
  parseSpelledNote,
  ROOT_CYCLE,
} from '../../music-data.ts';
import {
  buildMathIds,
  parseMathId,
  shuffleByItemHash,
} from '../../mode-utils.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Intervals used in math mode (semitones 1–11, excluding unison and octave). */
export const MATH_INTERVALS = INTERVALS.filter((i) =>
  i.num >= 1 && i.num <= 11
);

/** Distance groups using interval names instead of semitone counts. */
export const DISTANCE_GROUPS = [
  {
    id: 'seconds',
    distances: [1, 2],
    label: 'Seconds (m2, M2)',
    longLabel: 'Seconds (m2, M2)',
  },
  {
    id: 'thirds',
    distances: [3, 4],
    label: 'Thirds (m3, M3)',
    longLabel: 'Thirds (m3, M3)',
  },
  {
    id: 'fourth-tritone',
    distances: [5, 6],
    label: 'Fourth & tritone (P4, TT)',
    longLabel: 'Fourth & tritone (P4, TT)',
  },
  {
    id: 'fifth-sixth',
    distances: [7, 8],
    label: 'Fifth & minor 6th (P5, m6)',
    longLabel: 'Fifth & minor 6th (P5, m6)',
  },
  {
    id: 'sixths-sevenths',
    distances: [9, 10, 11],
    label: 'Sixths & sevenths (M6, m7, M7)',
    longLabel: 'Sixths & sevenths (M6, m7, M7)',
  },
];

/**
 * Get all item IDs belonging to a distance group.
 * Groups are defined by semitone distance — this maps to interval abbreviations.
 *
 * @example getItemIdsForGroup('seconds') → ["C+m2","C-m2","C+M2","C-M2","C#+m2",...]
 */
export function getItemIdsForGroup(groupId: string): string[] {
  const group = DISTANCE_GROUPS.find((g) => g.id === groupId);
  if (!group) return [];
  const intervals = MATH_INTERVALS.filter((i) =>
    group.distances.includes(i.num)
  );
  const items: string[] = [];
  // Build: interval ascending, then direction (+ then -), then ROOT_CYCLE.
  // Final order is hash-shuffled for variety.
  for (const interval of intervals) {
    for (const sign of ['+', '-']) {
      for (const root of ROOT_CYCLE) {
        items.push(root + sign + interval.abbrev);
      }
    }
  }
  return shuffleByItemHash(items);
}

/** All 264 item IDs: 12 notes × 11 intervals × 2 directions (+/-). */
export const ALL_ITEMS: string[] = shuffleByItemHash(buildMathIds(
  ROOT_CYCLE,
  MATH_INTERVALS.map((i) => i.abbrev),
));

export const ALL_GROUP_IDS: string[] = DISTANCE_GROUPS.map((g) => g.id);

// ---------------------------------------------------------------------------
// Question
// ---------------------------------------------------------------------------

export type Question = {
  note: Note;
  op: string;
  interval: Interval;
  /** Letter-correct spelled answer, e.g. 'Eb', 'F##', 'Cb'. */
  answerSpelled: string;
  useFlats: boolean;
  promptText: string;
};

/**
 * Parse an item ID and generate a question for the quiz engine.
 *
 * @example getQuestion("D+m2") → { note: D, op: "+", interval: m2, answerSpelled: "Eb", ... }
 * @example getQuestion("G#-m2") → { note: G#, op: "-", interval: m2, answerSpelled: "F##", ... }
 */
export function getQuestion(itemId: string): Question {
  const parsed = parseMathId(itemId);
  const noteName = parsed.note;
  const op = parsed.op;
  const abbrev = parsed.value;
  const note = NOTES.find((n) => n.name === noteName)!;
  const interval = MATH_INTERVALS.find((i) => i.abbrev === abbrev)!;
  // Display the root as spelled in the item ID (sharps for accidentals). This
  // means G# − m2 shows as "G# − m2" with answer F##, not "Ab − m2 = G".
  const rootSpelled = note.name;
  const answerSpelled = addInterval(rootSpelled, abbrev, op as '+' | '-');
  const useFlats = deriveUseFlats(answerSpelled, op);
  const promptNoteName = displayNote(rootSpelled);
  return {
    note,
    op,
    interval,
    answerSpelled,
    useFlats,
    promptText: promptNoteName + ' ' + op + ' ' + interval.abbrev,
  };
}

/** Pick accidental style for answer buttons from the spelled answer. */
function deriveUseFlats(answerSpelled: string, op: string): boolean {
  const { accidental } = parseSpelledNote(answerSpelled);
  if (accidental < 0) return true;
  if (accidental > 0) return false;
  return op === '-';
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
