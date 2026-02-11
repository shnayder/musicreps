// Pure state and helpers for the fretboard quiz mode.
// No DOM, no side effects — testable logic extracted from quiz-fretboard.js.
// ES module — exports stripped for browser inlining.
//
// In browser, depends on globals: NOTES, NATURAL_NOTES, STRING_OFFSETS,
// noteMatchesInput (from music-data.js, concatenated before this file).
// Tests import these from music-data.js directly.

/**
 * Toggle a string in the enabled set. Returns a new Set.
 * Ensures at least one string is always enabled.
 * @param {Set<number>} enabledStrings
 * @param {number} string - 0-5
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
 * Create fretboard helpers bound to music data.
 * The factory pattern avoids import/global issues — in browser the globals
 * are passed in; in tests the imported values are passed.
 *
 * @param {{ notes: Array, naturalNotes: string[], stringOffsets: number[],
 *           noteMatchesInput: function }} musicData
 */
export function createFretboardHelpers(musicData) {
  const noteNames = musicData.notes.map(n => n.name);

  /**
   * Compute the note name at a given fretboard position.
   * @param {number} string - 0-5
   * @param {number} fret - 0-12
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
    const note = musicData.notes.find(n => n.name === currentNote);
    const correct = note && musicData.noteMatchesInput(note, input);
    return { correct, correctAnswer: currentNote };
  }

  /**
   * Compute the list of enabled item IDs.
   * @param {Set<number>} enabledStrings
   * @param {boolean} naturalsOnly
   * @returns {string[]}
   */
  function getFretboardEnabledItems(enabledStrings, naturalsOnly) {
    const items = [];
    for (const s of enabledStrings) {
      for (let f = 0; f < 13; f++) {
        const note = getNoteAtPosition(s, f);
        if (!naturalsOnly || musicData.naturalNotes.includes(note)) {
          items.push(s + '-' + f);
        }
      }
    }
    return items;
  }

  /**
   * Compute item IDs for a specific string (used for recommendations).
   * @param {number} string - 0-5
   * @param {boolean} naturalsOnly
   * @returns {string[]}
   */
  function getItemIdsForString(string, naturalsOnly) {
    const items = [];
    for (let f = 0; f < 13; f++) {
      const note = getNoteAtPosition(string, f);
      if (!naturalsOnly || musicData.naturalNotes.includes(note)) {
        items.push(string + '-' + f);
      }
    }
    return items;
  }

  return {
    getNoteAtPosition,
    parseFretboardItem,
    checkFretboardAnswer,
    getFretboardEnabledItems,
    getItemIdsForString,
  };
}
