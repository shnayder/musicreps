// Pure logic for Speed Tap mode.
// No DOM, no hooks — just data in, data out.
// Items: 12 chromatic notes; user taps fretboard positions for each note.

import type { NoteFilter as NoteFilterType } from '../../types.ts';
import { NATURAL_NOTES, NOTES, STRING_OFFSETS } from '../../music-data.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const noteNames: string[] = NOTES.map((n) => n.name);

/** All 12 note names as item IDs (one per chromatic pitch). */
export const ALL_ITEMS = NOTES.map((n) => n.name);

// ---------------------------------------------------------------------------
// Position helpers
// ---------------------------------------------------------------------------

/**
 * Get the note name at a given fretboard position.
 * Uses standard guitar tuning offsets (STRING_OFFSETS).
 *
 * @example getNoteAtPosition(0, 0) → "E" (high E string, open)
 * @example getNoteAtPosition(5, 3) → "G" (low E string, fret 3)
 */
export function getNoteAtPosition(string: number, fret: number): string {
  const offset = STRING_OFFSETS[string];
  return noteNames[(offset + fret) % 12];
}

/**
 * Get all fretboard positions (string + fret) where a given note appears.
 * Searches all 6 strings, frets 0–12.
 *
 * @example getPositionsForNote("C") → [{string:0,fret:8},{string:1,fret:1},...]
 */
export function getPositionsForNote(
  noteName: string,
): { string: number; fret: number }[] {
  const positions: { string: number; fret: number }[] = [];
  for (let s = 0; s < 6; s++) {
    for (let f = 0; f <= 12; f++) {
      if (getNoteAtPosition(s, f) === noteName) {
        positions.push({ string: s, fret: f });
      }
    }
  }
  return positions;
}

/**
 * Get the list of note names enabled for the current note filter setting.
 *
 * @example getEnabledNotes("natural") → ["C","D","E","F","G","A","B"]
 * @example getEnabledNotes("sharps-flats") → ["C#","D#","F#","G#","A#"]
 * @example getEnabledNotes("all") → all 12 notes
 */
export function getEnabledNotes(filter: NoteFilterType): string[] {
  if (filter === 'none') return [];
  if (filter === 'natural') return NATURAL_NOTES.slice();
  if (filter === 'sharps-flats') {
    return NOTES.filter((n) => !NATURAL_NOTES.includes(n.name))
      .map((n) => n.name);
  }
  return NOTES.map((n) => n.name);
}
