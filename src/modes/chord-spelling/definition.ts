// Chord Spelling — declarative mode definition.
// Sequential response: user spells out all notes of a chord.
// "Cm7" → C, Eb, G, Bb. Strict enharmonic spelling.

import { displayNote } from '../../music-data.ts';
import { MODE_BEFORE_AFTER, MODE_DESCRIPTIONS } from '../../mode-catalog.ts';
import type { ModeDefinition } from '../../declarative/types.ts';
import {
  ALL_GROUP_IDS,
  ALL_ITEMS,
  evaluate,
  getGridItemId,
  getItemIdsForGroup,
  GRID_COL_LABELS,
  GRID_NOTES,
  parseChordInput,
  parseItem,
  type Question,
  SPELLING_GROUPS,
} from './logic.ts';

export const CHORD_SPELLING_DEF: ModeDefinition<Question> = {
  id: 'chordSpelling',
  name: 'Chord Spelling',
  namespace: 'chordSpelling',
  motorTaskType: 'chord-sequence',
  description: MODE_DESCRIPTIONS.chordSpelling,
  beforeAfter: MODE_BEFORE_AFTER.chordSpelling,
  itemNoun: 'items',

  allItems: ALL_ITEMS,
  getQuestion: (itemId) => parseItem(itemId),
  getPromptText: (q) => displayNote(q.rootName) + q.chordType.symbol,
  quizInstruction: 'Spell this chord',

  // Sequential: collect N notes, then evaluate all at once
  sequential: {
    expectedCount: (q) => q.tones.length,
    evaluate,
    parseBatchInput: parseChordInput,
    batchPlaceholder: (q) => `${q.tones.length} notes, e.g. C E G \u2014 Enter`,
  },

  buttons: { kind: 'split-note' },

  scope: {
    kind: 'groups',
    groups: SPELLING_GROUPS,
    getItemIdsForGroup,
    allGroupIds: ALL_GROUP_IDS,
    storageKey: 'chordSpelling_enabledGroups',
    scopeLabel: 'Chord types',
    defaultEnabled: [ALL_GROUP_IDS[0]],
    formatLabel: (groups) => {
      if (groups.size === SPELLING_GROUPS.length) return 'all chord types';
      const labels = SPELLING_GROUPS
        .filter((g) => groups.has(g.id))
        .map((g) => g.label);
      return labels.join(', ') + ' chords';
    },
  },

  stats: {
    kind: 'grid',
    colLabels: GRID_COL_LABELS,
    getItemId: getGridItemId,
    notes: GRID_NOTES,
  },
};
