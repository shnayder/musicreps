// Note ↔ Semitones — declarative mode definition.
// Bidirectional: "C" → 0, or 0 → "C".

import {
  displayNote,
  MODE_BEFORE_AFTER,
  MODE_DESCRIPTIONS,
} from '../../music-data.ts';
import type { ModeDefinition } from '../../declarative/types.ts';
import {
  ALL_ITEMS,
  checkAnswer,
  getQuestion,
  getStatsRows,
  type Question,
} from './logic.ts';

export const NOTE_SEMITONES_DEF: ModeDefinition<Question> = {
  id: 'noteSemitones',
  name: 'Note \u2194 Semitones',
  namespace: 'noteSemitones',
  description: MODE_DESCRIPTIONS.noteSemitones,
  beforeAfter: MODE_BEFORE_AFTER.noteSemitones,
  itemNoun: 'items',

  allItems: ALL_ITEMS,
  getQuestion,
  getPromptText: (q) =>
    q.dir === 'fwd' ? displayNote(q.accidentalChoice) : String(q.noteNum),
  checkAnswer,
  getDirection: (q) => q.dir,

  inputPlaceholder: (q) => q.dir === 'fwd' ? '0\u201311' : 'Note name',
  buttons: {
    kind: 'bidirectional',
    fwd: { kind: 'number', start: 0, end: 11 },
    rev: { kind: 'note' },
  },

  scope: { kind: 'none' },

  stats: {
    kind: 'table',
    getRows: getStatsRows,
    fwdHeader: 'N\u2192#',
    revHeader: '#\u2192N',
  },
};
