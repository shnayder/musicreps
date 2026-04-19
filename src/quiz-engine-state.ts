// Pure state transitions for the quiz engine.
// No DOM, no timers, no side effects — just data in, data out.

import type { EngineState } from './types.ts';

/** Create the initial (idle) engine state. */
export function initialEngineState(): EngineState {
  return {
    phase: 'idle', // 'idle' | 'active' | 'round-complete'
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
    roundUseFlats: false,

    // Progress tracking
    masteredCount: 0,
    totalEnabledCount: 0,

    // Feedback
    feedbackText: '',
    feedbackClass: 'feedback',
    feedbackCorrect: null,
    feedbackDisplayAnswer: null,
    feedbackUserInput: null,

    hintText: '',

    // Mastery message
    masteryText: '',
    showMastery: false,

    // UI visibility
    quizActive: false,
    answersEnabled: false,
  };
}

/**
 * Transition: start the quiz (first round).
 * Caller should invoke mode.onStart() separately, then call engineNextQuestion.
 * `rng` is injectable for deterministic tests; defaults to Math.random.
 */
export function engineStart(
  state: EngineState,
  rng: () => number = Math.random,
): EngineState {
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
    roundUseFlats: rng() < 0.5,
  };
}

/** Transition: present the next question. */
export function engineNextQuestion(
  state: EngineState,
  nextItemId: string,
  nowMs: number,
): EngineState {
  return {
    ...state,
    currentItemId: nextItemId,
    answered: false,
    questionStartTime: nowMs,
    questionCount: state.questionCount + 1,
    feedbackText: '',
    feedbackClass: 'feedback',
    feedbackCorrect: null,
    feedbackDisplayAnswer: null,
    feedbackUserInput: null,

    hintText: '',
    answersEnabled: true,
  };
}

/** Transition: submit an answer. */
export function engineSubmitAnswer(
  state: EngineState,
  isCorrect: boolean,
  correctAnswer: string,
  hintText = 'Space for next',
  userInput?: string,
): EngineState {
  return {
    ...state,
    answered: true,
    answersEnabled: false,
    feedbackText: isCorrect ? 'Correct!' : 'Incorrect \u2014 ' + correctAnswer,
    feedbackClass: isCorrect ? 'feedback correct' : 'feedback incorrect',
    feedbackCorrect: isCorrect,
    feedbackDisplayAnswer: correctAnswer,
    feedbackUserInput: userInput ?? null,

    hintText,
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
    feedbackCorrect: null,
    feedbackDisplayAnswer: null,
    feedbackUserInput: null,
    hintText: '',
  };
}

/**
 * Transition: continue to the next round.
 * Resets round counters but preserves session totals and quiz state.
 * `rng` is injectable for deterministic tests; defaults to Math.random.
 */
export function engineContinueRound(
  state: EngineState,
  rng: () => number = Math.random,
): EngineState {
  return {
    ...state,
    phase: 'active',
    roundNumber: state.roundNumber + 1,
    roundAnswered: 0,
    roundCorrect: 0,
    roundTimerExpired: false,
    roundResponseTimes: [],
    roundUseFlats: rng() < 0.5,
  };
}

/**
 * Transition: stop the quiz (return to idle).
 */
export function engineStop(_state: EngineState): EngineState {
  return initialEngineState();
}

/**
 * Transition: update the idle mastery/review message.
 * No-op if the engine is active.
 */
export function engineUpdateIdleMessage(
  state: EngineState,
  allMastered: boolean,
  needsReview: boolean,
): EngineState {
  if (state.phase !== 'idle') return state;
  // Review takes priority: stale items need attention even if all are fast.
  if (needsReview) {
    return { ...state, masteryText: 'Time to review?', showMastery: true };
  }
  if (allMastered) {
    return {
      ...state,
      masteryText: 'Looks like you\u2019ve got this!',
      showMastery: true,
    };
  }
  return { ...state, masteryText: '', showMastery: false };
}

/**
 * Transition: update mastery message after an answer (during quiz).
 */
export function engineUpdateMasteryAfterAnswer(
  state: EngineState,
  allMastered: boolean,
): EngineState {
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
export function engineUpdateProgress(
  state: EngineState,
  masteredCount: number,
  totalEnabledCount: number,
): EngineState {
  return { ...state, masteredCount, totalEnabledCount };
}

/** Route a keydown event to an action descriptor. Pure -- no DOM. */
export function engineRouteKey(
  state: EngineState,
  key: string,
): { action: 'stop' | 'next' | 'continue' | 'delegate' | 'ignore' } {
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
