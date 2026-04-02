// Semitone Math — declarative mode definition.
// "C + 3 = ?" → user answers with a note name.

import {
  displayNote,
  isValidNoteInput,
  pickAccidentalName,
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
  DISTANCE_GROUPS,
  getGridItemId,
  getItemIdsForGroup,
  getQuestion,
  GRID_COL_LABELS,
  type Question,
} from './logic.ts';

export const SEMITONE_MATH_DEF: ModeDefinition<Question> = {
  id: 'semitoneMath',
  name: 'Semitone Math',
  namespace: 'semitoneMath',
  description: MODE_DESCRIPTIONS.semitoneMath,
  aboutDescription: MODE_ABOUT_DESCRIPTIONS.semitoneMath,
  beforeAfter: MODE_BEFORE_AFTER.semitoneMath,
  itemNoun: 'items',

  allItems: ALL_ITEMS,
  getQuestion,
  getPromptText: (q) => q.promptText,
  quizInstruction: 'What note?',
  answer: {
    getExpectedValue: (q) => q.answer.name,
    comparison: 'note-enharmonic',
    getDisplayAnswer: (q) =>
      displayNote(pickAccidentalName(q.answer.displayName, q.useFlats)),
  },
  validateInput: (_q, input) => isValidNoteInput(input),
  getUseFlats: (q) => q.useFlats,

  inputPlaceholder: 'Note name',
  buttons: { kind: 'note' },

  scope: {
    kind: 'groups',
    groups: DISTANCE_GROUPS,
    getItemIdsForGroup,
    allGroupIds: ALL_GROUP_IDS,
    storageKey: 'semitoneMath_enabledGroups',
    scopeLabel: 'Distances',
    defaultEnabled: [ALL_GROUP_IDS[0]],
    formatLabel: (groups) => {
      if (groups.size === DISTANCE_GROUPS.length) return 'all distances';
      const labels = DISTANCE_GROUPS
        .filter((g) => groups.has(g.id))
        .map((g) => g.label);
      return labels.join(', ') + ' semitones';
    },
  },

  stats: {
    kind: 'grid',
    colLabels: GRID_COL_LABELS,
    getItemId: getGridItemId,
  },
};
