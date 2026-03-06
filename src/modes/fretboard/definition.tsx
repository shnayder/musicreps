// Fretboard mode — declarative definition factory.
// Creates a ModeDefinition for guitar or ukulele, with a useController hook
// that manages SVG prompt rendering, heatmap stats, and keyboard narrowing.

import { useCallback, useMemo, useRef, useState } from 'preact/hooks';
import type { Instrument } from '../../types.ts';
import { MODE_BEFORE_AFTER, MODE_DESCRIPTIONS } from '../../music-data.ts';
import {
  createAdaptiveKeyHandler,
  noteNarrowingSet,
} from '../../quiz-engine.ts';
import { getStatsCellColor } from '../../stats-display.ts';
import { fretboardSVG } from '../../html-helpers.ts';
import type {
  ModeController,
  ModeDefinition,
} from '../../declarative/types.ts';

import {
  checkAnswer,
  formatLabel,
  getAllGroupIndices,
  getAllItems,
  getGroups,
  getItemIdsForGroup,
  getQuestion,
  type Question,
} from './logic.ts';

// ---------------------------------------------------------------------------
// SVG helpers (imperative DOM manipulation)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createFretboardDef(
  instrument: Instrument,
): ModeDefinition<Question> {
  const groups = getGroups(instrument);
  const allItems = getAllItems(instrument);
  const allGroupIndices = getAllGroupIndices(instrument);

  return {
    id: instrument.id,
    name: instrument.name,
    namespace: instrument.storageNamespace,
    description: MODE_DESCRIPTIONS[instrument.id],
    beforeAfter: MODE_BEFORE_AFTER[instrument.id],
    itemNoun: 'positions',

    allItems,

    getQuestion: (itemId) => getQuestion(instrument, itemId),
    getPromptText: () => 'Name this note',
    checkAnswer: (_q, input) => checkAnswer(instrument, _q.currentNote, input),

    buttons: { kind: 'piano-note' },

    scope: {
      kind: 'groups',
      groups,
      getItemIdsForGroup: (index) => getItemIdsForGroup(instrument, index),
      allGroupIndices,
      storageKey: instrument.storageNamespace + '_enabledGroups',
      scopeLabel: 'Groups',
      defaultEnabled: [0],
      formatLabel: (enabled) => formatLabel(instrument, enabled),
    },

    stats: { kind: 'none' },

    useController: (enabledGroups) =>
      useFretboardController(instrument, groups, enabledGroups),
  };
}

// ---------------------------------------------------------------------------
// Controller hook — SVG prompt, heatmap stats, keyboard narrowing
// ---------------------------------------------------------------------------

function useFretboardController(
  instrument: Instrument,
  groups: ReturnType<typeof getGroups>,
  enabledGroups: ReadonlySet<number>,
): ModeController<Question> {
  // --- SVG refs ---
  const quizFbRef = useRef<HTMLDivElement>(null);
  const progressFbRef = useRef<HTMLDivElement>(null);

  // --- Generate SVG HTML once ---
  const svgHTML = useMemo(
    () =>
      fretboardSVG({
        stringCount: instrument.stringCount,
        fretCount: instrument.fretCount,
        fretMarkers: instrument.fretMarkers,
      }),
    [instrument],
  );

  // --- Check if any enabled group includes accidentals ---
  const hasAccidentals = useMemo(() => {
    for (const g of enabledGroups) {
      if (groups[g]?.noteFilter === 'sharps-flats') return true;
    }
    return false;
  }, [enabledGroups, groups]);

  // --- Keyboard handler + pending state for narrowing ---
  const engineSubmitRef = useRef<(input: string) => void>(() => {});
  const [pendingNote, setPendingNote] = useState<string | null>(null);

  const noteHandler = useMemo(
    () =>
      createAdaptiveKeyHandler(
        (note: string) => engineSubmitRef.current(note),
        () => hasAccidentals,
        setPendingNote,
      ),
    [],
  );

  // --- Narrowing set ---
  const narrowing = useMemo(
    () => noteNarrowingSet(pendingNote),
    [pendingNote],
  );

  // --- Prompt: SVG fretboard with highlighted position ---
  const currentQRef = useRef<Question | null>(null);

  const renderPrompt = useCallback(
    (q: Question) => {
      currentQRef.current = q;
      // Imperative highlight happens in onAnswer/onStart/onStop + effect below.
      // We schedule the highlight after render via a microtask.
      const el = quizFbRef.current;
      if (el) {
        clearAll(el);
        setCircleFill(el, q.currentString, q.currentFret, FB_QUIZ_HL);
      }
      return (
        <div
          ref={quizFbRef}
          // deno-lint-ignore react-no-danger
          dangerouslySetInnerHTML={{ __html: svgHTML }}
        />
      );
    },
    [svgHTML],
  );

  // --- Stats: SVG fretboard with heatmap colors ---
  const renderStats = useCallback(
    (
      selector: Parameters<
        NonNullable<ModeController<Question>['renderStats']>
      >[0],
    ) => {
      // Render SVG + apply heatmap colors after mount
      return (
        <div
          ref={(el: HTMLDivElement | null) => {
            progressFbRef.current = el;
            if (!el) return;
            for (let s = 0; s < instrument.stringCount; s++) {
              for (let f = 0; f < instrument.fretCount; f++) {
                const itemId = s + '-' + f;
                const color = getStatsCellColor(selector, itemId);
                setCircleFill(el, s, f, color);
              }
            }
          }}
          // deno-lint-ignore react-no-danger
          dangerouslySetInnerHTML={{ __html: svgHTML }}
        />
      );
    },
    [svgHTML, instrument],
  );

  return {
    renderPrompt,
    renderStats,

    onAnswer: (itemId, result) => {
      if (quizFbRef.current) {
        const q = getQuestion(instrument, itemId);
        const color = result.correct
          ? 'var(--color-success)'
          : 'var(--color-error)';
        setCircleFill(quizFbRef.current, q.currentString, q.currentFret, color);
      }
    },

    onStart: () => noteHandler.reset(),
    onStop: () => {
      noteHandler.reset();
      if (quizFbRef.current) clearAll(quizFbRef.current);
    },

    handleKey: (e, _ctx) => {
      engineSubmitRef.current = _ctx.submitAnswer;
      return noteHandler.handleKey(e);
    },

    deactivateCleanup: () => noteHandler.reset(),

    narrowing,
    hideAccidentals: !hasAccidentals,
  };
}
