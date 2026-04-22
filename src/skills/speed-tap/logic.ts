// Pure logic for Speed Tap mode.
// No DOM, no hooks — just data in, data out.
// Items: 12 chromatic notes; user taps fretboard positions for each note.
// Parameterized by instrument (guitar or ukulele).

import type { Instrument, NoteFilter as NoteFilterType } from '../../types.ts';
import type { MultiTapEvalResult } from '../../declarative/types.ts';
import {
  displayNote,
  NATURAL_NOTES,
  NOTES,
  pickRandomAccidental,
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
 * Get the note name at a given fretboard position for an instrument.
 *
 * @example getNoteAtPosition(inst, 0, 0) → "E" (guitar high E, open)
 */
export function getNoteAtPosition(
  inst: Instrument,
  string: number,
  fret: number,
): string {
  const offset = inst.stringOffsets[string];
  return noteNames[(offset + fret) % 12];
}

/**
 * Get all fretboard positions (string + fret) where a given note appears.
 * Searches all strings, frets 0–12.
 */
export function getPositionsForNote(
  inst: Instrument,
  noteName: string,
): { string: number; fret: number }[] {
  const positions: { string: number; fret: number }[] = [];
  for (let s = 0; s < inst.stringCount; s++) {
    for (let f = 0; f < inst.fretCount; f++) {
      if (getNoteAtPosition(inst, s, f) === noteName) {
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

/** Parse an item ID (note name) into a Question for a given instrument. */
export function parseItem(inst: Instrument, itemId: string): Question {
  const noteData = NOTES.find((n) => n.name === itemId);
  const name = noteData
    ? displayNote(pickRandomAccidental(noteData.displayName))
    : displayNote(itemId);
  return {
    note: itemId,
    displayName: name,
    positions: getPositionsForNote(inst, itemId),
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

// Circle-of-fifths ordering for each group (pedagogical fixed order).
const NATURALS_CYCLE = ['C', 'G', 'D', 'A', 'E', 'B', 'F'];
const ACCIDENTALS_CYCLE = ['F#', 'C#', 'G#', 'D#', 'A#'];

export const NOTE_LEVELS = [
  { id: 'naturals', label: 'Naturals', longLabel: 'Natural notes' },
  { id: 'sharps-flats', label: '\u266F/\u266D', longLabel: 'Sharps & flats' },
];

export const ALL_LEVEL_IDS: string[] = NOTE_LEVELS.map((g) => g.id);

export function getItemIdsForLevel(levelId: string): string[] {
  // Return in fixed (circle-of-fifths) order. Unknown group IDs
  // return [] to match the defensive pattern used by other modes.
  if (levelId === 'naturals') {
    return NATURALS_CYCLE.filter((n) => NATURAL_NOTES.includes(n));
  }
  if (levelId === 'sharps-flats') {
    return ACCIDENTALS_CYCLE.filter((n) => ACCIDENTAL_NOTES.includes(n));
  }
  return [];
}

export function formatGroupLabel(
  enabledGroups: ReadonlySet<string>,
): string {
  if (enabledGroups.size === 2) return 'all notes';
  if (enabledGroups.has('sharps-flats')) return 'sharps & flats';
  return 'natural notes';
}
