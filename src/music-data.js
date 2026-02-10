// Shared music theory data: notes, intervals, and helpers.
// Used by all quiz modes. This is an ES module — main.ts strips
// "export" keywords for browser inlining (same pattern as adaptive.js).

export const NOTES = [
  { name: 'C',  displayName: 'C',     num: 0,  accepts: ['c'] },
  { name: 'C#', displayName: 'C#/Db', num: 1,  accepts: ['c#', 'db'] },
  { name: 'D',  displayName: 'D',     num: 2,  accepts: ['d'] },
  { name: 'D#', displayName: 'D#/Eb', num: 3,  accepts: ['d#', 'eb'] },
  { name: 'E',  displayName: 'E',     num: 4,  accepts: ['e'] },
  { name: 'F',  displayName: 'F',     num: 5,  accepts: ['f'] },
  { name: 'F#', displayName: 'F#/Gb', num: 6,  accepts: ['f#', 'gb'] },
  { name: 'G',  displayName: 'G',     num: 7,  accepts: ['g'] },
  { name: 'G#', displayName: 'G#/Ab', num: 8,  accepts: ['g#', 'ab'] },
  { name: 'A',  displayName: 'A',     num: 9,  accepts: ['a'] },
  { name: 'A#', displayName: 'A#/Bb', num: 10, accepts: ['a#', 'bb'] },
  { name: 'B',  displayName: 'B',     num: 11, accepts: ['b'] },
];

export const NATURAL_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

export const INTERVALS = [
  { name: 'minor 2nd',   num: 1,  abbrev: 'm2' },
  { name: 'Major 2nd',   num: 2,  abbrev: 'M2' },
  { name: 'minor 3rd',   num: 3,  abbrev: 'm3' },
  { name: 'Major 3rd',   num: 4,  abbrev: 'M3' },
  { name: 'Perfect 4th',  num: 5,  abbrev: 'P4' },
  { name: 'Tritone',      num: 6,  abbrev: 'TT', altAbbrevs: ['A4', 'd5'] },
  { name: 'Perfect 5th',  num: 7,  abbrev: 'P5' },
  { name: 'minor 6th',   num: 8,  abbrev: 'm6' },
  { name: 'Major 6th',   num: 9,  abbrev: 'M6' },
  { name: 'minor 7th',   num: 10, abbrev: 'm7' },
  { name: 'Major 7th',   num: 11, abbrev: 'M7' },
  { name: 'Octave',       num: 12, abbrev: 'P8' },
];

/** Look up a note by its semitone number (0–11). */
export function noteByNum(num) {
  return NOTES[((num % 12) + 12) % 12];
}

/** Look up an interval by its semitone count (1–12). */
export function intervalByNum(num) {
  return INTERVALS.find(i => i.num === num) || null;
}

/** Add semitones to a note number, wrapping at 12. Returns the result note. */
export function noteAdd(noteNum, semitones) {
  return noteByNum(noteNum + semitones);
}

/** Subtract semitones from a note number, wrapping at 12. Returns the result note. */
export function noteSub(noteNum, semitones) {
  return noteByNum(noteNum - semitones);
}

/** Check if a user input matches any accepted answer for a note. */
export function noteMatchesInput(note, input) {
  return note.accepts.includes(input.toLowerCase());
}

/** Check if a user input matches an interval abbreviation (case-sensitive). */
export function intervalMatchesInput(interval, input) {
  if (input === interval.abbrev) return true;
  if (interval.altAbbrevs && interval.altAbbrevs.includes(input)) return true;
  return false;
}

// Guitar-specific data
export const STRING_NAMES = ['e', 'B', 'G', 'D', 'A', 'E'];
export const STRING_OFFSETS = [4, 11, 7, 2, 9, 4]; // semitones from C
