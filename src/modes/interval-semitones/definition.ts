// Interval ↔ Semitones — declarative mode definition.
// Bidirectional: "minor 2nd" → 1, or 7 → "P5".

import {
  isValidIntervalInput,
  isValidNumberInput,
  MODE_BEFORE_AFTER,
  MODE_DESCRIPTIONS,
} from '../../music-data.ts';
import type { ModeDefinition } from '../../declarative/types.ts';
import {
  ALL_ITEMS,
  getQuestion,
  getStatsRows,
  type Question,
} from './logic.ts';

export const INTERVAL_SEMITONES_DEF: ModeDefinition<Question> = {
  id: 'intervalSemitones',
  name: 'Interval \u2194 Semitones',
  namespace: 'intervalSemitones',
  description: MODE_DESCRIPTIONS.intervalSemitones,
  beforeAfter: MODE_BEFORE_AFTER.intervalSemitones,
  itemNoun: 'items',

  allItems: ALL_ITEMS,
  getQuestion,
  getPromptText: (q) => q.dir === 'fwd' ? q.name : String(q.num),
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
    fwdHeader: 'I\u2192#',
    revHeader: '#\u2192I',
  },
};
