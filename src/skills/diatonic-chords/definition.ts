// Diatonic Chords — declarative mode definition.
// Bidirectional: "IV in Bb major" → "Eb", or "Dm in C major" → "ii".

import {
  displayNote,
  isValidNoteInput,
  isValidNumeralInput,
  ROMAN_NUMERALS,
  rootUsesFlats,
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
  CHORD_LEVELS,
  getGridItemId,
  getItemIdsForLevel,
  getQuestion,
  GRID_NOTES,
  normalizeNumeralInput,
  type Question,
} from './logic.ts';

export const DIATONIC_CHORDS_DEF: SkillDefinition<Question> = {
  id: 'diatonicChords',
  name: 'Diatonic Chords',
  namespace: 'diatonicChords',
  description: SKILL_DESCRIPTIONS.diatonicChords,
  aboutDescription: SKILL_ABOUT_DESCRIPTIONS.diatonicChords,
  beforeAfter: SKILL_BEFORE_AFTER.diatonicChords,
  itemNoun: 'items',

  allItems: ALL_ITEMS,
  getQuestion,
  getPromptText: (q) =>
    q.dir === 'fwd'
      ? q.chord.numeral + ' in ' +
        displayNote(q.keyRoot) + ' major'
      : displayNote(q.rootNote) + q.chord.qualityLabel +
        ' in ' + displayNote(q.keyRoot) + ' major',
  quizInstruction: (q) =>
    q.dir === 'fwd' ? 'What chord root?' : 'What numeral?',
  answer: {
    kind: 'bidirectional',
    fwd: {
      getExpectedValue: (q) => q.rootNote,
      comparison: 'note-enharmonic',
      getDisplayAnswer: (q) => displayNote(q.rootNote) + ' ' + q.chord.quality,
    },
    rev: {
      getExpectedValue: (q) => q.chord.numeral,
      comparison: 'exact',
      normalizeInput: normalizeNumeralInput,
    },
  },
  validateInput: (q, input) =>
    q.dir === 'fwd'
      ? isValidNoteInput(input)
      : isValidNumeralInput(input) || /^[1-7]$/.test(input) ||
        input === 'vii',
  getDirection: (q) => q.dir,
  getUseFlats: (q) => rootUsesFlats(q.keyRoot),

  inputPlaceholder: (q) => q.dir === 'fwd' ? 'Note name' : 'Numeral (e.g. IV)',
  buttons: {
    kind: 'bidirectional',
    fwd: { kind: 'note' },
    rev: { kind: 'numeral' },
  },

  scope: {
    kind: 'levels',
    levels: CHORD_LEVELS,
    getItemIdsForLevel,
    allLevelIds: ALL_LEVEL_IDS,
    // Legacy storage key — uses old "enabledGroups" naming.
    storageKey: 'diatonicChords_enabledGroups',
    scopeLabel: 'Chords',
    defaultEnabled: [ALL_LEVEL_IDS[0]],
    formatLabel: (levels) => {
      if (levels.size === CHORD_LEVELS.length) return 'all chords';
      const numerals = CHORD_LEVELS
        .filter((g) => levels.has(g.id))
        .flatMap((g) => g.degrees)
        .sort((a, b) => a - b)
        .map((d) => ROMAN_NUMERALS[d - 1]);
      return numerals.join(', ') + ' chords';
    },
  },

  stats: {
    kind: 'grid',
    colLabels: ROMAN_NUMERALS,
    getItemId: getGridItemId,
    notes: GRID_NOTES,
  },
};
