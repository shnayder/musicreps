// Interval Math Preact mode: note +/- interval = note.
// "C + m3 = ?" -> D#/Eb.  Nearly identical to Semitone Math but with
// interval abbreviations instead of semitone counts.

import { useCallback, useMemo, useRef, useState } from 'preact/hooks';
import type { ModeHandle } from '../../types.ts';
import {
  createAdaptiveKeyHandler,
  noteNarrowingSet,
} from '../../quiz-engine.ts';

import { useLearnerModel } from '../../hooks/use-learner-model.ts';
import { useGroupScope } from '../../hooks/use-group-scope.ts';
import type { QuizEngineConfig } from '../../hooks/use-quiz-engine.ts';
import { useQuizEngine } from '../../hooks/use-quiz-engine.ts';
import {
  PHASE_FOCUS_TARGETS,
  usePhaseClass,
} from '../../hooks/use-phase-class.ts';
import { useModeLifecycle } from '../../hooks/use-mode-lifecycle.ts';
import { useRoundSummary } from '../../hooks/use-round-summary.ts';
import { usePracticeSummary } from '../../hooks/use-practice-summary.ts';

import { NoteButtons } from '../../ui/buttons.tsx';
import { GroupToggles } from '../../ui/scope.tsx';
import {
  ModeTopBar,
  PracticeTab,
  QuizArea,
  QuizSession,
  RoundComplete,
} from '../../ui/mode-screen.tsx';
import { StatsGrid, StatsLegend } from '../../ui/stats.tsx';
import {
  FeedbackBanner,
  FeedbackDisplay,
  KeyboardHint,
} from '../../ui/quiz-ui.tsx';
import { BUTTON_PROVIDER, SpeedCheck } from '../../ui/speed-check.tsx';

import {
  ALL_GROUP_INDICES,
  ALL_ITEMS,
  checkAnswer,
  DISTANCE_GROUPS,
  getGridItemId,
  getItemIdsForGroup,
  getQuestion,
  GRID_COL_LABELS,
  type Question,
} from './logic.ts';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IntervalMathMode(
  { container, navigateHome, onMount }: {
    container: HTMLElement;
    navigateHome: () => void;
    onMount: (handle: ModeHandle) => void;
  },
) {
  // --- Core hooks ---
  const learner = useLearnerModel('intervalMath', ALL_ITEMS);

  // --- Scope + recommendations ---
  const {
    scopeActions,
    enabledGroups,
    practicingLabel,
    recommendation,
    recommendationText,
    applyRecommendation,
    getEnabledItems,
    getPracticingLabel,
  } = useGroupScope({
    groups: DISTANCE_GROUPS,
    getItemIdsForGroup,
    allGroupIndices: ALL_GROUP_INDICES,
    storageKey: 'intervalMath_enabledGroups',
    scopeLabel: 'Intervals',
    defaultEnabled: [0],
    selector: learner.selector,
    formatLabel: (groups) => {
      if (groups.size === DISTANCE_GROUPS.length) return 'all intervals';
      const labels = [...groups].sort((a, b) => a - b)
        .map((g) => DISTANCE_GROUPS[g].label);
      return labels.join(', ') + ' intervals';
    },
  });

  // --- Question state (ref pre-declared for use in engineConfig) ---
  const currentQRef = useRef<Question | null>(null);

  // --- Key handler + pending state for narrowing ---
  const engineSubmitRef = useRef<(input: string) => void>(() => {});
  const [pendingNote, setPendingNote] = useState<string | null>(null);
  const noteHandler = useMemo(
    () =>
      createAdaptiveKeyHandler(
        (note: string) => engineSubmitRef.current(note),
        () => true,
        setPendingNote,
      ),
    [],
  );

  // --- Engine config ---
  const engineConfig = useMemo((): QuizEngineConfig => ({
    getEnabledItems,
    getPracticingLabel,

    checkAnswer: (_itemId: string, input: string) => {
      const q = currentQRef.current!;
      return checkAnswer(q, input);
    },

    handleKey: (
      e: KeyboardEvent,
      _ctx: { submitAnswer: (input: string) => void },
    ): boolean | void => {
      return noteHandler.handleKey(e);
    },

    onStart: () => noteHandler.reset(),
    onStop: () => noteHandler.reset(),
  }), [noteHandler, getEnabledItems, getPracticingLabel]);

  const engine = useQuizEngine(engineConfig, learner.selector, container);
  engineSubmitRef.current = engine.submitAnswer;

  // --- Derived question state (single source of truth) ---
  const currentQ = useMemo(() => {
    const id = engine.state.currentItemId;
    if (!id || engine.state.phase === 'idle') return null;
    return getQuestion(id);
  }, [engine.state.currentItemId, engine.state.phase]);
  currentQRef.current = currentQ;

  // --- Narrowing (keyboard match highlighting) ---
  const noteNarrowing = useMemo(
    () => engine.state.answered ? null : noteNarrowingSet(pendingNote),
    [pendingNote, engine.state.answered],
  );

  // --- Shared hooks ---
  usePhaseClass(container, engine.state.phase, PHASE_FOCUS_TARGETS);
  const round = useRoundSummary(engine, practicingLabel);

  // --- Practice summary + tab/stats state ---
  const ps = usePracticeSummary({
    allItems: ALL_ITEMS,
    selector: learner.selector,
    engine,
    itemNoun: 'items',
    recommendation,
    recommendationText,
  });

  // --- Navigation handle ---
  const deactivateCleanup = useCallback(() => noteHandler.reset(), [
    noteHandler,
  ]);
  useModeLifecycle(onMount, engine, learner, deactivateCleanup);

  // --- Derived state ---
  const promptText = currentQ?.promptText ?? '';
  const useFlats = currentQ?.useFlats;

  // Button answer handler
  const handleNoteAnswer = useCallback(
    (note: string) => engine.submitAnswer(note),
    [engine.submitAnswer],
  );

  // --- Render ---
  return (
    <>
      <ModeTopBar title='Interval Math' onBack={navigateHome} />
      <PracticeTab
        summary={ps.summary}
        onStart={engine.start}
        onApplyRecommendation={ps.summary.showRecommendationButton
          ? applyRecommendation
          : undefined}
        scope={
          <GroupToggles
            labels={DISTANCE_GROUPS.map((g) => g.label)}
            active={enabledGroups}
            recommended={recommendation.recommended}
            onToggle={scopeActions.toggleGroup}
          />
        }
        statsContent={
          <>
            <StatsGrid
              selector={ps.statsSel}
              colLabels={GRID_COL_LABELS}
              getItemId={getGridItemId}
              statsMode={ps.statsMode}
              baseline={learner.motorBaseline ?? undefined}
            />
            <StatsLegend
              statsMode={ps.statsMode}
              baseline={learner.motorBaseline ?? undefined}
            />
          </>
        }
        statsMode={ps.statsMode}
        onStatsToggle={ps.setStatsMode}
        baseline={learner.motorBaseline}
        onCalibrate={engine.startCalibration}
        activeTab={ps.activeTab}
        onTabSwitch={ps.setActiveTab}
      />
      <QuizSession
        timeLeft={engine.timerText}
        timerPct={engine.timerPct}
        context={practicingLabel}
        count={round.countText}
        fluent={engine.state.masteredCount}
        total={engine.state.totalEnabledCount}
        isWarning={engine.timerWarning}
        isLastQuestion={engine.timerLastQuestion}
        onClose={engine.stop}
      />
      <QuizArea
        prompt={engine.calibrating ? '' : promptText}
        lastQuestion={engine.calibrating
          ? ''
          : (engine.state.roundTimerExpired ? 'Last question' : '')}
      >
        {engine.calibrating
          ? (
            <SpeedCheck
              provider={BUTTON_PROVIDER}
              fixture={engine.calibrationFixture}
              onComplete={(baseline) => {
                learner.applyBaseline(baseline);
                engine.endCalibration();
              }}
              onCancel={engine.endCalibration}
            />
          )
          : (
            <>
              <FeedbackBanner
                correct={engine.state.feedbackCorrect}
                answer={engine.state.feedbackDisplayAnswer}
              />
              <NoteButtons
                onAnswer={handleNoteAnswer}
                useFlats={useFlats}
                narrowing={noteNarrowing}
              />
              <KeyboardHint type='note' />
              <FeedbackDisplay
                text={engine.state.feedbackText}
                className={engine.state.feedbackClass}
                time={engine.state.timeDisplayText || undefined}
                hint={engine.state.hintText || undefined}
              />
              <RoundComplete
                context={round.roundContext}
                heading='Round complete'
                correct={round.roundCorrect}
                median={round.roundMedian}
                onContinue={engine.continueQuiz}
                onStop={engine.stop}
              />
            </>
          )}
      </QuizArea>
    </>
  );
}
