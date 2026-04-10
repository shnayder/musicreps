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
export const KEY_GROUPS = [
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
export const MINOR_KEY_GROUPS = [
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

/** All key groups: 2 major + 2 minor. */
export const ALL_KEY_GROUPS = [...KEY_GROUPS, ...MINOR_KEY_GROUPS];

/**
 * Get all item IDs belonging to a key group.
 *
 * @example getItemIdsForGroup('major-easy') → ["C:fwd","C:rev","G:fwd",...,"Eb:fwd","Eb:rev"]
 */
export function getItemIdsForGroup(groupId: string): string[] {
  const group = ALL_KEY_GROUPS.find((g) => g.id === groupId);
  if (!group) return [];
  const items: string[] = [];
  for (const root of group.keys) {
    items.push(root + ':fwd');
    items.push(root + ':rev');
  }
  return items;
}

/** All 48 item IDs: 12 major + 12 minor keys × 2 directions. */
export const ALL_ITEMS: string[] = [];
for (const key of MAJOR_KEYS) {
  ALL_ITEMS.push(key.root + ':fwd');
  ALL_ITEMS.push(key.root + ':rev');
}
for (const minorRoot of MINOR_ROOTS) {
  ALL_ITEMS.push(minorRoot + 'm:fwd');
  ALL_ITEMS.push(minorRoot + 'm:rev');
}

export const ALL_GROUP_IDS: string[] = ALL_KEY_GROUPS.map((g) => g.id);

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
 * One row per major key + one per minor key, with fwd/rev item IDs.
 */
export function getStatsRows(): StatsTableRow[] {
  const majorRows = MAJOR_KEYS.map((key) => ({
    label: displayNote(key.root) + ' major',
    sublabel: displayKeysigLabel(keySignatureLabel(key)),
    _colHeader: 'Key',
    fwdItemId: key.root + ':fwd',
    revItemId: key.root + ':rev',
  }));
  const minorRows = MINOR_ROOTS.map((minorRoot) => {
    const majorKey = MINOR_ROOT_TO_MAJOR.get(minorRoot)!;
    return {
      label: displayNote(minorRoot) + ' minor',
      sublabel: displayKeysigLabel(keySignatureLabel(majorKey)),
      _colHeader: 'Key',
      fwdItemId: minorRoot + 'm:fwd',
      revItemId: minorRoot + 'm:rev',
    };
  });
  return [...majorRows, ...minorRows];
}
