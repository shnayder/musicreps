// Semitone Math mode definition: note +/- semitone count = note.
// "C + 3 = ?" -> D#/Eb,  "G - 5 = ?" -> D
// 264 items: 12 notes x 11 intervals (1-11) x 2 directions (+/-).
// Grouped by semitone count into 6 distance groups.

import type {
  CheckAnswerResult,
  GroupDef,
  ModeDefinition,
  Note,
  QuizAreaEls,
  ScopeState,
} from '../types.ts';
import {
  displayNote,
  noteAdd,
  noteMatchesInput,
  NOTES,
  noteSub,
  pickAccidentalName,
} from '../music-data.ts';
import {
  createAdaptiveKeyHandler,
  refreshNoteButtonLabels,
} from '../quiz-engine.ts';

// --- Question type ---

type SemitoneMathQuestion = {
  note: Note;
  op: string;
  semitones: number;
  answer: Note;
  useFlats: boolean;
  promptText: string;
};

// --- Distance groups ---

const DISTANCE_GROUPS = [
  { distances: [1, 2], label: '\u00B11\u20132' },
  { distances: [3, 4], label: '\u00B13\u20134' },
  { distances: [5, 6], label: '\u00B15\u20136' },
  { distances: [7, 8], label: '\u00B17\u20138' },
  { distances: [9, 10], label: '\u00B19\u201310' },
  { distances: [11], label: '\u00B111' },
];

function getItemIdsForGroup(groupIndex: number): string[] {
  const distances = DISTANCE_GROUPS[groupIndex].distances;
  const items: string[] = [];
  for (const note of NOTES) {
    for (const d of distances) {
      items.push(note.name + '+' + d);
      items.push(note.name + '-' + d);
    }
  }
  return items;
}

// --- Mode definition factory ---

export function semitoneMathDefinition(): ModeDefinition<SemitoneMathQuestion> {
  // Build full item list
  const ALL_ITEMS: string[] = [];
  for (const note of NOTES) {
    for (let s = 1; s <= 11; s++) {
      ALL_ITEMS.push(note.name + '+' + s);
      ALL_ITEMS.push(note.name + '-' + s);
    }
  }

  // Build GroupDef array for the scope spec
  const groups: GroupDef[] = DISTANCE_GROUPS.map((g, i) => ({
    index: i,
    label: g.label,
    itemIds: getItemIdsForGroup(i),
  }));

  // Closure state for the current question
  let currentQuestion: SemitoneMathQuestion | null = null;

  return {
    id: 'semitoneMath',
    name: 'Semitone Math',
    storageNamespace: 'semitoneMath',

    allItemIds: ALL_ITEMS,

    getEnabledItems(scope: ScopeState): string[] {
      if (scope.kind !== 'groups') return ALL_ITEMS;
      const items: string[] = [];
      for (const g of scope.enabledGroups) {
        items.push(...getItemIdsForGroup(g));
      }
      return items;
    },

    scopeSpec: {
      kind: 'groups',
      groups,
      defaultEnabled: [0],
      storageKey: 'semitoneMath_enabledGroups',
      label: 'Distances',
      sortUnstarted: (a, b) => a.string - b.string,
    },

    getQuestion(itemId: string): SemitoneMathQuestion {
      const match = itemId.match(/^([A-G]#?)([+-])(\d+)$/)!;
      const noteName = match[1];
      const op = match[2];
      const semitones = parseInt(match[3]);
      const note = NOTES.find((n) => n.name === noteName)!;
      const answer = op === '+'
        ? noteAdd(note.num, semitones)
        : noteSub(note.num, semitones);
      const useFlats = op === '-';
      const promptNoteName = displayNote(
        pickAccidentalName(note.displayName, useFlats),
      );
      currentQuestion = {
        note,
        op,
        semitones,
        answer,
        useFlats,
        promptText: promptNoteName + ' ' + op + ' ' + semitones,
      };
      return currentQuestion;
    },

    checkAnswer(_itemId: string, input: string): CheckAnswerResult {
      const q = currentQuestion!;
      const correct = noteMatchesInput(q.answer, input);
      return {
        correct,
        correctAnswer: displayNote(
          pickAccidentalName(q.answer.displayName, q.useFlats),
        ),
      };
    },

    prompt: {
      kind: 'custom',
      render(q: SemitoneMathQuestion, els: QuizAreaEls): void {
        els.promptEl.textContent = q.promptText;
        // Update answer button labels to match current accidental direction
        els.container.querySelectorAll<HTMLElement>('.answer-btn-note')
          .forEach((btn) => {
            const note = NOTES.find((n) => n.name === btn.dataset.note!);
            if (note) {
              btn.textContent = displayNote(
                pickAccidentalName(note.displayName, q.useFlats),
              );
            }
          });
      },
      clear(els: QuizAreaEls): void {
        // Restore default button labels
        refreshNoteButtonLabels(els.container);
      },
    },

    response: {
      kind: 'buttons',
      answerButtonsHTML: '', // already in build-template
      createKeyHandler(submitAnswer, _getScope) {
        return createAdaptiveKeyHandler(submitAnswer, () => true);
      },
      getButtonAnswer(btn: HTMLElement): string | null {
        return btn.dataset.note ?? null;
      },
    },

    stats: {
      kind: 'grid',
      colLabels: Array.from({ length: 11 }, (_, i) => String(i + 1)),
      getItemId(noteName: string, colIdx: number): string | string[] {
        const n = colIdx + 1;
        return [noteName + '+' + n, noteName + '-' + n];
      },
    },

    getPracticingLabel(scope: ScopeState): string {
      if (scope.kind !== 'groups') return 'all distances';
      if (scope.enabledGroups.size === DISTANCE_GROUPS.length) {
        return 'all distances';
      }
      const labels = [...scope.enabledGroups].sort((a, b) => a - b)
        .map((g) => DISTANCE_GROUPS[g].label);
      return labels.join(', ') + ' semitones';
    },

    getSessionSummary(scope: ScopeState): string {
      const count = this.getEnabledItems(scope).length;
      return count + ' items \u00B7 60s';
    },

    calibrationSpec: {
      getButtons(container: HTMLElement): HTMLElement[] {
        return Array.from(container.querySelectorAll('.answer-btn-note'));
      },
    },
  };
}
