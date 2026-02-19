// Note Semitones mode definition: bidirectional note <-> semitone number.
// Forward: "C# = ?" -> 1, Reverse: "3 = ?" -> D#/Eb
// 24 items total (12 notes x 2 directions).

import type {
  CheckAnswerResult,
  ModeDefinition,
  Note,
  NoteKeyHandler,
  ScopeState,
  StatsTableRow,
} from '../types.ts';
import {
  displayNote,
  noteMatchesInput,
  NOTES,
  pickRandomAccidental,
} from '../music-data.ts';
import { createAdaptiveKeyHandler } from '../quiz-engine.ts';

// --- Question type ---

type NoteSemitonesQuestion = {
  note: Note;
  dir: 'fwd' | 'rev';
  accidentalChoice: string;
};

// --- Mode definition factory ---

export function noteSemitonesDefinition(): ModeDefinition<
  NoteSemitonesQuestion
> {
  // Build item list: 12 notes x 2 directions
  const ALL_ITEMS: string[] = [];
  for (const note of NOTES) {
    ALL_ITEMS.push(note.name + ':fwd');
    ALL_ITEMS.push(note.name + ':rev');
  }

  // Closure state: tracks the current question for checkAnswer
  let currentQuestion: NoteSemitonesQuestion | null = null;

  return {
    id: 'noteSemitones',
    name: 'Note \u2194 Semitones',
    storageNamespace: 'noteSemitones',

    allItemIds: ALL_ITEMS,

    getEnabledItems(_scope: ScopeState): string[] {
      return ALL_ITEMS;
    },

    scopeSpec: { kind: 'none' },

    getQuestion(itemId: string): NoteSemitonesQuestion {
      const [noteName, dir] = itemId.split(':');
      const note = NOTES.find((n) => n.name === noteName)!;
      const accidentalChoice = pickRandomAccidental(note.displayName);
      currentQuestion = {
        note,
        dir: dir as 'fwd' | 'rev',
        accidentalChoice,
      };
      return currentQuestion;
    },

    checkAnswer(_itemId: string, input: string): CheckAnswerResult {
      const q = currentQuestion!;
      if (q.dir === 'fwd') {
        const correct = parseInt(input, 10) === q.note.num;
        return { correct, correctAnswer: String(q.note.num) };
      } else {
        const correct = noteMatchesInput(q.note, input);
        return {
          correct,
          correctAnswer: displayNote(q.accidentalChoice),
        };
      }
    },

    prompt: {
      kind: 'text',
      getText(q: NoteSemitonesQuestion): string {
        return q.dir === 'fwd'
          ? displayNote(q.accidentalChoice)
          : String(q.note.num);
      },
    },

    response: {
      kind: 'bidirectional',
      groups: [
        {
          id: 'notes',
          html: '', // already in build-template
          getButtonAnswer(btn: HTMLElement): string | null {
            return btn.dataset.note ?? null;
          },
        },
        {
          id: 'numbers',
          html: '', // already in build-template
          getButtonAnswer(btn: HTMLElement): string | null {
            return btn.dataset.num ?? null;
          },
        },
      ],
      getActiveGroup(question: unknown): string {
        const q = question as NoteSemitonesQuestion;
        return q.dir === 'fwd' ? 'numbers' : 'notes';
      },
      createKeyHandler(
        submitAnswer: (input: string) => void,
        _getScope: () => ScopeState,
      ): NoteKeyHandler {
        // Note handler for reverse direction
        const noteHandler = createAdaptiveKeyHandler(
          submitAnswer,
          () => true,
        );
        // Digit buffering for forward direction (handles 10, 11)
        let pendingDigit: number | null = null;
        let pendingDigitTimeout: ReturnType<typeof setTimeout> | null = null;

        return {
          handleKey(e: KeyboardEvent): boolean {
            if (currentQuestion?.dir === 'rev') {
              return noteHandler.handleKey(e);
            }
            // Forward: number keys 0-9 for semitone answer
            if (e.key >= '0' && e.key <= '9') {
              e.preventDefault();
              if (pendingDigit !== null) {
                const num = pendingDigit * 10 + parseInt(e.key);
                clearTimeout(pendingDigitTimeout!);
                pendingDigit = null;
                pendingDigitTimeout = null;
                if (num <= 11) submitAnswer(String(num));
                return true;
              }
              const d = parseInt(e.key);
              if (d >= 2) {
                submitAnswer(String(d));
              } else {
                // 0 or 1 — could be start of 10 or 11
                pendingDigit = d;
                pendingDigitTimeout = setTimeout(() => {
                  submitAnswer(String(pendingDigit));
                  pendingDigit = null;
                  pendingDigitTimeout = null;
                }, 400);
              }
              return true;
            }
            return false;
          },
          reset(): void {
            noteHandler.reset();
            if (pendingDigitTimeout) clearTimeout(pendingDigitTimeout);
            pendingDigit = null;
            pendingDigitTimeout = null;
          },
        };
      },
    },

    stats: {
      kind: 'table',
      fwdHeader: 'N\u2192#',
      revHeader: '#\u2192N',
      getRows(): StatsTableRow[] {
        return NOTES.map((note) => ({
          label: displayNote(note.name),
          sublabel: String(note.num),
          _colHeader: 'Note',
          fwdItemId: note.name + ':fwd',
          revItemId: note.name + ':rev',
        }));
      },
    },

    getPracticingLabel(_scope: ScopeState): string {
      return 'all items';
    },

    getSessionSummary(_scope: ScopeState): string {
      return ALL_ITEMS.length + ' items \u00B7 60s';
    },

    calibrationSpec: {
      getButtons(container: HTMLElement): HTMLElement[] {
        return Array.from(container.querySelectorAll('.answer-btn-note'));
      },
    },
  };
}
