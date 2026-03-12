// useQuizEngine — Preact hook wrapping the quiz engine lifecycle.
// Owns the pure state machine (quiz-engine-state.ts), round timer,
// auto-advance timer, keyboard routing, and calibration lifecycle.
// Components render reactively from the returned state — no manual
// DOM manipulation.

import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type {
  AdaptiveSelector,
  CheckAnswerResult,
  EngineState,
} from '../types.ts';
import { isCalibrationPhase } from '../types.ts';
import type { FixtureDetail } from '../fixtures/quiz-page.ts';
import type { SpeedCheckFixture } from '../ui/speed-check.tsx';
import {
  engineCalibrationIntro,
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
const TIMER_TICK_MS = 200;
const LAST_QUESTION_CAP_MS = 30000;

/** True when the primary pointer is coarse (phone/tablet). */
const IS_TOUCH_PRIMARY = typeof globalThis.matchMedia === 'function' &&
  globalThis.matchMedia('(pointer: coarse)').matches;

const HINT_ADVANCE = IS_TOUCH_PRIMARY ? '' : 'Space for next';
const HINT_CONTINUE = IS_TOUCH_PRIMARY ? '' : 'Space to continue';

// ---------------------------------------------------------------------------
// Config type — what the mode provides to the engine
// ---------------------------------------------------------------------------

export type QuizEngineConfig = {
  /** Get currently enabled item IDs (respects scope). */
  getEnabledItems: () => string[];
  /** Check user's answer against correct answer. */
  checkAnswer: (itemId: string, input: string) => CheckAnswerResult;
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

  /** True when phase is calibration-intro, calibrating, or calibration-results. */
  calibrating: boolean;
  /** Fixture data for SpeedCheck component (set via __fixture__ events). */
  calibrationFixture: SpeedCheckFixture | undefined;

  // Actions
  start: () => void;
  stop: () => void;
  submitAnswer: (input: string) => void;
  nextQuestion: () => void;
  continueQuiz: () => void;
  updateIdleMessage: () => void;
  /** Transition to calibration-intro phase. */
  startCalibration: () => void;
  /** Transition back to idle (end calibration). */
  endCalibration: () => void;
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

/** True when `?fixtures` is in the page URL. */
const FIXTURES_ENABLED = typeof globalThis.location !== 'undefined' &&
  new URLSearchParams(globalThis.location.search).has('fixtures');

export function useQuizEngine(
  config: QuizEngineConfig,
  selector: AdaptiveSelector,
  fixtureTarget?: HTMLElement,
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
  const roundDurationSnapshotRef = useRef<number | null>(null);
  const lastQuestionCapRef = useRef<number | null>(null);

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
    if (lastQuestionCapRef.current) {
      clearTimeout(lastQuestionCapRef.current);
      lastQuestionCapRef.current = null;
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
    // Use snapshot captured when the last answer was submitted, so feedback
    // screen dwell time is excluded from the displayed round duration.
    const roundDurationMs = roundDurationSnapshotRef.current ??
      (roundTimerStartRef.current
        ? Date.now() - roundTimerStartRef.current
        : 0);
    roundDurationSnapshotRef.current = null;
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
        // User is on feedback screen — round is effectively over.
        // Use ROUND_DURATION_MS (not Date.now()) because the setInterval
        // callback can fire late when the browser tab is backgrounded.
        roundDurationSnapshotRef.current = ROUND_DURATION_MS;
        setTimerLastQuestion(true);
        return { ...next, hintText: HINT_CONTINUE };
      } else {
        setTimerLastQuestion(true);
        // Cap the last question at 30 seconds — if the user walks away,
        // end the round automatically.
        lastQuestionCapRef.current = setTimeout(() => {
          if (stateRef.current.phase === 'active') {
            transitionToRoundCompleteRef.current();
          }
        }, LAST_QUESTION_CAP_MS);
      }
      return next;
    });
  }, []);

  const startRoundTimer = useCallback(() => {
    if (roundTimerRef.current) clearInterval(roundTimerRef.current);
    roundTimerStartRef.current = Date.now();
    roundDurationSnapshotRef.current = null;

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
    // If round timer expired, transition to round-complete
    if (stateRef.current.roundTimerExpired) {
      transitionToRoundCompleteRef.current();
      return;
    }

    const items = configRef.current.getEnabledItems();
    if (items.length === 0) return;

    // Clear focus from the previously-answered button so it doesn't
    // carry a stuck :hover/:focus style into the next question.
    const el = document.activeElement;
    if (el instanceof HTMLElement && el.matches('.answer-btn, .note-btn')) {
      el.blur();
    }

    const nextItemId = selectorRef.current.selectNext(items);
    setState((prev) => engineNextQuestion(prev, nextItemId, Date.now()));
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
      let next = engineSubmitAnswer(
        prev,
        result.correct,
        result.correctAnswer,
        HINT_ADVANCE,
        input,
      );
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

    // Handle timer expiry — clear the last-question cap timer (user answered
    // in time) and snapshot round duration so feedback dwell time is excluded.
    // Cap to ROUND_DURATION_MS + LAST_QUESTION_CAP_MS in case the browser
    // was backgrounded and Date.now() jumped forward.
    if (stateRef.current.roundTimerExpired) {
      if (lastQuestionCapRef.current) {
        clearTimeout(lastQuestionCapRef.current);
        lastQuestionCapRef.current = null;
      }
      const elapsed = roundTimerStartRef.current
        ? Date.now() - roundTimerStartRef.current
        : 0;
      roundDurationSnapshotRef.current = Math.min(
        elapsed,
        ROUND_DURATION_MS + LAST_QUESTION_CAP_MS,
      );
      setState((prev) => ({ ...prev, hintText: HINT_CONTINUE }));
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
    stopRoundTimer();
    setState(engineStop);
    setCalibrationFixture(undefined);
    if (configRef.current.onStop) configRef.current.onStop();
  }, [stopRoundTimer]);

  // --- Calibration lifecycle ---

  const [calibrationFixture, setCalibrationFixture] = useState<
    SpeedCheckFixture | undefined
  >();

  const startCalibration = useCallback(() => {
    setCalibrationFixture(undefined);
    setState(engineCalibrationIntro);
  }, []);

  const endCalibration = useCallback(() => {
    setCalibrationFixture(undefined);
    setState(engineStop);
  }, []);

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
          nextQuestionRef.current();
          break;
        case 'continue':
          // If a button is focused, let its native click fire instead
          if (e.target instanceof HTMLButtonElement) break;
          e.preventDefault();
          continueQuiz();
          break;
        case 'delegate':
          // Skip delegation when typing in a text input (AnswerInput handles it)
          if (e.target instanceof HTMLInputElement) break;
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
      if (lastQuestionCapRef.current) clearTimeout(lastQuestionCapRef.current);
    };
  }, []);

  // --- Fixture injection (dev/screenshot only) ---

  useEffect(() => {
    if (!FIXTURES_ENABLED || !fixtureTarget) return;
    const target = fixtureTarget; // capture for closure narrowing

    function handleFixture(e: Event) {
      const detail = (e as CustomEvent<FixtureDetail>).detail;
      if (!detail) return;

      // Apply engine state override
      if (detail.engineState) {
        setState((prev) => ({ ...prev, ...detail.engineState }));
      }

      // Apply timer overrides
      if (detail.timerPct !== undefined) setTimerPct(detail.timerPct);
      if (detail.timerText !== undefined) setTimerText(detail.timerText);
      if (detail.timerWarning !== undefined) {
        setTimerWarning(detail.timerWarning);
      }
      if (detail.timerLastQuestion !== undefined) {
        setTimerLastQuestion(detail.timerLastQuestion);
      }

      // Apply calibration fixture
      if (detail.calibration) {
        const calPhase = detail.calibration.phase === 'results'
          ? 'calibration-results' as const
          : detail.calibration.phase === 'running'
          ? 'calibrating' as const
          : 'calibration-intro' as const;
        setState((prev) => ({ ...prev, phase: calPhase }));
        setCalibrationFixture(detail.calibration);
      }

      // Signal completion so Playwright can waitForSelector
      target.setAttribute('data-fixture-applied', 'true');
    }

    target.addEventListener('__fixture__', handleFixture);
    return () => target.removeEventListener('__fixture__', handleFixture);
  }, [fixtureTarget]);

  return {
    state,
    timerPct,
    timerText,
    timerWarning,
    timerLastQuestion,
    calibrating: isCalibrationPhase(state.phase),
    calibrationFixture,
    start,
    stop,
    submitAnswer,
    nextQuestion,
    continueQuiz,
    updateIdleMessage,
    startCalibration,
    endCalibration,
  };
}
