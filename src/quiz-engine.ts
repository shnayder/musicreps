// Shared quiz engine: manages adaptive selection, timing, round countdown,
// feedback, and keyboard/tap handling for all quiz modes.
//
// Each quiz mode provides a config object; the engine handles the
// shared lifecycle.

import {
  engineCalibrating,
  engineCalibrationIntro,
  engineCalibrationResults,
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
} from './quiz-engine-state.ts';
import {
  computeMedian,
  createAdaptiveSelector,
  createLocalStorageAdapter,
  DEFAULT_CONFIG,
  deriveScaledConfig,
} from './adaptive.ts';
import { displayNote, getUseSolfege, NOTES } from './music-data.ts';
import type {
  CalibrationTrialConfig,
  EngineEls,
  EngineState,
  NoteKeyHandler,
  QuizEngine,
  QuizMode,
} from './types.ts';

/**
 * Create a keyboard handler for note input (C D E F G A B + #/s/b for accidentals).
 * Used by any mode where the answer is a note name.
 *
 * The handler keeps an internal timeout to allow a short window after a note key
 * is pressed for an accidental key (`#` / `b`) to be entered. Callers should
 * invoke `reset()` when the quiz stops and before restarting to clear any pending
 * note and prevent stale input from being submitted after the quiz has ended.
 */
export function createNoteKeyHandler(
  submitAnswer: (note: string) => void,
  allowAccidentals: () => boolean = () => true,
): NoteKeyHandler {
  let pendingNote: string | null = null;
  let pendingTimeout: number | null = null;

  function reset(): void {
    if (pendingTimeout) clearTimeout(pendingTimeout);
    pendingNote = null;
    pendingTimeout = null;
  }

  function handleKey(e: KeyboardEvent): boolean {
    const key = e.key.toUpperCase();

    // Handle #/s for sharps or b for flats after a pending note
    if (pendingNote && allowAccidentals()) {
      if (
        e.key === '#' || e.key === 's' || e.key === 'S' ||
        (e.shiftKey && e.key === '3')
      ) {
        e.preventDefault();
        if (pendingTimeout) clearTimeout(pendingTimeout);
        submitAnswer(pendingNote + '#');
        pendingNote = null;
        pendingTimeout = null;
        return true;
      }
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        if (pendingTimeout) clearTimeout(pendingTimeout);
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
          submitAnswer(pendingNote!);
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
 */
export function createSolfegeKeyHandler(
  submitAnswer: (note: string) => void,
  allowAccidentals: () => boolean = () => true,
): NoteKeyHandler {
  const SOLFEGE_TO_NOTE: Record<string, string> = {
    'do': 'C',
    're': 'D',
    'mi': 'E',
    'fa': 'F',
    'so': 'G',
    'la': 'A',
    'si': 'B',
  };
  const FIRST_CHARS = new Set(['d', 'r', 'm', 'f', 's', 'l']);

  let buffer: string = '';
  let pendingNote: string | null = null;
  let pendingTimeout: number | null = null;

  function reset(): void {
    buffer = '';
    if (pendingTimeout) clearTimeout(pendingTimeout);
    pendingTimeout = null;
    pendingNote = null;
  }

  function submitPending(): void {
    if (pendingNote) {
      if (pendingTimeout) clearTimeout(pendingTimeout);
      submitAnswer(pendingNote);
      pendingNote = null;
      pendingTimeout = null;
    }
  }

  function handleKey(e: KeyboardEvent): boolean {
    const key = e.key.toLowerCase();

    // Handle accidental after resolved syllable
    if (pendingNote && allowAccidentals()) {
      if (e.key === '#' || (e.shiftKey && e.key === '3')) {
        e.preventDefault();
        if (pendingTimeout) clearTimeout(pendingTimeout);
        submitAnswer(pendingNote + '#');
        pendingNote = null;
        pendingTimeout = null;
        return true;
      }
      // 'b' is flat (no solfège syllable starts with 'b')
      if (key === 'b') {
        e.preventDefault();
        if (pendingTimeout) clearTimeout(pendingTimeout);
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
            submitAnswer(pendingNote!);
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
 */
export function createAdaptiveKeyHandler(
  submitAnswer: (note: string) => void,
  allowAccidentals: () => boolean = () => true,
): NoteKeyHandler {
  const letterHandler = createNoteKeyHandler(submitAnswer, allowAccidentals);
  const solfegeHandler = createSolfegeKeyHandler(
    submitAnswer,
    allowAccidentals,
  );

  return {
    handleKey(e: KeyboardEvent): boolean {
      return getUseSolfege()
        ? solfegeHandler.handleKey(e)
        : letterHandler.handleKey(e);
    },
    reset(): void {
      letterHandler.reset();
      solfegeHandler.reset();
    },
  };
}

/**
 * Update all note button labels in a container to reflect current notation mode.
 * Handles .answer-btn-note, .note-btn, and .string-toggle elements.
 */
export function refreshNoteButtonLabels(container: HTMLElement): void {
  container.querySelectorAll<HTMLButtonElement>('.answer-btn-note').forEach(
    function (btn) {
      const note = NOTES.find(function (n) {
        return n.name === btn.dataset.note;
      });
      if (note) btn.textContent = displayNote(note.name);
    },
  );
  container.querySelectorAll<HTMLButtonElement>('.note-btn').forEach(
    function (btn) {
      const noteName = btn.dataset.note;
      if (noteName) btn.textContent = displayNote(noteName);
    },
  );
  container.querySelectorAll<HTMLButtonElement>('.string-toggle').forEach(
    function (btn) {
      const stringNote = btn.dataset.stringNote;
      if (stringNote) btn.textContent = displayNote(stringNote);
    },
  );
}

/**
 * Build human-readable threshold descriptions from a motor baseline.
 * Used by the calibration results screen.
 */
export function getCalibrationThresholds(
  baseline: number,
): { label: string; maxMs: number | null; meaning: string }[] {
  return [
    {
      label: 'Automatic',
      maxMs: Math.round(baseline * 1.5),
      meaning: 'Fully memorized — instant recall',
    },
    {
      label: 'Good',
      maxMs: Math.round(baseline * 3.0),
      meaning: 'Solid recall, minor hesitation',
    },
    {
      label: 'Developing',
      maxMs: Math.round(baseline * 4.5),
      meaning: 'Working on it — needs practice',
    },
    {
      label: 'Slow',
      maxMs: Math.round(baseline * 6.0),
      meaning: 'Significant hesitation',
    },
    { label: 'Very slow', maxMs: null, meaning: 'Not yet learned' },
  ];
}

/**
 * Determine the keyboard key that would activate a given button.
 * Returns null if no single-key shortcut exists (e.g. sharps, two-digit numbers).
 */
function getKeyForButton(btn: HTMLElement): string | null {
  const note = btn.dataset.note;
  if (note && note.length === 1 && 'CDEFGAB'.includes(note.toUpperCase())) {
    return note.toUpperCase();
  }
  const num = btn.dataset.num;
  if (num !== undefined && num.length === 1) return num;
  return null;
}

/**
 * Pick a random calibration button, weighted toward accidentals ~35% of the time.
 * Shared helper for mode getCalibrationTrialConfig implementations.
 */
export function pickCalibrationButton(
  buttons: HTMLElement[],
  prevBtn: HTMLElement | null,
  rng?: () => number,
): HTMLElement {
  const rand = rng || Math.random;
  const sharpBtns = buttons.filter((b) => {
    const note = b.dataset.note;
    return note && note.includes('#');
  });
  const naturalBtns = buttons.filter((b) => {
    const note = b.dataset.note;
    return note && !note.includes('#');
  });

  // ~35% chance of sharp if available
  const useSharp = sharpBtns.length > 0 && rand() < 0.35;
  const pool = useSharp
    ? sharpBtns
    : (naturalBtns.length > 0 ? naturalBtns : buttons);

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
 */
function runCalibration(opts: {
  buttons: HTMLElement[];
  els: EngineEls;
  container: HTMLElement;
  onComplete: (median: number | null) => void;
  getTrialConfig?: (
    buttons: HTMLElement[],
    prevBtn: HTMLElement | null,
  ) => CalibrationTrialConfig;
}): () => void {
  const { buttons, els, container, onComplete, getTrialConfig } = opts;
  const TRIAL_COUNT = 10;
  const PAUSE_MS = 400;

  // Skip the first 2 trials when computing baseline — users need a moment
  // to understand the task and orient to the UI, so their first taps are
  // noticeably slower and would inflate the baseline.
  const WARMUP_TRIALS = 2;

  const times: number[] = [];
  let trialIndex = 0;
  let targetBtn: HTMLElement | null = null; // current target (single-target or current in sequence)
  let trialStartTime: number | null = null;
  let prevBtn: HTMLElement | null = null;
  let canceled = false;
  let pendingTimeout: number | null = null;

  // Search mode state
  let trialConfig: CalibrationTrialConfig | null = null; // current trial's config from getTrialConfig
  let targetIndex = 0; // index within trialConfig.targetButtons
  let pressStartTime: number | null = null; // time of last press (for per-press timing)

  // Accidental key support for search mode
  let pendingNote: string | null = null;
  let pendingNoteTimeout: number | null = null;

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
      trialConfig = getTrialConfig!(buttons, prevBtn);
      targetIndex = 0;
      targetBtn = trialConfig.targetButtons[0];
      pressStartTime = Date.now();
      trialStartTime = Date.now();

      if (els.quizPrompt) els.quizPrompt.textContent = trialConfig.prompt;
    } else {
      // Highlight mode (speed tap fallback)
      let idx;
      const prevBtnIndex = prevBtn ? buttons.indexOf(prevBtn) : -1;
      do {
        idx = Math.floor(Math.random() * buttons.length);
      } while (idx === prevBtnIndex && buttons.length > 1);

      targetBtn = buttons[idx];
      targetBtn.classList.add('calibration-target');
      trialStartTime = Date.now();
    }

    prevBtn = targetBtn;
    if (els.progressText) {
      els.progressText.textContent = trialIndex + ' / ' + TRIAL_COUNT;
    }
    if (els.progressFill) {
      els.progressFill.style.width =
        Math.round((trialIndex / TRIAL_COUNT) * 100) + '%';
    }
  }

  function recordPress() {
    const now = Date.now();
    const elapsed = now - (isSearchMode() ? pressStartTime! : trialStartTime!);

    // Skip warmup trials
    if (trialIndex >= WARMUP_TRIALS) {
      times.push(elapsed);
    }

    if (
      isSearchMode() && trialConfig &&
      targetIndex < trialConfig.targetButtons.length - 1
    ) {
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

  function handleCalibrationClick(e: MouseEvent): void {
    if (!targetBtn) return;
    const clicked = (e.target as HTMLElement).closest('.note-btn, .answer-btn');
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

  function checkNoteMatch(noteName: string): boolean {
    if (!targetBtn) return false;
    const targetNote = targetBtn.dataset.note;
    return !!targetNote && targetNote.toUpperCase() === noteName.toUpperCase();
  }

  function handleCalibrationKey(e: KeyboardEvent): void {
    if (!targetBtn) return;

    if (isSearchMode()) {
      const key = e.key.toUpperCase();

      // Handle #/s or b after a pending note letter
      if (pendingNote) {
        if (
          e.key === '#' || e.key === 's' || e.key === 'S' ||
          (e.shiftKey && e.key === '3')
        ) {
          e.preventDefault();
          if (pendingNoteTimeout) clearTimeout(pendingNoteTimeout);
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
            if (pendingNoteTimeout) clearTimeout(pendingNoteTimeout);
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
            if (checkNoteMatch(pendingNote!)) recordPress();
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
 * Create a quiz engine for a given mode. Manages adaptive selection, timing,
 * round countdown, feedback, and keyboard/tap handling.
 */
export function createQuizEngine(
  mode: QuizMode,
  container: HTMLElement,
): QuizEngine {
  const storage = createLocalStorageAdapter(mode.storageNamespace);
  const responseCountFn: ((itemId: string) => number) | null =
    mode.getExpectedResponseCount
      ? (itemId: string) => mode.getExpectedResponseCount!(itemId)
      : null;
  const selector = createAdaptiveSelector(
    storage,
    DEFAULT_CONFIG,
    Math.random,
    responseCountFn,
  );

  const provider = mode.calibrationProvider || 'button';
  const baselineKey = 'motorBaseline_' + provider;
  const legacyBaselineKey = 'motorBaseline_' + mode.storageNamespace;
  let motorBaseline: number | null = null;
  let calibrationCleanup: (() => void) | null = null; // cancel function for running trials
  let calibrationContentEl: HTMLElement | null = null; // dynamically-created DOM for intro/results

  // Load stored baseline and apply to config at init time.
  // Check shared provider key first; fall back to legacy per-mode key for migration.
  let storedBaseline: string | null = localStorage.getItem(baselineKey);
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

  let state: EngineState = initialEngineState();
  let roundTimerInterval: number | null = null;
  let roundTimerStart: number | null = null;
  let autoAdvanceTimer: number | null = null;

  // DOM references (scoped to container)
  const els: EngineEls = {
    feedback: container.querySelector('.feedback'),
    timeDisplay: container.querySelector('.time-display'),
    hint: container.querySelector('.hint'),
    stats: container.querySelector('.stats'),
    quizArea: container.querySelector('.quiz-area'),
    quizPrompt: container.querySelector('.quiz-prompt'),
    masteryMessage: container.querySelector('.mastery-message'),
    baselineInfo: container.querySelector('.baseline-info'),
    quizHeaderClose: container.querySelector('.quiz-header-close'),
    countdownFill: container.querySelector('.quiz-countdown-fill'),
    countdownBar: container.querySelector('.quiz-countdown-bar'),
    quizInfoContext: container.querySelector('.quiz-info-context'),
    quizInfoTime: container.querySelector('.quiz-info-time'),
    quizLastQuestion: container.querySelector('.quiz-last-question'),
    quizInfoCount: container.querySelector('.quiz-info-count'),
    progressFill: container.querySelector('.progress-fill'),
    progressText: container.querySelector('.progress-text'),
    roundCompleteEl: container.querySelector('.round-complete'),
  };

  // --- Render: declaratively map state to DOM ---

  function clearCalibrationContent() {
    if (calibrationContentEl) {
      calibrationContentEl.remove();
      calibrationContentEl = null;
    }
  }

  function insertAfterHint(el: HTMLElement): void {
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
    const baseline = state.calibrationBaseline!;
    const thresholds = getCalibrationThresholds(baseline);

    const div = document.createElement('div');
    div.className = 'calibration-results';

    const baselineP = document.createElement('p');
    baselineP.className = 'calibration-baseline';
    baselineP.textContent = 'Your baseline response time: ' +
      formatMs(baseline);
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
      tdTime.textContent = t.maxMs !== null
        ? '< ' + formatMs(t.maxMs)
        : '> ' + formatMs(thresholds[thresholds.length - 2].maxMs!);
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

  function isCalibrationPhase(phase: string): boolean {
    return phase === 'calibration-intro' || phase === 'calibrating' ||
      phase === 'calibration-results';
  }

  function renderPhaseClass() {
    const inCalibration = isCalibrationPhase(state.phase);

    // Clear calibration content when leaving calibration UI phases
    if (
      state.phase !== 'calibration-intro' &&
      state.phase !== 'calibration-results'
    ) {
      clearCalibrationContent();
    }

    // Set phase class on container for CSS-driven visibility
    const phaseClass = inCalibration
      ? 'phase-calibration'
      : state.phase === 'active'
      ? 'phase-active'
      : state.phase === 'round-complete'
      ? 'phase-round-complete'
      : 'phase-idle';
    container.classList.remove(
      'phase-idle',
      'phase-active',
      'phase-calibration',
      'phase-round-complete',
    );
    container.classList.add(phaseClass);

    return { inCalibration: inCalibration, phaseClass: phaseClass };
  }

  function renderCalibrationMarking(inCalibration: boolean): void {
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

    // Sub-phase classes for calibration CSS (intro hides buttons, trials shows them)
    container.classList.remove('calibration-intro', 'calibration-results');
    if (state.phase === 'calibration-intro') {
      container.classList.add('calibration-intro');
    }
    if (state.phase === 'calibration-results') {
      container.classList.add('calibration-results');
    }
  }

  function renderHeader(_inCalibration: boolean): void {
    if (els.quizArea) els.quizArea.classList.toggle('active', state.quizActive);
  }

  function renderFeedback(inCalibration: boolean): void {
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
        els.feedback.className = state.feedbackClass;
      }
      if (els.quizPrompt && state.phase === 'idle') {
        els.quizPrompt.textContent = '';
      }
    }
    if (els.timeDisplay) els.timeDisplay.textContent = state.timeDisplayText;
    if (els.hint) els.hint.textContent = state.hintText;
  }

  function renderMessages() {
    if (els.masteryMessage) {
      els.masteryMessage.textContent = state.masteryText;
      els.masteryMessage.classList.toggle('mastery-visible', state.showMastery);
    }
  }

  function renderSessionStats() {
    if (state.phase === 'active') {
      if (els.quizInfoContext) {
        const label = mode.getPracticingLabel ? mode.getPracticingLabel() : '';
        els.quizInfoContext.textContent = label;
      }
      if (els.quizInfoCount) {
        const count = state.roundAnswered;
        els.quizInfoCount.textContent = count +
          (count === 1 ? ' answer' : ' answers');
      }
    }
  }

  function renderProgress() {
    if (els.progressFill) {
      const pct = state.totalEnabledCount > 0
        ? Math.round((state.masteredCount / state.totalEnabledCount) * 100)
        : 0;
      els.progressFill.style.width = pct + '%';
    }
    if (els.progressText) {
      els.progressText.textContent = state.masteredCount + ' / ' +
        state.totalEnabledCount + ' fluent';
    }
  }

  function renderRoundComplete() {
    if (els.roundCompleteEl && state.phase === 'round-complete') {
      // Context line: scope label + overall fluency
      const contextEl = els.roundCompleteEl.querySelector(
        '.round-complete-context',
      );
      if (contextEl) {
        const label = mode.getPracticingLabel ? mode.getPracticingLabel() : '';
        const fluencyText = state.masteredCount + ' / ' +
          state.totalEnabledCount + ' fluent';
        contextEl.textContent = label
          ? label + ' \u00B7 ' + fluencyText
          : fluencyText;
      }

      // Heading (no round number)
      const heading = els.roundCompleteEl.querySelector(
        '.round-complete-heading',
      );
      if (heading) heading.textContent = 'Round complete';

      // Correct count + round duration
      const correctEl = els.roundCompleteEl.querySelector(
        '.round-stat-correct',
      );
      if (correctEl) {
        const durationSec = Math.round((state.roundDurationMs || 0) / 1000);
        correctEl.textContent = state.roundCorrect + ' / ' +
          state.roundAnswered + ' correct \u00B7 ' + durationSec + 's';
      }

      // Median response time
      const medianEl = els.roundCompleteEl.querySelector('.round-stat-median');
      if (medianEl) {
        if (state.roundResponseTimes && state.roundResponseTimes.length > 0) {
          const sorted = state.roundResponseTimes.slice().sort(function (a, b) {
            return a - b;
          });
          const mid = Math.floor(sorted.length / 2);
          const median = sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];
          medianEl.textContent = (median / 1000).toFixed(1) +
            's median response time';
        } else {
          medianEl.textContent = '';
        }
      }
    }
  }

  function renderCalibrationContent() {
    if (state.phase === 'calibration-intro' && !calibrationContentEl) {
      renderCalibrationIntro();
    } else if (state.phase === 'calibration-results' && !calibrationContentEl) {
      renderCalibrationResults();
    }
  }

  function renderBaselineInfo() {
    if (!els.baselineInfo) return;
    els.baselineInfo.textContent = '';
    const text = document.createElement('span');
    const btn = document.createElement('button');
    btn.className = 'baseline-rerun-btn';
    btn.addEventListener('click', function () {
      startCalibration();
    });
    if (motorBaseline) {
      text.textContent = 'Response time baseline: ' + formatMs(motorBaseline) +
        ' ';
      btn.textContent = 'Rerun speed check';
    } else {
      text.textContent = 'Response time baseline: 1s (default). ' +
        'Do a speed check (10 taps, ~15s) to track progress more accurately. ';
      btn.textContent = 'Speed check';
    }
    els.baselineInfo.appendChild(text);
    els.baselineInfo.appendChild(btn);
  }

  function render() {
    const ctx = renderPhaseClass();
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

  function formatRoundTime(ms: number): string {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return min + ':' + (sec < 10 ? '0' : '') + sec;
  }

  function startRoundTimer() {
    if (roundTimerInterval) clearInterval(roundTimerInterval);
    roundTimerStart = Date.now();

    // Initialize countdown bar and time display
    if (els.countdownFill) els.countdownFill.style.width = '100%';
    if (els.countdownBar) {
      els.countdownBar.classList.remove('round-timer-warning');
    }
    if (els.quizInfoTime) {
      els.quizInfoTime.textContent = formatRoundTime(ROUND_DURATION_MS);
    }

    roundTimerInterval = setInterval(() => {
      const elapsed = Date.now() - roundTimerStart!;
      const remaining = ROUND_DURATION_MS - elapsed;
      const pct = Math.max(0, (remaining / ROUND_DURATION_MS) * 100);

      if (els.countdownFill) els.countdownFill.style.width = pct + '%';
      if (els.quizInfoTime) {
        els.quizInfoTime.textContent = formatRoundTime(remaining);
      }
      // Turn red in last 10 seconds
      if (els.countdownBar) {
        els.countdownBar.classList.toggle(
          'round-timer-warning',
          remaining <= 10000 && remaining > 0,
        );
      }

      if (remaining <= 0) {
        if (roundTimerInterval) clearInterval(roundTimerInterval);
        roundTimerInterval = null;
        if (els.countdownFill) els.countdownFill.style.width = '0%';
        if (els.quizInfoTime) els.quizInfoTime.textContent = '0:00';
        if (els.countdownBar) {
          els.countdownBar.classList.remove('round-timer-warning');
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
    if (els.countdownFill) els.countdownFill.style.width = '100%';
    if (els.countdownBar) {
      els.countdownBar.classList.remove('round-timer-warning');
      els.countdownBar.classList.remove('last-question');
    }
    if (els.quizInfoTime) els.quizInfoTime.textContent = '';
    if (els.quizLastQuestion) els.quizLastQuestion.textContent = '';
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
    } else {
      // User is mid-question — signal "last question" next to the prompt
      if (els.quizLastQuestion) {
        els.quizLastQuestion.textContent = 'Last question';
      }
      if (els.countdownBar) els.countdownBar.classList.add('last-question');
    }
  }

  function transitionToRoundComplete() {
    const roundDurationMs = roundTimerStart ? Date.now() - roundTimerStart : 0;
    stopRoundTimer();
    state = engineRoundComplete(state);
    state = { ...state, roundDurationMs: roundDurationMs };
    render();
  }

  function _getResponseCount(itemId: string): number {
    return mode.getExpectedResponseCount
      ? mode.getExpectedResponseCount(itemId)
      : 1;
  }

  function setAnswerButtonsEnabled(enabled: boolean): void {
    container.querySelectorAll<HTMLButtonElement>('.answer-btn, .note-btn')
      .forEach((btn) => {
        btn.disabled = !enabled;
        // pointer-events: none lets taps fall through to the parent so
        // the tap-to-advance handler still fires on mobile (disabled
        // buttons swallow click events and prevent bubbling).
        btn.style.pointerEvents = enabled ? '' : 'none';
      });
  }

  // --- Baseline application ---

  /**
   * Sync baseline from localStorage (another mode may have completed
   * calibration since this engine was created). Called on attach().
   */
  function syncBaselineFromStorage() {
    if (motorBaseline) return; // already have one
    const stored = localStorage.getItem(baselineKey);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (parsed > 0) {
        applyBaseline(parsed);
      }
    }
  }

  function applyBaseline(baseline: number): void {
    motorBaseline = baseline;
    localStorage.setItem(baselineKey, String(baseline));
    const scaledConfig = deriveScaledConfig(baseline, DEFAULT_CONFIG);
    selector.updateConfig(scaledConfig);
    renderBaselineInfo();
  }

  // --- Calibration ---

  function getCalibrationButtons(): HTMLElement[] {
    if (mode.getCalibrationButtons) return mode.getCalibrationButtons();
    // Fallback: all visible note/answer buttons
    return Array.from(
      container.querySelectorAll<HTMLElement>(
        '.note-btn:not(.hidden), .answer-btn',
      ),
    );
  }

  /**
   * Format milliseconds as a human-readable string (e.g., "0.9s" or "1.8s").
   */
  function formatMs(ms: number): string {
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
      return 'We\u2019ll measure your response speed to set personalized targets. Press the button shown in the prompt \u2014 10 rounds total.';
    }
    return undefined; // use default (highlight mode)
  }

  function getCalibrationTrialHint() {
    if (hasSearchCalibration()) return ''; // prompt already tells user what to press
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
      ? (btns: HTMLElement[], prevBtn: HTMLElement | null) =>
        mode.getCalibrationTrialConfig!(btns, prevBtn)
      : undefined;

    calibrationCleanup = runCalibration({
      buttons,
      els,
      container,
      getTrialConfig,
      onComplete: (median: number | null) => {
        calibrationCleanup = null;
        if (median === null || !Number.isFinite(median) || median <= 0) {
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
    if (autoAdvanceTimer) {
      clearTimeout(autoAdvanceTimer);
      autoAdvanceTimer = null;
    }

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
    mode.presentQuestion(state.currentItemId!);
  }

  function submitAnswer(input: string): void {
    if (state.phase !== 'active' || state.answered) return;

    const responseTime = Date.now() - state.questionStartTime!;

    const result = mode.checkAnswer(state.currentItemId!, input);
    selector.recordResponse(state.currentItemId!, responseTime, result.correct);

    state = engineSubmitAnswer(state, result.correct, result.correctAnswer);

    // Track response time for median calculation at round end
    state = {
      ...state,
      roundResponseTimes: [...state.roundResponseTimes, responseTime],
    };

    // Check if all enabled items are mastered
    const allMastered = selector.checkAllAutomatic(mode.getEnabledItems());
    state = engineUpdateMasteryAfterAnswer(state, allMastered);

    // Update progress
    const progress = computeProgress();
    state = engineUpdateProgress(
      state,
      progress.masteredCount,
      progress.totalEnabledCount,
    );

    render();

    // Let the mode react to the answer (e.g., highlight correct position)
    if (mode.onAnswer) {
      mode.onAnswer(state.currentItemId!, result, responseTime);
    }

    // If round timer already expired, show feedback briefly then transition
    if (state.roundTimerExpired) {
      setTimeout(() => {
        if (state.phase === 'active') transitionToRoundComplete();
      }, 600);
    } else {
      // Auto-advance after 1 second
      autoAdvanceTimer = setTimeout(() => {
        if (state.phase === 'active' && state.answered) nextQuestion();
      }, 1000);
    }
  }

  function start() {
    state = engineStart(state);
    // Call onStart first so modes can tear down their idle UI (e.g. heatmap)
    // before the engine renders the quiz UI state.
    if (mode.onStart) mode.onStart();

    // Compute initial progress
    const progress = computeProgress();
    state = engineUpdateProgress(
      state,
      progress.masteredCount,
      progress.totalEnabledCount,
    );

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
    if (autoAdvanceTimer) {
      clearTimeout(autoAdvanceTimer);
      autoAdvanceTimer = null;
    }
    if (calibrationCleanup) {
      calibrationCleanup();
      calibrationCleanup = null;
    }
    stopRoundTimer();
    state = engineStop(state);
    render();
    if (mode.onStop) mode.onStop();
    updateIdleMessage();
  }

  // Keyboard handler — uses pure routing, delegates mode-specific keys
  function handleKeydown(e: KeyboardEvent): void {
    const routed = engineRouteKey(state, e.key);
    switch (routed.action) {
      case 'stop':
        e.stopImmediatePropagation();
        stop();
        break;
      case 'next':
        e.preventDefault();
        if (autoAdvanceTimer) {
          clearTimeout(autoAdvanceTimer);
          autoAdvanceTimer = null;
        }
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
  function handleClick(e: MouseEvent): void {
    // In round-complete phase, only respond to the explicit buttons
    if (state.phase === 'round-complete') return;
    if (state.phase !== 'active' || !state.answered) return;
    if (
      (e.target as HTMLElement).closest(
        '.answer-btn, .note-btn, .string-toggle',
      )
    ) return;
    if (autoAdvanceTimer) {
      clearTimeout(autoAdvanceTimer);
      autoAdvanceTimer = null;
    }
    nextQuestion();
  }

  // Attach event listeners: keyboard on document (global), clicks on container.
  // Also refreshes notation-dependent content (button labels, stats table)
  // so that a mode activated after a global notation change shows current labels.
  function attach() {
    syncBaselineFromStorage();
    document.addEventListener('keydown', handleKeydown);
    container.addEventListener('click', handleClick);
    refreshNoteButtonLabels(container);
    const activeStatsBtn = container.querySelector(
      '.stats-toggle-btn.active',
    ) as HTMLElement | null;
    if (activeStatsBtn) activeStatsBtn.click();
  }

  function detach() {
    document.removeEventListener('keydown', handleKeydown);
    container.removeEventListener('click', handleClick);
  }

  // Wire up quiz header close button
  if (els.quizHeaderClose) {
    els.quizHeaderClose.addEventListener('click', stop);
  }

  // Wire up round-complete buttons
  if (els.roundCompleteEl) {
    const keepGoingBtn = els.roundCompleteEl.querySelector(
      '.round-complete-continue',
    );
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
    syncBaselineFromStorage();
    if (!motorBaseline && state.phase === 'idle') {
      startCalibration();
    }
  }

  // Render baseline info once at initialization
  renderBaselineInfo();

  return {
    start,
    stop,
    showCalibrationIfNeeded,
    submitAnswer,
    nextQuestion,
    continueQuiz,
    attach,
    detach,
    updateIdleMessage,
    get isActive() {
      return state.phase === 'active';
    },
    get isRunning() {
      return state.phase !== 'idle';
    },
    get isAnswered() {
      return state.answered;
    },
    get baseline() {
      return motorBaseline;
    },
    selector,
    storage,
    els,
  };
}
