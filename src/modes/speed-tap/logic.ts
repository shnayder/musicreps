// Pure logic for Speed Tap mode.
// No DOM, no hooks — just data in, data out.
// Items: 12 chromatic notes; user taps fretboard positions for each note.

import type { NoteFilter as NoteFilterType } from '../../types.ts';
import type { MultiTapEvalResult } from '../../declarative/types.ts';
import {
  displayNote,
  NATURAL_NOTES,
  NOTES,
  pickRandomAccidental,
  STRING_OFFSETS,
} from '../../music-data.ts';

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

// ---------------------------------------------------------------------------
// Question type and parser (for declarative mode definition)
// ---------------------------------------------------------------------------

export type Question = {
  note: string;
  displayName: string;
  positions: { string: number; fret: number }[];
};

/** Parse an item ID (note name) into a Question. */
export function parseItem(itemId: string): Question {
  const noteData = NOTES.find((n) => n.name === itemId);
  const name = noteData
    ? displayNote(pickRandomAccidental(noteData.displayName))
    : displayNote(itemId);
  return {
    note: itemId,
    displayName: name,
    positions: getPositionsForNote(itemId),
  };
}

/** Convert a position to a target key (for multi-tap matching). */
export function positionKey(
  pos: { string: number; fret: number },
): string {
  return pos.string + '-' + pos.fret;
}

// ---------------------------------------------------------------------------
// Multi-tap evaluation
// ---------------------------------------------------------------------------

/** Evaluate tapped positions against expected targets. */
export function evaluate(
  q: Question,
  tapped: string[],
): MultiTapEvalResult {
  const targetSet = new Set(q.positions.map(positionKey));
  const tappedSet = new Set(tapped);
  const perEntry = tapped.map((pos) => ({
    positionKey: pos,
    correct: targetSet.has(pos),
  }));
  const missed = [...targetSet].filter((t) => !tappedSet.has(t));
  const correct = perEntry.every((e) => e.correct) && missed.length === 0;
  return {
    correct,
    correctAnswer: displayNote(q.note),
    perEntry,
    missed,
  };
}

// ---------------------------------------------------------------------------
// Group definitions (for declarative scope)
// ---------------------------------------------------------------------------

const ACCIDENTAL_NOTES = NOTES
  .filter((n) => !NATURAL_NOTES.includes(n.name))
  .map((n) => n.name);

export const NOTE_GROUPS = [
  { label: 'Naturals', longLabel: 'Natural notes' },
  { label: '\u266F/\u266D', longLabel: 'Sharps & flats' },
];

export const ALL_GROUP_INDICES = [0, 1];

export function getItemIdsForGroup(index: number): string[] {
  return index === 0 ? NATURAL_NOTES.slice() : ACCIDENTAL_NOTES.slice();
}

export function formatGroupLabel(
  enabledGroups: ReadonlySet<number>,
): string {
  if (enabledGroups.size === 2) return 'all notes';
  if (enabledGroups.has(1)) return 'sharps & flats';
  return 'natural notes';
}
