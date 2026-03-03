// Scale Degrees Preact mode: bidirectional key + degree <-> note name.
// Forward: "5th of D major?" -> A, Reverse: "In D major, A is the ?" -> 5th.
// 168 items (12 keys x 7 degrees x 2 dirs), grouped by degree.

import { useCallback, useMemo, useRef, useState } from 'preact/hooks';
import type { ModeHandle } from '../../types.ts';
import {
  displayNote,
  MODE_DESCRIPTIONS,
  MODE_DETAIL,
} from '../../music-data.ts';
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

import { DegreeButtons, NoteButtons } from '../../ui/buttons.tsx';
import { GroupToggles } from '../../ui/scope.tsx';
import {
  ModeTopBar,
  PracticeTab,
  QuizArea,
  QuizSession,
  RoundCompleteActions,
  RoundCompleteInfo,
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
  DEGREE_GROUPS,
  DEGREE_LABELS,
  getGridItemId,
  getItemIdsForGroup,
  getQuestion,
  GRID_NOTES,
  type Question,
} from './logic.ts';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ScaleDegreesMode(
  { container, navigateHome, onMount }: {
    container: HTMLElement;
    navigateHome: () => void;
    onMount: (handle: ModeHandle) => void;
  },
) {
  // --- Core hooks ---
  const learner = useLearnerModel('scaleDegrees', ALL_ITEMS);

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
    groups: DEGREE_GROUPS,
    getItemIdsForGroup,
    allGroupIndices: ALL_GROUP_INDICES,
    storageKey: 'scaleDegrees_enabledGroups',
    scopeLabel: 'Degrees',
    defaultEnabled: [0],
    selector: learner.selector,
    formatLabel: (groups) => {
      if (groups.size === DEGREE_GROUPS.length) return 'all degrees';
      const degrees = [...groups].sort((a, b) => a - b)
        .flatMap((g) => DEGREE_GROUPS[g].degrees)
        .sort((a, b) => a - b);
      return degrees.map((d) => DEGREE_LABELS[d - 1]).join(', ') + ' degrees';
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
      return checkAnswer(currentQRef.current!, input);
    },

    handleKey: (
      e: KeyboardEvent,
      _ctx: { submitAnswer: (input: string) => void },
    ): boolean | void => {
      const dir = currentQRef.current?.dir;
      if (dir === 'fwd') {
        return noteHandler.handleKey(e);
      }
      // Reverse: number keys 1-7 for degree
      if (e.key >= '1' && e.key <= '7') {
        e.preventDefault();
        engineSubmitRef.current(e.key);
        return true;
      }
      return false;
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

  // --- Narrowing (keyboard match highlighting, forward direction only) ---
  const noteNarrowing = useMemo(
    () => engine.state.answered ? null : noteNarrowingSet(pendingNote),
    [pendingNote, engine.state.answered],
  );

  // --- Phase class sync ---
  usePhaseClass(container, engine.state.phase, PHASE_FOCUS_TARGETS);

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
  const dir = currentQ?.dir ?? 'fwd';
  const promptText = currentQ
    ? (currentQ.dir === 'fwd'
      ? DEGREE_LABELS[currentQ.degree - 1] + ' of ' +
        displayNote(currentQ.keyRoot) + ' major'
      : displayNote(currentQ.keyRoot) + ' major: ' +
        displayNote(currentQ.noteName))
    : '';

  const handleNoteAnswer = useCallback(
    (note: string) => engine.submitAnswer(note),
    [engine.submitAnswer],
  );
  const handleDegreeAnswer = useCallback(
    (degree: string) => engine.submitAnswer(degree),
    [engine.submitAnswer],
  );

  const round = useRoundSummary(engine, practicingLabel);

  const phase = engine.state.phase;
  const isIdle = phase === 'idle';

  return (
    <>
      <ModeTopBar
        title='Scale Degrees'
        description={MODE_DESCRIPTIONS.scaleDegrees}
        detail={MODE_DETAIL.scaleDegrees}
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
          scopeValid={enabledGroups.size > 0}
          validationMessage='Select at least one group'
          scope={
            <GroupToggles
              labels={DEGREE_GROUPS.map((g) => g.label)}
              active={enabledGroups}
              onToggle={scopeActions.toggleGroup}
            />
          }
          statsContent={
            <>
              <StatsGrid
                selector={ps.statsSel}
                colLabels={DEGREE_LABELS}
                getItemId={getGridItemId}
                notes={GRID_NOTES}
              />
              <StatsLegend />
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
                lastQuestion={engine.state.roundTimerExpired
                  ? 'Last question'
                  : ''}
                controls={
                  <>
                    <FeedbackBanner
                      correct={engine.state.feedbackCorrect}
                      answer={engine.state.feedbackDisplayAnswer}
                    />
                    <NoteButtons
                      hidden={dir === 'rev'}
                      onAnswer={handleNoteAnswer}
                      narrowing={dir === 'fwd' ? noteNarrowing : undefined}
                    />
                    <DegreeButtons
                      hidden={dir === 'fwd'}
                      onAnswer={handleDegreeAnswer}
                    />
                    <KeyboardHint type={dir === 'fwd' ? 'note' : null} />
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
              />
            )}
        </>
      )}
    </>
  );
}
