// Pure logic for Diatonic Chords mode.
// No DOM, no hooks — just data in, data out.
// Bidirectional: forward (numeral in key → chord root), reverse (chord in key → numeral).
// 168 items: 12 keys × 7 degrees × 2 directions.

import type { DiatonicChord } from '../../types.ts';
import {
  DIATONIC_CHORDS,
  getScaleDegreeNote,
  MAJOR_KEYS,
  ROMAN_NUMERALS,
} from '../../music-data.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Chord groups for scope selection, ordered by importance. */
export const CHORD_GROUPS = [
  {
    id: 'primary',
    degrees: [1, 4, 5],
    label: 'I IV V',
    longLabel: 'Primary chords (I, IV, V)',
  },
  {
    id: 'secondary',
    degrees: [2, 6],
    label: 'ii vi',
    longLabel: 'Secondary chords (ii, vi)',
  },
  {
    id: 'tertiary',
    degrees: [3, 7],
    label: 'iii vii\u00B0', // \u00B0 = ° (degree sign)
    longLabel: 'Tertiary chords (iii, vii\u00B0)',
  },
];

/**
 * Get all item IDs belonging to a chord group.
 * Item ID format: "key:degree:dir" (e.g. "Bb:4:fwd").
 *
 * @example getItemIdsForGroup('primary') → ["C:1:fwd","C:1:rev","C:4:fwd",...,"C:5:rev",...]
 */
export function getItemIdsForGroup(groupId: string): string[] {
  const group = CHORD_GROUPS.find((g) => g.id === groupId);
  if (!group) return [];
  const items: string[] = [];
  // Outer: numeral ascending within group; direction (fwd first);
  // inner: MAJOR_KEYS (already circle-of-fifths order).
  const sortedDegrees = [...group.degrees].sort((a, b) => a - b);
  for (const d of sortedDegrees) {
    for (const dir of ['fwd', 'rev']) {
      for (const key of MAJOR_KEYS) {
        items.push(key.root + ':' + d + ':' + dir);
      }
    }
  }
  return items;
}

/** All 168 item IDs: 12 keys × 7 degrees × 2 directions. */
export const ALL_ITEMS: string[] = [];
for (let d = 1; d <= 7; d++) {
  for (const dir of ['fwd', 'rev']) {
    for (const key of MAJOR_KEYS) {
      ALL_ITEMS.push(key.root + ':' + d + ':' + dir);
    }
  }
}

export const ALL_GROUP_IDS: string[] = CHORD_GROUPS.map((g) => g.id);

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
  chord: DiatonicChord;
  dir: 'fwd' | 'rev';
  rootNote: string;
};

/**
 * Parse a compound item ID and generate a question.
 * Item ID format: "keyRoot:degree:dir" (e.g. "Bb:4:fwd").
 *
 * @example getQuestion("Bb:4:fwd") → { keyRoot: "Bb", degree: 4, chord: IV, rootNote: "Eb" }
 * @example getQuestion("C:2:rev") → { keyRoot: "C", degree: 2, chord: ii, rootNote: "D" }
 */
export function getQuestion(itemId: string): Question {
  const parts = itemId.split(':');
  const keyRoot = parts[0];
  const degree = parseInt(parts[1]);
  const dir = parts[2] as 'fwd' | 'rev';
  const chord = DIATONIC_CHORDS[degree - 1];
  const rootNote = getScaleDegreeNote(keyRoot, degree);
  return { keyRoot, degree, chord, dir, rootNote };
}

// ---------------------------------------------------------------------------
// Input normalization
// ---------------------------------------------------------------------------

/** Normalize user input to canonical roman numeral.
 *  "4" → "IV", "vii" → "vii°" (adds ° for diminished). */
export function normalizeNumeralInput(input: string): string {
  const num = parseInt(input, 10);
  if (num >= 1 && num <= 7) return ROMAN_NUMERALS[num - 1];
  if (input === 'vii') return 'vii\u00B0';
  return input;
}

// ---------------------------------------------------------------------------
// Stats grid config
// ---------------------------------------------------------------------------

/**
 * Get the pair of item IDs (fwd + rev) for a stats grid cell.
 * Grid rows are keys, columns are degrees (using roman numerals).
 *
 * @example getGridItemId("Bb", 3) → ["Bb:4:fwd", "Bb:4:rev"]
 */
export function getGridItemId(
  keyRoot: string,
  colIdx: number,
): string[] {
  const d = colIdx + 1;
  return [keyRoot + ':' + d + ':fwd', keyRoot + ':' + d + ':rev'];
}
