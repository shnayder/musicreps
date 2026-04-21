// Scale Degrees — declarative mode definition.
// Bidirectional: "5th of D major" → "A", or "D major: A" → "5th".

import {
  displayNote,
  isValidNoteInput,
  rootUsesFlats,
} from '../../music-data.ts';
import {
  SKILL_ABOUT_DESCRIPTIONS,
  SKILL_BEFORE_AFTER,
  SKILL_DESCRIPTIONS,
} from '../../skill-catalog.ts';
import type { SkillDefinition } from '../../declarative/types.ts';
import {
  ACTIVE_DEGREES,
  ALL_ITEMS,
  ALL_LEVEL_IDS,
  DEGREE_LABELS,
  DEGREE_LEVELS,
  getGridItemId,
  getItemIdsForLevel,
  getQuestion,
  GRID_NOTES,
  type Question,
} from './logic.ts';

export const SCALE_DEGREES_DEF: SkillDefinition<Question> = {
  id: 'scaleDegrees',
  name: 'Scale Degrees',
  namespace: 'scaleDegrees',
  description: SKILL_DESCRIPTIONS.scaleDegrees,
  aboutDescription: SKILL_ABOUT_DESCRIPTIONS.scaleDegrees,
  beforeAfter: SKILL_BEFORE_AFTER.scaleDegrees,
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
    kind: 'levels',
    levels: DEGREE_LEVELS,
    getItemIdsForLevel,
    allLevelIds: ALL_LEVEL_IDS,
    // Legacy storage key — uses old "enabledGroups" naming.
    storageKey: 'scaleDegrees_enabledGroups',
    scopeLabel: 'Degrees',
    defaultEnabled: [ALL_LEVEL_IDS[0]],
    formatLabel: (levels) => {
      if (levels.size === DEGREE_LEVELS.length) return 'all degrees';
      const degrees = DEGREE_LEVELS
        .filter((g) => levels.has(g.id))
        .flatMap((g) => g.degrees)
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
