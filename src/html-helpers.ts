// Build-time HTML helpers for generating mode screen scaffolds and reusable
// button blocks. Imported by both main.ts and build.ts to eliminate duplication.

import {
  fretPositions,
  fretLines,
  stringLines,
  noteElements,
  fretNumberElements,
} from "./fretboard.ts";

// ---------------------------------------------------------------------------
// Reusable button blocks
// ---------------------------------------------------------------------------

/** Piano-style note buttons: naturals in bottom row, accidentals above. */
export function pianoNoteButtons(): string {
  return `<div class="note-buttons">
        <div class="note-row-accidentals">
          <button class="note-btn accidental" data-note="C#">C#</button>
          <button class="note-btn accidental" data-note="D#">D#</button>
          <button class="note-btn accidental" data-note="F#">F#</button>
          <button class="note-btn accidental" data-note="G#">G#</button>
          <button class="note-btn accidental" data-note="A#">A#</button>
        </div>
        <div class="note-row-naturals">
          <button class="note-btn" data-note="C">C</button>
          <button class="note-btn" data-note="D">D</button>
          <button class="note-btn" data-note="E">E</button>
          <button class="note-btn" data-note="F">F</button>
          <button class="note-btn" data-note="G">G</button>
          <button class="note-btn" data-note="A">A</button>
          <button class="note-btn" data-note="B">B</button>
        </div>
      </div>`;
}

/** 12-note answer button grid (C, C#/Db, D, ... B). */
export function noteAnswerButtons(opts?: { hidden?: boolean }): string {
  const notes: [string, string][] = [
    ["C", "C"], ["C#", "C#/Db"], ["D", "D"], ["D#", "D#/Eb"],
    ["E", "E"], ["F", "F"], ["F#", "F#/Gb"], ["G", "G"],
    ["G#", "G#/Ab"], ["A", "A"], ["A#", "A#/Bb"], ["B", "B"],
  ];
  const cls = opts?.hidden ? " answer-group-hidden" : "";
  return `<div class="answer-buttons answer-buttons-notes${cls}">\n`
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
export function degreeAnswerButtons(opts?: { hidden?: boolean }): string {
  const degrees: [string, string][] = [
    ["1", "1st"], ["2", "2nd"], ["3", "3rd"], ["4", "4th"],
    ["5", "5th"], ["6", "6th"], ["7", "7th"],
  ];
  const cls = opts?.hidden ? " answer-group-hidden" : "";
  return `<div class="answer-buttons answer-buttons-degrees${cls}">\n`
    + degrees.map(([val, label]) =>
      `        <button class="answer-btn answer-btn-degree" data-degree="${val}">${label}</button>`
    ).join("\n") + "\n      </div>";
}

/** Roman numeral answer buttons (I, ii, iii, IV, V, vi, vii\u00B0). */
export function numeralAnswerButtons(opts?: { hidden?: boolean }): string {
  const numerals = ["I", "ii", "iii", "IV", "V", "vi", "vii\u00B0"];
  const cls = opts?.hidden ? " answer-group-hidden" : "";
  return `<div class="answer-buttons answer-buttons-numerals${cls}">\n`
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

/** Feedback + hint (shared by all modes). time-display used during calibration. */
export function feedbackBlock(): string {
  return `<div class="feedback"></div>
      <div class="time-display"></div>
      <div class="hint"></div>`;
}

// ---------------------------------------------------------------------------
// Fretboard SVG + string toggle helpers
// ---------------------------------------------------------------------------

interface FretboardSVGConfig {
  id?: string;
  stringCount?: number;
  fretCount?: number;
  fretMarkers?: number[];
}

/** Generate a complete fretboard SVG wrapper. Defaults to guitar dimensions. */
export function fretboardSVG(config: FretboardSVGConfig = {}): string {
  const sc = config.stringCount ?? 6;
  const fc = config.fretCount ?? 13;
  const h = sc * 40;
  const markers = config.fretMarkers ?? [3, 5, 7, 9, 12];
  const idAttr = config.id ? ` id="${config.id}"` : "";
  return `<div class="fretboard-wrapper">
      <div class="fretboard-container">
        <svg class="fretboard"${idAttr} viewBox="0 0 600 ${h}">
          <!-- Nut (thick line at fret 0) -->
          <line x1="${fretPositions[1]}" y1="0" x2="${fretPositions[1]}" y2="${h}" stroke="#333" stroke-width="4"/>
          <!-- Frets (vertical lines) -->
          ${fretLines(h)}
          <!-- Strings (horizontal lines) -->
          ${stringLines(sc)}
          <!-- Note circles -->
          ${noteElements(sc, fc)}
        </svg>
        <div class="fret-numbers">
          ${fretNumberElements(markers)}
        </div>
      </div>
    </div>`;
}

/** Generate string toggle buttons for a fretted instrument mode. */
export function stringToggles(stringNames: string[], defaultString: number): string {
  return `<div class="toggle-group">
          <span class="toggle-group-label">Strings</span>
          <div class="string-toggles">
${stringNames.map((name, i) =>
  `            <button class="string-toggle${i === defaultString ? ' active' : ''}" data-string="${i}" data-string-note="${name}">${name}</button>`
).join('\n')}
          </div>
        </div>`;
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
        <span>#<span class="question-count">0</span></span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: 0%"></div>
        <div class="progress-text">0 / 0 fluent</div>
      </div>
    </div>
    <div class="quiz-area">
      <div class="practicing-label"></div>
      ${opts.quizAreaContent}
    </div>
  </div>`;
}
