// Interval ↔ Semitones — declarative mode definition.
// Bidirectional: "minor 2nd" → 1, or 7 → "P5".

import { isValidIntervalInput, isValidNumberInput } from '../../music-data.ts';
import {
  SKILL_ABOUT_DESCRIPTIONS,
  SKILL_BEFORE_AFTER,
  SKILL_DESCRIPTIONS,
} from '../../skill-catalog.ts';
import type { SkillDefinition } from '../../declarative/types.ts';
import {
  ALL_ITEMS,
  getQuestion,
  getStatsRows,
  type Question,
} from './logic.ts';

export const INTERVAL_SEMITONES_DEF: SkillDefinition<Question> = {
  id: 'intervalSemitones',
  name: 'Interval \u2194 Semitones',
  namespace: 'intervalSemitones',
  description: SKILL_DESCRIPTIONS.intervalSemitones,
  aboutDescription: SKILL_ABOUT_DESCRIPTIONS.intervalSemitones,
  beforeAfter: SKILL_BEFORE_AFTER.intervalSemitones,
  itemNoun: 'items',

  allItems: ALL_ITEMS,
  getQuestion,
  getPromptText: (q) => q.dir === 'fwd' ? q.name : String(q.num),
  quizInstruction: (q) =>
    q.dir === 'fwd' ? 'How many semitones?' : 'What interval?',
  answer: {
    kind: 'bidirectional',
    fwd: {
      getExpectedValue: (q) => String(q.num),
      comparison: 'integer',
    },
    rev: {
      getExpectedValue: (q) => q.abbrev,
      comparison: 'interval',
    },
  },
  validateInput: (q, input) =>
    q.dir === 'fwd'
      ? isValidNumberInput(input, 1, 12)
      : isValidIntervalInput(input),
  getDirection: (q) => q.dir,

  inputPlaceholder: (q) => q.dir === 'fwd' ? '1\u201312' : 'Interval (e.g. P5)',
  buttons: {
    kind: 'bidirectional',
    fwd: { kind: 'number', start: 1, end: 12 },
    rev: { kind: 'interval' },
  },

  scope: { kind: 'none' },

  stats: {
    kind: 'table',
    getRows: getStatsRows,
    fwdHeader: 'Interval \u2192 Number',
    revHeader: 'Number \u2192 Interval',
  },
};
