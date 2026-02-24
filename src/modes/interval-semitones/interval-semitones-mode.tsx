// Interval ↔ Semitones Preact mode component.
// Composes shared hooks + UI components with mode-specific logic from logic.ts.

import { useCallback, useMemo, useRef, useState } from 'preact/hooks';
import type { ModeHandle } from '../../types.ts';
import type { QuizEngineConfig } from '../../hooks/use-quiz-engine.ts';
import { useQuizEngine } from '../../hooks/use-quiz-engine.ts';
import { useLearnerModel } from '../../hooks/use-learner-model.ts';
import {
  PHASE_FOCUS_TARGETS,
  usePhaseClass,
} from '../../hooks/use-phase-class.ts';
import { useModeLifecycle } from '../../hooks/use-mode-lifecycle.ts';
import { useRoundSummary } from '../../hooks/use-round-summary.ts';
import { usePracticeSummary } from '../../hooks/use-practice-summary.ts';

import { IntervalButtons, NumberButtons } from '../../ui/buttons.tsx';
import {
  ModeTopBar,
  PracticeTab,
  QuizArea,
  QuizSession,
  RoundComplete,
} from '../../ui/mode-screen.tsx';
import { StatsLegend, StatsTable } from '../../ui/stats.tsx';
import {
  numberNarrowingSet,
  PENDING_DELAY_AMBIGUOUS,
  PENDING_DELAY_UNAMBIGUOUS,
} from '../../quiz-engine.ts';
import {
  FeedbackBanner,
  FeedbackDisplay,
  KeyboardHint,
} from '../../ui/quiz-ui.tsx';
import { BUTTON_PROVIDER, SpeedCheck } from '../../ui/speed-check.tsx';

import {
  ALL_ITEMS,
  checkAnswer,
  getQuestion,
  getStatsRows,
  type Question,
} from './logic.ts';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IntervalSemitonesMode(
  { container, navigateHome, onMount }: {
    container: HTMLElement;
    navigateHome: () => void;
    onMount: (handle: ModeHandle) => void;
  },
) {
  // --- Core hooks ---
  const learner = useLearnerModel('intervalSemitones', ALL_ITEMS);

  // --- Question state ---
  const [currentQ, setCurrentQ] = useState<Question | null>(null);
  const currentQRef = useRef<Question | null>(null);

  // --- Key handler state + pending state for narrowing ---
  const pendingDigitRef = useRef<number | null>(null);
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingDigit, setPendingDigit] = useState<number | null>(null);

  // --- Engine config ---
  const engineConfig = useMemo((): QuizEngineConfig => ({
    getEnabledItems: () => ALL_ITEMS,

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
      ctx: { submitAnswer: (input: string) => void },
    ): boolean | void => {
      const dir = currentQRef.current?.dir;
      if (dir === 'rev') {
        // No keyboard for interval buttons
        return false;
      }
      // Forward: Enter commits pending digit immediately
      if (e.key === 'Enter' && pendingDigitRef.current !== null) {
        e.preventDefault();
        clearTimeout(pendingTimeoutRef.current!);
        const d = pendingDigitRef.current;
        pendingDigitRef.current = null;
        setPendingDigit(null);
        pendingTimeoutRef.current = null;
        if (d >= 1) ctx.submitAnswer(String(d));
        return true;
      }
      // Forward: digit buffering for numbers 1-12
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        const d = parseInt(e.key);
        if (pendingDigitRef.current !== null) {
          const num = pendingDigitRef.current * 10 + d;
          clearTimeout(pendingTimeoutRef.current!);
          pendingDigitRef.current = null;
          setPendingDigit(null);
          pendingTimeoutRef.current = null;
          if (num >= 1 && num <= 12) ctx.submitAnswer(String(num));
          return true;
        }
        if (d >= 2 && d <= 9) {
          ctx.submitAnswer(String(d));
        } else {
          // 0 or 1 — could be 10, 11, 12
          pendingDigitRef.current = d;
          setPendingDigit(d);
          const delay = numberNarrowingSet(d, 12, 1)!.size > 1
            ? PENDING_DELAY_AMBIGUOUS
            : PENDING_DELAY_UNAMBIGUOUS;
          pendingTimeoutRef.current = setTimeout(() => {
            if (pendingDigitRef.current !== null) {
              if (pendingDigitRef.current >= 1) {
                ctx.submitAnswer(String(pendingDigitRef.current));
              }
              pendingDigitRef.current = null;
              setPendingDigit(null);
              pendingTimeoutRef.current = null;
            }
          }, delay);
        }
        return true;
      }
      return false;
    },

    onStart: () => {
      if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
      pendingDigitRef.current = null;
      setPendingDigit(null);
    },

    onStop: () => {
      if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
      pendingDigitRef.current = null;
      setPendingDigit(null);
    },

    getPracticingLabel: () => 'all items',
  }), []);

  const engine = useQuizEngine(engineConfig, learner.selector);

  // --- Narrowing (keyboard match highlighting, forward direction only) ---
  const numNarrowing = useMemo(
    () =>
      engine.state.answered ? null : numberNarrowingSet(pendingDigit, 12, 1),
    [pendingDigit, engine.state.answered],
  );

  // --- Calibration state ---
  const [calibrating, setCalibrating] = useState(false);

  // --- Phase class sync ---
  usePhaseClass(
    container,
    calibrating ? 'calibration' : engine.state.phase,
    PHASE_FOCUS_TARGETS,
  );

  // --- Practice summary + tab/stats state ---
  const ps = usePracticeSummary({
    allItems: ALL_ITEMS,
    selector: learner.selector,
    engine,
    itemNoun: 'items',
    recommendation: null,
    recommendationText: '',
  });

  // --- Navigation handle ---
  useModeLifecycle(onMount, engine, learner, setCalibrating);

  // --- Derived state ---
  const dir = currentQ?.dir ?? 'fwd';
  const promptText = currentQ
    ? (currentQ.dir === 'fwd' ? currentQ.name : String(currentQ.num))
    : '';

  // Button answer handlers
  const handleIntervalAnswer = useCallback(
    (interval: string) => engine.submitAnswer(interval),
    [engine.submitAnswer],
  );
  const handleNumAnswer = useCallback(
    (num: number) => engine.submitAnswer(String(num)),
    [engine.submitAnswer],
  );

  // Round-complete derived values
  const round = useRoundSummary(engine, 'all items');

  // --- Render ---
  return (
    <>
      <ModeTopBar title='Interval ↔ Semitones' onBack={navigateHome} />
      <PracticeTab
        summary={ps.summary}
        onStart={engine.start}
        statsContent={
          <>
            <StatsTable
              selector={ps.statsSel}
              rows={getStatsRows()}
              fwdHeader='I→#'
              revHeader='#→I'
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
        onCalibrate={() => setCalibrating(true)}
        activeTab={ps.activeTab}
        onTabSwitch={ps.setActiveTab}
      />
      <QuizSession
        timeLeft={engine.timerText}
        timerPct={engine.timerPct}
        context='all items'
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
              <IntervalButtons
                hidden={dir === 'fwd'}
                onAnswer={handleIntervalAnswer}
              />
              <NumberButtons
                start={1}
                end={12}
                hidden={dir === 'rev'}
                onAnswer={handleNumAnswer}
                narrowing={dir === 'fwd' ? numNarrowing : undefined}
              />
              <KeyboardHint
                type={dir === 'fwd' ? 'number-1-12' : null}
              />
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
