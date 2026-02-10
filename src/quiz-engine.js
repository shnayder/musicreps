// Shared quiz engine: manages adaptive selection, timing, countdown,
// feedback, and keyboard/tap handling for all quiz modes.
//
// Each quiz mode provides a config object; the engine handles the
// shared lifecycle. ES module — exports stripped for browser inlining.

export const TARGET_TIME = 3000;

/**
 * Create a keyboard handler for note input (C D E F G A B + #/b for accidentals).
 * Used by any mode where the answer is a note name.
 *
 * The handler keeps an internal timeout to allow a short window after a note key
 * is pressed for an accidental key (`#` / `b`) to be entered. Callers should
 * invoke `reset()` when the quiz stops and before restarting to clear any pending
 * note and prevent stale input from being submitted after the quiz has ended.
 *
 * @param {function} submitAnswer - Called with the note string (e.g. 'C', 'C#', 'Db')
 * @param {function} [allowAccidentals] - Returns true if accidentals are enabled
 * @returns {{ handleKey(e): boolean, reset(): void }}
 */
export function createNoteKeyHandler(submitAnswer, allowAccidentals = () => true) {
  let pendingNote = null;
  let pendingTimeout = null;

  function reset() {
    if (pendingTimeout) clearTimeout(pendingTimeout);
    pendingNote = null;
    pendingTimeout = null;
  }

  function handleKey(e) {
    const key = e.key.toUpperCase();

    // Handle # for sharps or b for flats after a pending note
    if (pendingNote && allowAccidentals()) {
      if (e.key === '#' || (e.shiftKey && e.key === '3')) {
        e.preventDefault();
        clearTimeout(pendingTimeout);
        submitAnswer(pendingNote + '#');
        pendingNote = null;
        pendingTimeout = null;
        return true;
      }
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        clearTimeout(pendingTimeout);
        submitAnswer(pendingNote + 'b');
        pendingNote = null;
        pendingTimeout = null;
        return true;
      }
    }

    if ('CDEFGAB'.includes(key)) {
      e.preventDefault();
      if (pendingTimeout) clearTimeout(pendingTimeout);

      if (!allowAccidentals()) {
        submitAnswer(key);
      } else {
        pendingNote = key;
        pendingTimeout = setTimeout(() => {
          submitAnswer(pendingNote);
          pendingNote = null;
          pendingTimeout = null;
        }, 400);
      }
      return true;
    }

    return false;
  }

  return { handleKey, reset };
}

/**
 * Compute and display median EWMA for a set of item IDs.
 * Used by all modes to show aggregate speed stats.
 */
export function updateModeStats(selector, itemIds, statsEl) {
  if (!statsEl) return;
  const ewmas = [];
  for (const id of itemIds) {
    const stats = selector.getStats(id);
    if (stats && stats.ewma) ewmas.push(stats.ewma);
  }
  if (ewmas.length === 0) {
    statsEl.textContent = '';
    return;
  }
  const sorted = [...ewmas].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const med = sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  const color = med < 3000 ? 'hsl(120,70%,35%)' : med < 4000 ? 'hsl(80,70%,35%)' : med < 5000 ? 'hsl(50,70%,40%)' : med < 6000 ? 'hsl(30,70%,40%)' : 'hsl(0,70%,40%)';
  statsEl.innerHTML = `median: <span style="color:${color}">${Math.round(med)}ms</span>`;
}

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
      // pointer-events: none lets taps fall through to the parent so
      // the tap-to-advance handler still fires on mobile (disabled
      // buttons swallow click events and prevent bubbling).
      btn.style.pointerEvents = enabled ? '' : 'none';
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
    // Call onStart first so modes can tear down their idle UI (e.g. heatmap)
    // before the engine sets up the quiz UI state.
    if (mode.onStart) mode.onStart();
    if (els.startBtn) els.startBtn.style.display = 'none';
    if (els.heatmapBtn) els.heatmapBtn.style.display = 'none';
    if (els.stopBtn) els.stopBtn.style.display = 'inline';
    if (els.quizArea) els.quizArea.classList.add('active');
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

  // Attach event listeners: keyboard on document (global), clicks on container
  function attach() {
    document.addEventListener('keydown', handleKeydown);
    container.addEventListener('click', handleClick);
  }

  function detach() {
    document.removeEventListener('keydown', handleKeydown);
    container.removeEventListener('click', handleClick);
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
