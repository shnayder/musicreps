// Pure state transitions for the quiz engine.
// No DOM, no timers, no side effects — just data in, data out.
// ES module — exports stripped for browser inlining.

/**
 * Create the initial (idle) engine state.
 * @returns {EngineState}
 */
export function initialEngineState() {
  return {
    phase: 'idle',          // 'idle' | 'active'
    currentItemId: null,
    answered: false,
    questionStartTime: null,

    // Feedback
    feedbackText: '',
    feedbackClass: 'feedback',
    timeDisplayText: '',
    hintText: '',

    // Mastery message
    masteryText: '',
    showMastery: false,

    // UI visibility
    showStartBtn: true,
    showStopBtn: false,
    showHeatmapBtn: true,
    showStatsControls: true,
    quizActive: false,
    answersEnabled: false,
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
    showStartBtn: false,
    showStopBtn: true,
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
    feedbackText: '',
    feedbackClass: 'feedback',
    timeDisplayText: '',
    hintText: '',
    answersEnabled: true,
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
    timeDisplayText: responseTimeMs + ' ms',
    hintText: 'Tap anywhere or press Space for next',
  };
}

/**
 * Transition: stop the quiz (return to idle).
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
 * Route a keydown event to an action descriptor. Pure — no DOM.
 * @param {EngineState} state
 * @param {string} key - e.key value
 * @returns {{ action: 'stop' | 'next' | 'delegate' | 'ignore' }}
 */
export function engineRouteKey(state, key) {
  if (state.phase !== 'active') return { action: 'ignore' };
  if (key === 'Escape') return { action: 'stop' };
  if ((key === ' ' || key === 'Enter') && state.answered) return { action: 'next' };
  if (!state.answered) return { action: 'delegate' };
  return { action: 'ignore' };
}
