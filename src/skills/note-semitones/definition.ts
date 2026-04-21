// Note ↔ Semitones — declarative mode definition.
// Bidirectional: "C" → 0, or 0 → "C".

import {
  displayNote,
  isValidNoteInput,
  isValidNumberInput,
} from '../../music-data.ts';
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

export const NOTE_SEMITONES_DEF: SkillDefinition<Question> = {
  id: 'noteSemitones',
  name: 'Note \u2194 Semitones',
  namespace: 'noteSemitones',
  description: SKILL_DESCRIPTIONS.noteSemitones,
  aboutDescription: SKILL_ABOUT_DESCRIPTIONS.noteSemitones,
  beforeAfter: SKILL_BEFORE_AFTER.noteSemitones,
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
    fwdHeader: 'Note\u2192Number',
    revHeader: 'Number\u2192Note',
  },
};
