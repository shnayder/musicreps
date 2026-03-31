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
  id: string;
  label: () => string;
  longLabel: () => string;
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
    id: 'e-natural',
    label: () => displayNote('E') + ' strings',
    longLabel: () => 'High & low ' + displayNote('E') + ' strings',
    strings: [5, 0],
    noteFilter: 'natural',
  },
  {
    id: 'a-natural',
    label: () => displayNote('A') + ' string',
    longLabel: () => displayNote('A') + ' string',
    strings: [4],
    noteFilter: 'natural',
  },
  {
    id: 'd-natural',
    label: () => displayNote('D') + ' string',
    longLabel: () => displayNote('D') + ' string',
    strings: [3],
    noteFilter: 'natural',
  },
  {
    id: 'g-natural',
    label: () => displayNote('G') + ' string',
    longLabel: () => displayNote('G') + ' string',
    strings: [2],
    noteFilter: 'natural',
  },
  {
    id: 'b-natural',
    label: () => displayNote('B') + ' string',
    longLabel: () => displayNote('B') + ' string',
    strings: [1],
    noteFilter: 'natural',
  },
  // Accidentals by string pair
  {
    id: 'e-sharps',
    label: () => displayNote('E') + ' \u266F/\u266D',
    longLabel: () => displayNote('E') + ' strings \u266F/\u266D',
    strings: [5, 0],
    noteFilter: 'sharps-flats',
  },
  {
    id: 'ad-sharps',
    label: () => displayNote('A') + ' ' + displayNote('D') + ' \u266F/\u266D',
    longLabel: () =>
      displayNote('A') + ' & ' + displayNote('D') + ' strings \u266F/\u266D',
    strings: [4, 3],
    noteFilter: 'sharps-flats',
  },
  {
    id: 'gb-sharps',
    label: () => displayNote('G') + ' ' + displayNote('B') + ' \u266F/\u266D',
    longLabel: () =>
      displayNote('G') + ' & ' + displayNote('B') + ' strings \u266F/\u266D',
    strings: [2, 1],
    noteFilter: 'sharps-flats',
  },
];

// ---------------------------------------------------------------------------
// Ukulele groups
// ---------------------------------------------------------------------------

// String indices: 0=A, 1=E, 2=C, 3=G

const UKULELE_GROUPS: FretboardGroup[] = [
  // Naturals by string
  {
    id: 'g-natural',
    label: () => displayNote('G') + ' string',
    longLabel: () => displayNote('G') + ' string',
    strings: [3],
    noteFilter: 'natural',
  },
  {
    id: 'c-natural',
    label: () => displayNote('C') + ' string',
    longLabel: () => displayNote('C') + ' string',
    strings: [2],
    noteFilter: 'natural',
  },
  {
    id: 'e-natural',
    label: () => displayNote('E') + ' string',
    longLabel: () => displayNote('E') + ' string',
    strings: [1],
    noteFilter: 'natural',
  },
  {
    id: 'a-natural',
    label: () => displayNote('A') + ' string',
    longLabel: () => displayNote('A') + ' string',
    strings: [0],
    noteFilter: 'natural',
  },
  // Accidentals by string pair
  {
    id: 'gc-sharps',
    label: () => displayNote('G') + ' ' + displayNote('C') + ' \u266F/\u266D',
    longLabel: () =>
      displayNote('G') + ' & ' + displayNote('C') + ' strings \u266F/\u266D',
    strings: [3, 2],
    noteFilter: 'sharps-flats',
  },
  {
    id: 'ea-sharps',
    label: () => displayNote('E') + ' ' + displayNote('A') + ' \u266F/\u266D',
    longLabel: () =>
      displayNote('E') + ' & ' + displayNote('A') + ' strings \u266F/\u266D',
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
  groupId: string,
): string[] {
  const groups = getGroups(instrument);
  const group = groups.find((g) => g.id === groupId);
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

/** All group IDs for the instrument. */
export function getAllGroupIds(instrument: Instrument): string[] {
  return getGroups(instrument).map((g) => g.id);
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
  enabledGroups: ReadonlySet<string>,
): string {
  const groups = getGroups(instrument);
  if (enabledGroups.size === groups.length) return 'all groups';
  // Preserve group order by iterating in definition order
  const labels = groups
    .filter((g) => enabledGroups.has(g.id))
    .map((g) => g.label());
  return labels.join(', ');
}
