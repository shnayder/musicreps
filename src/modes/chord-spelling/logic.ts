// Pure logic for Chord Spelling mode.
// No DOM, no hooks — just data in, data out.
// Sequential response: user spells out chord tones one at a time.
// ~132 items: 12 roots × chord types, grouped by chord type.

import type {
  ChordType,
  SequentialInputResult,
  SequentialState,
} from '../../types.ts';
import {
  CHORD_ROOTS,
  CHORD_TYPES,
  displayNote,
  getChordTones,
  spelledNoteMatchesInput,
  spelledNoteMatchesSemitone,
} from '../../music-data.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Build chord type groups from CHORD_TYPES, grouping by the `group` field.
 * Each group gets a label built from the chord symbols in that group.
 */
function buildGroups(): { types: ChordType[]; label: string }[] {
  let maxGroup = 0;
  for (const ct of CHORD_TYPES) {
    if (ct.group > maxGroup) maxGroup = ct.group;
  }
  const result: { types: ChordType[]; label: string }[] = [];
  for (let g = 0; g <= maxGroup; g++) {
    const types = CHORD_TYPES.filter((t) => t.group === g);
    const label = types.map((t) => t.symbol || 'maj').join(', ');
    result.push({ types, label });
  }
  return result;
}

/** Chord type groups for scope selection. */
export const SPELLING_GROUPS = buildGroups();

/**
 * Get all item IDs belonging to a chord type group.
 * Item ID format: "root:typeName" (e.g. "C:major", "F#:dim").
 *
 * @example getItemIdsForGroup(0) → ["C:major","C#:major",...,"C:minor","C#:minor",...]
 */
export function getItemIdsForGroup(groupIndex: number): string[] {
  const types = SPELLING_GROUPS[groupIndex].types;
  const items: string[] = [];
  for (const root of CHORD_ROOTS) {
    for (const type of types) {
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

export const ALL_GROUP_INDICES = SPELLING_GROUPS.map((_, i) => i);

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
 * Initialize sequential state for a chord-spelling question.
 * Sets the expected count (number of chord tones) and empty entries.
 *
 * @example initSequentialState("C:major") → { expectedCount: 3, entries: [] }
 */
export function initSequentialState(itemId: string): SequentialState {
  const item = parseItem(itemId);
  return { expectedCount: item.tones.length, entries: [] };
}

/**
 * Process a single note input in the sequential chord-spelling sequence.
 *
 * If the sequence is not yet complete, returns { status: 'continue', state }.
 * If all tones have been entered, returns { status: 'complete', correct, correctAnswer }.
 *
 * Each entered note is checked against the expected tone at that position.
 * If the note is enharmonically correct (same semitone), the canonical spelling is used.
 */
export function handleInput(
  itemId: string,
  input: string,
  state: SequentialState,
): SequentialInputResult {
  const item = parseItem(itemId);
  const idx = state.entries.length;
  if (idx >= item.tones.length) {
    const allCorrect = state.entries.every((e) => e.correct);
    return {
      status: 'complete',
      correct: allCorrect,
      correctAnswer: item.tones.map(displayNote).join(' '),
      state,
    };
  }

  const expected = item.tones[idx];
  if (spelledNoteMatchesSemitone(expected, input)) {
    input = expected;
  }

  const isCorrect = spelledNoteMatchesInput(expected, input);
  const entries = [
    ...state.entries,
    {
      input,
      display: isCorrect ? displayNote(expected) : displayNote(input),
      correct: isCorrect,
    },
  ];

  const newState: SequentialState = {
    expectedCount: item.tones.length,
    entries,
  };

  if (entries.length === item.tones.length) {
    const allCorrect = entries.every((e) => e.correct);
    return {
      status: 'complete',
      correct: allCorrect,
      correctAnswer: item.tones.map(displayNote).join(' '),
      state: newState,
    };
  }

  return { status: 'continue', state: newState };
}

/**
 * Final answer check used by the quiz engine after sequential input completes.
 * Uses a sentinel value ("__correct__") to signal all-correct.
 */
export function checkAnswer(
  itemId: string,
  input: string,
): { correct: boolean; correctAnswer: string } {
  const allCorrect = input === '__correct__';
  const item = parseItem(itemId);
  const correctAnswer = item.tones.map(displayNote).join(' ');
  return { correct: allCorrect, correctAnswer };
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
