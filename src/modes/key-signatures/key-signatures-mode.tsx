// Key Signatures Preact mode: bidirectional key name <-> accidental count.
// Forward: "D major -> ?" -> "2#", Reverse: "3b -> ?" -> Eb.
// 24 items (12 keys x 2 dirs), grouped by key group.

import { useCallback, useMemo, useRef, useState } from 'preact/hooks';
import type { ModeHandle } from '../../types.ts';
import { displayNote } from '../../music-data.ts';
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

import { KeysigButtons, NoteButtons } from '../../ui/buttons.tsx';
import { GroupToggles } from '../../ui/scope.tsx';
import {
  ModeTopBar,
  PracticeTab,
  QuizArea,
  QuizSession,
  RoundComplete,
} from '../../ui/mode-screen.tsx';
import { StatsLegend, StatsTable } from '../../ui/stats.tsx';
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
  getItemIdsForGroup,
  getQuestion,
  getStatsRows,
  KEY_GROUPS,
  type Question,
} from './logic.ts';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function KeySignaturesMode(
  { container, navigateHome, onMount }: {
    container: HTMLElement;
    navigateHome: () => void;
    onMount: (handle: ModeHandle) => void;
  },
) {
  // --- Core hooks ---
  const learner = useLearnerModel('keySignatures', ALL_ITEMS);

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
    groups: KEY_GROUPS,
    getItemIdsForGroup,
    allGroupIndices: ALL_GROUP_INDICES,
    storageKey: 'keySignatures_enabledGroups',
    scopeLabel: 'Keys',
    defaultEnabled: [0, 1],
    selector: learner.selector,
    formatLabel: (groups) => {
      if (groups.size === KEY_GROUPS.length) return 'all keys';
      const keys = [...groups].sort((a, b) => a - b)
        .flatMap((g) => KEY_GROUPS[g].keys)
        .map((k) => displayNote(k));
      return keys.join(', ');
    },
  });

  // --- Question state (ref pre-declared for use in engineConfig) ---
  const currentQRef = useRef<Question | null>(null);

  // --- Key handlers ---
  const pendingSigDigitRef = useRef<string | null>(null);
  const pendingSigTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

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
      ctx: { submitAnswer: (input: string) => void },
    ): boolean | void => {
      const dir = currentQRef.current?.dir;
      if (dir === 'rev') {
        return noteHandler.handleKey(e);
      }
      // Forward: Enter commits pending '0' (only valid standalone digit)
      if (
        e.key === 'Enter' && pendingSigDigitRef.current !== null
      ) {
        e.preventDefault();
        clearTimeout(pendingSigTimeoutRef.current!);
        const d = pendingSigDigitRef.current;
        pendingSigDigitRef.current = null;
        pendingSigTimeoutRef.current = null;
        if (d === '0') ctx.submitAnswer('0');
        return true;
      }
      // Forward: number + #/b for key sig answers
      if (e.key >= '0' && e.key <= '7') {
        e.preventDefault();
        if (pendingSigTimeoutRef.current) {
          clearTimeout(pendingSigTimeoutRef.current);
        }
        pendingSigDigitRef.current = e.key;
        pendingSigTimeoutRef.current = setTimeout(() => {
          if (pendingSigDigitRef.current === '0') {
            ctx.submitAnswer('0');
          }
          pendingSigDigitRef.current = null;
          pendingSigTimeoutRef.current = null;
        }, 600);
        return true;
      }
      if (
        pendingSigDigitRef.current !== null &&
        (e.key === '#' || e.key === 'b')
      ) {
        e.preventDefault();
        clearTimeout(pendingSigTimeoutRef.current!);
        const answer = pendingSigDigitRef.current + e.key;
        pendingSigDigitRef.current = null;
        pendingSigTimeoutRef.current = null;
        ctx.submitAnswer(answer);
        return true;
      }
      return false;
    },

    onStart: () => {
      noteHandler.reset();
      if (pendingSigTimeoutRef.current) {
        clearTimeout(pendingSigTimeoutRef.current);
      }
      pendingSigDigitRef.current = null;
    },

    onStop: () => {
      noteHandler.reset();
      if (pendingSigTimeoutRef.current) {
        clearTimeout(pendingSigTimeoutRef.current);
      }
      pendingSigDigitRef.current = null;
    },
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

  // --- Narrowing (keyboard match highlighting, reverse direction only) ---
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

  // --- Round summary ---
  const round = useRoundSummary(engine, practicingLabel);

  // --- Navigation handle ---
  const deactivateCleanup = useCallback(() => {
    noteHandler.reset();
    if (pendingSigTimeoutRef.current) {
      clearTimeout(pendingSigTimeoutRef.current);
    }
    pendingSigDigitRef.current = null;
  }, [noteHandler]);
  useModeLifecycle(onMount, engine, learner, deactivateCleanup);

  // --- Derived state ---
  const dir = currentQ?.dir ?? 'fwd';
  const promptText = currentQ
    ? (currentQ.dir === 'fwd'
      ? displayNote(currentQ.root) + ' major'
      : currentQ.sigLabel + ' major')
    : '';

  // Button answer handlers
  const handleSigAnswer = useCallback(
    (sig: string) => engine.submitAnswer(sig),
    [engine.submitAnswer],
  );
  const handleNoteAnswer = useCallback(
    (note: string) => engine.submitAnswer(note),
    [engine.submitAnswer],
  );

  // --- Render ---
  return (
    <>
      <ModeTopBar title='Key Signatures' onBack={navigateHome} />
      <PracticeTab
        summary={ps.summary}
        onStart={engine.start}
        onApplyRecommendation={ps.summary.showRecommendationButton
          ? applyRecommendation
          : undefined}
        scope={
          <GroupToggles
            labels={KEY_GROUPS.map((g) => g.label)}
            active={enabledGroups}
            recommended={recommendation.recommended}
            onToggle={scopeActions.toggleGroup}
          />
        }
        statsContent={
          <>
            <StatsTable
              selector={ps.statsSel}
              rows={getStatsRows()}
              fwdHeader='Key→Sig'
              revHeader='Sig→Key'
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
              <KeysigButtons
                hidden={dir === 'rev'}
                onAnswer={handleSigAnswer}
              />
              <NoteButtons
                hidden={dir === 'fwd'}
                onAnswer={handleNoteAnswer}
                narrowing={dir === 'rev' ? noteNarrowing : undefined}
              />
              <KeyboardHint type={dir === 'rev' ? 'note' : null} />
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
