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
// Before/after contrast text — shown on skill cards and in the About tab.
// Inner-monologue style: shows what the thinking actually feels like.
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
      `7th fret, ${d('G')} string. Ok\u2026 open ${d('G')}, ${d('G#')}, ${
        d('A')
      }, ${d('A#')}, ${d('B')}, ${d('C')}, ${d('C#')}, ${
        d('D')
      }. Wait, was that seven frets? Let me count again.`,
    after: () => `7th fret, ${d('G')} string. ${d('D')}. Next.`,
  },
  ukulele: {
    before: () =>
      `5th fret, ${d('C')} string. ${d('C')}\u2026 ${d('C#')}, ${d('D')}, ${
        d('D#')
      }, ${d('E')}. That\u2019s five? ${d('E')}.`,
    after: () => `5th fret, ${d('C')} string. ${d('E')}.`,
  },
  speedTap: {
    before: () =>
      `All the ${d('C')}\u2019s. 8th fret low ${d('E')}, 3rd fret ${
        d('A')
      }\u2026 somewhere on the ${
        d('D')
      } string\u2026 I always forget the high strings.`,
    after: () => `All the ${d('C')}\u2019s. Tap tap tap tap tap tap. Done.`,
  },
  noteSemitones: {
    before: () =>
      `${d('G#')} as a number. ${d('C')} is 0, ${d('D')} is 2, ${
        d('E')
      } is 4, ${d('F')} is 5, ${d('G')} is 7\u2026 so ${
        d('G#')
      } is 8? I think.`,
    after: () => `${d('G#')}. 8.`,
  },
  intervalSemitones: {
    before: () =>
      'Major 6th in semitones. A perfect 5th is 7, I\u2019m pretty sure. So major 6th is\u2026 9?',
    after: () => 'M6. 9.',
  },
  semitoneMath: {
    before: () =>
      `${d('F#')} plus 4. So ${d('F#')}\u2026 ${d('G')}, ${d('G#')}, ${
        d('A')
      }, ${d('A#')}. That\u2019s four up. Is it ${d('A#')} or ${
        d('Bb')
      }? Same note, but which name?`,
    after: () => `${d('F#')} + 4. ${d('Bb')}.`,
  },
  intervalMath: {
    before: () =>
      `${d('C')} up a minor 6th. How many semitones is that\u2026 8? Ok, ${
        d('C')
      }, ${d('C#')}, ${d('D')}, ${d('D#')}, ${d('E')}, ${d('F')}, ${d('F#')}, ${
        d('G')
      }, ${d('Ab')}. Was that right?`,
    after: () => `${d('C')} + m6. ${d('Ab')}.`,
  },
  keySignatures: {
    before: () =>
      `4 flats. Second from the end is ${d('Ab')}, so\u2026 ${
        d('Ab')
      } major. Or is it the relative minor? What was the rule for that again?`,
    after: () =>
      `4 flats. ${d('Ab')} major / ${d('F')} minor. IV chord is ${
        d('Db')
      } major. Keep going.`,
  },
  scaleDegrees: {
    before: () =>
      `5th degree of ${d('Bb')}. ${d('Bb')} is one, ${d('C')} is two, ${
        d('D')
      } is three, ${d('Eb')} is four, ${d('F')} is five. ${d('F')}. I think.`,
    after: () => `5th of ${d('Bb')}. ${d('F')}.`,
  },
  diatonicChords: {
    before: () =>
      `IV in ${d('G')} major. ${d('G')}, ${d('A')}, ${d('B')}, ${d('C')}. So ${
        d('C')
      }. And the IV is always major in a major key? I think so.`,
    after: () => `IV in ${d('G')}. ${d('C')} major.`,
  },
  chordSpelling: {
    before: () =>
      `${d('F')}m7. Root is ${d('F')}, minor third is ${d('Ab')}, fifth is ${
        d('C')
      }. The 7th\u2026 it\u2019s a minor 7th, so\u2026 ${d('Eb')}.`,
    after: () => `${d('F')}m7. ${d('F')} ${d('Ab')} ${d('C')} ${d('Eb')}.`,
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
