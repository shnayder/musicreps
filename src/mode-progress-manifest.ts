// Mode progress manifest: lightweight registry mapping each mode ID to the
// metadata needed for home screen progress computation.

import { GUITAR, UKULELE } from './music-data.ts';
import {
  ALL_ITEMS as KEY_SIG_ITEMS,
  ALL_KEY_GROUPS,
  getItemIdsForGroup as keySigGroup,
} from './modes/key-signatures/logic.ts';
import {
  ALL_ITEMS as SCALE_DEG_ITEMS,
  DEGREE_GROUPS as SCALE_DEGREE_GROUPS,
  getItemIdsForGroup as scaleDegGroup,
} from './modes/scale-degrees/logic.ts';
import {
  ALL_ITEMS as DIATONIC_ITEMS,
  CHORD_GROUPS,
  getItemIdsForGroup as diatonicGroup,
} from './modes/diatonic-chords/logic.ts';
import {
  ALL_ITEMS as SEMI_MATH_ITEMS,
  DISTANCE_GROUPS as SEMI_DISTANCE_GROUPS,
  getItemIdsForGroup as semiMathGroup,
} from './modes/semitone-math/logic.ts';
import {
  ALL_ITEMS as INT_MATH_ITEMS,
  DISTANCE_GROUPS as INT_DISTANCE_GROUPS,
  getItemIdsForGroup as intMathGroup,
} from './modes/interval-math/logic.ts';
import {
  ALL_ITEMS as CHORD_SPELL_ITEMS,
  getItemIdsForGroup as chordSpellGroup,
  SPELLING_GROUPS,
} from './modes/chord-spelling/logic.ts';
import {
  getAllItems as fretboardAllItems,
  getGroups as fretboardGetGroups,
  getItemIdsForGroup as fretboardGroup,
} from './modes/fretboard/logic.ts';
import { ALL_ITEMS as NOTE_SEMI_ITEMS } from './modes/note-semitones/logic.ts';
import { ALL_ITEMS as INT_SEMI_ITEMS } from './modes/interval-semitones/logic.ts';
import { ALL_ITEMS as SPEED_TAP_ITEMS } from './modes/speed-tap/logic.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModeProgressEntry = {
  modeId: string;
  namespace: string;
  groups: Array<{
    label: string;
    longLabel?: string;
    getItemIds: () => string[];
  }>;
  allItemIds: () => string[];
};

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

function buildGroupEntries(
  groups: { label: string; longLabel?: string }[],
  getIds: (i: number) => string[],
): Array<{ label: string; longLabel?: string; getItemIds: () => string[] }> {
  return groups.map((g, i) => ({
    label: g.label,
    longLabel: g.longLabel,
    getItemIds: () => getIds(i),
  }));
}

const guitarGroups = fretboardGetGroups(GUITAR);
const ukuleleGroups = fretboardGetGroups(UKULELE);

export const MODE_PROGRESS_MANIFEST: ModeProgressEntry[] = [
  {
    modeId: 'fretboard',
    namespace: 'fretboard',
    groups: guitarGroups.map((g, i) => ({
      label: g.label(),
      longLabel: g.longLabel,
      getItemIds: () => fretboardGroup(GUITAR, i),
    })),
    allItemIds: () => fretboardAllItems(GUITAR),
  },
  {
    modeId: 'ukulele',
    namespace: 'ukulele',
    groups: ukuleleGroups.map((g, i) => ({
      label: g.label(),
      longLabel: g.longLabel,
      getItemIds: () => fretboardGroup(UKULELE, i),
    })),
    allItemIds: () => fretboardAllItems(UKULELE),
  },
  {
    modeId: 'noteSemitones',
    namespace: 'noteSemitones',
    groups: [{ label: 'All', getItemIds: () => NOTE_SEMI_ITEMS }],
    allItemIds: () => NOTE_SEMI_ITEMS,
  },
  {
    modeId: 'intervalSemitones',
    namespace: 'intervalSemitones',
    groups: [{ label: 'All', getItemIds: () => INT_SEMI_ITEMS }],
    allItemIds: () => INT_SEMI_ITEMS,
  },
  {
    modeId: 'semitoneMath',
    namespace: 'semitoneMath',
    groups: buildGroupEntries(SEMI_DISTANCE_GROUPS, semiMathGroup),
    allItemIds: () => SEMI_MATH_ITEMS,
  },
  {
    modeId: 'intervalMath',
    namespace: 'intervalMath',
    groups: buildGroupEntries(INT_DISTANCE_GROUPS, intMathGroup),
    allItemIds: () => INT_MATH_ITEMS,
  },
  {
    modeId: 'keySignatures',
    namespace: 'keySignatures',
    groups: buildGroupEntries(ALL_KEY_GROUPS, keySigGroup),
    allItemIds: () => KEY_SIG_ITEMS,
  },
  {
    modeId: 'scaleDegrees',
    namespace: 'scaleDegrees',
    groups: buildGroupEntries(SCALE_DEGREE_GROUPS, scaleDegGroup),
    allItemIds: () => SCALE_DEG_ITEMS,
  },
  {
    modeId: 'diatonicChords',
    namespace: 'diatonicChords',
    groups: buildGroupEntries(CHORD_GROUPS, diatonicGroup),
    allItemIds: () => DIATONIC_ITEMS,
  },
  {
    modeId: 'chordSpelling',
    namespace: 'chordSpelling',
    groups: buildGroupEntries(SPELLING_GROUPS, chordSpellGroup),
    allItemIds: () => CHORD_SPELL_ITEMS,
  },
  {
    modeId: 'speedTap',
    namespace: 'speedTap',
    groups: [{ label: 'All', getItemIds: () => SPEED_TAP_ITEMS }],
    allItemIds: () => SPEED_TAP_ITEMS,
  },
];

/** Look up a mode's progress entry by ID. */
export function getModeProgress(
  modeId: string,
): ModeProgressEntry | undefined {
  return MODE_PROGRESS_MANIFEST.find((e) => e.modeId === modeId);
}
