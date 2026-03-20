// Scale Degrees — declarative mode definition.
// Bidirectional: "5th of D major" → "A", or "D major: A" → "5th".

import {
  displayNote,
  isValidNoteInput,
  rootUsesFlats,
} from '../../music-data.ts';
import { MODE_BEFORE_AFTER, MODE_DESCRIPTIONS } from '../../mode-catalog.ts';
import type { ModeDefinition } from '../../declarative/types.ts';
import {
  ACTIVE_DEGREES,
  ALL_GROUP_INDICES,
  ALL_ITEMS,
  DEGREE_GROUPS,
  DEGREE_LABELS,
  getGridItemId,
  getItemIdsForGroup,
  getQuestion,
  GRID_NOTES,
  type Question,
} from './logic.ts';

export const SCALE_DEGREES_DEF: ModeDefinition<Question> = {
  id: 'scaleDegrees',
  name: 'Scale Degrees',
  namespace: 'scaleDegrees',
  description: MODE_DESCRIPTIONS.scaleDegrees,
  beforeAfter: MODE_BEFORE_AFTER.scaleDegrees,
  itemNoun: 'items',

  allItems: ALL_ITEMS,
  getQuestion,
  getPromptText: (q) =>
    q.dir === 'fwd'
      ? DEGREE_LABELS[q.degree - 1] + ' of ' +
        displayNote(q.keyRoot) + ' major'
      : displayNote(q.keyRoot) + ' major: ' +
        displayNote(q.noteName),
  quizInstruction: (q) => q.dir === 'fwd' ? 'What note?' : 'What degree?',
  answer: {
    kind: 'bidirectional',
    fwd: {
      getExpectedValue: (q) => q.noteName,
      comparison: 'note-enharmonic',
    },
    rev: {
      getExpectedValue: (q) => String(q.degree),
      comparison: 'exact',
      getDisplayAnswer: (q) => DEGREE_LABELS[q.degree - 1],
    },
  },
  validateInput: (q, input) =>
    q.dir === 'fwd' ? isValidNoteInput(input) : /^[2-7]$/.test(input),
  getDirection: (q) => q.dir,
  getUseFlats: (q) => rootUsesFlats(q.keyRoot),

  inputPlaceholder: (q) => q.dir === 'fwd' ? 'Note name' : 'Degree (2\u20137)',
  buttons: {
    kind: 'bidirectional',
    fwd: { kind: 'note' },
    rev: { kind: 'degree' },
  },

  scope: {
    kind: 'groups',
    groups: DEGREE_GROUPS,
    getItemIdsForGroup,
    allGroupIndices: ALL_GROUP_INDICES,
    storageKey: 'scaleDegrees_enabledGroups',
    scopeLabel: 'Degrees',
    defaultEnabled: [0],
    formatLabel: (groups) => {
      if (groups.size === DEGREE_GROUPS.length) return 'all degrees';
      const degrees = [...groups].sort((a, b) => a - b)
        .flatMap((g) => DEGREE_GROUPS[g].degrees)
        .sort((a, b) => a - b);
      return degrees.map((d) => DEGREE_LABELS[d - 1]).join(', ') + ' degrees';
    },
  },

  stats: {
    kind: 'grid',
    colLabels: ACTIVE_DEGREES.map((d) => DEGREE_LABELS[d - 1]),
    getItemId: getGridItemId,
    notes: GRID_NOTES,
  },
};
