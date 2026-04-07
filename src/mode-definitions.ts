// Canonical list of all mode definitions. Shared by app.ts (registration)
// and mode-progress-manifest.ts (home screen progress). Add new modes here.

import type { ModeDefinition } from './declarative/types.ts';
import { GUITAR, UKULELE } from './music-data.ts';

import { createFretboardDef } from './modes/fretboard/definition.tsx';
import { NOTE_SEMITONES_DEF } from './modes/note-semitones/definition.ts';
import {
  INTERVAL_SEMITONES_DEF,
} from './modes/interval-semitones/definition.ts';
import { SEMITONE_MATH_DEF } from './modes/semitone-math/definition.ts';
import { INTERVAL_MATH_DEF } from './modes/interval-math/definition.ts';
import { KEY_SIGNATURES_DEF } from './modes/key-signatures/definition.ts';
import { SCALE_DEGREES_DEF } from './modes/scale-degrees/definition.ts';
import { DIATONIC_CHORDS_DEF } from './modes/diatonic-chords/definition.ts';
import { CHORD_SPELLING_DEF } from './modes/chord-spelling/definition.ts';
import { SPEED_TAP_DEF } from './modes/speed-tap/definition.tsx';
import {
  GUITAR_CHORD_SHAPES_DEF,
  UKULELE_CHORD_SHAPES_DEF,
} from './modes/chord-shapes/definition.tsx';

// deno-lint-ignore no-explicit-any
export const ALL_MODE_DEFINITIONS: ModeDefinition<any>[] = [
  createFretboardDef(GUITAR),
  createFretboardDef(UKULELE),
  NOTE_SEMITONES_DEF,
  INTERVAL_SEMITONES_DEF,
  SEMITONE_MATH_DEF,
  INTERVAL_MATH_DEF,
  KEY_SIGNATURES_DEF,
  SCALE_DEGREES_DEF,
  DIATONIC_CHORDS_DEF,
  CHORD_SPELLING_DEF,
  SPEED_TAP_DEF,
  GUITAR_CHORD_SHAPES_DEF,
  UKULELE_CHORD_SHAPES_DEF,
];
