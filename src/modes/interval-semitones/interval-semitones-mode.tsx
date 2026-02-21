// Interval ↔ Semitones Preact mode component.
// Composes shared hooks + UI components with mode-specific logic from logic.ts.

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import type { QuizEngineConfig } from '../../hooks/use-quiz-engine.ts';
import { useQuizEngine } from '../../hooks/use-quiz-engine.ts';
import { useLearnerModel } from '../../hooks/use-learner-model.ts';
import { usePhaseClass } from '../../hooks/use-phase-class.ts';
import {
  useRoundSummary,
  useStatsSelector,
} from '../../hooks/use-round-summary.ts';
import { computePracticeSummary } from '../../mode-ui-state.ts';

import { IntervalButtons, NumberButtons } from '../../ui/buttons.tsx';
import {
  ModeTopBar,
  PracticeCard,
  QuizArea,
  QuizSession,
  RoundComplete,
  TabbedIdle,
} from '../../ui/mode-screen.tsx';
import { StatsTable, StatsToggle } from '../../ui/stats.tsx';
import { FeedbackDisplay } from '../../ui/quiz-ui.tsx';

import {
  ALL_ITEMS,
  checkAnswer,
  getQuestion,
  getStatsRows,
  type Question,
} from './logic.ts';

// ---------------------------------------------------------------------------
// Mode handle for navigation integration
// ---------------------------------------------------------------------------

export type ModeHandle = {
  activate(): void;
  deactivate(): void;
};

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

  // --- Key handler state (digit buffering for forward direction) ---
  const pendingDigitRef = useRef<number | null>(null);
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      // Forward: digit buffering for numbers 1-12
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        const d = parseInt(e.key);
        if (pendingDigitRef.current !== null) {
          const num = pendingDigitRef.current * 10 + d;
          clearTimeout(pendingTimeoutRef.current!);
          pendingDigitRef.current = null;
          pendingTimeoutRef.current = null;
          if (num >= 1 && num <= 12) ctx.submitAnswer(String(num));
          return true;
        }
        if (d >= 2 && d <= 9) {
          ctx.submitAnswer(String(d));
        } else {
          // 0 or 1 — could be 10, 11, 12
          pendingDigitRef.current = d;
          pendingTimeoutRef.current = setTimeout(() => {
            if (pendingDigitRef.current !== null) {
              if (pendingDigitRef.current >= 1) {
                ctx.submitAnswer(String(pendingDigitRef.current));
              }
              pendingDigitRef.current = null;
              pendingTimeoutRef.current = null;
            }
          }, 400);
        }
        return true;
      }
      return false;
    },

    onStart: () => {
      if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
      pendingDigitRef.current = null;
    },

    onStop: () => {
      if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
      pendingDigitRef.current = null;
    },

    getPracticingLabel: () => 'all items',
  }), []);

  const engine = useQuizEngine(engineConfig, learner.selector);

  // --- Phase class sync ---
  usePhaseClass(container, engine.state.phase);

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
        recommendation: null,
        recommendationText: '',
        sessionSummary: ALL_ITEMS.length + ' items \u00B7 60s',
        masteryText: engine.state.masteryText,
        showMastery: engine.state.showMastery,
      }),
    [
      learner.selector,
      engine.state.masteryText,
      engine.state.showMastery,
      engine.state.phase,
    ],
  );

  // --- Navigation handle ---
  useLayoutEffect(() => {
    onMount({
      activate() {
        learner.syncBaseline();
        engine.updateIdleMessage();
      },
      deactivate() {
        if (engine.state.phase !== 'idle') engine.stop();
      },
    });
  }, [engine, learner]);

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
  const round = useRoundSummary(engine, learner, 'all items');

  // Stats selector adapter
  const statsSel = useStatsSelector(
    learner.selector,
    engine.state.phase,
    statsMode,
  );

  // --- Render ---
  return (
    <>
      <ModeTopBar title='Interval ↔ Semitones' onBack={navigateHome} />
      <TabbedIdle
        activeTab={activeTab}
        onTabSwitch={setActiveTab}
        practiceContent={
          <PracticeCard
            statusLabel={summary.statusLabel}
            statusDetail={summary.statusDetail}
            sessionSummary={summary.sessionSummary}
            mastery={summary.showMastery ? summary.masteryText : undefined}
            onStart={engine.start}
          />
        }
        progressContent={
          <div>
            <div class='baseline-info'>{round.baselineText}</div>
            <div class='stats-controls'>
              <StatsToggle active={statsMode} onToggle={setStatsMode} />
            </div>
            <div class='stats-container'>
              <StatsTable
                selector={statsSel}
                rows={getStatsRows()}
                fwdHeader='I→#'
                revHeader='#→I'
                statsMode={statsMode}
                baseline={learner.motorBaseline ?? undefined}
              />
            </div>
          </div>
        }
      />
      <QuizSession
        timeLeft={engine.timerText}
        context='all items'
        count={round.countText}
        fluent={engine.state.masteredCount}
        total={engine.state.totalEnabledCount}
        isWarning={engine.timerWarning}
        isLastQuestion={engine.timerLastQuestion}
        onClose={engine.stop}
      />
      <QuizArea
        prompt={promptText}
        lastQuestion={engine.state.roundTimerExpired ? 'Last question' : ''}
      >
        <IntervalButtons
          hidden={dir === 'fwd'}
          onAnswer={handleIntervalAnswer}
        />
        <NumberButtons
          start={1}
          end={12}
          hidden={dir === 'rev'}
          onAnswer={handleNumAnswer}
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
      </QuizArea>
    </>
  );
}
