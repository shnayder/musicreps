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
  fretboard: 'Name any fret instantly',
  ukulele: 'Name any fret instantly',
  speedTap: 'Instantly find every position of any note',
  noteSemitones: 'Convert between notes and semitone numbers instantly',
  intervalSemitones: 'Know the semitone size of any interval instantly',
  semitoneMath: 'Add and subtract semitones from any note',
  intervalMath: 'Move up and down by any interval from any note',
  keySignatures: 'Instantly know the sharps and flats in any key',
  scaleDegrees: 'Know every scale degree in every key',
  diatonicChords: 'Know every chord in every key',
  chordSpelling: 'Instantly spell the notes in any chord',
};

// ---------------------------------------------------------------------------
// About-tab descriptions — longer explanation of what the skill is and why
// it matters. Shown only on the About tab, not the home screen.
// ---------------------------------------------------------------------------

export const MODE_ABOUT_DESCRIPTIONS: Record<string, string> = {
  fretboard:
    'You can get far on guitar without knowing note names \u2014 shapes, tab, ' +
    'and fret numbers go a long way. Knowing the notes unlocks the next level: ' +
    'finding your bearings when someone calls a key at a jam, building chord ' +
    'voicings anywhere on the neck, moving a riff to a new position, or ' +
    'understanding what makes that chord you stumbled on actually work. ' +
    'A musician who knows their instrument can do things that someone who ' +
    'memorized patterns can\u2019t. This skill builds instant recall for every ' +
    'note on every fret.',
  ukulele:
    'You can get far on ukulele without knowing note names \u2014 shapes, tab, ' +
    'and fret numbers go a long way. Knowing the notes unlocks the next level: ' +
    'finding your bearings when someone calls a key at a jam, building chord ' +
    'voicings anywhere on the neck, moving a riff to a new position, or ' +
    'understanding what makes that chord you stumbled on actually work. ' +
    'A musician who knows their instrument can do things that someone who ' +
    'memorized patterns can\u2019t. This skill builds instant recall for every ' +
    'note on every fret.',
  speedTap:
    'Speed Tap complements the fretboard learning skill, teaching you to find ' +
    'every instance of a note on the neck. This lets you move between ' +
    'positions fluidly \u2014 jump to a higher octave, find a bass note, or ' +
    'play a chord wherever your hand happens to be.',
  noteSemitones:
    'The 12 notes of the chromatic scale can each be numbered by their ' +
    'distance from C in semitones: C is 0, C\u266F is 1, D is 2, all the way ' +
    'up to B at 11. This mapping is the foundation of all interval and ' +
    'transposition math. For example, to find a perfect 5th above E: E is 4, ' +
    'a fifth is 7 semitones, 4 + 7 = 11, and 11 is B. When you know these ' +
    'numbers cold, that whole chain becomes instant \u2014 and so does every ' +
    'skill that builds on it, from interval math to chord spelling.',
  intervalSemitones:
    'Intervals are a core building block of music, and each interval ' +
    'corresponds to a number of semitones. A major 3rd is 4 semitones, a ' +
    'perfect 5th is 7, and so on. Making this mapping automatic makes ' +
    'transposition and chord building much easier. When you can convert ' +
    'instantly in both directions, you stop translating and start thinking ' +
    'in intervals directly.',
  semitoneMath:
    'Adding and subtracting semitones from notes is the fundamental ' +
    'arithmetic of music. It\u2019s how you build chords (a major triad is ' +
    'root, +4, +3), navigate the fretboard (each fret is one semitone), ' +
    'apply scale formulas, and transpose. This skill makes that arithmetic ' +
    'automatic, so you can work through any of these without counting note ' +
    'by note.',
  intervalMath:
    'Interval Math is the named-interval version of Semitone Math. Instead ' +
    'of \u201CC + 4 semitones,\u201D you work with \u201CC up a major ' +
    '3rd\u201D \u2014 the way musicians actually talk. This is what you\u2019re ' +
    'doing when you harmonize a melody, find a chord tone, or figure out what ' +
    'note is a tritone away from where you are. Making it automatic means you ' +
    'can think in musical terms without an intermediate translation step.',
  keySignatures:
    'Key signatures tell you which notes are sharped or flatted in a key ' +
    '\u2014 they\u2019re the first thing you see on a piece of sheet music. ' +
    'Automatically going from \u201C2 sharps\u201D to \u201CD maj/B min\u201D ' +
    'lets you start playing without pausing to decode the key, identify the ' +
    'scale and likely chords, and follow along when someone says ' +
    '\u201Clet\u2019s play in E\u266D.\u201D This skill drills both ' +
    'directions: key to signature and signature to key.',
  scaleDegrees:
    'Scale degrees are how musicians reference notes within a key \u2014 ' +
    '\u201Cthe 5th of B\u266D\u201D or \u201Cplay the 3rd.\u201D They show ' +
    'up everywhere: in chord charts, in Nashville numbering, in conversations ' +
    'about harmony. When this mapping is automatic, you can hear \u201Cgo to ' +
    'the 6th\u201D and know the note instantly in whatever key you\u2019re ' +
    'in, without counting up from the root.',
  diatonicChords:
    'Every major key has seven chords built on its scale degrees \u2014 the ' +
    'I is major, the ii is minor, the V is major, and so on. This is the ' +
    'framework behind chord progressions: a I\u2013V\u2013vi\u2013IV in any ' +
    'key is the same pattern, just different notes. When you know the ' +
    'diatonic chords for every key, you can follow a chart written in Roman ' +
    'numerals, predict what chords fit in a song, and transpose progressions ' +
    'between keys without working them out from scratch.',
  chordSpelling:
    'Chord spelling is knowing the actual notes in a chord \u2014 Dm7 is D, ' +
    'F, A, C. Whether you\u2019re voicing chords on an instrument, arranging ' +
    'for other players, or analyzing a song, you need to go from a chord ' +
    'symbol to its notes. Most musicians work this out by stacking intervals ' +
    'each time. This skill makes it automatic: see the chord, know the ' +
    'notes. Builds on Interval Math.',
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
