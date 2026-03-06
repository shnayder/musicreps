// Fretboard Preact mode: identify notes on the fretboard.
// Parameterized by Instrument for multi-instrument reuse (guitar, ukulele).
// Uses standard group-based scope (useGroupScope) with SVG prompt + heatmap.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import type { Instrument, ModeHandle } from '../../types.ts';
import { MODE_BEFORE_AFTER, MODE_DESCRIPTIONS } from '../../music-data.ts';
import {
  createAdaptiveKeyHandler,
  noteNarrowingSet,
} from '../../quiz-engine.ts';
import { buildStatsLegend, getStatsCellColor } from '../../stats-display.ts';
import { fretboardSVG } from '../../html-helpers.ts';

import { useLearnerModel } from '../../hooks/use-learner-model.ts';
import type { QuizEngineConfig } from '../../hooks/use-quiz-engine.ts';
import { useQuizEngine } from '../../hooks/use-quiz-engine.ts';
import {
  PHASE_FOCUS_TARGETS,
  usePhaseClass,
} from '../../hooks/use-phase-class.ts';
import { useModeLifecycle } from '../../hooks/use-mode-lifecycle.ts';
import { useRoundSummary } from '../../hooks/use-round-summary.ts';
import { usePracticeSummary } from '../../hooks/use-practice-summary.ts';
import { useGroupScope } from '../../hooks/use-group-scope.ts';

import { PianoNoteButtons } from '../../ui/buttons.tsx';
import { GroupToggles } from '../../ui/scope.tsx';
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

import {
  checkAnswer,
  formatLabel,
  getAllGroupIndices,
  getAllItems,
  getGroups,
  getItemIdsForGroup,
  getQuestion,
} from './logic.ts';

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
  const groups = useMemo(() => getGroups(instrument), [instrument]);
  const allItems = useMemo(() => getAllItems(instrument), [instrument]);
  const allGroupIndices = useMemo(
    () => getAllGroupIndices(instrument),
    [instrument],
  );

  // Stable callbacks bound to instrument
  const boundGetItemIdsForGroup = useCallback(
    (index: number) => getItemIdsForGroup(instrument, index),
    [instrument],
  );
  const boundFormatLabel = useCallback(
    (enabled: ReadonlySet<number>) => formatLabel(instrument, enabled),
    [instrument],
  );

  const learner = useLearnerModel(instrument.storageNamespace, allItems);

  // --- Group scope ---
  const groupScope = useGroupScope({
    groups,
    getItemIdsForGroup: boundGetItemIdsForGroup,
    allGroupIndices,
    storageKey: instrument.storageNamespace + '_enabledGroups',
    scopeLabel: 'Groups',
    defaultEnabled: [0],
    selector: learner.selector,
    formatLabel: boundFormatLabel,
  });

  // --- Question state (ref pre-declared for use in engineConfig) ---
  type QuestionType = {
    currentString: number;
    currentFret: number;
    currentNote: string;
  };
  const currentQRef = useRef<QuestionType | null>(null);

  // --- Key handler + pending state for narrowing ---
  const engineSubmitRef = useRef<(input: string) => void>(() => {});

  // Check if any enabled group includes accidentals
  const hasAccidentals = useMemo(() => {
    for (const g of groupScope.enabledGroups) {
      if (groups[g]?.noteFilter === 'sharps-flats') return true;
    }
    return false;
  }, [groupScope.enabledGroups, groups]);

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

  // Update the accidentals check ref for the key handler
  const hasAccidentalsRef = useRef(hasAccidentals);
  hasAccidentalsRef.current = hasAccidentals;

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

  // --- Engine config ---
  const engineConfig = useMemo((): QuizEngineConfig => ({
    getEnabledItems: groupScope.getEnabledItems,
    getPracticingLabel: groupScope.getPracticingLabel,

    checkAnswer: (itemId: string, input: string) => {
      const q = getQuestion(instrument, itemId);
      return checkAnswer(instrument, q.currentNote, input);
    },

    onAnswer: (itemId: string, result) => {
      if (quizFbRef.current) {
        const q = getQuestion(instrument, itemId);
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
  }), [
    noteHandler,
    instrument,
    groupScope.getEnabledItems,
    groupScope.getPracticingLabel,
  ]);

  const engine = useQuizEngine(engineConfig, learner.selector, container);
  engineSubmitRef.current = engine.submitAnswer;

  // --- Derived question state (single source of truth) ---
  const currentQ = useMemo(() => {
    const id = engine.state.currentItemId;
    if (!id || engine.state.phase === 'idle') return null;
    return getQuestion(instrument, id);
  }, [engine.state.currentItemId, engine.state.phase, instrument]);
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

  // --- Round summary ---
  const round = useRoundSummary(engine, groupScope.practicingLabel);

  // --- Practice summary + tab/stats state ---
  const ps = usePracticeSummary({
    allItems,
    selector: learner.selector,
    engine,
    itemNoun: 'positions',
    recommendation: groupScope.recommendation,
    recommendationText: groupScope.recommendationText,
  });

  // --- Heatmap rendering (progress fretboard) ---
  useEffect(() => {
    const wrapper = progressFbRef.current;
    if (!wrapper) return;
    for (let s = 0; s < instrument.stringCount; s++) {
      for (let f = 0; f < instrument.fretCount; f++) {
        const itemId = s + '-' + f;
        const color = getStatsCellColor(learner.selector, itemId);
        setCircleFill(wrapper, s, f, color);
      }
    }
  }, [
    learner.selector,
    engine.state.phase,
    instrument,
  ]);

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

  const groupLabels = useMemo(
    () => groups.map((g) => g.label),
    [groups],
  );

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
            ? groupScope.applyRecommendation
            : undefined}
          scopeValid={groupScope.enabledGroups.size > 0}
          validationMessage='Select at least one group'
          scope={
            <GroupToggles
              labels={groupLabels}
              active={groupScope.enabledGroups}
              onToggle={groupScope.scopeActions.toggleGroup}
            />
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
              context={groupScope.practicingLabel}
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
                      hideAccidentals={!hasAccidentals}
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
