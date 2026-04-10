// Key Signatures — declarative mode definition.
// Bidirectional: "D major" → "2#", or "3b major" → "Eb".

import {
  displayKeysigLabel,
  displayNote,
  isValidKeysigInput,
  isValidNoteInput,
} from '../../music-data.ts';
import {
  MODE_ABOUT_DESCRIPTIONS,
  MODE_BEFORE_AFTER,
  MODE_DESCRIPTIONS,
} from '../../mode-catalog.ts';
import type { ModeDefinition } from '../../declarative/types.ts';
import {
  ALL_GROUP_IDS,
  ALL_ITEMS,
  ALL_KEY_GROUPS,
  getItemIdsForGroup,
  getQuestion,
  getStatsRows,
  type Question,
} from './logic.ts';

export const KEY_SIGNATURES_DEF: ModeDefinition<Question> = {
  id: 'keySignatures',
  name: 'Key Signatures',
  namespace: 'keySignatures',
  description: MODE_DESCRIPTIONS.keySignatures,
  aboutDescription: MODE_ABOUT_DESCRIPTIONS.keySignatures,
  beforeAfter: MODE_BEFORE_AFTER.keySignatures,
  itemNoun: 'items',

  allItems: ALL_ITEMS,
  getQuestion,
  getPromptText: (q) =>
    q.dir === 'fwd'
      ? displayNote(q.root) + ' ' + q.quality
      : displayKeysigLabel(q.sigLabel) + ', ' + q.quality,
  quizInstruction: (q) =>
    q.dir === 'fwd' ? 'How many \u266F or \u266D?' : 'Name the key',
  answer: {
    kind: 'bidirectional',
    fwd: {
      getExpectedValue: (q) => q.sigLabel,
      comparison: 'exact',
    },
    rev: {
      getExpectedValue: (q) => q.root,
      comparison: 'note-enharmonic',
    },
  },
  validateInput: (q, input) =>
    q.dir === 'fwd' ? isValidKeysigInput(input) : isValidNoteInput(input),
  getDirection: (q) => q.dir,
  getUseFlats: (q) => q.sigLabel.includes('b'),

  inputPlaceholder: (q) =>
    q.dir === 'fwd' ? 'Signature (e.g. 2#)' : 'Note name',
  buttons: {
    kind: 'bidirectional',
    fwd: { kind: 'split-keysig' },
    rev: { kind: 'note' },
  },

  scope: {
    kind: 'groups',
    groups: ALL_KEY_GROUPS,
    getItemIdsForGroup,
    allGroupIds: ALL_GROUP_IDS,
    storageKey: 'keySignatures_enabledGroups',
    scopeLabel: 'Keys',
    defaultEnabled: [ALL_GROUP_IDS[0]],
    formatLabel: (groups) => {
      if (groups.size === ALL_KEY_GROUPS.length) return 'all keys';
      const keys = ALL_KEY_GROUPS
        .filter((g) => groups.has(g.id))
        .flatMap((g) => g.keys)
        .map((k) => displayNote(k));
      return keys.join(', ');
    },
  },

  stats: {
    kind: 'table',
    getRows: getStatsRows,
    fwdHeader: 'Key\u2192Sig',
    revHeader: 'Sig\u2192Key',
  },
};
