// Shared quiz engine: manages adaptive selection, timing, countdown,
// feedback, and keyboard/tap handling for all quiz modes.
//
// Each quiz mode provides a config object; the engine handles the
// shared lifecycle. ES module — exports stripped for browser inlining.

export const TARGET_TIME = 3000;

/**
 * Create a quiz engine for a given mode.
 *
 * @param {object} mode - Quiz mode configuration:
 *   mode.id           - Unique mode identifier
 *   mode.storageNamespace - Key prefix for adaptive storage
 *   mode.getEnabledItems() - Returns array of item IDs eligible for quiz
 *   mode.presentQuestion(itemId) - Updates DOM to show the question
 *   mode.checkAnswer(itemId, input) - Returns { correct, correctAnswer }
 *   mode.onStart()    - Called when quiz starts (optional)
 *   mode.onStop()     - Called when quiz stops (optional)
 *   mode.handleKey(e, state) - Mode-specific key handling, return true if handled (optional)
 *
 * @param {HTMLElement} container - Root element containing quiz DOM elements.
 *   Expected children (found by class):
 *     .countdown-bar, .feedback, .time-display, .hint,
 *     .start-btn, .stop-btn, .heatmap-btn, .stats
 *
 * @returns {{ start, stop, submitAnswer, isActive, selector, storage }}
 */
export function createQuizEngine(mode, container) {
  const storage = createLocalStorageAdapter(mode.storageNamespace);
  const selector = createAdaptiveSelector(storage);

  let active = false;
  let currentItemId = null;
  let answered = false;
  let questionStartTime = null;
  let countdownInterval = null;
  let expired = false;

  // DOM references (scoped to container)
  const els = {
    countdownBar: container.querySelector('.countdown-bar'),
    feedback: container.querySelector('.feedback'),
    timeDisplay: container.querySelector('.time-display'),
    hint: container.querySelector('.hint'),
    startBtn: container.querySelector('.start-btn'),
    stopBtn: container.querySelector('.stop-btn'),
    heatmapBtn: container.querySelector('.heatmap-btn'),
    stats: container.querySelector('.stats'),
    quizArea: container.querySelector('.quiz-area'),
  };

  function startCountdown() {
    const bar = els.countdownBar;
    if (!bar) return;
    bar.style.width = '100%';
    bar.classList.remove('expired');
    expired = false;

    if (countdownInterval) clearInterval(countdownInterval);

    const startTime = Date.now();
    countdownInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, TARGET_TIME - elapsed);
      bar.style.width = (remaining / TARGET_TIME) * 100 + '%';

      if (remaining === 0 && !expired) {
        expired = true;
        bar.classList.add('expired');
        clearInterval(countdownInterval);
      }
    }, 50);
  }

  function clearFeedback() {
    if (els.feedback) {
      els.feedback.textContent = '';
      els.feedback.className = 'feedback';
    }
    if (els.timeDisplay) els.timeDisplay.textContent = '';
    if (els.hint) els.hint.textContent = '';
  }

  function setAnswerButtonsEnabled(enabled) {
    container.querySelectorAll('.answer-btn, .note-btn').forEach(btn => {
      btn.disabled = !enabled;
    });
  }

  function nextQuestion() {
    const items = mode.getEnabledItems();
    if (items.length === 0) return;

    currentItemId = selector.selectNext(items);
    answered = false;
    clearFeedback();
    setAnswerButtonsEnabled(true);
    mode.presentQuestion(currentItemId);
    questionStartTime = Date.now();
    startCountdown();
  }

  function submitAnswer(input) {
    if (!active || answered) return;

    const responseTime = Date.now() - questionStartTime;

    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }

    answered = true;
    setAnswerButtonsEnabled(false);

    const result = mode.checkAnswer(currentItemId, input);

    if (result.correct) {
      if (els.feedback) {
        els.feedback.textContent = 'Correct!';
        els.feedback.className = 'feedback correct';
      }
      selector.recordResponse(currentItemId, responseTime, true);
    } else {
      if (els.feedback) {
        els.feedback.textContent = 'Incorrect \u2014 ' + result.correctAnswer;
        els.feedback.className = 'feedback incorrect';
      }
      selector.recordResponse(currentItemId, responseTime, false);
    }

    if (els.timeDisplay) els.timeDisplay.textContent = responseTime + ' ms';
    if (els.hint) els.hint.textContent = 'Tap anywhere or press Space for next';

    // Let the mode react to the answer (e.g., highlight correct position)
    if (mode.onAnswer) {
      mode.onAnswer(currentItemId, result, responseTime);
    }
  }

  function start() {
    active = true;
    if (els.startBtn) els.startBtn.style.display = 'none';
    if (els.heatmapBtn) els.heatmapBtn.style.display = 'none';
    if (els.stopBtn) els.stopBtn.style.display = 'inline';
    if (els.quizArea) els.quizArea.classList.add('active');
    if (mode.onStart) mode.onStart();
    nextQuestion();
  }

  function stop() {
    active = false;
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    if (els.startBtn) els.startBtn.style.display = 'inline';
    if (els.heatmapBtn) els.heatmapBtn.style.display = 'inline';
    if (els.stopBtn) els.stopBtn.style.display = 'none';
    if (els.quizArea) els.quizArea.classList.remove('active');
    if (mode.onStop) mode.onStop();
  }

  // Keyboard handler — delegates mode-specific keys, handles shared keys
  function handleKeydown(e) {
    if (!active) return;

    if (e.key === 'Escape') {
      stop();
      return;
    }

    if ((e.key === ' ' || e.key === 'Enter') && answered) {
      e.preventDefault();
      nextQuestion();
      return;
    }

    // Delegate to mode for answer-specific keys
    if (!answered && mode.handleKey) {
      mode.handleKey(e, { submitAnswer });
    }
  }

  // Tap-to-advance handler
  function handleClick(e) {
    if (!active || !answered) return;
    if (e.target.closest('.answer-btn, .note-btn, .quiz-controls, .string-toggle')) return;
    nextQuestion();
  }

  // Attach event listeners (scoped to document since keys are global)
  function attach() {
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('click', handleClick);
  }

  function detach() {
    document.removeEventListener('keydown', handleKeydown);
    document.removeEventListener('click', handleClick);
  }

  return {
    start,
    stop,
    submitAnswer,
    nextQuestion,
    attach,
    detach,
    get isActive() { return active; },
    get isAnswered() { return answered; },
    selector,
    storage,
    els,
  };
}
