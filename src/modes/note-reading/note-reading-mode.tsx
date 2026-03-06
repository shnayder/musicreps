// Note Reading Preact mode: identify notes on treble and bass clef staves.
// Renders a single note on a musical staff using abcjs. Natural notes only.
// Groups progress from on-staff to ledger lines, treble first then bass.

import { useCallback, useEffect, useMemo, useRef } from 'preact/hooks';
import type { ModeHandle } from '../../types.ts';
import { createNoteKeyHandler } from '../../quiz-engine.ts';

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

import { NaturalNoteButtons } from '../../ui/buttons.tsx';
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
  getGridItemId,
  getItemIdsForGroup,
  getQuestion,
  GRID_COL_LABELS,
  GROUPS,
  type Question,
} from './logic.ts';

// ---------------------------------------------------------------------------
// abcjs rendering
// ---------------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
let abcjs: any = null;

async function ensureAbcjs(): Promise<void> {
  if (!abcjs) {
    abcjs = await import('abcjs');
  }
}

function renderStaff(el: HTMLElement, abc: string): void {
  if (!abcjs) return;
  abcjs.renderAbc(el, abc, {
    staffwidth: 150,
    paddingtop: 0,
    paddingbottom: 0,
    paddingleft: 0,
    paddingright: 0,
    responsive: 'resize',
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NoteReadingMode(
  { container, navigateHome, onMount }: {
    container: HTMLElement;
    navigateHome: () => void;
    onMount: (handle: ModeHandle) => void;
  },
) {
  // --- Load abcjs on mount ---
  useEffect(() => {
    ensureAbcjs();
  }, []);

  // --- Core hooks ---
  const learner = useLearnerModel('noteReading', ALL_ITEMS);

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
    groups: GROUPS,
    getItemIdsForGroup,
    allGroupIndices: ALL_GROUP_INDICES,
    storageKey: 'noteReading_enabledGroups',
    scopeLabel: 'Range',
    defaultEnabled: [0],
    selector: learner.selector,
    formatLabel: (groups) => {
      if (groups.size === GROUPS.length) return 'all ranges';
      const labels = [...groups].sort((a, b) => a - b)
        .map((g) => GROUPS[g].label);
      return labels.join(', ');
    },
  });

  // --- Question state (ref pre-declared for use in engineConfig) ---
  const currentQRef = useRef<Question | null>(null);

  // --- Key handler (no accidentals — immediate submission) ---
  const engineSubmitRef = useRef<(input: string) => void>(() => {});
  const noteHandler = useMemo(
    () =>
      createNoteKeyHandler(
        (note: string) => engineSubmitRef.current(note),
        () => false, // no accidentals — submit immediately on key press
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

  // --- Staff rendering ---
  const staffRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (staffRef.current && currentQ) {
      renderStaff(staffRef.current, currentQ.abc);
    } else if (staffRef.current && !currentQ) {
      staffRef.current.innerHTML = '';
    }
  }, [currentQ]);

  // --- Phase class sync ---
  usePhaseClass(container, engine.state.phase, PHASE_FOCUS_TARGETS);

  // --- Practice summary + tab/stats state ---
  const ps = usePracticeSummary({
    allItems: ALL_ITEMS,
    selector: learner.selector,
    engine,
    itemNoun: 'notes',
    recommendation,
    recommendationText,
  });

  // --- Navigation handle ---
  const deactivateCleanup = useCallback(() => noteHandler.reset(), [
    noteHandler,
  ]);
  useModeLifecycle(onMount, engine, learner, deactivateCleanup);

  // Button answer handler
  const handleNoteAnswer = useCallback(
    (note: string) => engine.submitAnswer(note),
    [engine.submitAnswer],
  );

  // --- Round summary ---
  const round = useRoundSummary(engine, practicingLabel);

  // --- Render ---
  const phase = engine.state.phase;
  const isIdle = phase === 'idle';

  return (
    <>
      <ModeTopBar
        title='Note Reading'
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
              labels={GROUPS.map((g) => g.label)}
              active={enabledGroups}
              onToggle={scopeActions.toggleGroup}
            />
          }
          statsContent={
            <>
              <StatsGrid
                selector={ps.statsSel}
                colLabels={GRID_COL_LABELS}
                getItemId={getGridItemId}
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
                controls={
                  <>
                    <FeedbackBanner
                      correct={engine.state.feedbackCorrect}
                      answer={engine.state.feedbackDisplayAnswer}
                    />
                    <NaturalNoteButtons onAnswer={handleNoteAnswer} />
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
                <div class='staff-display' ref={staffRef} />
              </QuizArea>
            )}
        </>
      )}
    </>
  );
}
