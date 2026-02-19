// Guitar Fretboard mode definition: identify notes on the fretboard.
// Parameterized by Instrument for multi-instrument reuse (guitar, ukulele).
// Custom prompt (SVG highlight), custom stats (heatmap), fretboard scope.

import type {
  AdaptiveSelector,
  CheckAnswerResult,
  Instrument,
  ModeDefinition,
  NoteFilter,
  QuizAreaEls,
  RecommendationResult,
  ScopeState,
} from '../types.ts';
import { DEFAULT_CONFIG } from '../adaptive.ts';
import {
  displayNote,
  NATURAL_NOTES,
  noteMatchesInput,
  NOTES,
} from '../music-data.ts';
import { createAdaptiveKeyHandler } from '../quiz-engine.ts';
import {
  buildStatsLegend,
  getAutomaticityColor,
  getSpeedHeatmapColor,
} from '../stats-display.ts';
import {
  computeNotePrioritization,
  createFretboardHelpers,
} from '../quiz-fretboard-state.ts';

// --- Question type ---

type FretboardQuestion = {
  currentString: number;
  currentFret: number;
  currentNote: string;
};

// --- SVG helpers ---

const FB_QUIZ_HL = 'hsl(50, 100%, 50%)';

function setCircleFill(
  root: HTMLElement,
  string: number,
  fret: number,
  color: string,
): void {
  const circle = root.querySelector(
    'circle.fb-pos[data-string="' + string + '"][data-fret="' + fret + '"]',
  ) as SVGElement | null;
  if (circle) circle.style.fill = color;
}

function clearAll(root: HTMLElement): void {
  root.querySelectorAll<SVGElement>('.fb-pos').forEach((c) => {
    c.style.fill = '';
  });
}

// --- Mode definition factory ---

export function fretboardDefinition(
  instrument: Instrument,
): ModeDefinition<FretboardQuestion> {
  const fb = createFretboardHelpers({
    notes: NOTES,
    naturalNotes: NATURAL_NOTES,
    stringOffsets: instrument.stringOffsets,
    fretCount: instrument.fretCount,
    noteMatchesInput,
  });

  // Build all item IDs
  const allStrings = Array.from(
    { length: instrument.stringCount },
    (_, i) => i,
  );
  const ALL_ITEMS: string[] = [];
  for (const s of allStrings) {
    for (let f = 0; f < instrument.fretCount; f++) {
      ALL_ITEMS.push(s + '-' + f);
    }
  }

  return {
    id: instrument.id,
    name: instrument.name,
    storageNamespace: instrument.storageNamespace,

    allItemIds: ALL_ITEMS,

    getEnabledItems(scope: ScopeState): string[] {
      if (scope.kind !== 'fretboard') {
        return fb.getFretboardEnabledItems(
          new Set(allStrings),
          'natural',
        );
      }
      return fb.getFretboardEnabledItems(
        scope.enabledStrings as Set<number>,
        scope.noteFilter,
      );
    },

    scopeSpec: {
      kind: 'fretboard',
      instrument,
    },

    getQuestion(itemId: string): FretboardQuestion {
      return fb.parseFretboardItem(itemId);
    },

    checkAnswer(_itemId: string, input: string): CheckAnswerResult {
      const q = fb.parseFretboardItem(_itemId);
      return fb.checkFretboardAnswer(q.currentNote, input);
    },

    prompt: {
      kind: 'custom',
      render(q: FretboardQuestion, els: QuizAreaEls): void {
        if (els.fretboardWrapper) {
          clearAll(els.fretboardWrapper);
          setCircleFill(
            els.fretboardWrapper,
            q.currentString,
            q.currentFret,
            FB_QUIZ_HL,
          );
        }
        els.promptEl.textContent = 'Name this note.';
      },
      clear(els: QuizAreaEls): void {
        if (els.fretboardWrapper) {
          clearAll(els.fretboardWrapper);
        }
      },
      onAnswer(
        q: FretboardQuestion,
        result: CheckAnswerResult,
        els: QuizAreaEls,
      ): void {
        if (els.fretboardWrapper) {
          const color = result.correct
            ? 'var(--color-success)'
            : 'var(--color-error)';
          setCircleFill(
            els.fretboardWrapper,
            q.currentString,
            q.currentFret,
            color,
          );
        }
      },
    },

    response: {
      kind: 'buttons',
      answerButtonsHTML: '', // already in build-template
      createKeyHandler(submitAnswer, getScope) {
        return createAdaptiveKeyHandler(submitAnswer, () => {
          const scope = getScope();
          return scope.kind === 'fretboard' &&
            scope.noteFilter !== 'natural';
        });
      },
      getButtonAnswer(btn: HTMLElement): string | null {
        return btn.dataset.note ?? null;
      },
    },

    stats: {
      kind: 'custom',
      render(
        statsMode: string,
        statsEl: HTMLElement,
        selector: AdaptiveSelector,
        baseline: number | null,
        modeContainer: HTMLElement,
      ): void {
        statsEl.innerHTML = buildStatsLegend(
          statsMode,
          baseline ?? undefined,
        );
        const progressFb = modeContainer.querySelector(
          '.tab-progress .fretboard-wrapper',
        ) as HTMLElement | null;
        if (!progressFb) return;
        for (const s of allStrings) {
          for (let f = 0; f < instrument.fretCount; f++) {
            const itemId = s + '-' + f;
            if (statsMode === 'retention') {
              const auto = selector.getAutomaticity(itemId);
              setCircleFill(progressFb, s, f, getAutomaticityColor(auto));
            } else {
              const stats = selector.getStats(itemId);
              const ewma = stats ? stats.ewma : null;
              setCircleFill(
                progressFb,
                s,
                f,
                getSpeedHeatmapColor(ewma, baseline ?? undefined),
              );
            }
          }
        }
      },
    },

    getPracticingLabel(scope: ScopeState): string {
      if (scope.kind !== 'fretboard') return 'all strings';
      const parts: string[] = [];
      if (scope.enabledStrings.size < instrument.stringCount) {
        const names = Array.from(scope.enabledStrings).sort((a, b) => b - a)
          .map((s) => displayNote(instrument.stringNames[s]));
        parts.push(
          names.join(', ') + ' string' + (names.length === 1 ? '' : 's'),
        );
      } else {
        parts.push('all strings');
      }
      const noteLabel = noteFilterLabel(scope.noteFilter);
      if (scope.noteFilter !== 'all') parts.push(noteLabel);
      return parts.join(', ');
    },

    getSessionSummary(scope: ScopeState): string {
      if (scope.kind !== 'fretboard') {
        return '1 string \u00B7 natural notes \u00B7 60s';
      }
      const count = scope.enabledStrings.size;
      return count + ' string' + (count !== 1 ? 's' : '') + ' \u00B7 ' +
        noteFilterLabel(scope.noteFilter) + ' \u00B7 60s';
    },

    getRecommendationContext(
      rec: RecommendationResult,
      selector: AdaptiveSelector,
    ): { extraParts: string[]; noteFilter?: NoteFilter } {
      const naturalStats = selector.getStringRecommendations(
        [...rec.recommended],
        (s: number) => fb.getItemIdsForString(s, 'natural'),
      );
      const pri = computeNotePrioritization(
        naturalStats,
        DEFAULT_CONFIG.expansionThreshold,
      );
      const extraParts = pri.suggestedFilter === 'natural'
        ? ['naturals first']
        : ['add sharps & flats'];
      const noteFilter: NoteFilter =
        (pri.suggestedFilter as NoteFilter) === 'natural' ? 'natural' : 'all';
      return { extraParts, noteFilter };
    },
  };
}

function noteFilterLabel(filter: NoteFilter): string {
  if (filter === 'natural') return 'natural notes';
  if (filter === 'sharps-flats') return 'sharps and flats';
  return 'all notes';
}
