// Fretboard Preact mode: identify notes on the fretboard.
// Parameterized by Instrument for multi-instrument reuse (guitar, ukulele).
// Custom SVG prompt (highlight position), heatmap stats, string + note scope.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import type {
  Instrument,
  ModeHandle,
  NoteFilter as NoteFilterType,
  RecommendationResult,
} from '../../types.ts';
import {
  displayNote,
  MODE_BEFORE_AFTER,
  MODE_DESCRIPTIONS,
  NATURAL_NOTES,
  noteMatchesInput,
  NOTES,
} from '../../music-data.ts';
import { DEFAULT_CONFIG } from '../../adaptive.ts';
import {
  createAdaptiveKeyHandler,
  noteNarrowingSet,
} from '../../quiz-engine.ts';
import { computeRecommendations } from '../../recommendations.ts';
import { buildRecommendationText } from '../../mode-ui-state.ts';
import {
  buildStatsLegend,
  getAutomaticityColor,
  getStatsCellColor,
} from '../../stats-display.ts';
import {
  computeNotePrioritization,
  createFretboardHelpers,
} from '../../quiz-fretboard-state.ts';
import { fretboardSVG } from '../../html-helpers.ts';

import { useLearnerModel } from '../../hooks/use-learner-model.ts';
import { useScopeState } from '../../hooks/use-scope-state.ts';
import type { QuizEngineConfig } from '../../hooks/use-quiz-engine.ts';
import { useQuizEngine } from '../../hooks/use-quiz-engine.ts';
import {
  PHASE_FOCUS_TARGETS,
  usePhaseClass,
} from '../../hooks/use-phase-class.ts';
import { useModeLifecycle } from '../../hooks/use-mode-lifecycle.ts';
import { useRoundSummary } from '../../hooks/use-round-summary.ts';
import { usePracticeSummary } from '../../hooks/use-practice-summary.ts';

import { PianoNoteButtons } from '../../ui/buttons.tsx';
import { NoteFilter, StringToggles } from '../../ui/scope.tsx';
import {
  ModeTopBar,
  PracticeTab,
  QuizArea,
  QuizSession,
  RoundCompleteActions,
  RoundCompleteInfo,
} from '../../ui/mode-screen.tsx';
import {
  FeedbackBanner,
  FeedbackDisplay,
  KeyboardHint,
} from '../../ui/quiz-ui.tsx';
import { BUTTON_PROVIDER, SpeedCheck } from '../../ui/speed-check.tsx';

// ---------------------------------------------------------------------------
// SVG helpers
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
// Hover card setup (imperative — positioning needs DOM measurement)
// ---------------------------------------------------------------------------

function setupHoverCard(
  wrapper: HTMLElement,
  instrument: Instrument,
  fb: ReturnType<typeof createFretboardHelpers>,
  selector: { getAutomaticity: (id: string) => number | null },
): () => void {
  const card = wrapper.querySelector('.hover-card') as HTMLElement | null;
  if (!card) return () => {};

  const svg = wrapper.querySelector('svg');
  if (!svg) return () => {};

  function onOver(e: MouseEvent) {
    const el = (e.target as Element).closest('.fb-pos');
    if (!el || !card) return;
    const s = parseInt(el.getAttribute('data-string')!);
    const f = parseInt(el.getAttribute('data-fret')!);
    const itemId = s + '-' + f;

    const q = fb.parseFretboardItem(itemId);
    const auto = selector.getAutomaticity(itemId);

    const noteEl = card.querySelector('.hc-note');
    if (noteEl) noteEl.textContent = displayNote(q.currentNote);

    const sfEl = card.querySelector('.hc-string-fret');
    if (sfEl) {
      sfEl.textContent = displayNote(instrument.stringNames[s]) +
        ' string, fret ' + f;
    }

    const detailEl = card.querySelector('.hc-detail');
    const barFill = card.querySelector('.hc-bar-fill') as HTMLElement | null;
    if (auto !== null) {
      const pct = Math.round(auto * 100);
      let label: string;
      if (auto > 0.8) label = 'Automatic';
      else if (auto > 0.6) label = 'Solid';
      else if (auto > 0.4) label = 'Getting there';
      else if (auto > 0.2) label = 'Fading';
      else label = 'Needs work';
      if (detailEl) detailEl.textContent = label + ' \u00B7 ' + pct + '%';
      if (barFill) {
        barFill.style.width = pct + '%';
        barFill.style.background = getAutomaticityColor(auto);
      }
    } else {
      if (detailEl) detailEl.textContent = 'Not seen yet';
      if (barFill) {
        barFill.style.width = '0%';
        barFill.style.background = '';
      }
    }

    const containerRect = wrapper.querySelector(
      '.fretboard-container',
    )!.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const cx = elRect.left + elRect.width / 2 - containerRect.left;
    const cy = elRect.top + elRect.height / 2 - containerRect.top;

    // Position card to left or right of target, centered vertically
    const midX = containerRect.width / 2;
    if (cx < midX) {
      card.style.left = (cx + elRect.width / 2 + 6) + 'px';
      card.style.top = cy + 'px';
      card.style.transform = 'translate(0, -50%)';
    } else {
      card.style.left = (cx - elRect.width / 2 - 6) + 'px';
      card.style.top = cy + 'px';
      card.style.transform = 'translate(-100%, -50%)';
    }
    card.classList.add('visible');
  }

  function onOut(e: MouseEvent) {
    const el = (e.target as Element).closest('.fb-pos');
    if (el && card) card.classList.remove('visible');
  }

  svg.addEventListener('mouseover', onOver);
  svg.addEventListener('mouseout', onOut);

  return () => {
    svg.removeEventListener('mouseover', onOver);
    svg.removeEventListener('mouseout', onOut);
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FretboardMode(
  { instrument, container, navigateHome, onMount }: {
    instrument: Instrument;
    container: HTMLElement;
    navigateHome: () => void;
    onMount: (handle: ModeHandle) => void;
  },
) {
  const fb = useMemo(
    () =>
      createFretboardHelpers({
        notes: NOTES,
        naturalNotes: NATURAL_NOTES,
        stringOffsets: instrument.stringOffsets,
        fretCount: instrument.fretCount,
        noteMatchesInput,
      }),
    [instrument],
  );

  const allStrings = useMemo(
    () => Array.from({ length: instrument.stringCount }, (_, i) => i),
    [instrument],
  );

  const ALL_ITEMS = useMemo(() => {
    const items: string[] = [];
    for (const s of allStrings) {
      for (let f = 0; f < instrument.fretCount; f++) {
        items.push(s + '-' + f);
      }
    }
    return items;
  }, [allStrings, instrument]);

  // --- Scope ---
  const [scope, scopeActions] = useScopeState({
    kind: 'fretboard',
    instrument,
  });

  const enabledStrings = scope.kind === 'fretboard'
    ? scope.enabledStrings
    : new Set([instrument.defaultString]);
  const noteFilter: NoteFilterType = scope.kind === 'fretboard'
    ? scope.noteFilter
    : 'natural';

  const learner = useLearnerModel(instrument.storageNamespace, ALL_ITEMS);

  // --- Question state (ref pre-declared for use in engineConfig) ---
  type Question = {
    currentString: number;
    currentFret: number;
    currentNote: string;
  };
  const currentQRef = useRef<Question | null>(null);

  // --- Key handler + pending state for narrowing ---
  const engineSubmitRef = useRef<(input: string) => void>(() => {});
  const noteFilterRef = useRef(noteFilter);
  noteFilterRef.current = noteFilter;

  const [pendingNote, setPendingNote] = useState<string | null>(null);
  const noteHandler = useMemo(
    () =>
      createAdaptiveKeyHandler(
        (note: string) => engineSubmitRef.current(note),
        () => noteFilterRef.current !== 'natural',
        setPendingNote,
      ),
    [],
  );

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

  // --- Recommendations ---
  const recommendation = useMemo((): RecommendationResult => {
    return computeRecommendations(
      learner.selector,
      allStrings,
      (s: number) => {
        const prefix = s + '-';
        return ALL_ITEMS.filter((id) => id.startsWith(prefix));
      },
      DEFAULT_CONFIG,
      { sortUnstarted: (a, b) => b.string - a.string },
    );
  }, [learner.selector, allStrings, ALL_ITEMS]);

  const recommendationText = useMemo(() => {
    if (!recommendation || recommendation.recommended.size === 0) return '';
    const naturalStats = learner.selector.getStringRecommendations(
      [...recommendation.recommended],
      (s: number) => fb.getItemIdsForString(s, 'natural'),
    );
    const pri = computeNotePrioritization(
      naturalStats,
      DEFAULT_CONFIG.expansionThreshold,
    );
    const extraParts = pri.suggestedFilter === 'natural'
      ? ['naturals first']
      : ['add sharps & flats'];
    return buildRecommendationText(
      recommendation,
      (s: number) => displayNote(instrument.stringNames[s]) + ' string',
      extraParts,
    );
  }, [recommendation, learner.selector, fb, instrument]);

  const applyRecommendation = useCallback(() => {
    if (!recommendation || !recommendation.enabled) return;
    // Check for note filter override
    const naturalStats = learner.selector.getStringRecommendations(
      [...recommendation.recommended],
      (s: number) => fb.getItemIdsForString(s, 'natural'),
    );
    const pri = computeNotePrioritization(
      naturalStats,
      DEFAULT_CONFIG.expansionThreshold,
    );
    const newNoteFilter: NoteFilterType = pri.suggestedFilter === 'natural'
      ? 'natural'
      : 'all';
    scopeActions.setScope({
      kind: 'fretboard',
      enabledStrings: recommendation.enabled,
      noteFilter: newNoteFilter,
    });
  }, [recommendation, learner.selector, fb, scopeActions]);

  const practicingLabel = useMemo(() => {
    const parts: string[] = [];
    if (enabledStrings.size < instrument.stringCount) {
      const names = Array.from(enabledStrings).sort((a, b) => b - a)
        .map((s) => displayNote(instrument.stringNames[s]));
      parts.push(
        names.join(', ') + ' string' + (names.length === 1 ? '' : 's'),
      );
    } else {
      parts.push('all strings');
    }
    if (noteFilter === 'natural') parts.push('natural notes');
    else if (noteFilter === 'sharps-flats') parts.push('sharps and flats');
    return parts.join(', ');
  }, [enabledStrings, noteFilter, instrument]);

  // --- Engine config ---
  const engineConfig = useMemo((): QuizEngineConfig => ({
    getEnabledItems: () => {
      const s = scope.kind === 'fretboard'
        ? scope.enabledStrings
        : new Set([instrument.defaultString]);
      const nf = scope.kind === 'fretboard' ? scope.noteFilter : 'natural';
      return fb.getFretboardEnabledItems(s as Set<number>, nf);
    },

    checkAnswer: (itemId: string, input: string) => {
      const q = fb.parseFretboardItem(itemId);
      return fb.checkFretboardAnswer(q.currentNote, input);
    },

    onAnswer: (itemId: string, result) => {
      if (quizFbRef.current) {
        const q = fb.parseFretboardItem(itemId);
        const color = result.correct
          ? 'var(--color-success)'
          : 'var(--color-error)';
        setCircleFill(
          quizFbRef.current,
          q.currentString,
          q.currentFret,
          color,
        );
      }
    },

    handleKey: (
      e: KeyboardEvent,
      _ctx: { submitAnswer: (input: string) => void },
    ): boolean | void => {
      return noteHandler.handleKey(e);
    },

    onStart: () => noteHandler.reset(),
    onStop: () => {
      noteHandler.reset();
      if (quizFbRef.current) clearAll(quizFbRef.current);
    },

    getPracticingLabel: () => {
      const s = scope.kind === 'fretboard'
        ? scope.enabledStrings
        : new Set([instrument.defaultString]);
      const nf = scope.kind === 'fretboard' ? scope.noteFilter : 'natural';
      const parts: string[] = [];
      if (s.size < instrument.stringCount) {
        const names = Array.from(s).sort((a, b) => b - a)
          .map((i) => displayNote(instrument.stringNames[i]));
        parts.push(
          names.join(', ') + ' string' + (names.length === 1 ? '' : 's'),
        );
      } else {
        parts.push('all strings');
      }
      if (nf === 'natural') parts.push('natural notes');
      else if (nf === 'sharps-flats') parts.push('sharps and flats');
      return parts.join(', ');
    },
  }), [scope, noteHandler, fb, instrument]);

  const engine = useQuizEngine(engineConfig, learner.selector, container);
  engineSubmitRef.current = engine.submitAnswer;

  // --- Derived question state (single source of truth) ---
  const currentQ = useMemo(() => {
    const id = engine.state.currentItemId;
    if (!id || engine.state.phase === 'idle') return null;
    return fb.parseFretboardItem(id);
  }, [engine.state.currentItemId, engine.state.phase, fb]);
  currentQRef.current = currentQ;

  // --- SVG highlight (imperative side effect on question change) ---
  useEffect(() => {
    if (!quizFbRef.current) return;
    if (!currentQ) {
      clearAll(quizFbRef.current);
      return;
    }
    clearAll(quizFbRef.current);
    setCircleFill(
      quizFbRef.current,
      currentQ.currentString,
      currentQ.currentFret,
      FB_QUIZ_HL,
    );
  }, [currentQ]);

  // --- Narrowing (keyboard match highlighting) ---
  const noteNarrowing = useMemo(
    () => engine.state.answered ? null : noteNarrowingSet(pendingNote),
    [pendingNote, engine.state.answered],
  );

  // --- Phase class sync ---
  usePhaseClass(container, engine.state.phase, PHASE_FOCUS_TARGETS);

  // --- Round summary (context, correct, median, baseline, count) ---
  const round = useRoundSummary(engine, practicingLabel);

  // --- Practice summary + tab/stats state ---
  const ps = usePracticeSummary({
    allItems: ALL_ITEMS,
    selector: learner.selector,
    engine,
    itemNoun: 'positions',
    recommendation,
    recommendationText,
  });

  // --- Heatmap rendering (progress fretboard) ---
  useEffect(() => {
    const wrapper = progressFbRef.current;
    if (!wrapper) return;
    for (const s of allStrings) {
      for (let f = 0; f < instrument.fretCount; f++) {
        const itemId = s + '-' + f;
        const color = getStatsCellColor(learner.selector, itemId);
        setCircleFill(wrapper, s, f, color);
      }
    }
  }, [
    learner.selector,
    engine.state.phase,
    allStrings,
    instrument,
  ]);

  // --- Hover card setup ---
  useEffect(() => {
    const wrapper = progressFbRef.current;
    if (!wrapper) return;
    return setupHoverCard(wrapper, instrument, fb, learner.selector);
  }, [instrument, fb, learner.selector]);

  // --- Stats legend ---
  const legendHTML = useMemo(
    () => buildStatsLegend(),
    [],
  );

  // --- Navigation handle ---
  const deactivateCleanup = useCallback(() => noteHandler.reset(), [
    noteHandler,
  ]);
  useModeLifecycle(onMount, engine, learner, deactivateCleanup);

  // --- Derived state ---
  const promptText = currentQ ? 'Name this note' : '';

  const handleNoteAnswer = useCallback(
    (note: string) => engine.submitAnswer(note),
    [engine.submitAnswer],
  );

  const phase = engine.state.phase;
  const isIdle = phase === 'idle';

  return (
    <>
      <ModeTopBar
        modeId={instrument.id}
        title={instrument.name}
        description={MODE_DESCRIPTIONS[instrument.id]}
        beforeAfter={MODE_BEFORE_AFTER[instrument.id]}
        onBack={navigateHome}
        showBack={isIdle}
      />
      {isIdle && (
        <PracticeTab
          summary={ps.summary}
          onStart={engine.start}
          onApplyRecommendation={ps.summary.showRecommendationButton
            ? applyRecommendation
            : undefined}
          scopeValid={enabledStrings.size > 0 && noteFilter !== 'none'}
          validationMessage='Select at least one string and one note type'
          scope={
            <>
              <StringToggles
                stringNames={instrument.stringNames}
                active={enabledStrings}
                onToggle={scopeActions.toggleString}
              />
              <NoteFilter
                mode={noteFilter}
                onChange={(f) =>
                  scopeActions.setNoteFilter(f as NoteFilterType)}
              />
            </>
          }
          statsContent={
            <>
              <div
                ref={progressFbRef}
                // deno-lint-ignore react-no-danger
                dangerouslySetInnerHTML={{ __html: svgHTML }}
              />
              <div
                // deno-lint-ignore react-no-danger
                dangerouslySetInnerHTML={{ __html: legendHTML }}
              />
            </>
          }
          baseline={learner.motorBaseline}
          onCalibrate={engine.startCalibration}
          activeTab={ps.activeTab}
          onTabSwitch={ps.setActiveTab}
        />
      )}
      {!isIdle && (
        <>
          {phase !== 'round-complete' && (
            <QuizSession
              timeLeft={engine.timerText}
              timerPct={engine.timerPct}
              context={practicingLabel}
              count={round.countText}
              isWarning={engine.timerWarning}
              isLastQuestion={engine.timerLastQuestion}
              lastQuestion={engine.state.roundTimerExpired
                ? 'Last question'
                : ''}
              onClose={engine.stop}
            />
          )}
          {engine.calibrating
            ? (
              <QuizArea>
                <SpeedCheck
                  provider={BUTTON_PROVIDER}
                  fixture={engine.calibrationFixture}
                  onComplete={(baseline) => {
                    learner.applyBaseline(baseline);
                    engine.endCalibration();
                  }}
                  onCancel={engine.endCalibration}
                />
              </QuizArea>
            )
            : phase === 'round-complete'
            ? (
              <QuizArea
                controls={
                  <RoundCompleteActions
                    onContinue={engine.continueQuiz}
                    onStop={engine.stop}
                  />
                }
              >
                <RoundCompleteInfo
                  context={round.roundContext}
                  heading='Round complete'
                  correct={round.roundCorrect}
                  median={round.roundMedian}
                />
              </QuizArea>
            )
            : (
              <QuizArea
                prompt={promptText}
                controls={
                  <>
                    <FeedbackBanner
                      correct={engine.state.feedbackCorrect}
                      answer={engine.state.feedbackDisplayAnswer}
                    />
                    <PianoNoteButtons
                      onAnswer={handleNoteAnswer}
                      hideAccidentals={noteFilter === 'natural'}
                      narrowing={noteNarrowing}
                    />
                    <KeyboardHint type='note' />
                    <FeedbackDisplay
                      text={engine.state.feedbackText}
                      className={engine.state.feedbackClass}
                      time={engine.state.timeDisplayText || undefined}
                      hint={engine.state.hintText || undefined}
                      onNext={engine.state.answered
                        ? engine.nextQuestion
                        : undefined}
                    />
                  </>
                }
              >
                <div
                  ref={quizFbRef}
                  // deno-lint-ignore react-no-danger
                  dangerouslySetInnerHTML={{ __html: svgHTML }}
                />
              </QuizArea>
            )}
        </>
      )}
    </>
  );
}
