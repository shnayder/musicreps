// Canonical list of all skill definitions. Shared by app.ts (registration)
// and skill-progress-manifest.ts (home screen progress). Add new skills here.

import type { SkillDefinition } from './declarative/types.ts';
import { GUITAR, UKULELE } from './music-data.ts';

import { createFretboardDef } from './skills/fretboard/definition.tsx';
import { NOTE_SEMITONES_DEF } from './skills/note-semitones/definition.ts';
import {
  INTERVAL_SEMITONES_DEF,
} from './skills/interval-semitones/definition.ts';
import { SEMITONE_MATH_DEF } from './skills/semitone-math/definition.ts';
import { INTERVAL_MATH_DEF } from './skills/interval-math/definition.ts';
import { KEY_SIGNATURES_DEF } from './skills/key-signatures/definition.ts';
import { SCALE_DEGREES_DEF } from './skills/scale-degrees/definition.ts';
import { DIATONIC_CHORDS_DEF } from './skills/diatonic-chords/definition.ts';
import { CHORD_SPELLING_DEF } from './skills/chord-spelling/definition.ts';
import { createSpeedTapDef } from './skills/speed-tap/definition.tsx';
import {
  GUITAR_CHORD_SHAPES_DEF,
  UKULELE_CHORD_SHAPES_DEF,
} from './skills/chord-shapes/definition.tsx';

// deno-lint-ignore no-explicit-any
export const ALL_SKILL_DEFINITIONS: SkillDefinition<any>[] = [
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
  createSpeedTapDef(GUITAR),
  createSpeedTapDef(UKULELE),
  GUITAR_CHORD_SHAPES_DEF,
  UKULELE_CHORD_SHAPES_DEF,
];
