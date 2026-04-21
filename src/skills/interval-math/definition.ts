// Interval Math — declarative mode definition.
// "C + m3 = ?" → user answers with a note name.

import {
  displayNote,
  isValidNoteInput,
  parseSpelledNote,
  spelledNoteToCanonical,
} from '../../music-data.ts';
import {
  SKILL_ABOUT_DESCRIPTIONS,
  SKILL_BEFORE_AFTER,
  SKILL_DESCRIPTIONS,
} from '../../skill-catalog.ts';
import type { SkillDefinition } from '../../declarative/types.ts';
import {
  ALL_ITEMS,
  ALL_LEVEL_IDS,
  DISTANCE_LEVELS,
  getGridItemId,
  getItemIdsForLevel,
  getQuestion,
  GRID_COL_LABELS,
  type Question,
} from './logic.ts';

export const INTERVAL_MATH_DEF: SkillDefinition<Question> = {
  id: 'intervalMath',
  name: 'Interval Math',
  namespace: 'intervalMath',
  description: SKILL_DESCRIPTIONS.intervalMath,
  aboutDescription: SKILL_ABOUT_DESCRIPTIONS.intervalMath,
  beforeAfter: SKILL_BEFORE_AFTER.intervalMath,
  itemNoun: 'items',

  allItems: ALL_ITEMS,
  getQuestion,
  getPromptText: (q) => q.promptText,
  quizInstruction: 'What note?',
  answer: {
    getExpectedValue: (q) => q.answerSpelled,
    comparison: 'note-enharmonic',
    getDisplayAnswer: (q) => {
      const display = displayNote(q.answerSpelled);
      const { accidental } = parseSpelledNote(q.answerSpelled);
      if (Math.abs(accidental) < 2) return display;
      return display + ' (= ' +
        displayNote(spelledNoteToCanonical(q.answerSpelled)) + ')';
    },
  },
  validateInput: (_q, input) => isValidNoteInput(input),
  getUseFlats: (q) => q.useFlats,

  inputPlaceholder: 'Note name',
  buttons: { kind: 'note' },

  scope: {
    kind: 'levels',
    levels: DISTANCE_LEVELS,
    getItemIdsForLevel,
    allLevelIds: ALL_LEVEL_IDS,
    // Legacy storage key — uses old "enabledGroups" naming.
    storageKey: 'intervalMath_enabledGroups',
    scopeLabel: 'Intervals',
    defaultEnabled: [ALL_LEVEL_IDS[0]],
    formatLabel: (levels) => {
      if (levels.size === DISTANCE_LEVELS.length) return 'all intervals';
      const labels = DISTANCE_LEVELS
        .filter((g) => levels.has(g.id))
        .map((g) => g.label);
      return labels.join(', ');
    },
  },

  stats: {
    kind: 'grid',
    colLabels: GRID_COL_LABELS,
    getItemId: getGridItemId,
  },
};
