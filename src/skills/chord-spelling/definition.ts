// Chord Spelling — declarative mode definition.
// Sequential response: user spells out all notes of a chord.
// "Cm7" → C, Eb, G, Bb. Strict enharmonic spelling.

import { displayNote } from '../../music-data.ts';
import {
  SKILL_ABOUT_DESCRIPTIONS,
  SKILL_BEFORE_AFTER,
  SKILL_DESCRIPTIONS,
} from '../../skill-catalog.ts';
import type { SkillDefinition } from '../../declarative/types.ts';
import {
  ALL_ITEMS,
  ALL_LEVEL_IDS,
  evaluate,
  getGridItemId,
  getItemIdsForLevel,
  GRID_COL_LABELS,
  GRID_NOTES,
  parseChordInput,
  parseItem,
  type Question,
  SPELLING_LEVELS,
} from './logic.ts';

export const CHORD_SPELLING_DEF: SkillDefinition<Question> = {
  id: 'chordSpelling',
  name: 'Chord Spelling',
  namespace: 'chordSpelling',
  motorTaskType: 'chord-sequence',
  description: SKILL_DESCRIPTIONS.chordSpelling,
  aboutDescription: SKILL_ABOUT_DESCRIPTIONS.chordSpelling,
  beforeAfter: SKILL_BEFORE_AFTER.chordSpelling,
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
    batchPlaceholder: 'e.g. C E G \u2014 Enter',
  },

  buttons: { kind: 'split-note' },

  scope: {
    kind: 'levels',
    levels: SPELLING_LEVELS,
    getItemIdsForLevel,
    allLevelIds: ALL_LEVEL_IDS,
    // Legacy storage key — uses old "enabledGroups" naming.
    storageKey: 'chordSpelling_enabledGroups',
    scopeLabel: 'Chord types',
    defaultEnabled: [ALL_LEVEL_IDS[0]],
    formatLabel: (levels) => {
      if (levels.size === SPELLING_LEVELS.length) return 'all chord types';
      const labels = SPELLING_LEVELS
        .filter((g) => levels.has(g.id))
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
