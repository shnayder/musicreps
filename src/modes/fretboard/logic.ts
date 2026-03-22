// Pure logic for fretboard modes (guitar, ukulele).
// Group definitions, item ID generation, question/answer checking.
// Parameterized by Instrument for multi-instrument reuse.

import type { Instrument } from '../../types.ts';
import {
  displayNote,
  NATURAL_NOTES,
  noteMatchesInput,
  NOTES,
} from '../../music-data.ts';
import { createFretboardHelpers } from '../../quiz-fretboard-state.ts';

// ---------------------------------------------------------------------------
// Group definition types
// ---------------------------------------------------------------------------

export type FretboardGroup = {
  label: () => string;
  strings: number[];
  noteFilter: 'natural' | 'sharps-flats';
};

// ---------------------------------------------------------------------------
// Guitar groups
// ---------------------------------------------------------------------------

// String indices: 0=e, 1=B, 2=G, 3=D, 4=A, 5=E (high to low)

const GUITAR_GROUPS: FretboardGroup[] = [
  // Naturals by string (E and e combined since same notes)
  {
    label: () => `${displayNote('E')} ${displayNote('e')}`,
    strings: [5, 0],
    noteFilter: 'natural',
  },
  { label: () => displayNote('A'), strings: [4], noteFilter: 'natural' },
  { label: () => displayNote('D'), strings: [3], noteFilter: 'natural' },
  { label: () => displayNote('G'), strings: [2], noteFilter: 'natural' },
  { label: () => displayNote('B'), strings: [1], noteFilter: 'natural' },
  // Accidentals by string pair
  {
    label: () => `${displayNote('E')} ${displayNote('A')} \u266F\u266D`,
    strings: [5, 4],
    noteFilter: 'sharps-flats',
  },
  {
    label: () => `${displayNote('D')} ${displayNote('G')} \u266F\u266D`,
    strings: [3, 2],
    noteFilter: 'sharps-flats',
  },
  {
    label: () => `${displayNote('B')} ${displayNote('e')} \u266F\u266D`,
    strings: [1, 0],
    noteFilter: 'sharps-flats',
  },
];

// ---------------------------------------------------------------------------
// Ukulele groups
// ---------------------------------------------------------------------------

// String indices: 0=A, 1=E, 2=C, 3=G

const UKULELE_GROUPS: FretboardGroup[] = [
  // Naturals by string
  { label: () => displayNote('G'), strings: [3], noteFilter: 'natural' },
  { label: () => displayNote('C'), strings: [2], noteFilter: 'natural' },
  { label: () => displayNote('E'), strings: [1], noteFilter: 'natural' },
  { label: () => displayNote('A'), strings: [0], noteFilter: 'natural' },
  // Accidentals by string pair
  {
    label: () => `${displayNote('G')} ${displayNote('C')} \u266F\u266D`,
    strings: [3, 2],
    noteFilter: 'sharps-flats',
  },
  {
    label: () => `${displayNote('E')} ${displayNote('A')} \u266F\u266D`,
    strings: [1, 0],
    noteFilter: 'sharps-flats',
  },
];

// ---------------------------------------------------------------------------
// Instrument → groups mapping
// ---------------------------------------------------------------------------

const GROUPS_BY_INSTRUMENT: Record<string, FretboardGroup[]> = {
  fretboard: GUITAR_GROUPS,
  ukulele: UKULELE_GROUPS,
};

export function getGroups(instrument: Instrument): FretboardGroup[] {
  return GROUPS_BY_INSTRUMENT[instrument.id] ?? GUITAR_GROUPS;
}

// ---------------------------------------------------------------------------
// Item ID generation
// ---------------------------------------------------------------------------

const helpersCache = new Map<
  string,
  ReturnType<typeof createFretboardHelpers>
>();

function getHelpers(
  instrument: Instrument,
): ReturnType<typeof createFretboardHelpers> {
  let h = helpersCache.get(instrument.id);
  if (!h) {
    h = createFretboardHelpers({
      notes: NOTES,
      naturalNotes: NATURAL_NOTES,
      stringOffsets: instrument.stringOffsets,
      fretCount: instrument.fretCount,
      noteMatchesInput,
    });
    helpersCache.set(instrument.id, h);
  }
  return h;
}

/** Get all item IDs belonging to a group for the given instrument. */
export function getItemIdsForGroup(
  instrument: Instrument,
  groupIndex: number,
): string[] {
  const groups = getGroups(instrument);
  const group = groups[groupIndex];
  if (!group) return [];
  const fb = getHelpers(instrument);
  const items: string[] = [];
  for (const s of group.strings) {
    items.push(...fb.getItemIdsForString(s, group.noteFilter));
  }
  return items;
}

/** All item IDs for an instrument (all strings, all frets). */
export function getAllItems(instrument: Instrument): string[] {
  const items: string[] = [];
  for (let s = 0; s < instrument.stringCount; s++) {
    for (let f = 0; f < instrument.fretCount; f++) {
      items.push(s + '-' + f);
    }
  }
  return items;
}

/** All group indices for the instrument. */
export function getAllGroupIndices(instrument: Instrument): number[] {
  return getGroups(instrument).map((_, i) => i);
}

// ---------------------------------------------------------------------------
// Question / answer
// ---------------------------------------------------------------------------

export type Question = {
  currentString: number;
  currentFret: number;
  currentNote: string;
};

export function getQuestion(
  instrument: Instrument,
  itemId: string,
): Question {
  const fb = getHelpers(instrument);
  return fb.parseFretboardItem(itemId);
}

// ---------------------------------------------------------------------------
// Label formatting
// ---------------------------------------------------------------------------

export function formatLabel(
  instrument: Instrument,
  enabledGroups: ReadonlySet<number>,
): string {
  const groups = getGroups(instrument);
  if (enabledGroups.size === groups.length) return 'all groups';
  const labels = Array.from(enabledGroups)
    .sort((a, b) => a - b)
    .map((i) => {
      const g = groups[i];
      if (!g) return String(i);
      return typeof g.label === 'function' ? g.label() : g.label;
    });
  return labels.join(', ');
}
