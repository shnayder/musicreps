// Build-time HTML helpers for generating mode screen scaffolds and reusable
// button blocks. Imported by both main.ts and build.ts to eliminate duplication.

import {
  fretPositions,
  fretLines,
  stringLines,
  fretMarkerDots,
  positionCircles,
  svgHeight,
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

/** 12-note answer button grid (C, C#, D, ... B). */
export function noteAnswerButtons(opts?: { hidden?: boolean }): string {
  const notes: [string, string][] = [
    ["C", "C"], ["C#", "C#"], ["D", "D"], ["D#", "D#"],
    ["E", "E"], ["F", "F"], ["F#", "F#"], ["G", "G"],
    ["G#", "G#"], ["A", "A"], ["A#", "A#"], ["B", "B"],
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
  const h = svgHeight(sc);
  const markers = config.fretMarkers ?? [3, 5, 7, 9, 12];
  const idAttr = config.id ? ` id="${config.id}"` : "";
  return `<div class="fretboard-wrapper">
      <div class="fretboard-container">
        <svg class="fretboard"${idAttr} viewBox="0 0 600 ${h}">
          <!-- Fret marker dots (inlays) -->
          ${fretMarkerDots(sc, markers, fc)}
          <!-- Nut (wide bar at fret 0) -->
          <rect class="fb-nut" x="${fretPositions[1] - 2}" y="0" width="4" height="${h}" rx="1"/>
          <!-- Frets (vertical lines) -->
          ${fretLines(h)}
          <!-- Strings (horizontal lines) -->
          ${stringLines(sc)}
          <!-- Position circles -->
          ${positionCircles(sc, fc)}
        </svg>
        <div class="hover-card"><div class="hc-inner">
          <div class="hc-note"></div>
          <div class="hc-string-fret"></div>
          <div class="hc-detail"></div>
          <div class="hc-bar"><div class="hc-bar-fill"></div></div>
        </div></div>
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
// Tabbed idle content (Practice + Progress tabs) — universal
// ---------------------------------------------------------------------------

/** Build the tab-based idle content used by all quiz modes. */
export function tabbedIdleHTML(config: {
  /** HTML for mode-specific settings (toggles, checkboxes). Omit for modes with no settings. */
  practiceScope?: string;
  /** Static HTML above the stats container in the Progress tab (e.g. fretboard SVG). */
  progressContent?: string;
}): string {
  const practiceScope = config.practiceScope
    ? `\n      <div class="practice-scope">\n        <div class="settings-row">\n          ${config.practiceScope}\n        </div>\n      </div>`
    : '';
  return `<div class="mode-tabs">
      <button class="mode-tab active" data-tab="practice">Practice</button>
      <button class="mode-tab" data-tab="progress">Progress</button>
    </div>
    <div class="tab-content tab-practice active">
      <div class="practice-card">
        <div class="practice-status">
          <span class="practice-status-label"></span>
          <span class="practice-status-detail"></span>
        </div>
        <div class="practice-recommendation">
          <span class="practice-rec-text"></span>
          <button class="practice-rec-btn">Use recommendation</button>
        </div>${practiceScope}
        <div class="practice-start">
          <div class="session-summary-text"></div>
          <div class="mastery-message">Looks like you've got this!</div>
          <button class="start-btn">Start Quiz</button>
        </div>
      </div>
      <details class="practice-advanced">
        <summary>Advanced</summary>
        <button class="recalibrate-btn">Redo speed check</button>
      </details>
    </div>
    <div class="tab-content tab-progress">
      ${config.progressContent || ''}
      <div class="stats-container"></div>
      <div class="stats-controls">
        <div class="stats-toggle"><button class="stats-toggle-btn active" data-mode="retention">Recall</button><button class="stats-toggle-btn" data-mode="speed">Speed</button></div>
        <span class="stats"></span>
      </div>
    </div>`;
}

/** Build the tab-based idle content for a fretted instrument mode. */
export function fretboardIdleHTML(config: {
  stringNames: string[];
  defaultString: number;
  id: string;
  fretboardSVG: string;
}): string {
  const togglesHTML = stringToggles(config.stringNames, config.defaultString);
  const naturalsHTML = `<label class="setting-group">
            <input type="checkbox" id="${config.id}-naturals-only" checked>
            Natural only
          </label>`;
  return tabbedIdleHTML({
    practiceScope: togglesHTML + '\n          ' + naturalsHTML,
    progressContent: config.fretboardSVG,
  });
}

// ---------------------------------------------------------------------------
// Mode screen scaffold
// ---------------------------------------------------------------------------

interface ModeScreenOptions {
  /** Human-readable mode name for the top bar. */
  modeName: string;
  /** Tab-based idle HTML generated by tabbedIdleHTML() or fretboardIdleHTML(). */
  idleHTML: string;
  /** HTML for inside the quiz-area div. */
  quizAreaContent: string;
}

/**
 * Generate a complete mode-screen div with the shared scaffold.
 * Each mode only specifies what's unique: idle HTML (tabs) and quiz-area content.
 *
 * DOM grouping:
 *   mode-tabs + tab-content — Practice/Progress tabs (idle)
 *   quiz-session            — close button + counters + progress (active)
 *   quiz-area               — question + answer buttons + feedback (active)
 */
export function modeScreen(id: string, opts: ModeScreenOptions): string {
  return `  <div class="mode-screen phase-idle" id="mode-${id}">
    <div class="mode-top-bar">
      <button class="mode-back-btn" aria-label="Back to home">\u2190</button>
      <h1 class="mode-title">${opts.modeName}</h1>
    </div>
    ${opts.idleHTML}
    <div class="quiz-session">
      <div class="quiz-countdown-bar">
        <div class="quiz-countdown-fill"></div>
      </div>
      <div class="quiz-session-info">
        <span class="quiz-info-context"></span>
        <span class="quiz-info-time"></span>
        <span class="quiz-info-count"></span>
        <button class="quiz-header-close" aria-label="Stop quiz">\u00D7</button>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: 0%"></div>
        <div class="progress-text">0 / 0 fluent</div>
      </div>
    </div>
    <div class="quiz-area">
      <div class="quiz-prompt"></div>
      ${opts.quizAreaContent}
      <div class="feedback"></div>
      <div class="time-display"></div>
      <div class="hint"></div>
      <div class="round-complete">
        <div class="round-complete-heading"></div>
        <div class="round-complete-stats">
          <div class="round-stat">
            <span class="round-stat-value round-stat-correct"></span>
            <span class="round-stat-label">correct</span>
          </div>
          <div class="round-stat">
            <span class="round-stat-value round-stat-median"></span>
            <span class="round-stat-label">median time</span>
          </div>
          <div class="round-stat">
            <span class="round-stat-value round-stat-fluent"></span>
            <span class="round-stat-label">fluent</span>
          </div>
        </div>
        <div class="round-complete-actions">
          <button class="round-complete-continue">Keep Going</button>
          <button class="round-complete-stop">Stop</button>
        </div>
      </div>
    </div>
  </div>`;
}
