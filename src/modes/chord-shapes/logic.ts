// Pure logic for Chord Shapes mode.
// No DOM, no hooks — just data in, data out.
// Items: chord voicings on guitar or ukulele fretboard.
// Multi-tap response: user taps all played positions of a chord shape.

import type { MultiTapEvalResult } from '../../declarative/types.ts';
import { displayNote } from '../../music-data.ts';
import {
  type ChordVoicing,
  getVoicings,
  type StringAction,
} from './voicings.ts';

// ---------------------------------------------------------------------------
// Position helpers
// ---------------------------------------------------------------------------

/** Convert a string index + fret to a position key matching InteractiveFretboard. */
export function positionKey(string: number, fret: number): string {
  return string + '-' + fret;
}

/** Get all played (non-muted) positions for a voicing as position keys. */
export function getPlayedPositions(v: ChordVoicing): string[] {
  const positions: string[] = [];
  for (let s = 0; s < v.strings.length; s++) {
    const fret = v.strings[s];
    if (fret !== 'x') {
      positions.push(positionKey(s, fret));
    }
  }
  return positions;
}

/** Get string indices that are muted in a voicing. */
export function getMutedStrings(v: ChordVoicing): number[] {
  const muted: number[] = [];
  for (let s = 0; s < v.strings.length; s++) {
    if (v.strings[s] === 'x') muted.push(s);
  }
  return muted;
}

// ---------------------------------------------------------------------------
// Item ID + Question
// ---------------------------------------------------------------------------

export type Question = {
  root: string;
  quality: string;
  displayName: string;
  voicing: ChordVoicing;
  playedPositions: string[];
  mutedStrings: number[];
};

/** Build item ID from a voicing. Format: "root:quality" */
export function itemId(v: ChordVoicing): string {
  return v.root + ':' + v.quality;
}

/** Parse an item ID back to a Question for a given instrument. */
export function parseItem(
  instrument: 'guitar' | 'ukulele',
  id: string,
): Question {
  const voicing = findVoicing(instrument, id);
  return buildQuestion(voicing);
}

function findVoicing(
  instrument: 'guitar' | 'ukulele',
  id: string,
): ChordVoicing {
  const voicings = getVoicings(instrument);
  const v = voicings.find((v) => itemId(v) === id);
  if (!v) throw new Error('Unknown chord voicing: ' + id);
  return v;
}

function buildQuestion(v: ChordVoicing): Question {
  return {
    root: v.root,
    quality: v.quality,
    displayName: chordDisplayName(v),
    voicing: v,
    playedPositions: getPlayedPositions(v),
    mutedStrings: getMutedStrings(v),
  };
}

/** Display name for a chord: "C", "Am", "G7". */
export function chordDisplayName(v: ChordVoicing): string {
  return displayNote(v.root) + v.symbol;
}

// ---------------------------------------------------------------------------
// All items for a given instrument
// ---------------------------------------------------------------------------

export function allItems(instrument: 'guitar' | 'ukulele'): string[] {
  const out: string[] = [];
  for (const q of ALL_GROUP_IDS) {
    out.push(...getItemIdsForGroup(instrument, q));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Multi-tap evaluation
// ---------------------------------------------------------------------------

export function evaluate(
  q: Question,
  tapped: string[],
): MultiTapEvalResult {
  const targetSet = new Set(q.playedPositions);
  const tappedSet = new Set(tapped);
  const perEntry = tapped.map((pos) => ({
    positionKey: pos,
    correct: targetSet.has(pos),
  }));
  const missed = [...targetSet].filter((t) => !tappedSet.has(t));
  const correct = perEntry.every((e) => e.correct) && missed.length === 0;
  return {
    correct,
    correctAnswer: q.displayName,
    perEntry,
    missed,
  };
}

// ---------------------------------------------------------------------------
// Voicing summary for stats display
// ---------------------------------------------------------------------------

/** Format a voicing as a compact fret string: "x32010" */
export function voicingSummary(strings: StringAction[]): string {
  return [...strings].reverse().map((s) => s === 'x' ? 'x' : String(s))
    .join('');
}

// ---------------------------------------------------------------------------
// Group definitions
// ---------------------------------------------------------------------------

export const QUALITY_GROUPS = [
  { id: 'major', label: 'Major', longLabel: 'Major chords' },
  { id: 'minor', label: 'Minor', longLabel: 'Minor chords' },
  { id: 'dom7', label: '7th', longLabel: 'Dominant 7th chords' },
];

export const ALL_GROUP_IDS: string[] = QUALITY_GROUPS.map((g) => g.id);

/**
 * Circle-of-fifths root order for sorting chord voicings within a quality
 * group. Uses enharmonic spellings present in the hardcoded voicings
 * (Bb, not A#).
 */
const CHORD_SHAPE_ROOT_ORDER: Record<string, number> = Object.fromEntries(
  ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F']
    .map((r, i) => [r, i]),
);

export function getItemIdsForGroup(
  instrument: 'guitar' | 'ukulele',
  groupId: string,
): string[] {
  const voicings = getVoicings(instrument).filter((v) => v.quality === groupId);
  voicings.sort((a, b) =>
    (CHORD_SHAPE_ROOT_ORDER[a.root] ?? 99) -
    (CHORD_SHAPE_ROOT_ORDER[b.root] ?? 99)
  );
  return voicings.map(itemId);
}

export function formatGroupLabel(enabledGroups: ReadonlySet<string>): string {
  if (enabledGroups.size === 3) return 'all chords';
  const labels: string[] = [];
  if (enabledGroups.has('major')) labels.push('major');
  if (enabledGroups.has('minor')) labels.push('minor');
  if (enabledGroups.has('dom7')) labels.push('7th');
  return labels.join(' & ');
}
