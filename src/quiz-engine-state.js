// Pure state transitions for the quiz engine.
// No DOM, no timers, no side effects — just data in, data out.
// ES module — exports stripped for browser inlining.

/**
 * Create the initial (idle) engine state.
 * @returns {EngineState}
 */
export function initialEngineState() {
  return {
    phase: 'idle',          // 'idle' | 'active' | 'calibration-intro' | 'calibrating' | 'calibration-results'
    currentItemId: null,
    answered: false,
    questionStartTime: null,

    // Session tracking
    questionCount: 0,
    quizStartTime: null,

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
    showStartBtn: true,
    showStopBtn: false,
    showHeatmapBtn: true,
    showStatsControls: true,
    quizActive: false,
    answersEnabled: false,
    timedOut: false,
  };
}

/**
 * Transition: start the quiz.
 * Caller should invoke mode.onStart() separately, then call engineNextQuestion.
 */
export function engineStart(state) {
  return {
    ...state,
    phase: 'active',
    questionCount: 0,
    quizStartTime: Date.now(),
    showStartBtn: false,
    showStopBtn: false,
    showHeatmapBtn: false,
    showStatsControls: false,
    quizActive: true,
    showMastery: false,
  };
}

/**
 * Transition: present the next question.
 * @param {EngineState} state
 * @param {string} nextItemId - selected by the adaptive selector
 * @param {number} nowMs - current timestamp (Date.now())
 */
export function engineNextQuestion(state, nextItemId, nowMs) {
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
    timedOut: false,
  };
}

/**
 * Transition: submit an answer.
 * @param {EngineState} state
 * @param {boolean} isCorrect
 * @param {string} correctAnswer - display string for incorrect feedback
 * @param {number} responseTimeMs
 */
export function engineSubmitAnswer(state, isCorrect, correctAnswer, responseTimeMs) {
  return {
    ...state,
    answered: true,
    answersEnabled: false,
    feedbackText: isCorrect ? 'Correct!' : 'Incorrect \u2014 ' + correctAnswer,
    feedbackClass: isCorrect ? 'feedback correct' : 'feedback incorrect',
    timeDisplayText: (responseTimeMs / 1000).toFixed(1) + 's',
    hintText: 'Tap anywhere or press Space for next',
    timedOut: false,
  };
}

/**
 * Transition: timer expired before user answered.
 * @param {EngineState} state
 * @param {string} correctAnswer - display string for the correct answer
 * @param {number} deadlineMs - the deadline that was active
 */
export function engineTimedOut(state, correctAnswer, deadlineMs) {
  return {
    ...state,
    answered: true,
    answersEnabled: false,
    feedbackText: 'Time\u2019s up \u2014 ' + correctAnswer,
    feedbackClass: 'feedback incorrect',
    timeDisplayText: 'limit: ' + (deadlineMs / 1000).toFixed(1) + 's',
    hintText: 'Tap anywhere or press Space for next',
    timedOut: true,
  };
}

/**
 * Transition: enter calibration intro screen.
 * Shows explanation and a Start button; quiz controls are hidden.
 */
export function engineCalibrationIntro(state) {
  return {
    ...state,
    phase: 'calibration-intro',
    showStartBtn: false,
    showStopBtn: false,
    showHeatmapBtn: false,
    showStatsControls: false,
    showMastery: false,
    quizActive: true,
    answersEnabled: false,
    feedbackText: 'Quick Speed Check',
    feedbackClass: 'feedback',
    hintText: "We\u2019ll measure your tap speed to set personalized targets. Tap each highlighted button as fast as you can \u2014 10 taps total.",
    timeDisplayText: '',
    calibrationBaseline: null,
  };
}

/**
 * Transition: calibration trials are running.
 * Buttons enabled for tapping; trial counter shown in timeDisplay.
 */
export function engineCalibrating(state) {
  return {
    ...state,
    phase: 'calibrating',
    answersEnabled: true,
    feedbackText: 'Speed check!',
    hintText: 'Tap the highlighted button as fast as you can',
  };
}

/**
 * Transition: calibration complete, show results.
 * @param {number} baseline - measured motor baseline in ms
 */
export function engineCalibrationResults(state, baseline) {
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
export function engineStop(state) {
  return initialEngineState();
}

/**
 * Transition: update the idle mastery/review message.
 * No-op if the engine is active.
 */
export function engineUpdateIdleMessage(state, allMastered, needsReview) {
  if (state.phase !== 'idle') return state;
  if (allMastered) {
    return { ...state, masteryText: 'Looks like you\u2019ve got this!', showMastery: true };
  }
  if (needsReview) {
    return { ...state, masteryText: 'Time to review?', showMastery: true };
  }
  return { ...state, masteryText: '', showMastery: false };
}

/**
 * Transition: update mastery message after an answer (during quiz).
 */
export function engineUpdateMasteryAfterAnswer(state, allMastered) {
  if (allMastered) {
    return { ...state, masteryText: 'Looks like you\u2019ve got this!', showMastery: true };
  }
  return { ...state, showMastery: false };
}

/**
 * Transition: update progress counts (mastered vs total enabled items).
 */
export function engineUpdateProgress(state, masteredCount, totalEnabledCount) {
  return { ...state, masteredCount, totalEnabledCount };
}

/**
 * Route a keydown event to an action descriptor. Pure — no DOM.
 * @param {EngineState} state
 * @param {string} key - e.key value
 * @returns {{ action: string }} action is one of 'stop', 'next', 'delegate', 'ignore'
 */
export function engineRouteKey(state, key) {
  if (state.phase === 'idle') return { action: 'ignore' };
  if (key === 'Escape') return { action: 'stop' };
  if (state.phase !== 'active') return { action: 'ignore' };
  if ((key === ' ' || key === 'Enter') && state.answered) return { action: 'next' };
  if (!state.answered) return { action: 'delegate' };
  return { action: 'ignore' };
}
