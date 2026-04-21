// Pure logic for fretboard modes (guitar, ukulele).
// Group definitions, item ID generation, question/answer checking.
// Parameterized by Instrument for multi-instrument reuse.

import type { Instrument } from '../../types.ts';
import { NATURAL_NOTES, noteMatchesInput, NOTES } from '../../music-data.ts';
import { createFretboardHelpers } from '../../quiz-fretboard-state.ts';
import type { QuestionContext } from '../../declarative/types.ts';

// ---------------------------------------------------------------------------
// Group definition types
// ---------------------------------------------------------------------------

export type FretboardLevel = {
  id: string;
  label: () => string;
  longLabel: () => string;
  frets: [number, number]; // [startFret, endFret] inclusive
  noteFilter: 'natural' | 'sharps-flats';
};

// ---------------------------------------------------------------------------
// Fret-based groups (shared across instruments)
// ---------------------------------------------------------------------------

function fretLabel(start: number, end: number): string {
  return 'Frets ' + start + '\u2013' + end;
}

const FRET_LEVELS: FretboardLevel[] = [
  {
    id: 'frets-0-3-natural',
    label: () => fretLabel(0, 3),
    longLabel: () => fretLabel(0, 3) + ' naturals',
    frets: [0, 3],
    noteFilter: 'natural',
  },
  {
    id: 'frets-0-3-sharps',
    label: () => fretLabel(0, 3) + '\u00A0\u266F/\u266D',
    longLabel: () => fretLabel(0, 3) + '\u00A0\u266F/\u266D',
    frets: [0, 3],
    noteFilter: 'sharps-flats',
  },
  {
    id: 'frets-4-8-natural',
    label: () => fretLabel(4, 8),
    longLabel: () => fretLabel(4, 8) + ' naturals',
    frets: [4, 8],
    noteFilter: 'natural',
  },
  {
    id: 'frets-4-8-sharps',
    label: () => fretLabel(4, 8) + '\u00A0\u266F/\u266D',
    longLabel: () => fretLabel(4, 8) + '\u00A0\u266F/\u266D',
    frets: [4, 8],
    noteFilter: 'sharps-flats',
  },
  {
    id: 'frets-9-12-natural',
    label: () => fretLabel(9, 12),
    longLabel: () => fretLabel(9, 12) + ' naturals',
    frets: [9, 12],
    noteFilter: 'natural',
  },
  {
    id: 'frets-9-12-sharps',
    label: () => fretLabel(9, 12) + '\u00A0\u266F/\u266D',
    longLabel: () => fretLabel(9, 12) + '\u00A0\u266F/\u266D',
    frets: [9, 12],
    noteFilter: 'sharps-flats',
  },
];

export function getLevels(_instrument: Instrument): FretboardLevel[] {
  return FRET_LEVELS;
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
export function getItemIdsForLevel(
  instrument: Instrument,
  levelId: string,
): string[] {
  const groups = getLevels(instrument);
  const group = groups.find((g) => g.id === levelId);
  if (!group) return [];
  const fb = getHelpers(instrument);
  return fb.getItemIdsForFretRange(
    group.frets[0],
    group.frets[1],
    group.noteFilter,
    instrument.stringCount,
  );
}

/** All item IDs for an instrument, ordered fret ascending, string low→high. */
export function getAllItems(instrument: Instrument): string[] {
  const items: string[] = [];
  for (let f = 0; f < instrument.fretCount; f++) {
    for (let s = instrument.stringCount - 1; s >= 0; s--) {
      items.push(s + '-' + f);
    }
  }
  return items;
}

/** All group IDs for the instrument. */
export function getAllLevelIds(instrument: Instrument): string[] {
  return getLevels(instrument).map((g) => g.id);
}

// ---------------------------------------------------------------------------
// Question / answer
// ---------------------------------------------------------------------------

export type Question = {
  currentString: number;
  currentFret: number;
  currentNote: string;
  /** Per-round spelling preference for accidentals (flats when true). */
  useFlats: boolean;
};

export function getQuestion(
  instrument: Instrument,
  itemId: string,
  ctx?: QuestionContext,
): Question {
  const fb = getHelpers(instrument);
  const base = fb.parseFretboardItem(itemId);
  return { ...base, useFlats: ctx?.useFlats ?? false };
}

// ---------------------------------------------------------------------------
// Label formatting
// ---------------------------------------------------------------------------

export function formatLabel(
  instrument: Instrument,
  enabledGroups: ReadonlySet<string>,
): string {
  const groups = getLevels(instrument);
  if (enabledGroups.size === groups.length) return 'all groups';
  // Preserve group order by iterating in definition order
  const labels = groups
    .filter((g) => enabledGroups.has(g.id))
    .map((g) => g.label());
  return labels.join(', ');
}
