// Fretboard mode — declarative definition factory.
// Creates a ModeDefinition for guitar or ukulele, with a useController hook
// that manages SVG prompt rendering, heatmap stats, and keyboard narrowing.

import { useCallback, useMemo, useRef, useState } from 'preact/hooks';
import type { Instrument } from '../../types.ts';
import { isValidNoteInput } from '../../music-data.ts';
import {
  MODE_ABOUT_DESCRIPTIONS,
  MODE_BEFORE_AFTER,
  MODE_DESCRIPTIONS,
} from '../../mode-catalog.ts';
import {
  createAdaptiveKeyHandler,
  noteNarrowingSet,
} from '../../quiz-engine.ts';
import { getStatsCellColor } from '../../stats-display.ts';
import { fretboardSVG } from '../../fretboard.ts';
import type {
  ModeController,
  ModeDefinition,
} from '../../declarative/types.ts';

import {
  formatLabel,
  getAllGroupIds,
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
  const allGroupIds = getAllGroupIds(instrument);

  return {
    id: instrument.id,
    name: instrument.name,
    namespace: instrument.storageNamespace,
    description: MODE_DESCRIPTIONS[instrument.id],
    aboutDescription: MODE_ABOUT_DESCRIPTIONS[instrument.id],
    beforeAfter: MODE_BEFORE_AFTER[instrument.id],
    itemNoun: 'positions',

    allItems,

    getQuestion: (itemId) => getQuestion(instrument, itemId),
    getPromptText: () => 'Name this note',
    quizInstruction: 'What note is this?',
    answer: {
      getExpectedValue: (q) => q.currentNote,
      comparison: 'note-enharmonic',
    },
    validateInput: (_q, input) => isValidNoteInput(input),

    buttons: { kind: 'note', columns: 6 },

    scope: {
      kind: 'groups',
      groups,
      getItemIdsForGroup: (id) => getItemIdsForGroup(instrument, id),
      allGroupIds,
      storageKey: instrument.storageNamespace + '_enabledGroups',
      scopeLabel: 'Groups',
      defaultEnabled: [allGroupIds[0]],
      formatLabel: (enabled) => formatLabel(instrument, enabled),
    },

    stats: { kind: 'none' },

    useController: (enabledGroups) =>
      useFretboardController(instrument, groups, enabledGroups),
  };
}

// ---------------------------------------------------------------------------
// Fretboard prompt renderer (highlighted position SVG)
// ---------------------------------------------------------------------------

function renderFretboardPrompt(
  q: Question,
  quizFbRef: { current: HTMLDivElement | null },
  svgHTML: string,
) {
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
}

// ---------------------------------------------------------------------------
// Fretboard stats renderer (heatmap SVG)
// ---------------------------------------------------------------------------

function renderFretboardStats(
  selector: Parameters<NonNullable<ModeController<Question>['renderStats']>>[0],
  instrument: Instrument,
  svgHTML: string,
  progressFbRef: { current: HTMLDivElement | null },
) {
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
}

// ---------------------------------------------------------------------------
// Controller hook — SVG prompt, heatmap stats, keyboard narrowing
// ---------------------------------------------------------------------------

function useFretboardController(
  instrument: Instrument,
  groups: ReturnType<typeof getGroups>,
  enabledGroups: ReadonlySet<string>,
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
    for (const id of enabledGroups) {
      const g = groups.find((g) => g.id === id);
      if (g?.noteFilter === 'sharps-flats') return true;
    }
    return false;
  }, [enabledGroups, groups]);

  // --- Keyboard handler + pending state for narrowing ---
  const engineSubmitRef = useRef<(input: string) => void>(() => {});
  const hasAccidentalsRef = useRef(hasAccidentals);
  hasAccidentalsRef.current = hasAccidentals;
  const [pendingNote, setPendingNote] = useState<string | null>(null);

  const noteHandler = useMemo(
    () =>
      createAdaptiveKeyHandler(
        (note: string) => engineSubmitRef.current(note),
        () => hasAccidentalsRef.current,
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
  const renderPrompt = useCallback(
    (q: Question) => renderFretboardPrompt(q, quizFbRef, svgHTML),
    [svgHTML],
  );

  // --- Stats: SVG fretboard with heatmap colors ---
  const renderStats = useCallback(
    (
      selector: Parameters<
        NonNullable<ModeController<Question>['renderStats']>
      >[0],
    ) => renderFretboardStats(selector, instrument, svgHTML, progressFbRef),
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
    buttonColumns: hasAccidentals ? undefined : 4,
  };
}
