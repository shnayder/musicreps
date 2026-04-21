// Pure logic for Key Signatures mode.
// No DOM, no hooks — just data in, data out.
// Bidirectional: forward (key → signature), reverse (signature → key root).

import type { MajorKey, StatsTableRow } from '../../types.ts';
import {
  displayKeysigLabel,
  displayNote,
  getScaleDegreeNote,
  keySignatureLabel,
  MAJOR_KEYS,
} from '../../music-data.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Key groups for scope selection, ordered by difficulty. */
// Labels use: \u266D = ♭ (flat), \u266F = ♯ (sharp), \u2013 = – (en dash)
export const KEY_LEVELS = [
  {
    id: 'major-easy',
    keys: ['C', 'G', 'F', 'D', 'Bb', 'A', 'Eb'],
    label: 'Major 0\u20133 \u266F/\u266D',
    longLabel: 'Major keys (0\u20133 \u266F/\u266D)',
  },
  {
    id: 'major-hard',
    keys: ['E', 'Ab', 'B', 'Db', 'F#'],
    label: 'Major 4+ \u266F/\u266D',
    longLabel: 'Major keys (4+ \u266F/\u266D)',
  },
];

// ---------------------------------------------------------------------------
// Relative minor keys
// ---------------------------------------------------------------------------

/** Map from minor root name to its relative major key. */
const MINOR_ROOT_TO_MAJOR = new Map<string, MajorKey>();
const RELATIVE_MINOR_DEGREE = 6; // 6th degree of a major scale = relative minor
for (const key of MAJOR_KEYS) {
  MINOR_ROOT_TO_MAJOR.set(
    getScaleDegreeNote(key.root, RELATIVE_MINOR_DEGREE),
    key,
  );
}

/** All minor root names, in MAJOR_KEYS order. */
const MINOR_ROOTS = MAJOR_KEYS.map((k) =>
  getScaleDegreeNote(k.root, RELATIVE_MINOR_DEGREE)
);

/** Build a minor-key group from a filtered set of major keys. */
function minorKeyGroup(
  id: string,
  majorKeys: MajorKey[],
  label: string,
  longLabel: string,
): { id: string; keys: string[]; label: string; longLabel: string } {
  const keys = majorKeys.map(
    (k) => getScaleDegreeNote(k.root, RELATIVE_MINOR_DEGREE) + 'm',
  );
  return { id, keys, label, longLabel };
}

/** Minor key groups for scope selection, ordered by difficulty. */
export const MINOR_KEY_LEVELS = [
  minorKeyGroup(
    'minor-easy',
    MAJOR_KEYS.filter((k) => k.accidentalCount <= 3),
    'Minor 0\u20133 \u266F/\u266D',
    'Minor keys (0\u20133 \u266F/\u266D)',
  ),
  minorKeyGroup(
    'minor-hard',
    MAJOR_KEYS.filter((k) => k.accidentalCount > 3),
    'Minor 4+ \u266F/\u266D',
    'Minor keys (4+ \u266F/\u266D)',
  ),
];

/** All key levels: 2 major + 2 minor. */
export const ALL_KEY_LEVELS = [...KEY_LEVELS, ...MINOR_KEY_LEVELS];

/**
 * Get all item IDs belonging to a key group.
 *
 * @example getItemIdsForLevel('major-easy') → ["C:fwd","C:rev","G:fwd",...,"Eb:fwd","Eb:rev"]
 */
export function getItemIdsForLevel(levelId: string): string[] {
  const group = ALL_KEY_LEVELS.find((g) => g.id === levelId);
  if (!group) return [];
  // Direction outer (fwd first), group's `keys` list inner (already
  // ordered by accidental count).
  return [
    ...group.keys.map((r) => r + ':fwd'),
    ...group.keys.map((r) => r + ':rev'),
  ];
}

/** All 48 item IDs: 12 major + 12 minor keys × 2 directions. */
export const ALL_ITEMS: string[] = (() => {
  const majorRoots = MAJOR_KEYS.map((k) => k.root);
  const minorRoots = MINOR_ROOTS.map((r) => r + 'm');
  const allRoots = [...majorRoots, ...minorRoots];
  return [
    ...allRoots.map((r) => r + ':fwd'),
    ...allRoots.map((r) => r + ':rev'),
  ];
})();

export const ALL_LEVEL_IDS: string[] = ALL_KEY_LEVELS.map((g) => g.id);

// ---------------------------------------------------------------------------
// Question
// ---------------------------------------------------------------------------

export type Question = {
  root: string;
  dir: 'fwd' | 'rev';
  sigLabel: string;
  quality: 'major' | 'minor';
};

/**
 * Parse an item ID and generate a question for the quiz engine.
 *
 * @example getQuestion("D:fwd") → { root: "D", dir: "fwd", sigLabel: "2#", quality: "major" }
 * @example getQuestion("Am:fwd") → { root: "A", dir: "fwd", sigLabel: "0", quality: "minor" }
 */
export function getQuestion(itemId: string): Question {
  const [rootPart, dir] = itemId.split(':');
  const isMinor = rootPart.endsWith('m') && rootPart.length > 1 &&
    MINOR_ROOT_TO_MAJOR.has(rootPart.slice(0, -1));
  if (isMinor) {
    const minorRoot = rootPart.slice(0, -1);
    const majorKey = MINOR_ROOT_TO_MAJOR.get(minorRoot)!;
    return {
      root: minorRoot,
      dir: dir as 'fwd' | 'rev',
      sigLabel: keySignatureLabel(majorKey),
      quality: 'minor',
    };
  }
  const key = MAJOR_KEYS.find((k) => k.root === rootPart)!;
  return {
    root: key.root,
    dir: dir as 'fwd' | 'rev',
    sigLabel: keySignatureLabel(key),
    quality: 'major',
  };
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

/**
 * Build stats table rows for the progress tab.
 * Returns 12 paired major/minor rows, each with major fwd/rev item IDs
 * plus minor fwd2/rev2 item IDs.
 */
export function getStatsRows(): StatsTableRow[] {
  return MAJOR_KEYS.map((key, i) => {
    const minorRoot = MINOR_ROOTS[i];
    return {
      label: displayNote(key.root) + ' / ' + displayNote(minorRoot) + 'm',
      sublabel: displayKeysigLabel(keySignatureLabel(key)),
      _colHeader: 'Key',
      fwdItemId: key.root + ':fwd',
      revItemId: key.root + ':rev',
      fwd2ItemId: minorRoot + 'm:fwd',
      rev2ItemId: minorRoot + 'm:rev',
    };
  });
}
