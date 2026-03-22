// Mode display catalog: product/UI strings for all quiz modes.
// Separated from music-data.ts, which should only contain music theory data.
//
// Contains: mode names, descriptions, before/after contrast text, and
// track definitions for the home screen.

import { displayNote } from './music-data.ts';

// ---------------------------------------------------------------------------
// Mode descriptions — shown on home screen buttons and practice tab headers.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Centralized display names for all modes.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Before/after contrast text — shown on skill cards to communicate value.
// Functions so that displayNote() is called at render time, respecting the
// current solfège setting.
// ---------------------------------------------------------------------------

const d = displayNote; // short alias for readability below
export const MODE_BEFORE_AFTER: Record<
  string,
  { before: () => string; after: () => string }
> = {
  fretboard: {
    before: () =>
      `\u201C7th fret, ${d('G')} string\u2026 ${d('G')}, ${d('G#')}, ${
        d('A')
      }\u2026 ${d('D')}?\u201D`,
    after: () => `\u201C7th fret, ${d('G')} string. ${d('D')}.\u201D`,
  },
  ukulele: {
    before: () =>
      `\u201C5th fret, ${d('C')} string\u2026 ${d('C')}, ${d('D')}, ${
        d('E')
      }\u2026 ${d('E')}?\u201D`,
    after: () => `\u201C5th fret, ${d('C')} string. ${d('E')}.\u201D`,
  },
  speedTap: {
    before: () =>
      `\u201CAll the ${d('C')}\u2019s\u2026 8th fret ${d('E')}, 3rd fret ${
        d('A')
      }\u2026 um\u2026\u201D`,
    after: () => `\u201C${d('C')}\u2019s. 8, 3, 10, 5, 1, 8.\u201D`,
  },
  noteSemitones: {
    before: () =>
      `\u201C${d('G#')}\u2026 ${d('F')} is 5, so ${d('G')} is\u2026 7, so ${
        d('G#')
      } is 8.\u201D`,
    after: () => `\u201C${d('G#')}. 8.\u201D`,
  },
  intervalSemitones: {
    before: () =>
      '\u201CMajor 6th\u2026 P5 is 7, so M6 is\u2026 9 semitones?\u201D',
    after: () => '\u201CM6. 9 semitones.\u201D',
  },
  semitoneMath: {
    before: () =>
      `\u201C${d('F#')} + 4\u2026 ${d('G')}, ${d('G#')}, ${d('A')}, ${
        d('A#')
      }\u2026 is that ${d('Bb')}?\u201D`,
    after: () => `\u201C${d('F#')} + 4. ${d('Bb')}.\u201D`,
  },
  intervalMath: {
    before: () =>
      `\u201C${d('C')} + m6\u2026 minor 6th is 8 semitones\u2026 ${
        d('Ab')
      }?\u201D`,
    after: () => `\u201C${d('C')} + m6. ${d('Ab')}.\u201D`,
  },
  keySignatures: {
    before: () =>
      `\u201C3 flats\u2026 ${d('Bb')}, ${d('Eb')}, ${d('Ab')}\u2026 so ${
        d('Eb')
      } major?\u201D`,
    after: () => `\u201C3 flats: ${d('Eb')} major.\u201D`,
  },
  scaleDegrees: {
    before: () =>
      `\u201C5th degree of ${d('Bb')}\u2026 ${d('Bb')}, ${d('C')}, ${d('D')}, ${
        d('Eb')
      }, ${d('F')}\u2026 ${d('F')}?\u201D`,
    after: () => `\u201C5th of ${d('Bb')}. ${d('F')}.\u201D`,
  },
  diatonicChords: {
    before: () =>
      `\u201CIV in ${d('G')}\u2026 ${d('G')}, ${d('A')}, ${d('B')}, ${
        d('C')
      }\u2026 so ${d('C')} major?\u201D`,
    after: () => `\u201CIV in ${d('G')}. ${d('C')} major.\u201D`,
  },
  chordSpelling: {
    before: () =>
      `\u201C${d('F')}m7\u2026 ${d('F')}, ${d('Ab')}, ${
        d('C')
      }\u2026 what\u2019s the 7th\u2026 ${d('Eb')}\u201D`,
    after: () =>
      `\u201C${d('F')}m7. ${d('F')} ${d('Ab')} ${d('C')} ${d('Eb')}.\u201D`,
  },
};

// ---------------------------------------------------------------------------
// Track definitions — interest-based skill groups for the home screen.
// ---------------------------------------------------------------------------

export type Track = {
  id: string;
  label: string;
  skills: string[];
};

export const TRACKS: Track[] = [
  {
    id: 'core',
    label: 'Music theory',
    skills: [
      'noteSemitones',
      'intervalSemitones',
      'semitoneMath',
      'intervalMath',
      'scaleDegrees',
      'diatonicChords',
      'chordSpelling',
    ],
  },
  {
    id: 'reading',
    label: 'Reading music',
    skills: ['keySignatures'],
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
