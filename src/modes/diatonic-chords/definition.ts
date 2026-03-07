// Diatonic Chords — declarative mode definition.
// Bidirectional: "IV in Bb major" → "Eb", or "Dm in C major" → "ii".

import {
  displayNote,
  isValidNoteInput,
  isValidNumeralInput,
  MODE_BEFORE_AFTER,
  MODE_DESCRIPTIONS,
  ROMAN_NUMERALS,
} from '../../music-data.ts';
import type { ModeDefinition } from '../../declarative/types.ts';
import {
  ALL_GROUP_INDICES,
  ALL_ITEMS,
  checkAnswer,
  CHORD_GROUPS,
  getGridItemId,
  getItemIdsForGroup,
  getQuestion,
  GRID_NOTES,
  type Question,
} from './logic.ts';

export const DIATONIC_CHORDS_DEF: ModeDefinition<Question> = {
  id: 'diatonicChords',
  name: 'Diatonic Chords',
  namespace: 'diatonicChords',
  description: MODE_DESCRIPTIONS.diatonicChords,
  beforeAfter: MODE_BEFORE_AFTER.diatonicChords,
  itemNoun: 'items',

  allItems: ALL_ITEMS,
  getQuestion,
  getPromptText: (q) =>
    q.dir === 'fwd'
      ? q.chord.numeral + ' in ' +
        displayNote(q.keyRoot) + ' major'
      : displayNote(q.rootNote) + q.chord.qualityLabel +
        ' in ' + displayNote(q.keyRoot) + ' major',
  checkAnswer,
  validateInput: (q, input) =>
    q.dir === 'fwd' ? isValidNoteInput(input) : isValidNumeralInput(input),
  getDirection: (q) => q.dir,

  inputPlaceholder: (q) => q.dir === 'fwd' ? 'Note name' : 'Numeral (e.g. IV)',
  buttons: {
    kind: 'bidirectional',
    fwd: { kind: 'note' },
    rev: { kind: 'numeral' },
  },

  scope: {
    kind: 'groups',
    groups: CHORD_GROUPS,
    getItemIdsForGroup,
    allGroupIndices: ALL_GROUP_INDICES,
    storageKey: 'diatonicChords_enabledGroups',
    scopeLabel: 'Chords',
    defaultEnabled: [0],
    formatLabel: (groups) => {
      if (groups.size === CHORD_GROUPS.length) return 'all chords';
      const numerals = [...groups].sort((a, b) => a - b)
        .flatMap((g) => CHORD_GROUPS[g].degrees)
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
