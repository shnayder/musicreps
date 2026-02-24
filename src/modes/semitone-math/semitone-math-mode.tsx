// Semitone Math Preact mode: note +/- semitone count = note.
// "C + 3 = ?" -> D#/Eb.  Has distance group toggles, recommendations,
// grid stats, and dynamic note button labels (flats for subtraction).

import { useCallback, useMemo, useRef, useState } from 'preact/hooks';
import type { ModeHandle } from '../../types.ts';
import {
  createAdaptiveKeyHandler,
  noteNarrowingSet,
} from '../../quiz-engine.ts';
import { computePracticeSummary } from '../../mode-ui-state.ts';

import { useLearnerModel } from '../../hooks/use-learner-model.ts';
import { useGroupScope } from '../../hooks/use-group-scope.ts';
import type { QuizEngineConfig } from '../../hooks/use-quiz-engine.ts';
import { useQuizEngine } from '../../hooks/use-quiz-engine.ts';
import {
  PHASE_FOCUS_TARGETS,
  usePhaseClass,
} from '../../hooks/use-phase-class.ts';
import { useModeLifecycle } from '../../hooks/use-mode-lifecycle.ts';
import {
  useRoundSummary,
  useStatsSelector,
} from '../../hooks/use-round-summary.ts';

import { NoteButtons } from '../../ui/buttons.tsx';
import { GroupToggles } from '../../ui/scope.tsx';
import {
  ModeTopBar,
  PracticeCard,
  QuizArea,
  QuizSession,
  RoundComplete,
  TabbedIdle,
} from '../../ui/mode-screen.tsx';
import { StatsGrid, StatsLegend, StatsToggle } from '../../ui/stats.tsx';
import {
  FeedbackBanner,
  FeedbackDisplay,
  KeyboardHint,
} from '../../ui/quiz-ui.tsx';
import {
  BaselineInfo,
  BUTTON_PROVIDER,
  SpeedCheck,
} from '../../ui/speed-check.tsx';

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

export function SemitoneMathMode(
  { container, navigateHome, onMount }: {
    container: HTMLElement;
    navigateHome: () => void;
    onMount: (handle: ModeHandle) => void;
  },
) {
  // --- Core hooks ---
  const learner = useLearnerModel('semitoneMath', ALL_ITEMS);

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
    storageKey: 'semitoneMath_enabledGroups',
    scopeLabel: 'Distances',
    defaultEnabled: [0],
    selector: learner.selector,
    formatLabel: (groups) => {
      if (groups.size === DISTANCE_GROUPS.length) return 'all distances';
      const labels = [...groups].sort((a, b) => a - b)
        .map((g) => DISTANCE_GROUPS[g].label);
      return labels.join(', ') + ' semitones';
    },
  });

  // --- Question state ---
  const [currentQ, setCurrentQ] = useState<Question | null>(null);
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

    onPresent: (itemId: string) => {
      const q = getQuestion(itemId);
      currentQRef.current = q;
      setCurrentQ(q);
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

  const engine = useQuizEngine(engineConfig, learner.selector);
  engineSubmitRef.current = engine.submitAnswer;

  // --- Narrowing (keyboard match highlighting) ---
  const noteNarrowing = useMemo(
    () => engine.state.answered ? null : noteNarrowingSet(pendingNote),
    [pendingNote, engine.state.answered],
  );

  // --- Calibration state ---
  const [calibrating, setCalibrating] = useState(false);

  // --- Phase class sync (calibration overrides engine phase) ---
  usePhaseClass(
    container,
    calibrating ? 'calibration' : engine.state.phase,
    PHASE_FOCUS_TARGETS,
  );

  // --- Tab state ---
  const [activeTab, setActiveTab] = useState<'practice' | 'progress'>(
    'practice',
  );
  const [statsMode, setStatsMode] = useState('retention');

  // --- Practice summary ---
  const summary = useMemo(
    () =>
      computePracticeSummary({
        allItemIds: ALL_ITEMS,
        selector: learner.selector,
        itemNoun: 'items',
        recommendation,
        recommendationText,
        masteryText: engine.state.masteryText,
        showMastery: engine.state.showMastery,
      }),
    [
      learner.selector,
      recommendation,
      recommendationText,
      engine.state.masteryText,
      engine.state.showMastery,
      engine.state.phase,
    ],
  );

  // --- Navigation handle ---
  const deactivateCleanup = useCallback(() => noteHandler.reset(), [
    noteHandler,
  ]);
  useModeLifecycle(onMount, engine, learner, setCalibrating, deactivateCleanup);

  // --- Derived state ---
  const promptText = currentQ?.promptText ?? '';
  const useFlats = currentQ?.useFlats;

  // Button answer handler
  const handleNoteAnswer = useCallback(
    (note: string) => engine.submitAnswer(note),
    [engine.submitAnswer],
  );

  // --- Round summary (context, correct, median, baseline, count) ---
  const round = useRoundSummary(engine, practicingLabel);

  // --- Stats selector adapter ---
  const statsSel = useStatsSelector(
    learner.selector,
    engine.state.phase,
    statsMode,
  );

  // --- Render ---
  return (
    <>
      <ModeTopBar title='Semitone Math' onBack={navigateHome} />
      <TabbedIdle
        activeTab={activeTab}
        onTabSwitch={setActiveTab}
        practiceContent={
          <PracticeCard
            statusLabel={summary.statusLabel}
            statusDetail={summary.statusDetail}
            recommendation={summary.recommendationText || undefined}
            mastery={summary.showMastery ? summary.masteryText : undefined}
            onStart={engine.start}
            onApplyRecommendation={summary.showRecommendationButton
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
          />
        }
        progressContent={
          <div>
            <div class='stats-controls'>
              <StatsToggle active={statsMode} onToggle={setStatsMode} />
            </div>
            <div class='stats-container'>
              <StatsGrid
                selector={statsSel}
                colLabels={GRID_COL_LABELS}
                getItemId={getGridItemId}
                statsMode={statsMode}
                baseline={learner.motorBaseline ?? undefined}
              />
              <StatsLegend
                statsMode={statsMode}
                baseline={learner.motorBaseline ?? undefined}
              />
            </div>
            <BaselineInfo
              baseline={learner.motorBaseline}
              onRun={() => setCalibrating(true)}
            />
          </div>
        }
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
        prompt={calibrating ? '' : promptText}
        lastQuestion={calibrating
          ? ''
          : (engine.state.roundTimerExpired ? 'Last question' : '')}
      >
        {calibrating
          ? (
            <SpeedCheck
              provider={BUTTON_PROVIDER}
              onComplete={(baseline) => {
                learner.applyBaseline(baseline);
                setCalibrating(false);
              }}
              onCancel={() => setCalibrating(false)}
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
