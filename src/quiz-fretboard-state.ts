// Pure state and helpers for fretboard quiz modes (guitar, ukulele, etc.).
// No DOM, no side effects — testable logic extracted from quiz-fretboard.js.

import { displayNote } from './music-data.ts';
import type { Note, StringRecommendation } from './types.ts';

/**
 * Toggle a string in the enabled set. Returns a new Set.
 * Ensures at least one string is always enabled.
 */
export function toggleFretboardString(
  enabledStrings: Set<number>,
  string: number,
): Set<number> {
  const next = new Set(enabledStrings);
  if (next.has(string)) {
    if (next.size > 1) next.delete(string);
  } else {
    next.add(string);
  }
  return next;
}

/**
 * Create fretboard helpers bound to music data and instrument config.
 * The factory pattern avoids import/global issues — in browser the globals
 * are passed in; in tests the imported values are passed.
 */
export function createFretboardHelpers(musicData: {
  notes: Note[];
  naturalNotes: string[];
  stringOffsets: number[];
  fretCount?: number;
  noteMatchesInput: (note: Note, input: string) => boolean;
}) {
  const noteNames = musicData.notes.map((n) => n.name);
  const fretCount = musicData.fretCount || 13;

  /** Compute the note name at a given fretboard position (e.g. 'C#'). */
  function getNoteAtPosition(string: number, fret: number): string {
    const offset = musicData.stringOffsets[string];
    return noteNames[(offset + fret) % 12];
  }

  /** Parse a fretboard item ID (e.g. '3-5') into question state. */
  function parseFretboardItem(
    itemId: string,
  ): { currentString: number; currentFret: number; currentNote: string } {
    const [s, f] = itemId.split('-').map(Number);
    return {
      currentString: s,
      currentFret: f,
      currentNote: getNoteAtPosition(s, f),
    };
  }

  /** Check if an input matches the current fretboard question. */
  function checkFretboardAnswer(
    currentNote: string,
    input: string,
  ): { correct: boolean; correctAnswer: string } {
    const note = musicData.notes.find((n) => n.name === currentNote);
    const correct = !!(note && musicData.noteMatchesInput(note, input));
    return { correct, correctAnswer: displayNote(currentNote) };
  }

  /** Test whether a note passes the filter ('natural', 'sharps-flats', or 'all'). */
  function notePassesFilter(note: string, noteFilter: string): boolean {
    if (noteFilter === 'all') return true;
    const isNatural = musicData.naturalNotes.includes(note);
    return noteFilter === 'natural' ? isNatural : !isNatural;
  }

  /** Compute the list of enabled item IDs. */
  function getFretboardEnabledItems(
    enabledStrings: Set<number>,
    noteFilter: string,
  ): string[] {
    const items = [];
    for (const s of enabledStrings) {
      for (let f = 0; f < fretCount; f++) {
        const note = getNoteAtPosition(s, f);
        if (notePassesFilter(note, noteFilter)) {
          items.push(s + '-' + f);
        }
      }
    }
    return items;
  }

  /** Compute item IDs for a specific string (used for recommendations). */
  function getItemIdsForString(string: number, noteFilter: string): string[] {
    const items = [];
    for (let f = 0; f < fretCount; f++) {
      const note = getNoteAtPosition(string, f);
      if (notePassesFilter(note, noteFilter)) {
        items.push(string + '-' + f);
      }
    }
    return items;
  }

  return {
    fretCount,
    getNoteAtPosition,
    parseFretboardItem,
    checkFretboardAnswer,
    getFretboardEnabledItems,
    getItemIdsForString,
  };
}

/**
 * Compute which note filter to suggest based on natural-note mastery.
 * Consolidate-before-expanding applied to note types: master naturals
 * before adding accidentals.
 *
 * naturalStats are per-string stats for natural notes only (from
 * getStringRecommendations called with a natural-only getItemIds).
 */
export function computeNotePrioritization(
  naturalStats: StringRecommendation[],
  threshold: number,
): { suggestedFilter: string; naturalMasteryRatio: number } {
  let totalSeen = 0;
  let totalMastered = 0;
  for (const r of naturalStats) {
    totalSeen += r.masteredCount + r.dueCount;
    totalMastered += r.masteredCount;
  }
  const ratio = totalSeen > 0 ? totalMastered / totalSeen : 0;
  if (totalSeen === 0 || ratio < threshold) {
    return { suggestedFilter: 'natural', naturalMasteryRatio: ratio };
  }
  return { suggestedFilter: 'all', naturalMasteryRatio: ratio };
}
