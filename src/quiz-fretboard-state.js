// Pure state and helpers for fretboard quiz modes (guitar, ukulele, etc.).
// No DOM, no side effects — testable logic extracted from quiz-fretboard.js.

import { displayNote } from './music-data.js';

/**
 * Toggle a string in the enabled set. Returns a new Set.
 * Ensures at least one string is always enabled.
 * @param {Set<number>} enabledStrings
 * @param {number} string
 * @returns {Set<number>}
 */
export function toggleFretboardString(enabledStrings, string) {
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
 *
 * @param {{ notes: Array, naturalNotes: string[], stringOffsets: number[],
 *           fretCount?: number, noteMatchesInput: function }} musicData
 */
export function createFretboardHelpers(musicData) {
  const noteNames = musicData.notes.map((n) => n.name);
  const fretCount = musicData.fretCount || 13;

  /**
   * Compute the note name at a given fretboard position.
   * @param {number} string
   * @param {number} fret
   * @returns {string} note name (e.g. 'C#')
   */
  function getNoteAtPosition(string, fret) {
    const offset = musicData.stringOffsets[string];
    return noteNames[(offset + fret) % 12];
  }

  /**
   * Parse a fretboard item ID into question state.
   * @param {string} itemId - e.g. '3-5'
   * @returns {{ currentString: number, currentFret: number, currentNote: string }}
   */
  function parseFretboardItem(itemId) {
    const [s, f] = itemId.split('-').map(Number);
    return {
      currentString: s,
      currentFret: f,
      currentNote: getNoteAtPosition(s, f),
    };
  }

  /**
   * Check if an input matches the current fretboard question.
   * @param {string} currentNote - the correct note name
   * @param {string} input - user's answer
   * @returns {{ correct: boolean, correctAnswer: string }}
   */
  function checkFretboardAnswer(currentNote, input) {
    const note = musicData.notes.find((n) => n.name === currentNote);
    const correct = !!(note && musicData.noteMatchesInput(note, input));
    return { correct, correctAnswer: displayNote(currentNote) };
  }

  /**
   * Test whether a note passes the filter.
   * @param {string} note
   * @param {string} noteFilter - 'natural', 'sharps-flats', or 'all'
   * @returns {boolean}
   */
  function notePassesFilter(note, noteFilter) {
    if (noteFilter === 'all') return true;
    const isNatural = musicData.naturalNotes.includes(note);
    return noteFilter === 'natural' ? isNatural : !isNatural;
  }

  /**
   * Compute the list of enabled item IDs.
   * @param {Set<number>} enabledStrings
   * @param {string} noteFilter - 'natural', 'sharps-flats', or 'all'
   * @returns {string[]}
   */
  function getFretboardEnabledItems(enabledStrings, noteFilter) {
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

  /**
   * Compute item IDs for a specific string (used for recommendations).
   * @param {number} string
   * @param {string} noteFilter - 'natural', 'sharps-flats', or 'all'
   * @returns {string[]}
   */
  function getItemIdsForString(string, noteFilter) {
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
 * @param {Array<{masteredCount: number, dueCount: number, unseenCount: number, totalCount: number}>} naturalStats
 *   Per-string stats for natural notes only (from getStringRecommendations
 *   called with a natural-only getItemIds).
 * @param {number} threshold - mastery ratio gate (e.g. 0.7)
 * @returns {{ suggestedFilter: string, naturalMasteryRatio: number }}
 */
export function computeNotePrioritization(naturalStats, threshold) {
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
