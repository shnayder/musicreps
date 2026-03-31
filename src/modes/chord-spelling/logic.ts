// Pure logic for Chord Spelling mode.
// No DOM, no hooks — just data in, data out.
// Sequential response: user spells out chord tones one at a time.
// ~132 items: 12 roots × chord types, grouped by chord type.
//
// All notes are collected before evaluation. Spelling must be exact —
// enharmonic equivalents (e.g. B vs Cb) are rejected.

import type { ChordType } from '../../types.ts';
import type { SequentialEvalResult } from '../../declarative/types.ts';
import {
  CHORD_ROOTS,
  CHORD_TYPES,
  displayNote,
  getChordTones,
  spelledNoteMatchesInput,
} from '../../music-data.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Long labels by group index (hand-written for readability). */
const GROUP_LONG_LABELS: Record<number, string> = {
  0: 'Major triads',
  1: 'Minor triads',
  2: 'Dominant 7th',
  3: 'Major 7th',
  4: 'Minor 7th',
  5: 'Diminished, augmented & half-dim',
  6: 'Suspended & 6th chords',
};

/** Stable string IDs by group index. */
const GROUP_IDS: Record<number, string> = {
  0: 'triads-major',
  1: 'triads-minor',
  2: 'dom-7th',
  3: 'maj-7th',
  4: 'min-7th',
  5: 'dim-aug-hdim',
  6: 'sus-6th',
};

/**
 * Build chord type groups from CHORD_TYPES, grouping by the `group` field.
 * Each group gets a label built from the chord symbols in that group.
 */
function buildGroups(): {
  id: string;
  types: ChordType[];
  label: string;
  longLabel: string;
}[] {
  let maxGroup = 0;
  for (const ct of CHORD_TYPES) {
    if (ct.group > maxGroup) maxGroup = ct.group;
  }
  const result: {
    id: string;
    types: ChordType[];
    label: string;
    longLabel: string;
  }[] = [];
  for (let g = 0; g <= maxGroup; g++) {
    const types = CHORD_TYPES.filter((t) => t.group === g);
    const label = types.map((t) => t.symbol || 'maj').join(', ');
    const longLabel = GROUP_LONG_LABELS[g] ?? label;
    const id = GROUP_IDS[g] ?? String(g);
    result.push({ id, types, label, longLabel });
  }
  return result;
}

/** Chord type groups for scope selection. */
export const SPELLING_GROUPS = buildGroups();

/**
 * Get all item IDs belonging to a chord type group.
 * Item ID format: "root:typeName" (e.g. "C:major", "F#:dim").
 *
 * @example getItemIdsForGroup('triads-major') → ["C:major","C#:major",...]
 */
export function getItemIdsForGroup(groupId: string): string[] {
  const group = SPELLING_GROUPS.find((g) => g.id === groupId);
  if (!group) return [];
  const items: string[] = [];
  for (const root of CHORD_ROOTS) {
    for (const type of group.types) {
      items.push(root + ':' + type.name);
    }
  }
  return items;
}

/** All item IDs: 12 roots × all chord types. */
export const ALL_ITEMS: string[] = [];
for (const root of CHORD_ROOTS) {
  for (const type of CHORD_TYPES) {
    ALL_ITEMS.push(root + ':' + type.name);
  }
}

export const ALL_GROUP_IDS: string[] = SPELLING_GROUPS.map((g) => g.id);

/** Row definitions for the stats grid (one row per chord root). */
export const GRID_NOTES = CHORD_ROOTS.map((r) => ({
  name: r,
  displayName: r,
}));

/** Column labels for the stats grid (chord type symbols). */
export const GRID_COL_LABELS = CHORD_TYPES.map((t) => t.symbol || 'maj');

// ---------------------------------------------------------------------------
// Question + sequential logic
// ---------------------------------------------------------------------------

export type Question = {
  rootName: string;
  chordType: ChordType;
  tones: string[];
};

/**
 * Parse a chord-spelling item ID into its components.
 * Splits on the first colon — root is before, chord type name is after.
 *
 * @example parseItem("C:major") → { rootName: "C", chordType: ..., tones: ["C","E","G"] }
 * @example parseItem("F#:dim") → { rootName: "F#", chordType: ..., tones: ["F#","A","C"] }
 */
export function parseItem(itemId: string): Question {
  const colonIdx = itemId.indexOf(':');
  const rootName = itemId.substring(0, colonIdx);
  const typeName = itemId.substring(colonIdx + 1);
  const chordType = CHORD_TYPES.find((t) => t.name === typeName)!;
  const tones = getChordTones(rootName, chordType);
  return { rootName, chordType, tones };
}

/**
 * Evaluate user's note inputs against the expected chord tones.
 * Requires exact spelling — enharmonic equivalents are rejected
 * (e.g. B ≠ Cb, F# ≠ Gb).
 *
 * Used by the declarative mode definition via `sequential.evaluate`.
 */
export function evaluate(q: Question, inputs: string[]): SequentialEvalResult {
  const perEntry = inputs.map((input, i) => {
    const expected = q.tones[i];
    const isCorrect = expected !== undefined &&
      spelledNoteMatchesInput(expected, input);
    return {
      display: isCorrect ? displayNote(expected) : displayNote(input),
      correct: isCorrect,
    };
  });

  return {
    correct: perEntry.every((e) => e.correct),
    correctAnswer: q.tones.map(displayNote).join(' '),
    perEntry,
  };
}

/**
 * Parse keyboard text input into note names.
 * Whitespace-separated, case-insensitive. 's' is accepted for sharp.
 *
 * @example parseChordInput("C E G") → ["C", "E", "G"]
 * @example parseChordInput("A Cb fs") → ["A", "Cb", "F#"]
 * @example parseChordInput("bb db f") → ["Bb", "Db", "F"]
 */
export function parseChordInput(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean).map((token) => {
    if (token.length === 0) return '';
    const letter = token[0].toUpperCase();
    if (!'CDEFGAB'.includes(letter)) return token;
    let suffix = '';
    for (let i = 1; i < token.length; i++) {
      const ch = token[i];
      if (ch === 's' || ch === 'S') suffix += '#';
      else suffix += ch; // '#' and 'b' stay as-is
    }
    return letter + suffix;
  });
}

// ---------------------------------------------------------------------------
// Stats grid config
// ---------------------------------------------------------------------------

/**
 * Get the item ID for a stats grid cell. Single item (not a pair) since
 * chord spelling is unidirectional.
 *
 * @example getGridItemId("C", 0) → "C:major"
 */
export function getGridItemId(
  rootName: string,
  colIdx: number,
): string | string[] {
  return rootName + ':' + CHORD_TYPES[colIdx].name;
}
