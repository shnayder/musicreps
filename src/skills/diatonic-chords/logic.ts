// Pure logic for Diatonic Chords mode (modal chords).
// No DOM, no hooks — just data in, data out.
// Bidirectional: forward (degree in key+mode → chord), reverse (chord in key+mode → degree).
// 864 items: 6 modes × 12 keys × 6 degrees (2–7) × 2 directions.

import type { DiatonicChord } from '../../types.ts';
import { shuffleByItemHash } from '../../skill-utils.ts';
import {
  getModalScaleDegreeNote,
  MAJOR_KEYS,
  MODAL_DIATONIC_CHORDS,
  MUSICAL_MODES,
  ORDINAL_LABELS,
} from '../../music-data.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Degrees we actually drill (skip 1 — root is always the tonic). */
const ACTIVE_DEGREES = [2, 3, 4, 5, 6, 7];

/** One scope level per musical mode. */
export const MODE_LEVELS = MUSICAL_MODES.map((m) => ({
  id: m.id,
  label: m.label,
  longLabel: m.label + (m.id === 'major' ? ' (Ionian)' : ''),
}));

export const ALL_LEVEL_IDS = MODE_LEVELS.map((l) => l.id);

/**
 * Get all item IDs for a mode-level.
 * Item ID format: "mode:key:degree:dir" (e.g. "dorian:Bb:4:fwd").
 * Returns 144 items per mode (12 keys × 6 degrees × 2 dirs), hash-shuffled.
 */
export function getItemIdsForLevel(modeId: string): string[] {
  const items: string[] = [];
  for (const d of ACTIVE_DEGREES) {
    for (const dir of ['fwd', 'rev']) {
      for (const key of MAJOR_KEYS) {
        items.push(modeId + ':' + key.root + ':' + d + ':' + dir);
      }
    }
  }
  return shuffleByItemHash(items);
}

/** All 864 item IDs, hash-shuffled. */
export const ALL_ITEMS: string[] = (() => {
  const items: string[] = [];
  for (const mode of MUSICAL_MODES) {
    for (const d of ACTIVE_DEGREES) {
      for (const dir of ['fwd', 'rev']) {
        for (const key of MAJOR_KEYS) {
          items.push(mode.id + ':' + key.root + ':' + d + ':' + dir);
        }
      }
    }
  }
  return shuffleByItemHash(items);
})();

/** Row definitions for the stats grid (one row per key). */
export const GRID_NOTES = MAJOR_KEYS.map((k) => ({
  name: k.root,
  displayName: k.root,
}));

// ---------------------------------------------------------------------------
// Question
// ---------------------------------------------------------------------------

export type Question = {
  mode: string;
  keyRoot: string;
  degree: number;
  chord: DiatonicChord;
  dir: 'fwd' | 'rev';
  rootNote: string;
};

/**
 * Parse a compound item ID and generate a question.
 * Item ID format: "mode:keyRoot:degree:dir" (e.g. "dorian:Bb:4:fwd").
 */
export function getQuestion(itemId: string): Question {
  const parts = itemId.split(':');
  const mode = parts[0];
  const keyRoot = parts[1];
  const degree = parseInt(parts[2]);
  const dir = parts[3] as 'fwd' | 'rev';
  const chord = MODAL_DIATONIC_CHORDS[mode][degree - 1];
  const rootNote = getModalScaleDegreeNote(keyRoot, degree, mode);
  return { mode, keyRoot, degree, chord, dir, rootNote };
}

/** Ordinal label for a degree (1-indexed). */
export function ordinalLabel(degree: number): string {
  return ORDINAL_LABELS[degree - 1];
}

/** Mode display label for prompts. */
export function modeLabel(modeId: string): string {
  return MUSICAL_MODES.find((m) => m.id === modeId)?.label ?? modeId;
}

// ---------------------------------------------------------------------------
// Stats grid config
// ---------------------------------------------------------------------------

/** Column labels for the stats grid: modal numerals for degrees 2–7. */
export function getGridColLabels(modeId: string): string[] {
  return ACTIVE_DEGREES.map((d) =>
    MODAL_DIATONIC_CHORDS[modeId][d - 1].numeral
  );
}

/**
 * Get the pair of item IDs (fwd + rev) for a stats grid cell.
 * Grid rows are keys, columns are degrees 2–7 (colIdx 0–5).
 */
export function getGridItemId(
  modeId: string,
  keyRoot: string,
  colIdx: number,
): string[] {
  const d = ACTIVE_DEGREES[colIdx];
  return [
    modeId + ':' + keyRoot + ':' + d + ':fwd',
    modeId + ':' + keyRoot + ':' + d + ':rev',
  ];
}
