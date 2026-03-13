// Note Reading mode — declarative definition.
// Staff rendering and natural-note keyboard input are handled by GenericMode's
// built-in hooks (getAbcNotation + keyboardInput: 'note-natural').

import { MODE_BEFORE_AFTER, MODE_DESCRIPTIONS } from '../../music-data.ts';
import type { ModeDefinition } from '../../declarative/types.ts';

import {
  ALL_GROUP_INDICES,
  ALL_ITEMS,
  getGridItemId,
  getItemIdsForGroup,
  getQuestion,
  GRID_COL_LABELS,
  GRID_NOTES,
  GROUPS,
  type Question,
} from './logic.ts';

export const NOTE_READING_DEF: ModeDefinition<Question> = {
  id: 'noteReading',
  name: 'Note Reading',
  namespace: 'noteReading',
  description: MODE_DESCRIPTIONS.noteReading,
  beforeAfter: MODE_BEFORE_AFTER.noteReading,
  itemNoun: 'notes',

  allItems: ALL_ITEMS,

  getQuestion,
  getPromptText: () => 'Name this note',
  answer: {
    getExpectedValue: (q) => q.letter,
    comparison: 'exact',
  },

  buttons: { kind: 'piano-note', hideAccidentals: true },
  getAbcNotation: (q) => q.abc,
  keyboardInput: 'note-natural',

  scope: {
    kind: 'groups',
    groups: GROUPS,
    getItemIdsForGroup,
    allGroupIndices: ALL_GROUP_INDICES,
    storageKey: 'noteReading_enabledGroups',
    scopeLabel: 'Range',
    defaultEnabled: [0],
    formatLabel: (enabled) => {
      if (enabled.size === GROUPS.length) return 'all ranges';
      const labels = [...enabled].sort((a, b) => a - b)
        .map((g) => GROUPS[g].label);
      return labels.join(', ');
    },
  },

  stats: {
    kind: 'grid',
    colLabels: GRID_COL_LABELS,
    getItemId: getGridItemId,
    notes: GRID_NOTES,
  },
};
