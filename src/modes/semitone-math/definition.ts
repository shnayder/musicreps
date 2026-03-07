// Semitone Math — declarative mode definition.
// "C + 3 = ?" → user answers with a note name.

import {
  isValidNoteInput,
  MODE_BEFORE_AFTER,
  MODE_DESCRIPTIONS,
} from '../../music-data.ts';
import type { ModeDefinition } from '../../declarative/types.ts';
import {
  ALL_GROUP_INDICES,
  ALL_ITEMS,
  checkAnswer,
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
  beforeAfter: MODE_BEFORE_AFTER.semitoneMath,
  itemNoun: 'items',

  allItems: ALL_ITEMS,
  getQuestion,
  getPromptText: (q) => q.promptText,
  checkAnswer,
  validateInput: (_q, input) => isValidNoteInput(input),
  getUseFlats: (q) => q.useFlats,

  inputPlaceholder: 'Note name',
  buttons: { kind: 'note' },

  scope: {
    kind: 'groups',
    groups: DISTANCE_GROUPS,
    getItemIdsForGroup,
    allGroupIndices: ALL_GROUP_INDICES,
    storageKey: 'semitoneMath_enabledGroups',
    scopeLabel: 'Distances',
    defaultEnabled: [0],
    formatLabel: (groups) => {
      if (groups.size === DISTANCE_GROUPS.length) return 'all distances';
      const labels = [...groups].sort((a, b) => a - b)
        .map((g) => DISTANCE_GROUPS[g].label);
      return labels.join(', ') + ' semitones';
    },
  },

  stats: {
    kind: 'grid',
    colLabels: GRID_COL_LABELS,
    getItemId: getGridItemId,
  },
};
