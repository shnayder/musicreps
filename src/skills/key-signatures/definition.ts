// Key Signatures — declarative mode definition.
// Bidirectional: "D major" → "2#", or "3b major" → "Eb".

import {
  displayKeysigLabel,
  displayNote,
  isValidKeysigInput,
  isValidNoteInput,
} from '../../music-data.ts';
import {
  SKILL_ABOUT_DESCRIPTIONS,
  SKILL_BEFORE_AFTER,
  SKILL_DESCRIPTIONS,
} from '../../skill-catalog.ts';
import type { SkillDefinition } from '../../declarative/types.ts';
import {
  ALL_ITEMS,
  ALL_KEY_LEVELS,
  ALL_LEVEL_IDS,
  getItemIdsForLevel,
  getQuestion,
  getStatsRows,
  type Question,
} from './logic.ts';

export const KEY_SIGNATURES_DEF: SkillDefinition<Question> = {
  id: 'keySignatures',
  name: 'Key Signatures',
  namespace: 'keySignatures',
  description: SKILL_DESCRIPTIONS.keySignatures,
  aboutDescription: SKILL_ABOUT_DESCRIPTIONS.keySignatures,
  beforeAfter: SKILL_BEFORE_AFTER.keySignatures,
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
    kind: 'levels',
    levels: ALL_KEY_LEVELS,
    getItemIdsForLevel,
    allLevelIds: ALL_LEVEL_IDS,
    // Legacy storage key — uses old "enabledGroups" naming.
    storageKey: 'keySignatures_enabledGroups',
    scopeLabel: 'Keys',
    defaultEnabled: [ALL_LEVEL_IDS[0]],
    formatLabel: (levels) => {
      if (levels.size === ALL_KEY_LEVELS.length) return 'all keys';
      const keys = ALL_KEY_LEVELS
        .filter((g) => levels.has(g.id))
        .flatMap((g) => g.keys)
        .map((k) => displayNote(k));
      return keys.join(', ');
    },
  },

  stats: {
    kind: 'table',
    getRows: getStatsRows,
    fwdHeader: 'Maj\u2192',
    revHeader: '\u2190Maj',
    fwd2Header: 'Min\u2192',
    rev2Header: '\u2190Min',
  },
};
