// Mode progress manifest: derived from ModeDefinition objects.
// No manual maintenance — adding a mode definition automatically includes it.

import { GUITAR, UKULELE } from './music-data.ts';
import type { ModeDefinition, ScopeDef } from './declarative/types.ts';

import { NOTE_SEMITONES_DEF } from './modes/note-semitones/definition.ts';
import { INTERVAL_SEMITONES_DEF } from './modes/interval-semitones/definition.ts';
import { SEMITONE_MATH_DEF } from './modes/semitone-math/definition.ts';
import { INTERVAL_MATH_DEF } from './modes/interval-math/definition.ts';
import { KEY_SIGNATURES_DEF } from './modes/key-signatures/definition.ts';
import { SCALE_DEGREES_DEF } from './modes/scale-degrees/definition.ts';
import { DIATONIC_CHORDS_DEF } from './modes/diatonic-chords/definition.ts';
import { createFretboardDef } from './modes/fretboard/definition.tsx';
import { CHORD_SPELLING_DEF } from './modes/chord-spelling/definition.ts';
import { SPEED_TAP_DEF } from './modes/speed-tap/definition.tsx';
import {
  GUITAR_CHORD_SHAPES_DEF,
  UKULELE_CHORD_SHAPES_DEF,
} from './modes/chord-shapes/definition.tsx';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModeProgressEntry = {
  modeId: string;
  namespace: string;
  groups: Array<{
    id: string;
    label: string | (() => string);
    longLabel?: string | (() => string);
    getItemIds: () => string[];
  }>;
  allItemIds: () => string[];
};

// ---------------------------------------------------------------------------
// Derivation from ModeDefinition
// ---------------------------------------------------------------------------

/** Build a manifest entry from any ModeDefinition. */
// deno-lint-ignore no-explicit-any
function entryFromDef(def: ModeDefinition<any>): ModeProgressEntry {
  const scope: ScopeDef = def.scope;
  return {
    modeId: def.id,
    namespace: def.namespace,
    groups: scope.kind === 'groups'
      ? scope.groups.map((g) => ({
        id: g.id,
        label: g.label,
        longLabel: g.longLabel,
        getItemIds: () => scope.getItemIdsForGroup(g.id),
      }))
      : [{ id: 'all', label: 'All', getItemIds: () => def.allItems }],
    allItemIds: () => def.allItems,
  };
}

// ---------------------------------------------------------------------------
// All mode definitions — single source of truth
// ---------------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
const ALL_DEFINITIONS: ModeDefinition<any>[] = [
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

// ---------------------------------------------------------------------------
// Manifest (auto-derived)
// ---------------------------------------------------------------------------

export const MODE_PROGRESS_MANIFEST: ModeProgressEntry[] = ALL_DEFINITIONS.map(
  entryFromDef,
);

/** Look up a mode's progress entry by ID. */
export function getModeProgress(
  modeId: string,
): ModeProgressEntry | undefined {
  return MODE_PROGRESS_MANIFEST.find((e) => e.modeId === modeId);
}
