// Pure logic for Scale Degrees mode.
// No DOM, no hooks — just data in, data out.
// Bidirectional: forward (degree in key → note), reverse (note in key → degree).
// 144 items: 12 keys × 6 degrees × 2 directions (1st excluded).

import { getScaleDegreeNote, MAJOR_KEYS } from '../../music-data.ts';
import { shuffleByItemHash } from '../../mode-utils.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DEGREE_LABELS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th'];

/** Degrees included in this mode (1st excluded — too easy). */
export const ACTIVE_DEGREES = [2, 3, 4, 5, 6, 7];

/** Degree groups for scope selection, ordered by importance. */
export const DEGREE_GROUPS = [
  {
    id: '4th-5th',
    degrees: [4, 5],
    label: '4th, 5th',
    longLabel: '4th & 5th degrees',
  },
  {
    id: '3rd-7th',
    degrees: [3, 7],
    label: '3rd, 7th',
    longLabel: '3rd & 7th degrees',
  },
  {
    id: '2nd-6th',
    degrees: [2, 6],
    label: '2nd, 6th',
    longLabel: '2nd & 6th degrees',
  },
];

/**
 * Get all item IDs belonging to a degree group.
 * Item ID format: "key:degree:dir" (e.g. "D:5:fwd").
 *
 * @example getItemIdsForGroup('4th-5th') → ["C:4:fwd","C:4:rev","C:5:fwd","C:5:rev",...]
 */
export function getItemIdsForGroup(groupId: string): string[] {
  const group = DEGREE_GROUPS.find((g) => g.id === groupId);
  if (!group) return [];
  const items: string[] = [];
  // Build: degree ascending, then direction (fwd first), then MAJOR_KEYS.
  // Final order is hash-shuffled for variety.
  const sortedDegrees = [...group.degrees].sort((a, b) => a - b);
  for (const d of sortedDegrees) {
    for (const dir of ['fwd', 'rev']) {
      for (const key of MAJOR_KEYS) {
        items.push(key.root + ':' + d + ':' + dir);
      }
    }
  }
  return shuffleByItemHash(items);
}

/** All 144 item IDs: 12 keys × 6 degrees × 2 directions (1st excluded). */
export const ALL_ITEMS: string[] = (() => {
  const items: string[] = [];
  for (const d of ACTIVE_DEGREES) {
    for (const dir of ['fwd', 'rev']) {
      for (const key of MAJOR_KEYS) {
        items.push(key.root + ':' + d + ':' + dir);
      }
    }
  }
  return shuffleByItemHash(items);
})();

export const ALL_GROUP_IDS: string[] = DEGREE_GROUPS.map((g) => g.id);

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
// Stats grid config
// ---------------------------------------------------------------------------

/**
 * Get the pair of item IDs (fwd + rev) for a stats grid cell.
 * Grid rows are keys, columns are degrees 2–7.
 *
 * @example getGridItemId("D", 3) → ["D:5:fwd", "D:5:rev"]
 */
export function getGridItemId(
  keyRoot: string,
  colIdx: number,
): string[] {
  const d = ACTIVE_DEGREES[colIdx];
  return [keyRoot + ':' + d + ':fwd', keyRoot + ':' + d + ':rev'];
}
