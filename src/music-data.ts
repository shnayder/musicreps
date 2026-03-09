// Shared music theory data: notes, intervals, and helpers.
// Used by all quiz modes. This is an ES module — main.ts strips
// "export" keywords for browser inlining (same pattern as adaptive.js).

import type {
  ChordType,
  DiatonicChord,
  Instrument,
  Interval,
  MajorKey,
  Note,
} from './types.ts';

export const NOTES: Note[] = [
  { name: 'C', displayName: 'C', num: 0, accepts: ['c'] },
  { name: 'C#', displayName: 'C#/Db', num: 1, accepts: ['c#', 'db'] },
  { name: 'D', displayName: 'D', num: 2, accepts: ['d'] },
  { name: 'D#', displayName: 'D#/Eb', num: 3, accepts: ['d#', 'eb'] },
  { name: 'E', displayName: 'E', num: 4, accepts: ['e'] },
  { name: 'F', displayName: 'F', num: 5, accepts: ['f'] },
  { name: 'F#', displayName: 'F#/Gb', num: 6, accepts: ['f#', 'gb'] },
  { name: 'G', displayName: 'G', num: 7, accepts: ['g'] },
  { name: 'G#', displayName: 'G#/Ab', num: 8, accepts: ['g#', 'ab'] },
  { name: 'A', displayName: 'A', num: 9, accepts: ['a'] },
  { name: 'A#', displayName: 'A#/Bb', num: 10, accepts: ['a#', 'bb'] },
  { name: 'B', displayName: 'B', num: 11, accepts: ['b'] },
];

export const NATURAL_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
export const NOTE_NAMES = NOTES.map((n) => n.name);
export const ACCIDENTAL_NAMES = NOTE_NAMES.filter((n) => n.includes('#'));

export const INTERVALS: Interval[] = [
  { name: 'minor 2nd', num: 1, abbrev: 'm2' },
  { name: 'Major 2nd', num: 2, abbrev: 'M2' },
  { name: 'minor 3rd', num: 3, abbrev: 'm3' },
  { name: 'Major 3rd', num: 4, abbrev: 'M3' },
  { name: 'Perfect 4th', num: 5, abbrev: 'P4' },
  { name: 'Tritone', num: 6, abbrev: 'TT', altAbbrevs: ['A4', 'd5'] },
  { name: 'Perfect 5th', num: 7, abbrev: 'P5' },
  { name: 'minor 6th', num: 8, abbrev: 'm6' },
  { name: 'Major 6th', num: 9, abbrev: 'M6' },
  { name: 'minor 7th', num: 10, abbrev: 'm7' },
  { name: 'Major 7th', num: 11, abbrev: 'M7' },
  { name: 'Octave', num: 12, abbrev: 'P8' },
];
export const INTERVAL_ABBREVS = INTERVALS.map((i) => i.abbrev);

// Mode descriptions — shown on home screen buttons and practice tab headers.
export const MODE_DESCRIPTIONS: Record<string, string> = {
  fretboard: 'Stop hunting for notes on the fretboard',
  ukulele: 'Stop hunting for notes on the fretboard',
  speedTap: 'Know all positions of a note instantly',
  noteSemitones: 'The number system behind the chromatic scale',
  intervalSemitones: 'Know the size of every interval in semitones',
  semitoneMath: 'Transpose by semitones without counting',
  intervalMath: 'Transpose by interval without counting',
  keySignatures: 'See a key, know its sharps and flats instantly',
  scaleDegrees: 'Connect notes to their function in a key',
  diatonicChords: 'Know which chords belong in any key',
  chordSpelling: 'Know the notes in any chord',
};

// Centralized display names for all modes.
export const MODE_NAMES: Record<string, string> = {
  fretboard: 'Guitar Fretboard',
  ukulele: 'Ukulele Fretboard',
  speedTap: 'Speed Tap',
  noteSemitones: 'Note \u2194 Semitones',
  intervalSemitones: 'Interval \u2194 Semitones',
  semitoneMath: 'Semitone Math',
  intervalMath: 'Interval Math',
  keySignatures: 'Key Signatures',
  scaleDegrees: 'Scale Degrees',
  diatonicChords: 'Diatonic Chords',
  chordSpelling: 'Chord Spelling',
};

// Before/after contrast text — shown on skill cards to communicate value.
export const MODE_BEFORE_AFTER: Record<
  string,
  { before: string; after: string }
> = {
  fretboard: {
    before: '\u201C7th fret, G string\u2026 G, G#, A\u2026 D?\u201D',
    after: '\u201C7th fret, G string. D.\u201D',
  },
  ukulele: {
    before: '\u201C5th fret, C string\u2026 C, D, E\u2026 E?\u201D',
    after: '\u201C5th fret, C string. E.\u201D',
  },
  speedTap: {
    before:
      '\u201CAll the C\u2019s\u2026 8th fret E, 3rd fret A\u2026 um\u2026\u201D',
    after: '\u201CC\u2019s. 8, 3, 10, 5, 1, 8.\u201D',
  },
  noteSemitones: {
    before: '\u201CG#\u2026 F is 5, so G is\u2026 7, so G# is 8.\u201D',
    after: '\u201CG#. 8.\u201D',
  },
  intervalSemitones: {
    before: '\u201CMajor 6th\u2026 P5 is 7, so M6 is\u2026 9 semitones?\u201D',
    after: '\u201CM6. 9 semitones.\u201D',
  },
  semitoneMath: {
    before: '\u201CF# + 4\u2026 G, G#, A, A#\u2026 is that Bb?\u201D',
    after: '\u201CF# + 4. Bb.\u201D',
  },
  intervalMath: {
    before: '\u201CC + m6\u2026 minor 6th is 8 semitones\u2026 Ab?\u201D',
    after: '\u201CC + m6. Ab.\u201D',
  },
  keySignatures: {
    before: '\u201C3 flats\u2026 Bb, Eb, Ab\u2026 so Eb major?\u201D',
    after: '\u201C3 flats: Eb major.\u201D',
  },
  scaleDegrees: {
    before: '\u201C5th degree of Bb\u2026 Bb, C, D, Eb, F\u2026 F?\u201D',
    after: '\u201C5th of Bb. F.\u201D',
  },
  diatonicChords: {
    before: '\u201CIV in G\u2026 G, A, B, C\u2026 so C major?\u201D',
    after: '\u201CIV in G. C major.\u201D',
  },
  chordSpelling: {
    before: '\u201CFm7\u2026 F, Ab, C\u2026 what\u2019s the 7th\u2026 Eb\u201D',
    after: '\u201CFm7. F Ab C Eb.\u201D',
  },
};

// Track definitions — interest-based skill groups for the home screen.
export type Track = {
  id: string;
  label: string;
  alwaysSelected?: boolean;
  skills: string[];
};

export const TRACKS: Track[] = [
  {
    id: 'core',
    label: 'Core',
    alwaysSelected: true,
    skills: [
      'noteSemitones',
      'intervalSemitones',
      'semitoneMath',
      'intervalMath',
      'keySignatures',
      'scaleDegrees',
      'diatonicChords',
      'chordSpelling',
    ],
  },
  {
    id: 'guitar',
    label: 'Guitar',
    skills: ['fretboard', 'speedTap'],
  },
  {
    id: 'ukulele',
    label: 'Ukulele',
    skills: ['ukulele'],
  },
];

/** Look up a note by its semitone number (0–11). */
export function noteByNum(num: number) {
  return NOTES[((num % 12) + 12) % 12];
}

/** Look up an interval by its semitone count (1–12). */
export function intervalByNum(num: number) {
  return INTERVALS.find((i) => i.num === num) || null;
}

/** Add semitones to a note number, wrapping at 12. Returns the result note. */
export function noteAdd(noteNum: number, semitones: number) {
  return noteByNum(noteNum + semitones);
}

/** Subtract semitones from a note number, wrapping at 12. Returns the result note. */
export function noteSub(noteNum: number, semitones: number) {
  return noteByNum(noteNum - semitones);
}

/** Pick a single accidental spelling from a displayName like 'C#/Db'. */
export function pickAccidentalName(displayName: string, useFlats: boolean) {
  if (!displayName.includes('/')) return displayName;
  const [sharp, flat] = displayName.split('/');
  return useFlats ? flat : sharp;
}

/** Randomly pick one enharmonic spelling from a displayName like 'C#/Db'. */
export function pickRandomAccidental(displayName: string) {
  if (!displayName.includes('/')) return displayName;
  const [sharp, flat] = displayName.split('/');
  return Math.random() < 0.5 ? sharp : flat;
}

/** Whether a root/key name uses flat accidentals (e.g. "Bb", "Eb", "Db"). */
export function rootUsesFlats(rootName: string) {
  return rootName.length > 1 && rootName[1] === 'b';
}

/** Check if a user input matches any accepted answer for a note.
 *  Accepts 's' as alias for '#' (e.g. "Cs" = "C#", "fs" = "f#"). */
export function noteMatchesInput(note: Note, input: string) {
  const lower = input.toLowerCase();
  if (note.accepts.includes(lower)) return true;
  // Try 's' → '#' substitution (e.g. "cs" → "c#")
  if (lower.endsWith('s') && lower.length === 2) {
    return note.accepts.includes(lower[0] + '#');
  }
  return false;
}

/** All strings a user could type that represent a note name.
 *  Built from NOTES.accepts plus 's' sharp alias (e.g. "cs" for "c#"). */
const VALID_NOTE_INPUTS: ReadonlySet<string> = new Set(
  NOTES.flatMap((n) => {
    const inputs = [...n.accepts];
    // Add 's' alias for each sharp accept (e.g. "c#" → "cs")
    for (const a of n.accepts) {
      if (a.endsWith('#')) inputs.push(a.slice(0, -1) + 's');
    }
    return inputs;
  }),
);

/** Check if input is a valid note name (case-insensitive). */
export function isValidNoteInput(input: string): boolean {
  return VALID_NOTE_INPUTS.has(input.toLowerCase());
}

/** Check if input is a valid integer in [min, max]. */
export function isValidNumberInput(
  input: string,
  min: number,
  max: number,
): boolean {
  if (!/^\d{1,2}$/.test(input)) return false;
  const n = parseInt(input, 10);
  return n >= min && n <= max;
}

/** All valid interval abbreviations, derived from INTERVALS data. */
const VALID_INTERVAL_INPUTS: ReadonlySet<string> = new Set(
  INTERVALS.flatMap((i) => [i.abbrev, ...(i.altAbbrevs || [])]),
);

/** Check if input is a valid interval abbreviation (case-sensitive). */
export function isValidIntervalInput(input: string): boolean {
  return VALID_INTERVAL_INPUTS.has(input);
}

/** Valid key signature labels, derived from MAJOR_KEYS at module init. */
let VALID_KEYSIG_INPUTS: ReadonlySet<string>;

function getValidKeysigInputs(): ReadonlySet<string> {
  if (!VALID_KEYSIG_INPUTS) {
    VALID_KEYSIG_INPUTS = new Set(MAJOR_KEYS.map((k) => keySignatureLabel(k)));
  }
  return VALID_KEYSIG_INPUTS;
}

/** Check if input is a valid key signature label. */
export function isValidKeysigInput(input: string): boolean {
  return getValidKeysigInputs().has(input);
}

/** Valid Roman numeral inputs, derived from DIATONIC_CHORDS. */
let VALID_NUMERAL_INPUTS: ReadonlySet<string>;

function getValidNumeralInputs(): ReadonlySet<string> {
  if (!VALID_NUMERAL_INPUTS) {
    VALID_NUMERAL_INPUTS = new Set(DIATONIC_CHORDS.map((c) => c.numeral));
  }
  return VALID_NUMERAL_INPUTS;
}

/** Check if input is a valid Roman numeral. */
export function isValidNumeralInput(input: string): boolean {
  return getValidNumeralInputs().has(input);
}

/** Check if a user input matches an interval abbreviation (case-sensitive). */
export function intervalMatchesInput(interval: Interval, input: string) {
  if (input === interval.abbrev) return true;
  if (interval.altAbbrevs && interval.altAbbrevs.includes(input)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Letter-name arithmetic (for scale degrees, chord spelling, key sigs)
// ---------------------------------------------------------------------------

export const LETTER_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
export const NATURAL_SEMITONES: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};
export const MAJOR_SCALE_STEPS = [0, 2, 4, 5, 7, 9, 11]; // cumulative semitones per degree

/** Parse a spelled note name like 'F#', 'Bb', 'Ebb' into { letter, accidental }. */
export function parseSpelledNote(name: string) {
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
export function spelledNoteName(letter: string, accidental: number) {
  if (accidental === 0) return letter;
  if (accidental > 0) return letter + '#'.repeat(accidental);
  return letter + 'b'.repeat(-accidental);
}

/** Get the semitone value (0-11) of a spelled note. */
export function spelledNoteSemitone(name: string) {
  const { letter, accidental } = parseSpelledNote(name);
  return (((NATURAL_SEMITONES[letter] + accidental) % 12) + 12) % 12;
}

/**
 * Get the note name for a scale degree in a major key.
 * keyRoot: e.g., 'D', 'Bb', 'F#'. degree: 1-7 (1 = root).
 * Returns spelled note name, e.g., 'F#', 'Eb'.
 */
export function getScaleDegreeNote(keyRoot: string, degree: number) {
  const root = parseSpelledNote(keyRoot);
  const rootLetterIdx = LETTER_NAMES.indexOf(root.letter);
  const rootSemitone =
    (((NATURAL_SEMITONES[root.letter] + root.accidental) % 12) + 12) % 12;

  const targetLetterIdx = (rootLetterIdx + degree - 1) % 7;
  const targetLetter = LETTER_NAMES[targetLetterIdx];
  const targetSemitone = (rootSemitone + MAJOR_SCALE_STEPS[degree - 1]) % 12;
  const naturalSemitone = NATURAL_SEMITONES[targetLetter];

  let acc = (targetSemitone - naturalSemitone + 12) % 12;
  if (acc > 6) acc -= 12;

  return spelledNoteName(targetLetter, acc);
}

/**
 * Reverse lookup: given a key and a note, find which degree (1-7) it is.
 * Returns the degree number, or 0 if the note isn't in the scale.
 */
export function findScaleDegree(keyRoot: string, noteName: string) {
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

export const MAJOR_KEYS: MajorKey[] = [
  {
    root: 'C',
    sharps: 0,
    flats: 0,
    accidentalCount: 0,
    accidentalType: 'none',
  },
  {
    root: 'G',
    sharps: 1,
    flats: 0,
    accidentalCount: 1,
    accidentalType: 'sharps',
  },
  {
    root: 'D',
    sharps: 2,
    flats: 0,
    accidentalCount: 2,
    accidentalType: 'sharps',
  },
  {
    root: 'A',
    sharps: 3,
    flats: 0,
    accidentalCount: 3,
    accidentalType: 'sharps',
  },
  {
    root: 'E',
    sharps: 4,
    flats: 0,
    accidentalCount: 4,
    accidentalType: 'sharps',
  },
  {
    root: 'B',
    sharps: 5,
    flats: 0,
    accidentalCount: 5,
    accidentalType: 'sharps',
  },
  {
    root: 'F#',
    sharps: 6,
    flats: 0,
    accidentalCount: 6,
    accidentalType: 'sharps',
  },
  {
    root: 'F',
    sharps: 0,
    flats: 1,
    accidentalCount: 1,
    accidentalType: 'flats',
  },
  {
    root: 'Bb',
    sharps: 0,
    flats: 2,
    accidentalCount: 2,
    accidentalType: 'flats',
  },
  {
    root: 'Eb',
    sharps: 0,
    flats: 3,
    accidentalCount: 3,
    accidentalType: 'flats',
  },
  {
    root: 'Ab',
    sharps: 0,
    flats: 4,
    accidentalCount: 4,
    accidentalType: 'flats',
  },
  {
    root: 'Db',
    sharps: 0,
    flats: 5,
    accidentalCount: 5,
    accidentalType: 'flats',
  },
];

/** Build a display label for a key signature, e.g., '2#', '3b', '0'. */
export function keySignatureLabel(key: MajorKey) {
  if (key.accidentalCount === 0) return '0';
  if (key.accidentalType === 'sharps') return key.accidentalCount + '#';
  return key.accidentalCount + 'b';
}

/** All 15 key-signature labels (0 through 7 sharps/flats). Includes
 *  enharmonic signatures (7#, 6b, 7b) not in MAJOR_KEYS. */
export const KEYSIG_LABELS = [
  '0',
  '1#',
  '2#',
  '3#',
  '4#',
  '5#',
  '6#',
  '7#',
  '1b',
  '2b',
  '3b',
  '4b',
  '5b',
  '6b',
  '7b',
];

/** Find a key by its signature label (e.g., '2#' -> D major). */
export function keyBySignatureLabel(label: string) {
  return MAJOR_KEYS.find((k) => keySignatureLabel(k) === label) || null;
}

// ---------------------------------------------------------------------------
// Diatonic chords (major key harmonization)
// ---------------------------------------------------------------------------

export const DIATONIC_CHORDS: DiatonicChord[] = [
  { degree: 1, numeral: 'I', quality: 'major', qualityLabel: '' },
  { degree: 2, numeral: 'ii', quality: 'minor', qualityLabel: 'm' },
  { degree: 3, numeral: 'iii', quality: 'minor', qualityLabel: 'm' },
  { degree: 4, numeral: 'IV', quality: 'major', qualityLabel: '' },
  { degree: 5, numeral: 'V', quality: 'major', qualityLabel: '' },
  { degree: 6, numeral: 'vi', quality: 'minor', qualityLabel: 'm' },
  {
    degree: 7,
    numeral: 'vii\u00B0',
    quality: 'diminished',
    qualityLabel: 'dim',
  },
];

export const ROMAN_NUMERALS = DIATONIC_CHORDS.map((c) => c.numeral);
export const DEGREE_LABELS: [string, string][] = [
  ['2', '2nd'],
  ['3', '3rd'],
  ['4', '4th'],
  ['5', '5th'],
  ['6', '6th'],
  ['7', '7th'],
];

// ---------------------------------------------------------------------------
// Chord types and spelling
// ---------------------------------------------------------------------------

// Letter offset from root for each chord-tone label
const DEGREE_LETTER_OFFSETS: Record<string, number> = {
  R: 0,
  '2': 1,
  b3: 2,
  '3': 2,
  '4': 3,
  b5: 4,
  '5': 4,
  '#5': 4,
  '6': 5,
  b7: 6,
  '7': 6,
};

export const CHORD_TYPES: ChordType[] = [
  {
    name: 'major',
    symbol: '',
    intervals: [0, 4, 7],
    degrees: ['R', '3', '5'],
    group: 0,
  },
  {
    name: 'minor',
    symbol: 'm',
    intervals: [0, 3, 7],
    degrees: ['R', 'b3', '5'],
    group: 1,
  },
  {
    name: 'dom7',
    symbol: '7',
    intervals: [0, 4, 7, 10],
    degrees: ['R', '3', '5', 'b7'],
    group: 2,
  },
  {
    name: 'maj7',
    symbol: 'maj7',
    intervals: [0, 4, 7, 11],
    degrees: ['R', '3', '5', '7'],
    group: 3,
  },
  {
    name: 'min7',
    symbol: 'm7',
    intervals: [0, 3, 7, 10],
    degrees: ['R', 'b3', '5', 'b7'],
    group: 4,
  },
  {
    name: 'dim',
    symbol: 'dim',
    intervals: [0, 3, 6],
    degrees: ['R', 'b3', 'b5'],
    group: 5,
  },
  {
    name: 'aug',
    symbol: 'aug',
    intervals: [0, 4, 8],
    degrees: ['R', '3', '#5'],
    group: 5,
  },
  {
    name: 'halfdim',
    symbol: 'm7b5',
    intervals: [0, 3, 6, 10],
    degrees: ['R', 'b3', 'b5', 'b7'],
    group: 5,
  },
  {
    name: 'sus2',
    symbol: 'sus2',
    intervals: [0, 2, 7],
    degrees: ['R', '2', '5'],
    group: 6,
  },
  {
    name: 'sus4',
    symbol: 'sus4',
    intervals: [0, 5, 7],
    degrees: ['R', '4', '5'],
    group: 6,
  },
  {
    name: '6',
    symbol: '6',
    intervals: [0, 4, 7, 9],
    degrees: ['R', '3', '5', '6'],
    group: 6,
  },
];

/** Canonical root names for chord spelling (12 chromatic pitches). */
export const CHORD_ROOTS = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'F#',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
];

/**
 * Compute the correctly-spelled chord tones for a given root and chord type.
 * Returns array of spelled note names, e.g., ['C', 'Eb', 'G'] for Cm.
 */
export function getChordTones(rootName: string, chordType: ChordType) {
  const root = parseSpelledNote(rootName);
  const rootLetterIdx = LETTER_NAMES.indexOf(root.letter);
  const rootSemitone =
    (((NATURAL_SEMITONES[root.letter] + root.accidental) % 12) + 12) % 12;

  return chordType.intervals.map((interval: number, i: number) => {
    const degreeLabel = chordType.degrees[i];
    const letterOffset = DEGREE_LETTER_OFFSETS[degreeLabel];
    const targetLetter = LETTER_NAMES[(rootLetterIdx + letterOffset) % 7];
    const targetSemitone = (rootSemitone + interval) % 12;
    const naturalSemitone = NATURAL_SEMITONES[targetLetter];

    let acc = (targetSemitone - naturalSemitone + 12) % 12;
    if (acc > 6) acc -= 12;

    return spelledNoteName(targetLetter, acc);
  });
}

/** Build chord display name, e.g., 'Cm7', 'F#dim', 'Bbmaj7'. */
export function chordDisplayName(rootName: string, chordType: ChordType) {
  return rootName + chordType.symbol;
}

/**
 * Check if a user input matches a spelled note exactly (strict enharmonic).
 * Matches case-insensitively but requires correct letter + accidental.
 */
export function spelledNoteMatchesInput(expectedName: string, input: string) {
  const expected = parseSpelledNote(expectedName);
  const given = parseSpelledNote(input);
  return (
    given.letter.toUpperCase() === expected.letter.toUpperCase() &&
    given.accidental === expected.accidental
  );
}

/**
 * Check if a user input matches a spelled note by semitone (lenient).
 * Used for button taps where user can't distinguish enharmonics.
 */
export function spelledNoteMatchesSemitone(
  expectedName: string,
  input: string,
) {
  return spelledNoteSemitone(expectedName) === spelledNoteSemitone(input);
}

// ---------------------------------------------------------------------------
// Instrument configurations
// ---------------------------------------------------------------------------

export const GUITAR: Instrument = {
  id: 'fretboard', // mode ID (preserved for backward compat)
  name: 'Guitar Fretboard',
  storageNamespace: 'fretboard',
  stringCount: 6,
  fretCount: 13, // frets 0–12
  stringNames: ['e', 'B', 'G', 'D', 'A', 'E'],
  stringOffsets: [4, 11, 7, 2, 9, 4], // semitones from C per string
  defaultString: 5, // low E
  fretMarkers: [3, 5, 7, 9, 12],
};

export const UKULELE: Instrument = {
  id: 'ukulele',
  name: 'Ukulele Fretboard',
  storageNamespace: 'ukulele',
  stringCount: 4,
  fretCount: 13, // frets 0–12
  stringNames: ['A', 'E', 'C', 'G'], // 1st (top) to 4th (bottom)
  stringOffsets: [9, 4, 0, 7], // A=9, E=4, C=0, G=7
  defaultString: 2, // C string (lowest pitch)
  fretMarkers: [3, 5, 7, 10, 12],
};

// Legacy exports (used by Speed Tap)
export const STRING_NAMES = GUITAR.stringNames;
export const STRING_OFFSETS = GUITAR.stringOffsets;

// ---------------------------------------------------------------------------
// Solfège notation
// ---------------------------------------------------------------------------

export const SOLFEGE_MAP: Record<string, string> = {
  C: 'Do',
  D: 'Re',
  E: 'Mi',
  F: 'Fa',
  G: 'Sol',
  A: 'La',
  B: 'Si',
};

let _useSolfege = false;

/** Get current notation mode. */
export function getUseSolfege() {
  return _useSolfege;
}

/** Set notation mode and persist to localStorage. */
export function setUseSolfege(v: boolean) {
  _useSolfege = v;
  try {
    localStorage.setItem('fretboard_notation', v ? 'solfege' : 'letter');
  } catch (_) {
    /* expected */
  }
}

// Load notation preference on module evaluation
try {
  _useSolfege = localStorage.getItem('fretboard_notation') === 'solfege';
} catch (_) {
  /* expected */
}

/**
 * Format a note name for display. Always replaces ASCII accidentals with
 * Unicode symbols (# → ♯, b → ♭). In solfège mode, also translates the
 * letter to a solfège syllable. Preserves case: lowercase input produces
 * lowercase output (e.g., "e" → "mi" for high-E string).
 */
export function displayNote(name: string) {
  if (!name) return name;
  const letter = name[0].toUpperCase();
  // \u266F = ♯ (sharp), \u266D = ♭ (flat)
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
export function displayNotePair(displayName: string) {
  if (!displayName) return displayName;
  if (!displayName.includes('/')) return displayNote(displayName);
  const [s, f] = displayName.split('/');
  return displayNote(s) + '/' + displayNote(f);
}
