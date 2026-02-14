// Build-time HTML helpers for generating mode screen scaffolds and reusable
// button blocks. Imported by both main.ts and build.ts to eliminate duplication.

// ---------------------------------------------------------------------------
// Reusable button blocks
// ---------------------------------------------------------------------------

/** 12-note answer button grid (C, C#/Db, D, ... B). */
export function noteAnswerButtons(style?: string): string {
  const notes: [string, string][] = [
    ["C", "C"], ["C#", "C#/Db"], ["D", "D"], ["D#", "D#/Eb"],
    ["E", "E"], ["F", "F"], ["F#", "F#/Gb"], ["G", "G"],
    ["G#", "G#/Ab"], ["A", "A"], ["A#", "A#/Bb"], ["B", "B"],
  ];
  const styleAttr = style ? ` style="${style}"` : "";
  return `<div class="answer-buttons answer-buttons-notes"${styleAttr}>\n`
    + notes.map(([val, label]) =>
      `        <button class="answer-btn answer-btn-note" data-note="${val}">${label}</button>`
    ).join("\n") + "\n      </div>";
}

/** Number answer buttons (start..end inclusive). */
export function numberButtons(start: number, end: number): string {
  const btns = [];
  for (let i = start; i <= end; i++) {
    btns.push(`        <button class="answer-btn answer-btn-num" data-num="${i}">${i}</button>`);
  }
  return `<div class="answer-buttons answer-buttons-numbers">\n`
    + btns.join("\n") + "\n      </div>";
}

/** Interval answer buttons (m2..P8). */
export function intervalAnswerButtons(): string {
  const intervals = ["m2", "M2", "m3", "M3", "P4", "TT", "P5", "m6", "M6", "m7", "M7", "P8"];
  return `<div class="answer-buttons answer-buttons-intervals">\n`
    + intervals.map((i) =>
      `        <button class="answer-btn answer-btn-interval" data-interval="${i}">${i}</button>`
    ).join("\n") + "\n      </div>";
}

/** Key signature answer buttons (0, 1#..7#, 1b..7b). */
export function keysigAnswerButtons(): string {
  const sigs = ["0", "1#", "2#", "3#", "4#", "5#", "6#", "7#", "1b", "2b", "3b", "4b", "5b", "6b", "7b"];
  return `<div class="answer-buttons answer-buttons-keysig">\n`
    + sigs.map((s) =>
      `        <button class="answer-btn answer-btn-keysig" data-sig="${s}">${s}</button>`
    ).join("\n") + "\n      </div>";
}

/** Scale degree answer buttons (1st..7th). */
export function degreeAnswerButtons(style?: string): string {
  const degrees: [string, string][] = [
    ["1", "1st"], ["2", "2nd"], ["3", "3rd"], ["4", "4th"],
    ["5", "5th"], ["6", "6th"], ["7", "7th"],
  ];
  const styleAttr = style ? ` style="${style}"` : "";
  return `<div class="answer-buttons answer-buttons-degrees"${styleAttr}>\n`
    + degrees.map(([val, label]) =>
      `        <button class="answer-btn answer-btn-degree" data-degree="${val}">${label}</button>`
    ).join("\n") + "\n      </div>";
}

/** Roman numeral answer buttons (I, ii, iii, IV, V, vi, vii\u00B0). */
export function numeralAnswerButtons(style?: string): string {
  const numerals = ["I", "ii", "iii", "IV", "V", "vi", "vii\u00B0"];
  const styleAttr = style ? ` style="${style}"` : "";
  return `<div class="answer-buttons answer-buttons-numerals"${styleAttr}>\n`
    + numerals.map((n) =>
      `        <button class="answer-btn answer-btn-numeral" data-numeral="${n}">${n}</button>`
    ).join("\n") + "\n      </div>";
}

// ---------------------------------------------------------------------------
// Common sub-blocks
// ---------------------------------------------------------------------------

/** Countdown bar + quiz prompt (shared by all text quiz modes). */
export function countdownAndPrompt(): string {
  return `<div class="countdown-container"><div class="countdown-track"><div class="countdown-bar"></div></div><span class="deadline-display"></span></div>
      <div class="quiz-prompt"></div>`;
}

/** Feedback + time display + hint (shared by all modes). */
export function feedbackBlock(): string {
  return `<div class="feedback"></div>
      <div class="time-display"></div>
      <div class="hint"></div>`;
}

// ---------------------------------------------------------------------------
// Mode screen scaffold
// ---------------------------------------------------------------------------

interface ModeScreenOptions {
  /** HTML for the settings-row div contents. Empty string = no settings row. */
  settingsHTML?: string;
  /** HTML for inside the quiz-area div. */
  quizAreaContent: string;
  /** HTML inserted between quiz-session and quiz-area (e.g. fretboard-wrapper). */
  beforeQuizArea?: string;
}

/**
 * Generate a complete mode-screen div with the shared scaffold.
 * Each mode only specifies what's unique: settings, quiz-area content, etc.
 *
 * DOM grouping:
 *   [beforeQuizArea] — mode-specific content above stats (e.g. fretboard SVG)
 *   stats-section    — heatmap + recall/speed toggle (idle)
 *   quiz-config      — settings + mastery + start/recalibrate (idle)
 *   quiz-session     — close button + counters + progress (active)
 *   quiz-area        — question + answer buttons + feedback (active)
 */
export function modeScreen(id: string, opts: ModeScreenOptions): string {
  const settingsRow = opts.settingsHTML
    ? `\n      <div class="settings-row">\n        ${opts.settingsHTML}\n      </div>`
    : "";
  const beforeQuizArea = opts.beforeQuizArea ? "\n    " + opts.beforeQuizArea : "";

  return `  <div class="mode-screen phase-idle" id="mode-${id}">${beforeQuizArea}
    <div class="stats-section">
      <div class="stats-container"></div>
      <div class="stats-controls">
        <div class="stats-toggle"><button class="stats-toggle-btn active" data-mode="retention">Recall</button><button class="stats-toggle-btn" data-mode="speed">Speed</button></div>
        <span class="stats"></span>
      </div>
    </div>
    <div class="quiz-config">${settingsRow}
      <div class="mastery-message" style="display: none;">Looks like you've got this!</div>
      <div>
        <button class="start-btn">Start Quiz</button>
        <button class="recalibrate-btn" style="display: none;">Redo speed check</button>
      </div>
    </div>
    <div class="quiz-session">
      <div class="quiz-header">
        <span class="quiz-header-title"></span>
        <button class="quiz-header-close" aria-label="Stop quiz">\u00D7</button>
      </div>
      <div class="session-stats">
        <span><span class="question-count">0</span> questions</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: 0%"></div>
        <div class="progress-text">0 / 0 mastered</div>
      </div>
    </div>
    <div class="quiz-area">
      ${opts.quizAreaContent}
    </div>
  </div>`;
}
