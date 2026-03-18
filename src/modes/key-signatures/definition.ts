// Key Signatures — declarative mode definition.
// Bidirectional: "D major" → "2#", or "3b major" → "Eb".

import {
  displayNote,
  isValidKeysigInput,
  isValidNoteInput,
  keySignatureLabel,
  MAJOR_KEYS,
  rootUsesFlats,
} from '../../music-data.ts';
import { MODE_BEFORE_AFTER, MODE_DESCRIPTIONS } from '../../mode-catalog.ts';
import type { ModeDefinition } from '../../declarative/types.ts';
import {
  ALL_GROUP_INDICES,
  ALL_ITEMS,
  getItemIdsForGroup,
  getQuestion,
  getStatsRows,
  KEY_GROUPS,
  type Question,
} from './logic.ts';

export const KEY_SIGNATURES_DEF: ModeDefinition<Question> = {
  id: 'keySignatures',
  name: 'Key Signatures',
  namespace: 'keySignatures',
  description: MODE_DESCRIPTIONS.keySignatures,
  beforeAfter: MODE_BEFORE_AFTER.keySignatures,
  itemNoun: 'items',

  allItems: ALL_ITEMS,
  getQuestion,
  getPromptText: (q) =>
    q.dir === 'fwd' ? displayNote(q.root) + ' major' : q.sigLabel + ' major',
  answer: {
    kind: 'bidirectional',
    fwd: {
      getExpectedValue: (q) =>
        keySignatureLabel(MAJOR_KEYS.find((k) => k.root === q.root)!),
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
  getUseFlats: (q) => rootUsesFlats(q.root),

  inputPlaceholder: (q) =>
    q.dir === 'fwd' ? 'Signature (e.g. 2#)' : 'Note name',
  buttons: {
    kind: 'bidirectional',
    fwd: { kind: 'keysig' },
    rev: { kind: 'note' },
  },

  scope: {
    kind: 'groups',
    groups: KEY_GROUPS,
    getItemIdsForGroup,
    allGroupIndices: ALL_GROUP_INDICES,
    storageKey: 'keySignatures_enabledGroups',
    scopeLabel: 'Keys',
    defaultEnabled: [0, 1],
    formatLabel: (groups) => {
      if (groups.size === KEY_GROUPS.length) return 'all keys';
      const keys = [...groups].sort((a, b) => a - b)
        .flatMap((g) => KEY_GROUPS[g].keys)
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
