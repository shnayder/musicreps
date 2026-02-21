// useQuizEngine — Preact hook wrapping the quiz engine lifecycle.
// Owns the pure state machine (quiz-engine-state.ts), round timer,
// auto-advance timer, and keyboard routing. Components render
// reactively from the returned state — no manual DOM manipulation.
//
// Calibration is left as an imperative escape hatch for Phase 5+.

import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type {
  AdaptiveSelector,
  CheckAnswerResult,
  EngineState,
} from '../types.ts';
import {
  engineContinueRound,
  engineNextQuestion,
  engineRoundComplete,
  engineRoundTimerExpired,
  engineRouteKey,
  engineStart,
  engineStop,
  engineSubmitAnswer,
  engineUpdateIdleMessage,
  engineUpdateMasteryAfterAnswer,
  engineUpdateProgress,
  initialEngineState,
} from '../quiz-engine-state.ts';

const ROUND_DURATION_MS = 60000;
const AUTO_ADVANCE_MS = 1000;
const TIMER_TICK_MS = 200;

// ---------------------------------------------------------------------------
// Config type — what the mode provides to the engine
// ---------------------------------------------------------------------------

export type QuizEngineConfig = {
  /** Get currently enabled item IDs (respects scope). */
  getEnabledItems: () => string[];
  /** Check user's answer against correct answer. */
  checkAnswer: (itemId: string, input: string) => CheckAnswerResult;
  /** Called when the engine presents a new question. */
  onPresent?: (itemId: string) => void;
  /** Called after the user answers. */
  onAnswer?: (
    itemId: string,
    result: CheckAnswerResult,
    responseTime: number,
  ) => void;
  /** Called when quiz starts. */
  onStart?: () => void;
  /** Called when quiz stops (back to idle). */
  onStop?: () => void;
  /** Mode keyboard handler. Return true if handled. */
  handleKey?: (
    e: KeyboardEvent,
    ctx: { submitAnswer: (input: string) => void },
  ) => boolean | void;
  /** Context label for the session header (e.g., "Natural notes"). */
  getPracticingLabel?: () => string;
  /** Expected response count per item (for multi-response modes). */
  getExpectedResponseCount?: (itemId: string) => number;
};

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export type QuizEngineHandle = {
  state: EngineState;
  /** Timer state (not in EngineState since it's a side effect). */
  timerPct: number;
  timerText: string;
  timerWarning: boolean;
  timerLastQuestion: boolean;

  // Actions
  start: () => void;
  stop: () => void;
  submitAnswer: (input: string) => void;
  nextQuestion: () => void;
  continueQuiz: () => void;
  updateIdleMessage: () => void;
};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function formatRoundTime(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min + ':' + (sec < 10 ? '0' : '') + sec;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useQuizEngine(
  config: QuizEngineConfig,
  selector: AdaptiveSelector,
): QuizEngineHandle {
  const [state, setState] = useState<EngineState>(initialEngineState);

  // Timer state — updated at 200ms intervals, separate from engine state
  // to avoid re-running the full engine state transitions on every tick.
  const [timerPct, setTimerPct] = useState(100);
  const [timerText, setTimerText] = useState('');
  const [timerWarning, setTimerWarning] = useState(false);
  const [timerLastQuestion, setTimerLastQuestion] = useState(false);

  // Refs for mutable values accessed by timers/callbacks.
  const stateRef = useRef(state);
  stateRef.current = state;
  const configRef = useRef(config);
  configRef.current = config;
  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  const roundTimerRef = useRef<number | null>(null);
  const roundTimerStartRef = useRef<number | null>(null);
  const autoAdvanceRef = useRef<number | null>(null);

  // --- Compute progress ---

  const computeProgress = useCallback(() => {
    const items = configRef.current.getEnabledItems();
    let mastered = 0;
    const threshold = selectorRef.current.getConfig().automaticityThreshold;
    for (const id of items) {
      const auto = selectorRef.current.getAutomaticity(id);
      if (auto !== null && auto > threshold) mastered++;
    }
    return { masteredCount: mastered, totalEnabledCount: items.length };
  }, []);

  // --- Round timer ---

  const stopRoundTimer = useCallback(() => {
    if (roundTimerRef.current) {
      clearInterval(roundTimerRef.current);
      roundTimerRef.current = null;
    }
    roundTimerStartRef.current = null;
    setTimerPct(100);
    setTimerText('');
    setTimerWarning(false);
    setTimerLastQuestion(false);
  }, []);

  // Forward declare for mutual recursion between timer expiry and nextQuestion
  const transitionToRoundCompleteRef = useRef<() => void>(null!);
  const nextQuestionRef = useRef<() => void>(null!);

  const transitionToRoundComplete = useCallback(() => {
    const roundDurationMs = roundTimerStartRef.current
      ? Date.now() - roundTimerStartRef.current
      : 0;
    stopRoundTimer();
    setState((prev) => {
      const s = engineRoundComplete(prev);
      return { ...s, roundDurationMs };
    });
  }, [stopRoundTimer]);
  transitionToRoundCompleteRef.current = transitionToRoundComplete;

  const handleRoundTimerExpiry = useCallback(() => {
    if (stateRef.current.phase !== 'active') return;

    setState((prev) => {
      const next = engineRoundTimerExpired(prev);
      if (next.answered) {
        // User is on feedback screen — transition now
        setTimeout(() => transitionToRoundCompleteRef.current(), 0);
      } else {
        setTimerLastQuestion(true);
      }
      return next;
    });
  }, []);

  const startRoundTimer = useCallback(() => {
    if (roundTimerRef.current) clearInterval(roundTimerRef.current);
    roundTimerStartRef.current = Date.now();

    setTimerPct(100);
    setTimerText(formatRoundTime(ROUND_DURATION_MS));
    setTimerWarning(false);
    setTimerLastQuestion(false);

    roundTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - roundTimerStartRef.current!;
      const remaining = ROUND_DURATION_MS - elapsed;
      const pct = Math.max(0, (remaining / ROUND_DURATION_MS) * 100);

      setTimerPct(pct);
      setTimerText(formatRoundTime(remaining));
      setTimerWarning(remaining <= 10000 && remaining > 0);

      if (remaining <= 0) {
        if (roundTimerRef.current) clearInterval(roundTimerRef.current);
        roundTimerRef.current = null;
        setTimerPct(0);
        setTimerText('0:00');
        setTimerWarning(false);
        handleRoundTimerExpiry();
      }
    }, TIMER_TICK_MS);
  }, [handleRoundTimerExpiry]);

  // --- Engine actions ---

  const nextQuestion = useCallback(() => {
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }

    // If round timer expired, transition to round-complete
    if (stateRef.current.roundTimerExpired) {
      transitionToRoundCompleteRef.current();
      return;
    }

    const items = configRef.current.getEnabledItems();
    if (items.length === 0) return;

    const nextItemId = selectorRef.current.selectNext(items);
    setState((prev) => engineNextQuestion(prev, nextItemId, Date.now()));

    if (configRef.current.onPresent) {
      configRef.current.onPresent(nextItemId);
    }
  }, []);
  nextQuestionRef.current = nextQuestion;

  const submitAnswer = useCallback((input: string) => {
    const s = stateRef.current;
    if (s.phase !== 'active' || s.answered) return;

    const responseTime = Date.now() - s.questionStartTime!;
    const result = configRef.current.checkAnswer(s.currentItemId!, input);
    selectorRef.current.recordResponse(
      s.currentItemId!,
      responseTime,
      result.correct,
    );

    setState((prev) => {
      let next = engineSubmitAnswer(prev, result.correct, result.correctAnswer);
      next = {
        ...next,
        roundResponseTimes: [...next.roundResponseTimes, responseTime],
      };
      const allMastered = selectorRef.current.checkAllAutomatic(
        configRef.current.getEnabledItems(),
      );
      next = engineUpdateMasteryAfterAnswer(next, allMastered);
      const progress = computeProgress();
      next = engineUpdateProgress(
        next,
        progress.masteredCount,
        progress.totalEnabledCount,
      );
      return next;
    });

    if (configRef.current.onAnswer) {
      configRef.current.onAnswer(
        s.currentItemId!,
        result,
        responseTime,
      );
    }

    // Auto-advance or handle timer expiry
    if (stateRef.current.roundTimerExpired) {
      setTimeout(() => {
        if (stateRef.current.phase === 'active') {
          transitionToRoundCompleteRef.current();
        }
      }, 600);
    } else {
      autoAdvanceRef.current = setTimeout(() => {
        if (stateRef.current.phase === 'active' && stateRef.current.answered) {
          nextQuestionRef.current();
        }
      }, AUTO_ADVANCE_MS);
    }
  }, [computeProgress]);

  const start = useCallback(() => {
    if (configRef.current.onStart) configRef.current.onStart();

    setState((prev) => {
      let next = engineStart(prev);
      const progress = computeProgress();
      next = engineUpdateProgress(
        next,
        progress.masteredCount,
        progress.totalEnabledCount,
      );
      return next;
    });

    startRoundTimer();
    // nextQuestion needs to run after state update
    setTimeout(() => nextQuestionRef.current(), 0);
  }, [startRoundTimer, computeProgress]);

  const continueQuiz = useCallback(() => {
    setState(engineContinueRound);
    startRoundTimer();
    setTimeout(() => nextQuestionRef.current(), 0);
  }, [startRoundTimer]);

  const stop = useCallback(() => {
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }
    stopRoundTimer();
    setState(engineStop);
    if (configRef.current.onStop) configRef.current.onStop();
  }, [stopRoundTimer]);

  const updateIdleMessage = useCallback(() => {
    if (stateRef.current.phase !== 'idle') return;
    const items = configRef.current.getEnabledItems();
    setState((prev) =>
      engineUpdateIdleMessage(
        prev,
        selectorRef.current.checkAllAutomatic(items),
        selectorRef.current.checkNeedsReview(items),
      )
    );
  }, []);

  // --- Keyboard routing ---

  useEffect(() => {
    if (state.phase === 'idle') return;

    function handleKeydown(e: KeyboardEvent) {
      const routed = engineRouteKey(stateRef.current, e.key);
      switch (routed.action) {
        case 'stop':
          e.stopImmediatePropagation();
          stop();
          break;
        case 'next':
          e.preventDefault();
          if (autoAdvanceRef.current) {
            clearTimeout(autoAdvanceRef.current);
            autoAdvanceRef.current = null;
          }
          nextQuestionRef.current();
          break;
        case 'continue':
          e.preventDefault();
          continueQuiz();
          break;
        case 'delegate':
          if (configRef.current.handleKey) {
            configRef.current.handleKey(e, { submitAnswer });
          }
          break;
        case 'ignore':
          break;
      }
    }

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [state.phase !== 'idle', stop, continueQuiz, submitAnswer]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (roundTimerRef.current) clearInterval(roundTimerRef.current);
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    };
  }, []);

  return {
    state,
    timerPct,
    timerText,
    timerWarning,
    timerLastQuestion,
    start,
    stop,
    submitAnswer,
    nextQuestion,
    continueQuiz,
    updateIdleMessage,
  };
}
