// Pure logic for Key Signatures mode.
// No DOM, no hooks — just data in, data out.
// Bidirectional: forward (key → signature), reverse (signature → key root).

import type { StatsTableRow } from '../../types.ts';
import {
  displayNote,
  keySignatureLabel,
  MAJOR_KEYS,
  spelledNoteMatchesSemitone,
} from '../../music-data.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Key groups for scope selection, ordered by difficulty. */
// Labels use: \u266D = ♭ (flat), \u266F = ♯ (sharp)
export const KEY_GROUPS = [
  { keys: ['C', 'G', 'F'], label: 'C G F' },
  { keys: ['D', 'Bb'], label: 'D B\u266D' },
  { keys: ['A', 'Eb'], label: 'A E\u266D' },
  { keys: ['E', 'Ab'], label: 'E A\u266D' },
  { keys: ['B', 'Db', 'F#'], label: 'B D\u266D F\u266F' },
];

/**
 * Get all item IDs belonging to a key group.
 *
 * @example getItemIdsForGroup(0) → ["C:fwd","C:rev","G:fwd","G:rev","F:fwd","F:rev"]
 */
export function getItemIdsForGroup(groupIndex: number): string[] {
  const roots = KEY_GROUPS[groupIndex].keys;
  const items: string[] = [];
  for (const root of roots) {
    items.push(root + ':fwd');
    items.push(root + ':rev');
  }
  return items;
}

/** All 24 item IDs: 12 keys × 2 directions (fwd + rev). */
export const ALL_ITEMS: string[] = [];
for (const key of MAJOR_KEYS) {
  ALL_ITEMS.push(key.root + ':fwd');
  ALL_ITEMS.push(key.root + ':rev');
}

export const ALL_GROUP_INDICES = KEY_GROUPS.map((_, i) => i);

// ---------------------------------------------------------------------------
// Question
// ---------------------------------------------------------------------------

export type Question = {
  root: string;
  dir: 'fwd' | 'rev';
  sigLabel: string;
};

/**
 * Parse an item ID and generate a question for the quiz engine.
 *
 * @example getQuestion("D:fwd") → { root: "D", dir: "fwd", sigLabel: "2#" }
 * @example getQuestion("Eb:rev") → { root: "Eb", dir: "rev", sigLabel: "3b" }
 */
export function getQuestion(itemId: string): Question {
  const [rootName, dir] = itemId.split(':');
  const key = MAJOR_KEYS.find((k) => k.root === rootName)!;
  return {
    root: key.root,
    dir: dir as 'fwd' | 'rev',
    sigLabel: keySignatureLabel(key),
  };
}

// ---------------------------------------------------------------------------
// Answer checking
// ---------------------------------------------------------------------------

/**
 * Check the user's answer against the expected answer.
 *
 * Forward: user enters a signature label (e.g. "2#", "3b", "0").
 *   Correct if it matches keySignatureLabel(key).
 * Reverse: user enters a note name (the key root).
 *   Correct if the spelled note matches the key root's semitone.
 */
export function checkAnswer(
  q: Question,
  input: string,
): { correct: boolean; correctAnswer: string } {
  const key = MAJOR_KEYS.find((k) => k.root === q.root)!;
  if (q.dir === 'fwd') {
    const expected = keySignatureLabel(key);
    return { correct: input === expected, correctAnswer: expected };
  }
  const correct = spelledNoteMatchesSemitone(q.root, input);
  return { correct, correctAnswer: displayNote(q.root) };
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

/**
 * Build stats table rows for the progress tab.
 * One row per key, with fwd/rev item IDs.
 */
export function getStatsRows(): StatsTableRow[] {
  return MAJOR_KEYS.map((key) => ({
    label: displayNote(key.root) + ' major',
    sublabel: keySignatureLabel(key),
    _colHeader: 'Key',
    fwdItemId: key.root + ':fwd',
    revItemId: key.root + ':rev',
  }));
}
