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

/** Pick a single accidental spelling from a displayName like 'C#/Db'. */
export function pickAccidentalName(displayName, useFlats) {
  if (!displayName.includes('/')) return displayName;
  const [sharp, flat] = displayName.split('/');
  return useFlats ? flat : sharp;
}

/** Randomly pick one enharmonic spelling from a displayName like 'C#/Db'. */
export function pickRandomAccidental(displayName) {
  if (!displayName.includes('/')) return displayName;
  const [sharp, flat] = displayName.split('/');
  return Math.random() < 0.5 ? sharp : flat;
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

// ---------------------------------------------------------------------------
// Letter-name arithmetic (for scale degrees, chord spelling, key sigs)
// ---------------------------------------------------------------------------

export const LETTER_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
export const NATURAL_SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export const MAJOR_SCALE_STEPS = [0, 2, 4, 5, 7, 9, 11]; // cumulative semitones per degree

/** Parse a spelled note name like 'F#', 'Bb', 'Ebb' into { letter, accidental }. */
export function parseSpelledNote(name) {
  if (!name) return { letter: '', accidental: 0 };
  const letter = name[0].toUpperCase();
  let acc = 0;
  for (let i = 1; i < name.length; i++) {
    if (name[i] === '#') acc++;
    else if (name[i] === 'b') acc--;
  }
  return { letter, accidental: acc };
}

/** Build a note name from letter + accidental offset. */
export function spelledNoteName(letter, accidental) {
  if (accidental === 0) return letter;
  if (accidental > 0) return letter + '#'.repeat(accidental);
  return letter + 'b'.repeat(-accidental);
}

/** Get the semitone value (0-11) of a spelled note. */
export function spelledNoteSemitone(name) {
  const { letter, accidental } = parseSpelledNote(name);
  return ((NATURAL_SEMITONES[letter] + accidental) % 12 + 12) % 12;
}

/**
 * Get the note name for a scale degree in a major key.
 * keyRoot: e.g., 'D', 'Bb', 'F#'
 * degree: 1-7 (1 = root)
 * Returns spelled note name, e.g., 'F#', 'Eb'.
 */
export function getScaleDegreeNote(keyRoot, degree) {
  const root = parseSpelledNote(keyRoot);
  const rootLetterIdx = LETTER_NAMES.indexOf(root.letter);
  const rootSemitone = ((NATURAL_SEMITONES[root.letter] + root.accidental) % 12 + 12) % 12;

  const targetLetterIdx = (rootLetterIdx + degree - 1) % 7;
  const targetLetter = LETTER_NAMES[targetLetterIdx];
  const targetSemitone = (rootSemitone + MAJOR_SCALE_STEPS[degree - 1]) % 12;
  const naturalSemitone = NATURAL_SEMITONES[targetLetter];

  let acc = ((targetSemitone - naturalSemitone + 12) % 12);
  if (acc > 6) acc -= 12;

  return spelledNoteName(targetLetter, acc);
}

/**
 * Reverse lookup: given a key and a note, find which degree (1-7) it is.
 * Returns the degree number, or 0 if the note isn't in the scale.
 */
export function findScaleDegree(keyRoot, noteName) {
  const noteSemitone = spelledNoteSemitone(noteName);
  for (let d = 1; d <= 7; d++) {
    const degreeName = getScaleDegreeNote(keyRoot, d);
    if (spelledNoteSemitone(degreeName) === noteSemitone) return d;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Key signatures
// ---------------------------------------------------------------------------

export const MAJOR_KEYS = [
  { root: 'C',  sharps: 0, flats: 0, accidentalCount: 0,  accidentalType: 'none' },
  { root: 'G',  sharps: 1, flats: 0, accidentalCount: 1,  accidentalType: 'sharps' },
  { root: 'D',  sharps: 2, flats: 0, accidentalCount: 2,  accidentalType: 'sharps' },
  { root: 'A',  sharps: 3, flats: 0, accidentalCount: 3,  accidentalType: 'sharps' },
  { root: 'E',  sharps: 4, flats: 0, accidentalCount: 4,  accidentalType: 'sharps' },
  { root: 'B',  sharps: 5, flats: 0, accidentalCount: 5,  accidentalType: 'sharps' },
  { root: 'F#', sharps: 6, flats: 0, accidentalCount: 6,  accidentalType: 'sharps' },
  { root: 'F',  sharps: 0, flats: 1, accidentalCount: 1,  accidentalType: 'flats' },
  { root: 'Bb', sharps: 0, flats: 2, accidentalCount: 2,  accidentalType: 'flats' },
  { root: 'Eb', sharps: 0, flats: 3, accidentalCount: 3,  accidentalType: 'flats' },
  { root: 'Ab', sharps: 0, flats: 4, accidentalCount: 4,  accidentalType: 'flats' },
  { root: 'Db', sharps: 0, flats: 5, accidentalCount: 5,  accidentalType: 'flats' },
];

/** Build a display label for a key signature, e.g., '2#', '3b', '0'. */
export function keySignatureLabel(key) {
  if (key.accidentalCount === 0) return '0';
  if (key.accidentalType === 'sharps') return key.accidentalCount + '#';
  return key.accidentalCount + 'b';
}

/** Find a key by its signature label (e.g., '2#' -> D major). */
export function keyBySignatureLabel(label) {
  return MAJOR_KEYS.find(k => keySignatureLabel(k) === label) || null;
}

// ---------------------------------------------------------------------------
// Diatonic chords (major key harmonization)
// ---------------------------------------------------------------------------

export const DIATONIC_CHORDS = [
  { degree: 1, numeral: 'I',     quality: 'major',      qualityLabel: '' },
  { degree: 2, numeral: 'ii',    quality: 'minor',      qualityLabel: 'm' },
  { degree: 3, numeral: 'iii',   quality: 'minor',      qualityLabel: 'm' },
  { degree: 4, numeral: 'IV',    quality: 'major',      qualityLabel: '' },
  { degree: 5, numeral: 'V',     quality: 'major',      qualityLabel: '' },
  { degree: 6, numeral: 'vi',    quality: 'minor',      qualityLabel: 'm' },
  { degree: 7, numeral: 'vii\u00B0', quality: 'diminished', qualityLabel: 'dim' },
];

export const ROMAN_NUMERALS = DIATONIC_CHORDS.map(c => c.numeral);

// ---------------------------------------------------------------------------
// Chord types and spelling
// ---------------------------------------------------------------------------

// Letter offset from root for each chord-tone label
const DEGREE_LETTER_OFFSETS = {
  'R': 0, '2': 1, 'b3': 2, '3': 2, '4': 3,
  'b5': 4, '5': 4, '#5': 4, '6': 5, 'b7': 6, '7': 6,
};

export const CHORD_TYPES = [
  { name: 'major',   symbol: '',      intervals: [0, 4, 7],      degrees: ['R', '3', '5'],  group: 0 },
  { name: 'minor',   symbol: 'm',     intervals: [0, 3, 7],      degrees: ['R', 'b3', '5'], group: 1 },
  { name: 'dom7',    symbol: '7',     intervals: [0, 4, 7, 10],  degrees: ['R', '3', '5', 'b7'], group: 2 },
  { name: 'maj7',    symbol: 'maj7',  intervals: [0, 4, 7, 11],  degrees: ['R', '3', '5', '7'],  group: 3 },
  { name: 'min7',    symbol: 'm7',    intervals: [0, 3, 7, 10],  degrees: ['R', 'b3', '5', 'b7'], group: 4 },
  { name: 'dim',     symbol: 'dim',   intervals: [0, 3, 6],      degrees: ['R', 'b3', 'b5'], group: 5 },
  { name: 'aug',     symbol: 'aug',   intervals: [0, 4, 8],      degrees: ['R', '3', '#5'],  group: 5 },
  { name: 'halfdim', symbol: 'm7b5',  intervals: [0, 3, 6, 10],  degrees: ['R', 'b3', 'b5', 'b7'], group: 5 },
  { name: 'sus2',    symbol: 'sus2',  intervals: [0, 2, 7],      degrees: ['R', '2', '5'],   group: 6 },
  { name: 'sus4',    symbol: 'sus4',  intervals: [0, 5, 7],      degrees: ['R', '4', '5'],   group: 6 },
  { name: '6',       symbol: '6',     intervals: [0, 4, 7, 9],   degrees: ['R', '3', '5', '6'], group: 6 },
];

/** Canonical root names for chord spelling (12 chromatic pitches). */
export const CHORD_ROOTS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

/**
 * Compute the correctly-spelled chord tones for a given root and chord type.
 * Returns array of spelled note names, e.g., ['C', 'Eb', 'G'] for Cm.
 */
export function getChordTones(rootName, chordType) {
  const root = parseSpelledNote(rootName);
  const rootLetterIdx = LETTER_NAMES.indexOf(root.letter);
  const rootSemitone = ((NATURAL_SEMITONES[root.letter] + root.accidental) % 12 + 12) % 12;

  return chordType.intervals.map((interval, i) => {
    const degreeLabel = chordType.degrees[i];
    const letterOffset = DEGREE_LETTER_OFFSETS[degreeLabel];
    const targetLetter = LETTER_NAMES[(rootLetterIdx + letterOffset) % 7];
    const targetSemitone = (rootSemitone + interval) % 12;
    const naturalSemitone = NATURAL_SEMITONES[targetLetter];

    let acc = ((targetSemitone - naturalSemitone + 12) % 12);
    if (acc > 6) acc -= 12;

    return spelledNoteName(targetLetter, acc);
  });
}

/** Build chord display name, e.g., 'Cm7', 'F#dim', 'Bbmaj7'. */
export function chordDisplayName(rootName, chordType) {
  return rootName + chordType.symbol;
}

/**
 * Check if a user input matches a spelled note exactly (strict enharmonic).
 * Matches case-insensitively but requires correct letter + accidental.
 */
export function spelledNoteMatchesInput(expectedName, input) {
  const expected = parseSpelledNote(expectedName);
  const given = parseSpelledNote(input);
  return given.letter.toUpperCase() === expected.letter.toUpperCase()
      && given.accidental === expected.accidental;
}

/**
 * Check if a user input matches a spelled note by semitone (lenient).
 * Used for button taps where user can't distinguish enharmonics.
 */
export function spelledNoteMatchesSemitone(expectedName, input) {
  return spelledNoteSemitone(expectedName) === spelledNoteSemitone(input);
}

// ---------------------------------------------------------------------------
// Instrument configurations
// ---------------------------------------------------------------------------

export const GUITAR = {
  id: 'fretboard',            // mode ID (preserved for backward compat)
  name: 'Guitar Fretboard',
  storageNamespace: 'fretboard',
  stringCount: 6,
  fretCount: 13,              // frets 0–12
  stringNames: ['e', 'B', 'G', 'D', 'A', 'E'],
  stringOffsets: [4, 11, 7, 2, 9, 4],   // semitones from C per string
  defaultString: 5,           // low E
  fretMarkers: [3, 5, 7, 9, 12],
};

export const UKULELE = {
  id: 'ukulele',
  name: 'Ukulele Fretboard',
  storageNamespace: 'ukulele',
  stringCount: 4,
  fretCount: 13,              // frets 0–12
  stringNames: ['A', 'E', 'C', 'G'],    // 1st (top) to 4th (bottom)
  stringOffsets: [9, 4, 0, 7],           // A=9, E=4, C=0, G=7
  defaultString: 2,           // C string (lowest pitch)
  fretMarkers: [3, 5, 7, 10, 12],
};

// Legacy exports (used by Speed Tap)
export const STRING_NAMES = GUITAR.stringNames;
export const STRING_OFFSETS = GUITAR.stringOffsets;

// ---------------------------------------------------------------------------
// Solfège notation
// ---------------------------------------------------------------------------

export const SOLFEGE_MAP = {
  C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si'
};

let _useSolfege = false;

/** Get current notation mode. */
export function getUseSolfege() { return _useSolfege; }

/** Set notation mode and persist to localStorage. */
export function setUseSolfege(v) {
  _useSolfege = v;
  try { localStorage.setItem('fretboard_notation', v ? 'solfege' : 'letter'); } catch (_) {}
}

// Load notation preference on module evaluation
try {
  _useSolfege = localStorage.getItem('fretboard_notation') === 'solfege';
} catch (_) {}

/**
 * Format a note name for display. Always replaces ASCII accidentals with
 * Unicode symbols (# → ♯, b → ♭). In solfège mode, also translates the
 * letter to a solfège syllable. Preserves case: lowercase input produces
 * lowercase output (e.g., "e" → "mi" for high-E string).
 */
export function displayNote(name) {
  if (!name) return name;
  const letter = name[0].toUpperCase();
  const acc = name.slice(1).replace(/#/g, '\u266F').replace(/b/g, '\u266D');
  if (!_useSolfege) {
    return name[0] + acc;
  }
  const syl = SOLFEGE_MAP[letter];
  if (!syl) return name[0] + acc;
  // Preserve case: lowercase input letter → lowercase solfège
  const out = name[0] === name[0].toLowerCase() ? syl.toLowerCase() : syl;
  return out + acc;
}

/**
 * Format a display-name pair like "C#/Db" → "C♯/D♭" (letter mode)
 * or "Do♯/Re♭" (solfège mode). Handles both single names and
 * slash-separated pairs.
 */
export function displayNotePair(displayName) {
  if (!displayName) return displayName;
  if (!displayName.includes('/')) return displayNote(displayName);
  const [s, f] = displayName.split('/');
  return displayNote(s) + '/' + displayNote(f);
}
