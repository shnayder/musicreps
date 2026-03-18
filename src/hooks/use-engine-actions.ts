// useEngineActions — core quiz engine actions (start, continue, next, submit, idle).
// Extracted from useQuizEngine for clarity.

import { useCallback, useRef } from 'preact/hooks';
import type { AdaptiveSelector, EngineState } from '../types.ts';
import {
  engineContinueRound,
  engineNextQuestion,
  engineStart,
  engineStop,
  engineSubmitAnswer,
  engineUpdateIdleMessage,
  engineUpdateMasteryAfterAnswer,
  engineUpdateProgress,
} from '../quiz-engine-state.ts';
import { effectiveRoundMs, LAST_QUESTION_CAP_MS } from './use-round-timer.ts';
import { HINT_CONTINUE, IS_TOUCH_PRIMARY } from './use-round-transitions.ts';
import type { RoundTimerHandle } from './use-round-timer.ts';
import type { QuizEngineConfig } from './quiz-engine-types.ts';

const HINT_ADVANCE = IS_TOUCH_PRIMARY ? '' : 'Space for next';

// ---------------------------------------------------------------------------
// Standalone helpers — called from useCallback wrappers inside the hook
// ---------------------------------------------------------------------------

function computeProgress(
  configRef: { current: QuizEngineConfig },
  selectorRef: { current: AdaptiveSelector },
): { masteredCount: number; totalEnabledCount: number } {
  const items = configRef.current.getEnabledItems();
  let mastered = 0;
  for (const id of items) {
    const speed = selectorRef.current.getSpeedScore(id);
    if (speed !== null && speed >= 0.9) mastered++;
  }
  return { masteredCount: mastered, totalEnabledCount: items.length };
}

function processSubmitAnswer(
  stateRef: { current: EngineState },
  configRef: { current: QuizEngineConfig },
  selectorRef: { current: AdaptiveSelector },
  setState: (fn: (prev: EngineState) => EngineState) => void,
  timer: RoundTimerHandle,
  input: string,
): void {
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
    const p = computeProgress(configRef, selectorRef);
    return engineUpdateProgress(next, p.masteredCount, p.totalEnabledCount);
  });

  configRef.current.onAnswer?.(s.currentItemId!, result, responseTime);

  if (stateRef.current.roundTimerExpired) {
    if (timer.lastQuestionCapRef.current) {
      clearTimeout(timer.lastQuestionCapRef.current);
      timer.lastQuestionCapRef.current = null;
    }
    const elapsed = timer.roundTimerStartRef.current
      ? Date.now() - timer.roundTimerStartRef.current
      : 0;
    timer.roundDurationSnapshotRef.current = Math.min(
      elapsed,
      effectiveRoundMs + LAST_QUESTION_CAP_MS,
    );
    setState((prev) => ({ ...prev, hintText: HINT_CONTINUE }));
  }
}

export type EngineActionsHandle = {
  nextQuestionRef: { current: () => void };
  start: () => void;
  /** Reset engine state to idle (no timer/callback cleanup). */
  stopEngine: () => void;
  continueQuiz: () => void;
  nextQuestion: () => void;
  submitAnswer: (input: string) => void;
  updateIdleMessage: () => void;
};

export function useEngineActions(
  stateRef: { current: EngineState },
  configRef: { current: QuizEngineConfig },
  selectorRef: { current: AdaptiveSelector },
  setState: (fn: (prev: EngineState) => EngineState) => void,
  timer: RoundTimerHandle,
  transitionToRoundCompleteRef: { current: () => void },
): EngineActionsHandle {
  const nextQuestionRef = useRef<() => void>(null!);

  const nextQuestion = useCallback(() => {
    if (stateRef.current.roundTimerExpired) {
      transitionToRoundCompleteRef.current();
      return;
    }
    const items = configRef.current.getEnabledItems();
    if (items.length === 0) return;
    const el = document.activeElement;
    if (el instanceof HTMLElement && el.matches('.answer-btn, .note-btn')) {
      el.blur();
    }
    const nextItemId = selectorRef.current.selectNext(items);
    setState((prev) => engineNextQuestion(prev, nextItemId, Date.now()));
  }, []);
  nextQuestionRef.current = nextQuestion;

  const submitAnswer = useCallback(
    (input: string) =>
      processSubmitAnswer(
        stateRef,
        configRef,
        selectorRef,
        setState,
        timer,
        input,
      ),
    [],
  );

  const start = useCallback(() => {
    configRef.current.onStart?.();
    setState((prev) => {
      const next = engineStart(prev);
      const p = computeProgress(configRef, selectorRef);
      return engineUpdateProgress(next, p.masteredCount, p.totalEnabledCount);
    });
    timer.startRoundTimer();
    setTimeout(() => nextQuestionRef.current(), 0);
  }, [timer.startRoundTimer]);

  const stopEngine = useCallback(() => {
    setState(engineStop);
  }, []);

  const continueQuiz = useCallback(() => {
    setState(engineContinueRound);
    timer.startRoundTimer();
    setTimeout(() => nextQuestionRef.current(), 0);
  }, [timer.startRoundTimer]);

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

  return {
    nextQuestionRef,
    start,
    stopEngine,
    continueQuiz,
    nextQuestion,
    submitAnswer,
    updateIdleMessage,
  };
}
