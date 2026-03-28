// Build-time HTML helpers for generating mode screen scaffolds and reusable
// button blocks. Imported by both main.ts and build.ts to eliminate duplication.

import {
  fretLines,
  fretMarkerDots,
  fretPositions,
  positionCircles,
  stringLines,
  SVG_HEIGHT,
  svgWidth,
  tapTargetRects,
} from './fretboard.ts';

// ---------------------------------------------------------------------------
// Reusable button blocks
// ---------------------------------------------------------------------------

// Build-time button placeholders — Preact replaces these on mount.
// Keep the container divs so the HTML structure is valid.

/** Note answer buttons placeholder. */
export function noteAnswerButtons(): string {
  return '<div class="answer-grid"></div>';
}

/** Number answer buttons placeholder. */
export function numberButtons(_start: number, _end: number): string {
  return '<div class="answer-grid"></div>';
}

/** Interval answer buttons placeholder. */
export function intervalAnswerButtons(): string {
  return '<div class="answer-grid"></div>';
}

/** Scale degree answer buttons placeholder. */
export function degreeAnswerButtons(): string {
  return '<div class="answer-grid"></div>';
}

/** Roman numeral answer buttons placeholder. */
export function numeralAnswerButtons(): string {
  return '<div class="answer-grid"></div>';
}

// ---------------------------------------------------------------------------
// Fretboard SVG + string toggle helpers
// ---------------------------------------------------------------------------

interface FretboardSVGConfig {
  id?: string;
  stringCount?: number;
  fretCount?: number;
  fretMarkers?: number[];
  /** Include invisible rect tap targets covering each fret cell. */
  tapTargets?: boolean;
}

/** Generate a complete fretboard SVG wrapper. Defaults to guitar dimensions. */
export function fretboardSVG(config: FretboardSVGConfig = {}): string {
  const sc = config.stringCount ?? 6;
  const fc = config.fretCount ?? 13;
  const w = svgWidth(sc);
  const markers = config.fretMarkers ?? [3, 5, 7, 9, 12];
  const idAttr = config.id ? ` id="${config.id}"` : '';
  return `<div class="fretboard-wrapper">
      <div class="fretboard-container">
        <svg class="fretboard"${idAttr} viewBox="0 0 ${w} ${SVG_HEIGHT}">
          <!-- Fret marker dots (inlays) -->
          ${fretMarkerDots(sc, markers, fc)}
          <!-- Nut (horizontal bar at top) -->
          <rect class="fb-nut" x="0" y="${
    fretPositions[1] - 2
  }" width="${w}" height="4" rx="1"/>
          <!-- Frets (horizontal lines) -->
          ${fretLines(w)}
          <!-- Strings (vertical lines) -->
          ${stringLines(sc)}
          <!-- Position circles -->
          ${positionCircles(sc, fc)}
          ${
    config.tapTargets
      ? '<!-- Tap targets -->\n          ' + tapTargetRects(sc, fc)
      : ''
  }
        </svg>
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
    ? `\n          <div class="practice-scope">\n            <div class="settings-row">\n              ${config.practiceScope}\n            </div>\n          </div>`
    : '';
  const recBlock = `<div class="suggestion-card">
            <div class="suggestion-card-body">
              <div class="suggestion-card-header suggestion-card-text"></div>
              <button tabindex="0" class="suggestion-card-accept">Accept</button>
            </div>
          </div>`;
  const masteryBlock = `<div class="mastery-message"></div>`;
  // Build-time scaffold only knows about scope controls, not dynamic
  // recommendations. The Preact PracticeCard also considers recommendation
  // presence when deciding whether to show the "Quiz setup" header.
  const hasScope = config.practiceScope;
  const setupHeader = hasScope
    ? `\n          <div class="practice-section-header">Practice Settings</div>`
    : '';
  const setupRec = hasScope ? `\n          ${recBlock}` : '';
  return `<div class="tabs">
      <button class="tab-btn active" data-tab="practice">Practice</button>
      <button class="tab-btn" data-tab="progress">Progress</button>
    </div>
    <div class="tab-panel tab-practice active">
      <div class="practice-card">
        <div class="practice-zone practice-zone-mastery">
          <div class="practice-section-header">Mastery</div>
          <div class="practice-status">
            <span class="practice-status-label"></span>
          </div>
          <span class="practice-status-detail"></span>
          ${masteryBlock}
        </div>
        <div class="practice-zone practice-zone-setup">${setupHeader}${setupRec}${practiceScope}
          <div class="practice-zone-action">
            <button tabindex="0" class="page-action-btn page-action-primary start-btn">Practice</button>
          </div>
        </div>
      </div>
    </div>
    <div class="tab-panel tab-progress">
      ${config.progressContent || ''}
      <div class="stats-container"></div>
      <div class="baseline-info"></div>
    </div>`;
}

/** Notes toggle HTML (natural / sharps & flats). Reused by fretboard and speed tap. */
export function notesToggleHTML(): string {
  return `<div class="toggle-group">
            <span class="toggle-group-label">Notes</span>
            <div class="notes-toggles">
              <button tabindex="0" class="notes-toggle active" data-notes="natural">natural</button>
              <button tabindex="0" class="notes-toggle" data-notes="sharps-flats">sharps &amp; flats</button>
            </div>
          </div>`;
}

// ---------------------------------------------------------------------------
// Mode screen scaffold
// ---------------------------------------------------------------------------

interface ModeScreenOptions {
  /** Human-readable mode name for the top bar. */
  modeName: string;
  /** Tab-based idle HTML generated by tabbedIdleHTML(). */
  idleHTML: string;
  /** HTML for inside the quiz-area div. */
  quizAreaContent: string;
}

/**
 * Generate a complete mode-screen div with the shared scaffold.
 * Each mode only specifies what's unique: idle HTML (tabs) and quiz-area content.
 *
 * DOM grouping:
 *   .tabs + .tab-panel — Practice/Progress tabs (idle)
 *   quiz-session            — close button + counters + progress (active)
 *   quiz-area               — question + answer buttons + feedback (active)
 */
export function modeScreen(id: string, opts: ModeScreenOptions): string {
  return `  <div class="mode-screen phase-idle" id="mode-${id}">
    <div class="mode-top-bar">
      <button tabindex="0" class="close-btn" aria-label="Back to home">\u00D7</button>
      <h1 class="mode-title">${opts.modeName}</h1>
    </div>
    ${opts.idleHTML}
    <div class="quiz-session">
      <div class="quiz-session-header">
        <button tabindex="0" class="close-btn" aria-label="Stop quiz">\u00D7</button>
        <div class="quiz-countdown-bar">
          <div class="quiz-countdown-fill"></div>
        </div>
        <span class="quiz-info-time"></span>
        <span class="quiz-info-count"></span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: 0%"></div>
        <div class="progress-text">0 / 0 automatic</div>
      </div>
    </div>
    <div class="quiz-area">
      <div class="quiz-prompt-row">
        <div class="quiz-prompt"></div>
      </div>
      ${opts.quizAreaContent}
      <div class="feedback"></div>
      <div class="hint"></div>
      <div class="round-complete">
        <div class="round-complete-heading"></div>
        <div class="round-complete-count"></div>
        <div class="round-complete-count-label"></div>
        <div class="round-complete-stats">
          <div class="round-stat-line round-stat-correct"></div>
        </div>
        <div class="round-complete-overall">
          <div class="round-complete-overall-label">Overall</div>
          <div class="round-complete-context"></div>
        </div>
        <div class="page-action-row">
          <button tabindex="0" class="page-action-btn page-action-primary">Keep Going</button>
          <button tabindex="0" class="page-action-btn page-action-secondary">Stop</button>
        </div>
      </div>
    </div>
  </div>`;
}
