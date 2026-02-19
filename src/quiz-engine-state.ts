// Pure state transitions for the quiz engine.
// No DOM, no timers, no side effects — just data in, data out.

import type { EngineState } from './types.ts';

/** Create the initial (idle) engine state. */
export function initialEngineState(): EngineState {
  return {
    phase: 'idle', // 'idle' | 'active' | 'round-complete' | 'calibration-intro' | 'calibrating' | 'calibration-results'
    currentItemId: null,
    answered: false,
    questionStartTime: null,

    // Session tracking
    questionCount: 0,
    quizStartTime: null,

    // Round tracking
    roundNumber: 0,
    roundAnswered: 0,
    roundCorrect: 0,
    roundTimerExpired: false,
    roundResponseTimes: [],
    roundDurationMs: 0,

    // Progress tracking
    masteredCount: 0,
    totalEnabledCount: 0,

    // Feedback
    feedbackText: '',
    feedbackClass: 'feedback',
    timeDisplayText: '',
    hintText: '',

    // Mastery message
    masteryText: '',
    showMastery: false,

    // Calibration
    calibrationBaseline: null,

    // UI visibility
    quizActive: false,
    answersEnabled: false,
  };
}

/**
 * Transition: start the quiz (first round).
 * Caller should invoke mode.onStart() separately, then call engineNextQuestion.
 */
export function engineStart(state: EngineState): EngineState {
  return {
    ...state,
    phase: 'active',
    questionCount: 0,
    quizStartTime: Date.now(),
    quizActive: true,
    showMastery: false,
    roundNumber: 1,
    roundAnswered: 0,
    roundCorrect: 0,
    roundTimerExpired: false,
    roundResponseTimes: [],
  };
}

/** Transition: present the next question. */
export function engineNextQuestion(state: EngineState, nextItemId: string, nowMs: number): EngineState {
  return {
    ...state,
    currentItemId: nextItemId,
    answered: false,
    questionStartTime: nowMs,
    questionCount: state.questionCount + 1,
    feedbackText: '',
    feedbackClass: 'feedback',
    timeDisplayText: '',
    hintText: '',
    answersEnabled: true,
  };
}

/** Transition: submit an answer. */
export function engineSubmitAnswer(state: EngineState, isCorrect: boolean, correctAnswer: string): EngineState {
  return {
    ...state,
    answered: true,
    answersEnabled: false,
    feedbackText: isCorrect ? 'Correct!' : 'Incorrect \u2014 ' + correctAnswer,
    feedbackClass: isCorrect ? 'feedback correct' : 'feedback incorrect',
    timeDisplayText: '',
    hintText: 'Tap anywhere or press Space for next',
    roundAnswered: state.roundAnswered + 1,
    roundCorrect: state.roundCorrect + (isCorrect ? 1 : 0),
  };
}

/**
 * Transition: mark the round timer as expired.
 * The round doesn't end immediately — the user can finish their current question.
 */
export function engineRoundTimerExpired(state: EngineState): EngineState {
  return {
    ...state,
    roundTimerExpired: true,
  };
}

/**
 * Transition: round is complete, show results.
 */
export function engineRoundComplete(state: EngineState): EngineState {
  return {
    ...state,
    phase: 'round-complete',
    answered: false,
    answersEnabled: false,
    currentItemId: null,
    feedbackText: '',
    feedbackClass: 'feedback',
    hintText: '',
  };
}

/**
 * Transition: continue to the next round.
 * Resets round counters but preserves session totals and quiz state.
 */
export function engineContinueRound(state: EngineState): EngineState {
  return {
    ...state,
    phase: 'active',
    roundNumber: state.roundNumber + 1,
    roundAnswered: 0,
    roundCorrect: 0,
    roundTimerExpired: false,
    roundResponseTimes: [],
  };
}

/**
 * Transition: enter calibration intro screen.
 * Shows explanation and a Start button; quiz controls are hidden.
 */
export function engineCalibrationIntro(state: EngineState, hintOverride?: string): EngineState {
  return {
    ...state,
    phase: 'calibration-intro',
    showMastery: false,
    quizActive: true,
    answersEnabled: false,
    feedbackText: 'Quick Speed Check',
    feedbackClass: 'feedback',
    hintText: hintOverride !== undefined
      ? hintOverride
      : 'We\u2019ll measure your tap speed to set personalized targets. Tap each highlighted button as fast as you can \u2014 10 taps total.',
    timeDisplayText: '',
    calibrationBaseline: null,
  };
}

/**
 * Transition: calibration trials are running.
 * Buttons enabled for tapping; trial counter shown in timeDisplay.
 */
export function engineCalibrating(state: EngineState, hintOverride?: string): EngineState {
  return {
    ...state,
    phase: 'calibrating',
    answersEnabled: true,
    feedbackText: 'Speed check!',
    hintText: hintOverride !== undefined
      ? hintOverride
      : 'Tap the highlighted button as fast as you can',
  };
}

/** Transition: calibration complete, show results. */
export function engineCalibrationResults(state: EngineState, baseline: number): EngineState {
  return {
    ...state,
    phase: 'calibration-results',
    answersEnabled: false,
    feedbackText: 'Speed Check Complete',
    feedbackClass: 'feedback',
    hintText: '',
    timeDisplayText: '',
    calibrationBaseline: baseline,
  };
}

/**
 * Transition: stop the quiz (return to idle).
 * Works from any phase — quiz, calibration, or already idle.
 */
export function engineStop(_state: EngineState): EngineState {
  return initialEngineState();
}

/**
 * Transition: update the idle mastery/review message.
 * No-op if the engine is active.
 */
export function engineUpdateIdleMessage(state: EngineState, allMastered: boolean, needsReview: boolean): EngineState {
  if (state.phase !== 'idle') return state;
  if (allMastered) {
    return {
      ...state,
      masteryText: 'Looks like you\u2019ve got this!',
      showMastery: true,
    };
  }
  if (needsReview) {
    return { ...state, masteryText: 'Time to review?', showMastery: true };
  }
  return { ...state, masteryText: '', showMastery: false };
}

/**
 * Transition: update mastery message after an answer (during quiz).
 */
export function engineUpdateMasteryAfterAnswer(state: EngineState, allMastered: boolean): EngineState {
  if (allMastered) {
    return {
      ...state,
      masteryText: 'Looks like you\u2019ve got this!',
      showMastery: true,
    };
  }
  return { ...state, showMastery: false };
}

/**
 * Transition: update progress counts (mastered vs total enabled items).
 */
export function engineUpdateProgress(state: EngineState, masteredCount: number, totalEnabledCount: number): EngineState {
  return { ...state, masteredCount, totalEnabledCount };
}

/** Route a keydown event to an action descriptor. Pure -- no DOM. */
export function engineRouteKey(state: EngineState, key: string): { action: 'stop' | 'next' | 'continue' | 'delegate' | 'ignore' } {
  if (state.phase === 'idle') return { action: 'ignore' };
  if (key === 'Escape') return { action: 'stop' };
  if (state.phase === 'round-complete') {
    if (key === ' ' || key === 'Enter') return { action: 'continue' };
    return { action: 'ignore' };
  }
  if (state.phase !== 'active') return { action: 'ignore' };
  if ((key === ' ' || key === 'Enter') && state.answered) {
    return { action: 'next' };
  }
  if (!state.answered) return { action: 'delegate' };
  return { action: 'ignore' };
}
