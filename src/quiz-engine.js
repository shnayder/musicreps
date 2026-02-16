// Shared quiz engine: manages adaptive selection, timing, round countdown,
// feedback, and keyboard/tap handling for all quiz modes.
//
// Each quiz mode provides a config object; the engine handles the
// shared lifecycle. ES module — exports stripped for browser inlining.
//
// Depends on globals (from quiz-engine-state.js): initialEngineState,
// engineStart, engineNextQuestion, engineSubmitAnswer,
// engineStop, engineUpdateIdleMessage, engineUpdateMasteryAfterAnswer,
// engineUpdateProgress, engineRouteKey, engineCalibrationIntro,
// engineCalibrating, engineCalibrationResults, engineRoundTimerExpired,
// engineRoundComplete, engineContinueRound

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
 * Create a keyboard handler for solfège input (Do Re Mi Fa Sol La Si + #/b).
 * Case-insensitive. Buffers two characters to identify the syllable, then
 * waits for an optional accidental. All syllables are unambiguous after 2 chars.
 *
 * @param {function} submitAnswer - Called with the internal note string (e.g. 'C', 'F#')
 * @param {function} [allowAccidentals] - Returns true if accidentals are enabled
 * @returns {{ handleKey(e): boolean, reset(): void }}
 */
export function createSolfegeKeyHandler(submitAnswer, allowAccidentals = () => true) {
  const SOLFEGE_TO_NOTE = {
    'do': 'C', 're': 'D', 'mi': 'E', 'fa': 'F',
    'so': 'G', 'la': 'A', 'si': 'B'
  };
  const FIRST_CHARS = new Set(['d', 'r', 'm', 'f', 's', 'l']);

  let buffer = '';
  let pendingNote = null;
  let pendingTimeout = null;

  function reset() {
    buffer = '';
    if (pendingTimeout) clearTimeout(pendingTimeout);
    pendingTimeout = null;
    pendingNote = null;
  }

  function submitPending() {
    if (pendingNote) {
      clearTimeout(pendingTimeout);
      submitAnswer(pendingNote);
      pendingNote = null;
      pendingTimeout = null;
    }
  }

  function handleKey(e) {
    const key = e.key.toLowerCase();

    // Handle accidental after resolved syllable
    if (pendingNote && allowAccidentals()) {
      if (e.key === '#' || (e.shiftKey && e.key === '3')) {
        e.preventDefault();
        clearTimeout(pendingTimeout);
        submitAnswer(pendingNote + '#');
        pendingNote = null;
        pendingTimeout = null;
        return true;
      }
      // 'b' is flat (no solfège syllable starts with 'b')
      if (key === 'b') {
        e.preventDefault();
        clearTimeout(pendingTimeout);
        submitAnswer(pendingNote + 'b');
        pendingNote = null;
        pendingTimeout = null;
        return true;
      }
    }

    // Submit any pending note before starting new input
    if (pendingNote && FIRST_CHARS.has(key)) {
      submitPending();
    }

    // Continue building syllable
    if (buffer.length > 0) {
      e.preventDefault();
      buffer += key;
      const note = SOLFEGE_TO_NOTE[buffer];
      if (note) {
        buffer = '';
        if (!allowAccidentals()) {
          submitAnswer(note);
        } else {
          pendingNote = note;
          pendingTimeout = setTimeout(() => {
            submitAnswer(pendingNote);
            pendingNote = null;
            pendingTimeout = null;
          }, 400);
        }
      } else if (buffer.length >= 2) {
        // Invalid pair — reset
        buffer = '';
      }
      return true;
    }

    // Start new syllable
    if (FIRST_CHARS.has(key)) {
      e.preventDefault();
      // Submit any pending note first
      submitPending();
      buffer = key;
      return true;
    }

    return false;
  }

  return { handleKey, reset };
}

/**
 * Adaptive key handler: delegates to letter or solfège handler based on
 * current notation mode. Drop-in replacement for createNoteKeyHandler.
 *
 * @param {function} submitAnswer - Called with the note string
 * @param {function} [allowAccidentals] - Returns true if accidentals are enabled
 * @returns {{ handleKey(e): boolean, reset(): void }}
 */
export function createAdaptiveKeyHandler(submitAnswer, allowAccidentals = () => true) {
  const letterHandler = createNoteKeyHandler(submitAnswer, allowAccidentals);
  const solfegeHandler = createSolfegeKeyHandler(submitAnswer, allowAccidentals);

  return {
    handleKey(e) {
      return getUseSolfege()
        ? solfegeHandler.handleKey(e)
        : letterHandler.handleKey(e);
    },
    reset() {
      letterHandler.reset();
      solfegeHandler.reset();
    }
  };
}

/**
 * Update all note button labels in a container to reflect current notation mode.
 * Handles .answer-btn-note, .note-btn, and .string-toggle elements.
 */
export function refreshNoteButtonLabels(container) {
  container.querySelectorAll('.answer-btn-note').forEach(function(btn) {
    var note = NOTES.find(function(n) { return n.name === btn.dataset.note; });
    if (note) btn.textContent = displayNote(note.name);
  });
  container.querySelectorAll('.note-btn').forEach(function(btn) {
    var noteName = btn.dataset.note;
    if (noteName) btn.textContent = displayNote(noteName);
  });
  container.querySelectorAll('.string-toggle').forEach(function(btn) {
    var stringNote = btn.dataset.stringNote;
    if (stringNote) btn.textContent = displayNote(stringNote);
  });
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
 * Pick a random calibration button, weighted toward accidentals ~35% of the time.
 * Shared helper for mode getCalibrationTrialConfig implementations.
 *
 * @param {Element[]} buttons - available answer buttons
 * @param {Element|null} prevBtn - previous trial's button (to avoid repeats)
 * @param {function} [rng] - random number generator (0–1), defaults to Math.random
 * @returns {Element}
 */
export function pickCalibrationButton(buttons, prevBtn, rng) {
  const rand = rng || Math.random;
  const sharpBtns = buttons.filter(b => {
    const note = b.dataset.note;
    return note && note.includes('#');
  });
  const naturalBtns = buttons.filter(b => {
    const note = b.dataset.note;
    return note && !note.includes('#');
  });

  // ~35% chance of sharp if available
  const useSharp = sharpBtns.length > 0 && rand() < 0.35;
  const pool = useSharp ? sharpBtns : (naturalBtns.length > 0 ? naturalBtns : buttons);

  let btn;
  do {
    btn = pool[Math.floor(rand() * pool.length)];
  } while (btn === prevBtn && pool.length > 1);
  return btn;
}

/**
 * Run a motor-baseline calibration sequence.
 * In highlight mode (no getTrialConfig): highlights a random button green.
 * In search mode (getTrialConfig provided): shows a text prompt, user finds the button.
 *
 * @param {object}   opts
 * @param {Element[]} opts.buttons       - answer buttons to use for calibration
 * @param {object}   opts.els           - engine DOM elements (feedback, hint, timeDisplay)
 * @param {Element}  opts.container     - mode container element
 * @param {function} opts.onComplete    - called with median time in ms
 * @param {function} [opts.getTrialConfig] - mode's getCalibrationTrialConfig(buttons, prevBtn)
 */
function runCalibration(opts) {
  const { buttons, els, container, onComplete, getTrialConfig } = opts;
  const TRIAL_COUNT = 10;
  const PAUSE_MS = 400;

  // Skip the first 2 trials when computing baseline — users need a moment
  // to understand the task and orient to the UI, so their first taps are
  // noticeably slower and would inflate the baseline.
  const WARMUP_TRIALS = 2;

  const times = [];
  let trialIndex = 0;
  let targetBtn = null;        // current target (single-target or current in sequence)
  let trialStartTime = null;
  let prevBtn = null;
  let canceled = false;
  let pendingTimeout = null;

  // Search mode state
  let trialConfig = null;      // current trial's config from getTrialConfig
  let targetIndex = 0;         // index within trialConfig.targetButtons
  let pressStartTime = null;   // time of last press (for per-press timing)

  // Accidental key support for search mode
  let pendingNote = null;
  let pendingNoteTimeout = null;

  function isSearchMode() {
    return !!getTrialConfig;
  }

  function startTrial() {
    if (canceled) return;

    if (trialIndex >= TRIAL_COUNT) {
      cleanup();
      // Warmup trials already filtered in recordPress() — use all collected times
      const median = computeMedian(times);
      onComplete(median);
      return;
    }

    if (isSearchMode()) {
      trialConfig = getTrialConfig(buttons, prevBtn);
      targetIndex = 0;
      targetBtn = trialConfig.targetButtons[0];
      pressStartTime = Date.now();
      trialStartTime = Date.now();

      if (els.quizPrompt) els.quizPrompt.textContent = trialConfig.prompt;
    } else {
      // Highlight mode (speed tap fallback)
      let idx;
      let prevBtnIndex = prevBtn ? buttons.indexOf(prevBtn) : -1;
      do {
        idx = Math.floor(Math.random() * buttons.length);
      } while (idx === prevBtnIndex && buttons.length > 1);

      targetBtn = buttons[idx];
      targetBtn.classList.add('calibration-target');
      trialStartTime = Date.now();
    }

    prevBtn = targetBtn;
    if (els.progressText) els.progressText.textContent = (trialIndex + 1) + ' / ' + TRIAL_COUNT;
    if (els.progressFill) els.progressFill.style.width = Math.round(((trialIndex + 1) / TRIAL_COUNT) * 100) + '%';
  }

  function recordPress() {
    const now = Date.now();
    const elapsed = now - (isSearchMode() ? pressStartTime : trialStartTime);

    // Skip warmup trials
    if (trialIndex >= WARMUP_TRIALS) {
      times.push(elapsed);
    }

    if (isSearchMode() && trialConfig && targetIndex < trialConfig.targetButtons.length - 1) {
      // Multi-target: advance to next target in sequence
      targetIndex++;
      targetBtn = trialConfig.targetButtons[targetIndex];
      pressStartTime = now;
      return; // don't advance trial
    }

    // Trial complete
    if (!isSearchMode() && targetBtn) {
      targetBtn.classList.remove('calibration-target');
    }
    targetBtn = null;
    trialConfig = null;
    trialIndex++;
    pendingTimeout = setTimeout(startTrial, PAUSE_MS);
  }

  function handleCalibrationClick(e) {
    if (!targetBtn) return;
    const clicked = e.target.closest('.note-btn, .answer-btn');
    if (clicked === targetBtn) {
      clearPendingNote();
      recordPress();
    }
  }

  function clearPendingNote() {
    if (pendingNoteTimeout) clearTimeout(pendingNoteTimeout);
    pendingNote = null;
    pendingNoteTimeout = null;
  }

  function checkNoteMatch(noteName) {
    if (!targetBtn) return false;
    const targetNote = targetBtn.dataset.note;
    return targetNote && targetNote.toUpperCase() === noteName.toUpperCase();
  }

  function handleCalibrationKey(e) {
    if (!targetBtn) return;

    if (isSearchMode()) {
      const key = e.key.toUpperCase();

      // Handle # or b after a pending note letter
      if (pendingNote) {
        if (e.key === '#' || (e.shiftKey && e.key === '3')) {
          e.preventDefault();
          clearTimeout(pendingNoteTimeout);
          const combined = pendingNote + '#';
          pendingNote = null;
          pendingNoteTimeout = null;
          if (checkNoteMatch(combined)) recordPress();
          return;
        }
        if (e.key === 'b' || e.key === 'B') {
          // 'B' by itself could be the note B, but after a pending note it's a flat
          if (pendingNote !== 'B') {
            e.preventDefault();
            clearTimeout(pendingNoteTimeout);
            const combined = pendingNote + 'b';
            pendingNote = null;
            pendingNoteTimeout = null;
            if (checkNoteMatch(combined)) recordPress();
            return;
          }
        }
      }

      // Note letter
      if ('CDEFGAB'.includes(key)) {
        e.preventDefault();
        clearPendingNote();

        // Check if target is a natural — if so, submit immediately
        const targetNote = targetBtn.dataset.note;
        if (targetNote && !targetNote.includes('#')) {
          if (checkNoteMatch(key)) recordPress();
        } else {
          // Target is an accidental — wait for # or b
          pendingNote = key;
          pendingNoteTimeout = setTimeout(() => {
            // Window expired, check natural
            if (checkNoteMatch(pendingNote)) recordPress();
            pendingNote = null;
            pendingNoteTimeout = null;
          }, 400);
        }
        return;
      }

      // Interval buttons (data-interval="P5" etc.) have no keyboard
      // shortcut during calibration — users tap/click them instead.
    } else {
      // Highlight mode: single-key match
      const expectedKey = getKeyForButton(targetBtn);
      if (expectedKey && e.key.toUpperCase() === expectedKey) {
        e.preventDefault();
        recordPress();
      }
    }
  }

  function cleanup() {
    canceled = true;
    clearPendingNote();
    if (pendingTimeout !== null) {
      clearTimeout(pendingTimeout);
      pendingTimeout = null;
    }
    container.removeEventListener('click', handleCalibrationClick);
    document.removeEventListener('keydown', handleCalibrationKey);
    if (targetBtn && !isSearchMode()) {
      targetBtn.classList.remove('calibration-target');
    }
    targetBtn = null;
    trialConfig = null;
  }

  container.addEventListener('click', handleCalibrationClick);
  document.addEventListener('keydown', handleCalibrationKey);

  startTrial();

  // Return cleanup function in case the quiz is stopped during calibration
  return cleanup;
}

// Round duration in milliseconds
const ROUND_DURATION_MS = 60000;

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
 *   mode.getCalibrationTrialConfig(buttons, prevBtn) - Returns { prompt, targetButtons } for search calibration (optional)
 *   mode.calibrationIntroHint - Custom intro hint text (optional, e.g. for chord spelling)
 *
 * @param {HTMLElement} container - Root element containing quiz DOM elements.
 *   Expected children (found by class):
 *     .feedback, .time-display, .hint,
 *     .stats, .mastery-message
 *
 * @returns {{ start, stop, submitAnswer, nextQuestion, attach, detach,
 *             updateIdleMessage, isActive, isAnswered, selector, storage, els, baseline }}
 */
export function createQuizEngine(mode, container) {
  const storage = createLocalStorageAdapter(mode.storageNamespace);
  const responseCountFn = mode.getExpectedResponseCount
    ? (itemId) => mode.getExpectedResponseCount(itemId)
    : null;
  const selector = createAdaptiveSelector(storage, DEFAULT_CONFIG, Math.random, responseCountFn);

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
      const scaledConfig = deriveScaledConfig(motorBaseline, DEFAULT_CONFIG);
      selector.updateConfig(scaledConfig);
    }
  }

  let state = initialEngineState();
  let roundTimerInterval = null;
  let roundTimerStart = null;

  // DOM references (scoped to container)
  const els = {
    feedback: container.querySelector('.feedback'),
    timeDisplay: container.querySelector('.time-display'),
    hint: container.querySelector('.hint'),
    stats: container.querySelector('.stats'),
    quizArea: container.querySelector('.quiz-area'),
    quizPrompt: container.querySelector('.quiz-prompt'),
    quizHeaderTitle: container.querySelector('.quiz-header-title'),
    masteryMessage: container.querySelector('.mastery-message'),
    recalibrateBtn: container.querySelector('.recalibrate-btn'),
    quizHeaderClose: container.querySelector('.quiz-header-close'),
    roundTimerEl: container.querySelector('.round-timer'),
    roundAnswerCount: container.querySelector('.round-answer-count'),
    progressFill: container.querySelector('.progress-fill'),
    progressText: container.querySelector('.progress-text'),
    practicingLabel: container.querySelector('.practicing-label'),
    roundCompleteEl: container.querySelector('.round-complete'),
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

  // --- render sub-functions ---

  function isCalibrationPhase(phase) {
    return phase === 'calibration-intro' || phase === 'calibrating' || phase === 'calibration-results';
  }

  function renderPhaseClass() {
    var inCalibration = isCalibrationPhase(state.phase);

    // Clear calibration content when leaving calibration UI phases
    if (state.phase !== 'calibration-intro' && state.phase !== 'calibration-results') {
      clearCalibrationContent();
    }

    // Set phase class on container for CSS-driven visibility
    var phaseClass = inCalibration ? 'phase-calibration'
      : state.phase === 'active' ? 'phase-active'
      : state.phase === 'round-complete' ? 'phase-round-complete'
      : 'phase-idle';
    container.classList.remove('phase-idle', 'phase-active', 'phase-calibration', 'phase-round-complete');
    container.classList.add(phaseClass);

    // Hide settings gear during active quiz/calibration
    var gearBtn = document.querySelector('.gear-btn');
    if (gearBtn) gearBtn.classList.toggle('hidden', phaseClass !== 'phase-idle');

    return { inCalibration: inCalibration, phaseClass: phaseClass };
  }

  function renderCalibrationMarking(inCalibration) {
    // Mark the calibration button container so CSS can hide others
    if (inCalibration && !container.querySelector('.calibration-active')) {
      var buttons = getCalibrationButtons();
      if (buttons.length > 0) {
        var parent = buttons[0].closest('.answer-buttons, .note-buttons');
        if (parent) parent.classList.add('calibration-active');
      }
    }
    if (!inCalibration) {
      var activeEl = container.querySelector('.calibration-active');
      if (activeEl) activeEl.classList.remove('calibration-active');
    }

    // Sub-phase classes for calibration CSS (intro hides buttons, trials shows them)
    container.classList.remove('calibration-intro', 'calibration-results');
    if (state.phase === 'calibration-intro') container.classList.add('calibration-intro');
    if (state.phase === 'calibration-results') container.classList.add('calibration-results');
  }

  function renderHeader(inCalibration) {
    var isActive = state.phase === 'active';
    if (els.quizHeaderTitle) {
      if (inCalibration) {
        els.quizHeaderTitle.textContent = 'Speed Check';
      } else if (isActive || state.phase === 'round-complete') {
        els.quizHeaderTitle.textContent = 'Round ' + state.roundNumber;
      } else {
        els.quizHeaderTitle.textContent = '';
      }
    }
    if (els.quizArea) els.quizArea.classList.toggle('active', state.quizActive);
  }

  function renderFeedback(inCalibration) {
    // During calibration, feedbackText goes in quiz-prompt (above buttons)
    // so the heading/prompt appears in the same position as quiz questions.
    // During active quiz, it stays in .feedback (below buttons).
    if (inCalibration) {
      if (els.quizPrompt) els.quizPrompt.textContent = state.feedbackText;
      if (els.feedback) {
        els.feedback.textContent = '';
        els.feedback.className = 'feedback';
      }
    } else {
      if (els.feedback) {
        els.feedback.textContent = state.feedbackText;
        els.feedback.className   = state.feedbackClass;
      }
      if (els.quizPrompt && state.phase === 'idle') {
        els.quizPrompt.textContent = '';
      }
    }
    if (els.timeDisplay) els.timeDisplay.textContent = state.timeDisplayText;
    if (els.hint)        els.hint.textContent        = state.hintText;
  }

  function renderMessages() {
    if (els.masteryMessage) {
      els.masteryMessage.textContent = state.masteryText;
      els.masteryMessage.classList.toggle('mastery-visible', state.showMastery);
    }
    if (els.recalibrateBtn) {
      els.recalibrateBtn.classList.toggle('has-baseline', !!motorBaseline);
    }
  }

  function renderSessionStats() {
    if (els.roundAnswerCount && state.phase === 'active') {
      var count = state.roundAnswered;
      els.roundAnswerCount.textContent = count + (count === 1 ? ' answer' : ' answers');
    }
  }

  function renderProgress() {
    if (els.progressFill) {
      var pct = state.totalEnabledCount > 0
        ? Math.round((state.masteredCount / state.totalEnabledCount) * 100)
        : 0;
      els.progressFill.style.width = pct + '%';
    }
    if (els.progressText) {
      els.progressText.textContent = state.masteredCount + ' / ' + state.totalEnabledCount + ' fluent';
    }
  }

  function renderRoundComplete() {
    if (els.roundCompleteEl && state.phase === 'round-complete') {
      var pct = state.roundAnswered > 0
        ? Math.round((state.roundCorrect / state.roundAnswered) * 100)
        : 0;
      els.roundCompleteEl.querySelector('.round-complete-count').textContent =
        state.roundAnswered + (state.roundAnswered === 1 ? ' answer' : ' answers');
      els.roundCompleteEl.querySelector('.round-complete-correct').textContent =
        state.roundCorrect + ' correct (' + pct + '%)';
    }
  }

  function renderCalibrationContent() {
    if (state.phase === 'calibration-intro' && !calibrationContentEl) {
      renderCalibrationIntro();
    } else if (state.phase === 'calibration-results' && !calibrationContentEl) {
      renderCalibrationResults();
    }
  }

  function render() {
    var ctx = renderPhaseClass();
    renderCalibrationMarking(ctx.inCalibration);
    renderHeader(ctx.inCalibration);
    renderFeedback(ctx.inCalibration);
    renderMessages();
    renderSessionStats();
    renderProgress();
    setAnswerButtonsEnabled(state.answersEnabled);
    renderRoundComplete();
    renderCalibrationContent();
  }

  // --- Round timer ---

  function formatRoundTime(ms) {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return min + ':' + (sec < 10 ? '0' : '') + sec;
  }

  function startRoundTimer() {
    if (roundTimerInterval) clearInterval(roundTimerInterval);
    roundTimerStart = Date.now();

    // Initialize display immediately so the timer isn't blank before first tick
    if (els.roundTimerEl) {
      els.roundTimerEl.textContent = formatRoundTime(ROUND_DURATION_MS);
      els.roundTimerEl.classList.remove('round-timer-warning');
    }

    roundTimerInterval = setInterval(() => {
      const elapsed = Date.now() - roundTimerStart;
      const remaining = ROUND_DURATION_MS - elapsed;

      if (els.roundTimerEl) {
        els.roundTimerEl.textContent = formatRoundTime(remaining);
        // Turn red in last 10 seconds
        els.roundTimerEl.classList.toggle('round-timer-warning', remaining <= 10000 && remaining > 0);
      }

      if (remaining <= 0) {
        clearInterval(roundTimerInterval);
        roundTimerInterval = null;
        if (els.roundTimerEl) {
          els.roundTimerEl.textContent = '0:00';
          els.roundTimerEl.classList.remove('round-timer-warning');
        }
        handleRoundTimerExpiry();
      }
    }, 200);
  }

  function stopRoundTimer() {
    if (roundTimerInterval) {
      clearInterval(roundTimerInterval);
      roundTimerInterval = null;
    }
    roundTimerStart = null;
    if (els.roundTimerEl) {
      els.roundTimerEl.textContent = '';
      els.roundTimerEl.classList.remove('round-timer-warning');
    }
  }

  /**
   * Handle round timer expiry. If the user has already answered the current
   * question (waiting for Space/tap to advance), transition immediately.
   * Otherwise, mark the timer as expired so the transition happens after
   * they answer.
   */
  function handleRoundTimerExpiry() {
    if (state.phase !== 'active') return;

    state = engineRoundTimerExpired(state);

    if (state.answered) {
      // User is on the feedback screen — transition now
      transitionToRoundComplete();
    }
    // Otherwise: user is mid-question. They'll finish, and nextQuestion()
    // or submitAnswer() will check roundTimerExpired.
  }

  function transitionToRoundComplete() {
    stopRoundTimer();
    state = engineRoundComplete(state);
    render();
  }

  function getResponseCount(itemId) {
    return mode.getExpectedResponseCount ? mode.getExpectedResponseCount(itemId) : 1;
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
    const scaledConfig = deriveScaledConfig(baseline, DEFAULT_CONFIG);
    selector.updateConfig(scaledConfig);
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
   * Determine if the mode uses search-based calibration (text prompt)
   * vs highlight-based (speed tap fallback).
   */
  function hasSearchCalibration() {
    return typeof mode.getCalibrationTrialConfig === 'function';
  }

  function getCalibrationIntroHint() {
    if (mode.calibrationIntroHint) return mode.calibrationIntroHint;
    if (hasSearchCalibration()) {
      return "We\u2019ll measure your response speed to set personalized targets. Press the button shown in the prompt \u2014 10 rounds total.";
    }
    return undefined; // use default (highlight mode)
  }

  function getCalibrationTrialHint() {
    if (hasSearchCalibration()) return 'Find and press the button';
    return undefined; // use default (highlight mode)
  }

  /**
   * Enter the calibration intro screen.
   */
  function startCalibration() {
    if (mode.onStart) mode.onStart();
    state = engineCalibrationIntro(state, getCalibrationIntroHint());
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

    state = engineCalibrating(state, getCalibrationTrialHint());
    render();

    const getTrialConfig = hasSearchCalibration()
      ? (btns, prevBtn) => mode.getCalibrationTrialConfig(btns, prevBtn)
      : undefined;

    calibrationCleanup = runCalibration({
      buttons,
      els,
      container,
      getTrialConfig,
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
    const threshold = selector.getConfig().automaticityThreshold;
    for (const id of items) {
      const auto = selector.getAutomaticity(id);
      if (auto !== null && auto > threshold) {
        mastered++;
      }
    }
    return { masteredCount: mastered, totalEnabledCount: items.length };
  }

  // --- Engine lifecycle ---

  function nextQuestion() {
    // If round timer expired, transition to round-complete instead
    if (state.roundTimerExpired) {
      transitionToRoundComplete();
      return;
    }

    const items = mode.getEnabledItems();
    if (items.length === 0) return;

    const nextItemId = selector.selectNext(items);
    state = engineNextQuestion(state, nextItemId, Date.now());
    render();
    mode.presentQuestion(state.currentItemId);
  }

  function submitAnswer(input) {
    if (state.phase !== 'active' || state.answered) return;

    const responseTime = Date.now() - state.questionStartTime;

    const result = mode.checkAnswer(state.currentItemId, input);
    selector.recordResponse(state.currentItemId, responseTime, result.correct);

    state = engineSubmitAnswer(state, result.correct, result.correctAnswer);

    // Check if all enabled items are mastered
    const allMastered = selector.checkAllAutomatic(mode.getEnabledItems());
    state = engineUpdateMasteryAfterAnswer(state, allMastered);

    // Update progress
    const progress = computeProgress();
    state = engineUpdateProgress(state, progress.masteredCount, progress.totalEnabledCount);

    render();

    // Let the mode react to the answer (e.g., highlight correct position)
    if (mode.onAnswer) {
      mode.onAnswer(state.currentItemId, result, responseTime);
    }

    // If round timer already expired, show feedback briefly then transition
    if (state.roundTimerExpired) {
      setTimeout(() => {
        if (state.phase === 'active') transitionToRoundComplete();
      }, 600);
    }
  }

  function start() {
    state = engineStart(state);
    // Call onStart first so modes can tear down their idle UI (e.g. heatmap)
    // before the engine renders the quiz UI state.
    if (mode.onStart) mode.onStart();

    // Set practicing label (e.g. "Practicing E, A strings")
    if (els.practicingLabel) {
      const label = mode.getPracticingLabel ? mode.getPracticingLabel() : '';
      els.practicingLabel.textContent = label ? 'Practicing ' + label : '';
    }

    // Compute initial progress
    const progress = computeProgress();
    state = engineUpdateProgress(state, progress.masteredCount, progress.totalEnabledCount);

    render();
    startRoundTimer();
    nextQuestion();
  }

  function continueQuiz() {
    state = engineContinueRound(state);
    render();
    startRoundTimer();
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
      selector.checkAllAutomatic(items),
      selector.checkNeedsReview(items),
    );
    render();
  }

  function stop() {
    if (calibrationCleanup) {
      calibrationCleanup();
      calibrationCleanup = null;
    }
    stopRoundTimer();
    if (els.practicingLabel) els.practicingLabel.textContent = '';
    state = engineStop(state);
    render();
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
      case 'continue':
        e.preventDefault();
        continueQuiz();
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
    // In round-complete phase, only respond to the explicit buttons
    if (state.phase === 'round-complete') return;
    if (state.phase !== 'active' || !state.answered) return;
    if (e.target.closest('.answer-btn, .note-btn, .quiz-config, .string-toggle')) return;
    nextQuestion();
  }

  // Attach event listeners: keyboard on document (global), clicks on container.
  // Also refreshes notation-dependent content (button labels, stats table)
  // so that a mode activated after a global notation change shows current labels.
  function attach() {
    document.addEventListener('keydown', handleKeydown);
    container.addEventListener('click', handleClick);
    refreshNoteButtonLabels(container);
    var activeStatsBtn = container.querySelector('.stats-toggle-btn.active');
    if (activeStatsBtn) activeStatsBtn.click();
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

  // Wire up round-complete buttons
  if (els.roundCompleteEl) {
    const keepGoingBtn = els.roundCompleteEl.querySelector('.round-complete-continue');
    const stopBtn = els.roundCompleteEl.querySelector('.round-complete-stop');
    if (keepGoingBtn) keepGoingBtn.addEventListener('click', continueQuiz);
    if (stopBtn) stopBtn.addEventListener('click', stop);
  }

  /**
   * If no baseline exists, show the calibration intro screen.
   * Called by modes from their activate() hook.
   *
   * Re-checks localStorage because another mode sharing the same
   * calibrationProvider may have completed calibration after this
   * engine was created (e.g. guitar and ukulele both use 'button').
   */
  function showCalibrationIfNeeded() {
    if (!motorBaseline) {
      const stored = localStorage.getItem(baselineKey);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (parsed > 0) {
          applyBaseline(parsed);
        }
      }
    }
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
    continueQuiz,
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
