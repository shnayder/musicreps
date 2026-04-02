// Note ↔ Semitones — declarative mode definition.
// Bidirectional: "C" → 0, or 0 → "C".

import {
  displayNote,
  isValidNoteInput,
  isValidNumberInput,
} from '../../music-data.ts';
import {
  MODE_ABOUT_DESCRIPTIONS,
  MODE_BEFORE_AFTER,
  MODE_DESCRIPTIONS,
} from '../../mode-catalog.ts';
import type { ModeDefinition } from '../../declarative/types.ts';
import {
  ALL_ITEMS,
  getQuestion,
  getStatsRows,
  type Question,
} from './logic.ts';

export const NOTE_SEMITONES_DEF: ModeDefinition<Question> = {
  id: 'noteSemitones',
  name: 'Note \u2194 Semitones',
  namespace: 'noteSemitones',
  description: MODE_DESCRIPTIONS.noteSemitones,
  aboutDescription: MODE_ABOUT_DESCRIPTIONS.noteSemitones,
  beforeAfter: MODE_BEFORE_AFTER.noteSemitones,
  itemNoun: 'items',

  allItems: ALL_ITEMS,
  getQuestion,
  getPromptText: (q) =>
    q.dir === 'fwd' ? displayNote(q.accidentalChoice) : String(q.noteNum),
  quizInstruction: (q) => q.dir === 'fwd' ? 'What number?' : 'What note?',
  answer: {
    kind: 'bidirectional',
    fwd: {
      getExpectedValue: (q) => String(q.noteNum),
      comparison: 'integer',
    },
    rev: {
      getExpectedValue: (q) => q.noteName,
      comparison: 'note-enharmonic',
      getDisplayAnswer: (q) => displayNote(q.accidentalChoice),
    },
  },
  validateInput: (q, input) =>
    q.dir === 'fwd'
      ? isValidNumberInput(input, 0, 11)
      : isValidNoteInput(input),
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
