// Shared quiz engine: manages adaptive selection, timing, countdown,
// feedback, and keyboard/tap handling for all quiz modes.
//
// Each quiz mode provides a config object; the engine handles the
// shared lifecycle. ES module — exports stripped for browser inlining.
//
// Depends on globals (from quiz-engine-state.js): initialEngineState,
// engineStart, engineNextQuestion, engineSubmitAnswer, engineStop,
// engineUpdateIdleMessage, engineUpdateMasteryAfterAnswer, engineUpdateProgress,
// engineRouteKey, engineCalibrationIntro, engineCalibrating,
// engineCalibrationResults

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
 * Build human-readable threshold descriptions from a motor baseline.
 * Returns an array of { label, maxMs, meaning } objects describing the
 * heatmap speed bands. Used by the calibration results screen.
 *
 * @param {number} baseline - Motor baseline in ms
 * @returns {{ label: string, maxMs: number|null, meaning: string }[]}
 */
export function getCalibrationThresholds(baseline) {
  return [
    { label: 'Automatic', maxMs: Math.round(baseline * 1.5), meaning: 'Fully memorized — instant recall' },
    { label: 'Good',      maxMs: Math.round(baseline * 3.0), meaning: 'Solid recall, minor hesitation' },
    { label: 'Developing', maxMs: Math.round(baseline * 4.5), meaning: 'Working on it — needs practice' },
    { label: 'Slow',      maxMs: Math.round(baseline * 6.0), meaning: 'Significant hesitation' },
    { label: 'Very slow', maxMs: null,                        meaning: 'Not yet learned' },
  ];
}

/**
 * Update aggregate stats display for a set of item IDs.
 * Currently a no-op (median display was removed).
 */
export function updateModeStats(selector, itemIds, statsEl) {
  if (!statsEl) return;
  statsEl.textContent = '';
}

/**
 * Determine the keyboard key that would activate a given button.
 * Returns null if no single-key shortcut exists (e.g. sharps, two-digit numbers).
 */
function getKeyForButton(btn) {
  const note = btn.dataset.note;
  if (note && note.length === 1 && 'CDEFGAB'.includes(note.toUpperCase())) return note.toUpperCase();
  const num = btn.dataset.num;
  if (num !== undefined && num.length === 1) return num;
  return null;
}

/**
 * Run a motor-baseline calibration sequence.
 * Highlights random buttons one at a time; user taps or types to respond.
 *
 * @param {object}   opts
 * @param {Element[]} opts.buttons    - answer buttons to use for calibration
 * @param {object}   opts.els        - engine DOM elements (feedback, hint, timeDisplay)
 * @param {Element}  opts.container  - mode container element
 * @param {function} opts.onComplete - called with median time in ms
 */
function runCalibration(opts) {
  const { buttons, els, container, onComplete } = opts;
  const TRIAL_COUNT = 10;
  const PAUSE_MS = 400;

  const times = [];
  let trialIndex = 0;
  let targetBtn = null;
  let trialStartTime = null;
  let prevBtnIndex = -1;
  let canceled = false;
  let pendingTimeout = null;

  function startTrial() {
    if (canceled) return;
    if (trialIndex >= TRIAL_COUNT) {
      cleanup();
      const median = computeMedian(times);
      onComplete(median);
      return;
    }

    // Pick random button (not same as previous)
    let idx;
    do {
      idx = Math.floor(Math.random() * buttons.length);
    } while (idx === prevBtnIndex && buttons.length > 1);
    prevBtnIndex = idx;

    targetBtn = buttons[idx];
    targetBtn.classList.add('calibration-target');
    trialStartTime = Date.now();

    if (els.timeDisplay) els.timeDisplay.textContent = (trialIndex + 1) + ' / ' + TRIAL_COUNT;
  }

  function recordTrial() {
    const elapsed = Date.now() - trialStartTime;
    times.push(elapsed);
    targetBtn.classList.remove('calibration-target');
    targetBtn = null;
    trialIndex++;
    pendingTimeout = setTimeout(startTrial, PAUSE_MS);
  }

  function handleCalibrationClick(e) {
    if (!targetBtn) return;
    const clicked = e.target.closest('.note-btn, .answer-btn');
    if (clicked === targetBtn) {
      recordTrial();
    }
  }

  function handleCalibrationKey(e) {
    if (!targetBtn) return;
    const expectedKey = getKeyForButton(targetBtn);
    if (expectedKey && e.key.toUpperCase() === expectedKey) {
      e.preventDefault();
      recordTrial();
    }
  }

  function cleanup() {
    canceled = true;
    if (pendingTimeout !== null) {
      clearTimeout(pendingTimeout);
      pendingTimeout = null;
    }
    container.removeEventListener('click', handleCalibrationClick);
    document.removeEventListener('keydown', handleCalibrationKey);
    if (targetBtn) {
      targetBtn.classList.remove('calibration-target');
      targetBtn = null;
    }
  }

  container.addEventListener('click', handleCalibrationClick);
  document.addEventListener('keydown', handleCalibrationKey);

  startTrial();

  // Return cleanup function in case the quiz is stopped during calibration
  return cleanup;
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
 *   mode.getCalibrationButtons() - Returns array of DOM elements for calibration (optional)
 *
 * @param {HTMLElement} container - Root element containing quiz DOM elements.
 *   Expected children (found by class):
 *     .countdown-bar, .feedback, .time-display, .hint,
 *     .start-btn, .stop-btn, .stats-toggle, .stats,
 *     .stats-controls, .mastery-message
 *
 * @returns {{ start, stop, submitAnswer, nextQuestion, attach, detach,
 *             updateIdleMessage, isActive, isAnswered, selector, storage, els, baseline }}
 */
export function createQuizEngine(mode, container) {
  const storage = createLocalStorageAdapter(mode.storageNamespace);
  const selector = createAdaptiveSelector(storage);

  const provider = mode.calibrationProvider || 'button';
  const baselineKey = 'motorBaseline_' + provider;
  const legacyBaselineKey = 'motorBaseline_' + mode.storageNamespace;
  let motorBaseline = null;
  let calibrationCleanup = null;   // cancel function for running trials
  let calibrationContentEl = null; // dynamically-created DOM for intro/results

  // Load stored baseline and apply to config at init time.
  // Check shared provider key first; fall back to legacy per-mode key for migration.
  let storedBaseline = localStorage.getItem(baselineKey);
  if (!storedBaseline && legacyBaselineKey !== baselineKey) {
    storedBaseline = localStorage.getItem(legacyBaselineKey);
    if (storedBaseline) {
      // Migrate legacy baseline to shared provider key
      localStorage.setItem(baselineKey, storedBaseline);
    }
  }
  if (storedBaseline) {
    const parsed = parseInt(storedBaseline, 10);
    if (parsed > 0) {
      motorBaseline = parsed;
      selector.updateConfig(deriveScaledConfig(motorBaseline, DEFAULT_CONFIG));
    }
  }

  let state = initialEngineState();
  let countdownInterval = null;
  let elapsedTimeInterval = null;

  // DOM references (scoped to container)
  const els = {
    countdownBar: container.querySelector('.countdown-bar'),
    feedback: container.querySelector('.feedback'),
    timeDisplay: container.querySelector('.time-display'),
    hint: container.querySelector('.hint'),
    startBtn: container.querySelector('.start-btn'),
    stopBtn: container.querySelector('.stop-btn'),
    statsToggle: container.querySelector('.stats-toggle'),
    stats: container.querySelector('.stats'),
    statsControls: container.querySelector('.stats-controls'),
    quizArea: container.querySelector('.quiz-area'),
    masteryMessage: container.querySelector('.mastery-message'),
    recalibrateBtn: container.querySelector('.recalibrate-btn'),
    quizHeader: container.querySelector('.quiz-header'),
    quizHeaderClose: container.querySelector('.quiz-header-close'),
    sessionStats: container.querySelector('.session-stats'),
    questionCountEl: container.querySelector('.question-count'),
    elapsedTimeEl: container.querySelector('.elapsed-time'),
    progressBar: container.querySelector('.progress-bar'),
    progressFill: container.querySelector('.progress-fill'),
    progressText: container.querySelector('.progress-text'),
  };

  // --- Render: declaratively map state to DOM ---

  function clearCalibrationContent() {
    if (calibrationContentEl) {
      calibrationContentEl.remove();
      calibrationContentEl = null;
    }
  }

  function insertAfterHint(el) {
    if (els.hint && els.hint.parentNode) {
      els.hint.parentNode.insertBefore(el, els.hint.nextSibling);
    }
  }

  function renderCalibrationIntro() {
    clearCalibrationContent();
    const btn = document.createElement('button');
    btn.textContent = 'Start';
    btn.className = 'calibration-action-btn';
    btn.addEventListener('click', beginCalibrationTrials);
    calibrationContentEl = btn;
    insertAfterHint(btn);
  }

  function renderCalibrationResults() {
    clearCalibrationContent();
    const baseline = state.calibrationBaseline;
    const thresholds = getCalibrationThresholds(baseline);

    const div = document.createElement('div');
    div.className = 'calibration-results';

    const baselineP = document.createElement('p');
    baselineP.className = 'calibration-baseline';
    baselineP.textContent = 'Your baseline response time: ' + formatMs(baseline);
    div.appendChild(baselineP);

    const table = document.createElement('table');
    table.className = 'calibration-thresholds';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['Speed', 'Response time', 'Meaning'].forEach((text) => {
      const th = document.createElement('th');
      th.textContent = text;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    thresholds.forEach((t) => {
      const tr = document.createElement('tr');
      const tdLabel = document.createElement('td');
      tdLabel.textContent = t.label;
      tr.appendChild(tdLabel);

      const tdTime = document.createElement('td');
      tdTime.textContent = t.maxMs !== null ? '< ' + formatMs(t.maxMs) : '> ' + formatMs(thresholds[thresholds.length - 2].maxMs);
      tr.appendChild(tdTime);

      const tdMeaning = document.createElement('td');
      tdMeaning.textContent = t.meaning;
      tr.appendChild(tdMeaning);

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    div.appendChild(table);

    const doneBtn = document.createElement('button');
    doneBtn.textContent = 'Done';
    doneBtn.className = 'calibration-action-btn';
    doneBtn.addEventListener('click', finishCalibration);
    div.appendChild(doneBtn);

    calibrationContentEl = div;
    insertAfterHint(div);
  }

  function render() {
    const inCalibration = state.phase === 'calibration-intro' ||
                          state.phase === 'calibrating' ||
                          state.phase === 'calibration-results';

    // Clear calibration content when leaving calibration phases
    const inCalibUI = state.phase === 'calibration-intro' || state.phase === 'calibration-results';
    if (!inCalibUI) {
      clearCalibrationContent();
    }

    // Toggle calibrating class on container for CSS-driven visibility
    container.classList.toggle('calibrating', inCalibration);

    // Mark the calibration button container so CSS can hide others
    if (inCalibration && !container.querySelector('.calibration-active')) {
      const buttons = getCalibrationButtons();
      if (buttons.length > 0) {
        const parent = buttons[0].closest('.answer-buttons, .note-buttons');
        if (parent) parent.classList.add('calibration-active');
      }
    }
    if (!inCalibration) {
      const activeEl = container.querySelector('.calibration-active');
      if (activeEl) activeEl.classList.remove('calibration-active');
    }

    // Show/hide close button
    if (inCalibration && !container.querySelector('.calibration-close-btn')) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'calibration-close-btn';
      closeBtn.textContent = '\u00D7';
      closeBtn.setAttribute('aria-label', 'Close speed check');
      closeBtn.addEventListener('click', stop);
      if (els.quizArea) {
        els.quizArea.style.position = 'relative';
        els.quizArea.appendChild(closeBtn);
      }
    }
    if (!inCalibration) {
      const closeBtn = container.querySelector('.calibration-close-btn');
      if (closeBtn) closeBtn.remove();
    }

    if (els.startBtn)      els.startBtn.style.display     = state.showStartBtn ? 'inline' : 'none';
    if (els.stopBtn)       els.stopBtn.style.display      = state.showStopBtn ? 'inline' : 'none';
    if (els.statsToggle)   els.statsToggle.style.display   = state.showHeatmapBtn ? '' : 'none';
    if (els.statsControls) els.statsControls.style.display = state.showStatsControls ? '' : 'none';
    if (els.quizArea)      els.quizArea.classList.toggle('active', state.quizActive);
    if (els.feedback) {
      els.feedback.textContent = state.feedbackText;
      els.feedback.className   = state.feedbackClass;
    }
    if (els.timeDisplay) els.timeDisplay.textContent = state.timeDisplayText;
    if (els.hint)        els.hint.textContent        = state.hintText;
    if (els.masteryMessage) {
      els.masteryMessage.textContent   = state.masteryText;
      els.masteryMessage.style.display = state.showMastery ? 'block' : 'none';
    }
    if (els.recalibrateBtn) {
      els.recalibrateBtn.style.display = (state.phase === 'idle' && motorBaseline) ? 'inline' : 'none';
    }
    if (els.countdownBar) {
      els.countdownBar.classList.remove('expired');
      if (state.phase !== 'active') els.countdownBar.style.width = '0%';
    }

    // Quiz header visibility — only during active quiz, not calibration
    if (els.quizHeader) {
      els.quizHeader.style.display = state.phase === 'active' ? 'flex' : 'none';
    }

    // Session stats (question count + elapsed time)
    if (els.sessionStats) {
      els.sessionStats.style.display = state.phase === 'active' ? 'flex' : 'none';
    }
    if (els.questionCountEl && state.phase === 'active') {
      els.questionCountEl.textContent = state.questionCount;
    }

    // Progress bar
    if (els.progressBar) {
      els.progressBar.style.display = state.quizActive && state.phase === 'active' ? '' : 'none';
    }
    if (els.progressFill) {
      const pct = state.totalEnabledCount > 0
        ? Math.round((state.masteredCount / state.totalEnabledCount) * 100)
        : 0;
      els.progressFill.style.width = pct + '%';
    }
    if (els.progressText) {
      els.progressText.textContent = state.masteredCount + ' / ' + state.totalEnabledCount;
    }

    setAnswerButtonsEnabled(state.answersEnabled);

    // Create calibration content when entering those phases
    if (state.phase === 'calibration-intro' && !calibrationContentEl) {
      renderCalibrationIntro();
    } else if (state.phase === 'calibration-results' && !calibrationContentEl) {
      renderCalibrationResults();
    }
  }

  // --- Elapsed time display ---

  function formatElapsedTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes === 0) return seconds + 's';
    return minutes + 'm ' + (seconds < 10 ? '0' : '') + seconds + 's';
  }

  function updateElapsedTime() {
    if (!state.quizStartTime || !els.elapsedTimeEl) return;
    els.elapsedTimeEl.textContent = formatElapsedTime(Date.now() - state.quizStartTime);
  }

  function startElapsedTimer() {
    updateElapsedTime();
    elapsedTimeInterval = setInterval(updateElapsedTime, 1000);
  }

  function stopElapsedTimer() {
    if (elapsedTimeInterval) {
      clearInterval(elapsedTimeInterval);
      elapsedTimeInterval = null;
    }
  }

  // --- Countdown (purely DOM/timer — not part of state) ---

  function getTargetTime() {
    return selector.getConfig().automaticityTarget;
  }

  function startCountdown() {
    const bar = els.countdownBar;
    if (!bar) return;
    bar.style.width = '100%';
    bar.classList.remove('expired');

    if (countdownInterval) clearInterval(countdownInterval);

    const targetTime = getTargetTime();
    let expired = false;
    const startTime = Date.now();
    countdownInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, targetTime - elapsed);
      bar.style.width = (remaining / targetTime) * 100 + '%';

      if (remaining === 0 && !expired) {
        expired = true;
        bar.classList.add('expired');
        clearInterval(countdownInterval);
      }
    }, 50);
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

  // --- Baseline application ---

  function applyBaseline(baseline) {
    motorBaseline = baseline;
    localStorage.setItem(baselineKey, String(baseline));
    selector.updateConfig(deriveScaledConfig(baseline, DEFAULT_CONFIG));
  }

  // --- Calibration ---

  function getCalibrationButtons() {
    if (mode.getCalibrationButtons) return mode.getCalibrationButtons();
    // Fallback: all visible note/answer buttons
    return Array.from(container.querySelectorAll('.note-btn:not(.hidden), .answer-btn'));
  }

  /**
   * Format milliseconds as a human-readable string (e.g., "0.9s" or "1.8s").
   */
  function formatMs(ms) {
    return (ms / 1000).toFixed(1) + 's';
  }

  /**
   * Enter the calibration intro screen.
   */
  function startCalibration() {
    if (mode.onStart) mode.onStart();
    state = engineCalibrationIntro(state);
    render();
  }

  /**
   * Called when user clicks Start on the intro screen — begin trials.
   */
  function beginCalibrationTrials() {
    const buttons = getCalibrationButtons();
    if (buttons.length < 2) {
      stop();
      return;
    }

    state = engineCalibrating(state);
    render();

    calibrationCleanup = runCalibration({
      buttons,
      els,
      container,
      onComplete: (median) => {
        calibrationCleanup = null;
        if (!Number.isFinite(median) || median <= 0) {
          // Invalid measurement — abort to idle
          stop();
          return;
        }
        const baseline = Math.round(median);
        applyBaseline(baseline);
        state = engineCalibrationResults(state, baseline);
        render();
      },
    });
  }

  /**
   * Called when user clicks Done on the results screen — return to idle.
   */
  function finishCalibration() {
    stop();
  }

  // --- Progress tracking ---

  function computeProgress() {
    const items = mode.getEnabledItems();
    let mastered = 0;
    for (const id of items) {
      const recall = selector.getRecall(id);
      if (recall !== null && recall >= selector.getConfig().recallThreshold) {
        mastered++;
      }
    }
    return { masteredCount: mastered, totalEnabledCount: items.length };
  }

  // --- Engine lifecycle ---

  function nextQuestion() {
    const items = mode.getEnabledItems();
    if (items.length === 0) return;

    const nextItemId = selector.selectNext(items);
    state = engineNextQuestion(state, nextItemId, Date.now());
    render();
    mode.presentQuestion(state.currentItemId);
    startCountdown();
  }

  function submitAnswer(input) {
    if (state.phase !== 'active' || state.answered) return;

    const responseTime = Date.now() - state.questionStartTime;

    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }

    const result = mode.checkAnswer(state.currentItemId, input);
    selector.recordResponse(state.currentItemId, responseTime, result.correct);

    state = engineSubmitAnswer(state, result.correct, result.correctAnswer, responseTime);

    // Check if all enabled items are mastered
    const allMastered = selector.checkAllMastered(mode.getEnabledItems());
    state = engineUpdateMasteryAfterAnswer(state, allMastered);

    // Update progress
    const progress = computeProgress();
    state = engineUpdateProgress(state, progress.masteredCount, progress.totalEnabledCount);

    render();

    // Let the mode react to the answer (e.g., highlight correct position)
    if (mode.onAnswer) {
      mode.onAnswer(state.currentItemId, result, responseTime);
    }
  }

  function start() {
    state = engineStart(state);
    // Call onStart first so modes can tear down their idle UI (e.g. heatmap)
    // before the engine renders the quiz UI state.
    if (mode.onStart) mode.onStart();

    // Compute initial progress
    const progress = computeProgress();
    state = engineUpdateProgress(state, progress.masteredCount, progress.totalEnabledCount);

    render();
    startElapsedTimer();
    nextQuestion();
  }

  function recalibrate() {
    startCalibration();
  }

  function updateIdleMessage() {
    if (state.phase !== 'idle') return;
    const items = mode.getEnabledItems();
    state = engineUpdateIdleMessage(
      state,
      selector.checkAllMastered(items),
      selector.checkNeedsReview(items),
    );
    render();
  }

  function stop() {
    if (calibrationCleanup) {
      calibrationCleanup();
      calibrationCleanup = null;
    }
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    stopElapsedTimer();
    state = engineStop(state);
    render();   // render() clears calibrationContentEl when phase is idle
    if (mode.onStop) mode.onStop();
    updateIdleMessage();
  }

  // Keyboard handler — uses pure routing, delegates mode-specific keys
  function handleKeydown(e) {
    const routed = engineRouteKey(state, e.key);
    switch (routed.action) {
      case 'stop':
        stop();
        break;
      case 'next':
        e.preventDefault();
        nextQuestion();
        break;
      case 'delegate':
        if (mode.handleKey) mode.handleKey(e, { submitAnswer });
        break;
      case 'ignore':
        break;
    }
  }

  // Tap-to-advance handler
  function handleClick(e) {
    if (state.phase !== 'active' || !state.answered) return;
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

  // Wire up recalibrate button
  if (els.recalibrateBtn) {
    els.recalibrateBtn.addEventListener('click', recalibrate);
  }

  // Wire up quiz header close button
  if (els.quizHeaderClose) {
    els.quizHeaderClose.addEventListener('click', stop);
  }

  /**
   * If no baseline exists, show the calibration intro screen.
   * Called by modes from their activate() hook.
   */
  function showCalibrationIfNeeded() {
    if (!motorBaseline && state.phase === 'idle') {
      startCalibration();
    }
  }

  return {
    start,
    stop,
    recalibrate,
    showCalibrationIfNeeded,
    submitAnswer,
    nextQuestion,
    attach,
    detach,
    updateIdleMessage,
    get isActive() { return state.phase === 'active'; },
    get isRunning() { return state.phase !== 'idle'; },
    get isAnswered() { return state.answered; },
    get baseline() { return motorBaseline; },
    selector,
    storage,
    els,
  };
}
