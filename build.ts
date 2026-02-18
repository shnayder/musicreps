#!/usr/bin/env npx tsx
// Node-compatible build script — mirrors the Deno --build path in main.ts.
// Usage: npx tsx build.ts

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  pianoNoteButtons,
  noteAnswerButtons,
  numberButtons,
  intervalAnswerButtons,
  keysigAnswerButtons,
  degreeAnswerButtons,
  numeralAnswerButtons,
  modeScreen,
  fretboardSVG,
  tabbedIdleHTML,
  fretboardIdleHTML,
} from "./src/html-helpers.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(__dirname, rel), "utf-8");
const readModule = (rel: string) => read(rel).replace(/^export /gm, "");

const css = read("src/styles.css");
const adaptiveJS = readModule("src/adaptive.js");
const musicDataJS = readModule("src/music-data.js");
const quizEngineStateJS = readModule("src/quiz-engine-state.js");
const quizEngineJS = readModule("src/quiz-engine.js");
const statsDisplayJS = readModule("src/stats-display.js");
const recommendationsJS = readModule("src/recommendations.js");
const quizFretboardStateJS = readModule("src/quiz-fretboard-state.js");
const quizFretboardJS = read("src/quiz-fretboard.js");
const quizSpeedTapJS = read("src/quiz-speed-tap.js");
const quizNoteSemitonesJS = read("src/quiz-note-semitones.js");
const quizIntervalSemitonesJS = read("src/quiz-interval-semitones.js");
const quizSemitoneMathJS = read("src/quiz-semitone-math.js");
const quizIntervalMathJS = read("src/quiz-interval-math.js");
const quizKeySignaturesJS = read("src/quiz-key-signatures.js");
const quizScaleDegreesJS = read("src/quiz-scale-degrees.js");
const quizDiatonicChordsJS = read("src/quiz-diatonic-chords.js");
const quizChordSpellingJS = read("src/quiz-chord-spelling.js");
const settingsJS = read("src/settings.js");
const navigationJS = read("src/navigation.js");
const appJS = read("src/app.js");

// ---------------------------------------------------------------------------
// Shared HTML fragments
// ---------------------------------------------------------------------------

const DISTANCE_TOGGLES = '<div class="toggle-group"><span class="toggle-group-label">Groups</span><div class="distance-toggles"></div></div>';

const HOME_SCREEN_HTML = `  <div class="home-screen" id="home-screen">
    <div class="home-header">
      <h1 class="home-title">Music Reps</h1>
    </div>
    <div class="home-modes">
      <div class="home-group-label">Fretboard</div>
      <button data-mode="fretboard" class="home-mode-btn">
        <span class="home-mode-name">Guitar Fretboard</span>
        <span class="home-mode-desc">Name notes on the guitar neck</span>
      </button>
      <button data-mode="ukulele" class="home-mode-btn">
        <span class="home-mode-name">Ukulele Fretboard</span>
        <span class="home-mode-desc">Name notes on the ukulele</span>
      </button>
      <button data-mode="speedTap" class="home-mode-btn">
        <span class="home-mode-name">Speed Tap</span>
        <span class="home-mode-desc">Find all positions of a note</span>
      </button>
      <div class="home-group-label">Theory Lookup</div>
      <button data-mode="noteSemitones" class="home-mode-btn">
        <span class="home-mode-name">Note \u2194 Semitones</span>
        <span class="home-mode-desc">Convert between notes and semitone numbers</span>
      </button>
      <button data-mode="intervalSemitones" class="home-mode-btn">
        <span class="home-mode-name">Interval \u2194 Semitones</span>
        <span class="home-mode-desc">Convert between intervals and semitone counts</span>
      </button>
      <div class="home-group-label">Calculation</div>
      <button data-mode="semitoneMath" class="home-mode-btn">
        <span class="home-mode-name">Semitone Math</span>
        <span class="home-mode-desc">Add or subtract semitones from a note</span>
      </button>
      <button data-mode="intervalMath" class="home-mode-btn">
        <span class="home-mode-name">Interval Math</span>
        <span class="home-mode-desc">Apply intervals up or down from a note</span>
      </button>
      <div class="home-group-label">Keys &amp; Chords</div>
      <button data-mode="keySignatures" class="home-mode-btn">
        <span class="home-mode-name">Key Signatures</span>
        <span class="home-mode-desc">Match keys to their sharps and flats</span>
      </button>
      <button data-mode="scaleDegrees" class="home-mode-btn">
        <span class="home-mode-name">Scale Degrees</span>
        <span class="home-mode-desc">Name notes by scale degree in any key</span>
      </button>
      <button data-mode="diatonicChords" class="home-mode-btn">
        <span class="home-mode-name">Diatonic Chords</span>
        <span class="home-mode-desc">Identify chords built on each scale degree</span>
      </button>
      <button data-mode="chordSpelling" class="home-mode-btn">
        <span class="home-mode-name">Chord Spelling</span>
        <span class="home-mode-desc">Spell out the notes in any chord</span>
      </button>
    </div>
    <div class="home-footer">
      <button class="home-settings-btn" type="button">Settings</button>
      <span class="version">v6.0</span>
    </div>
  </div>`;

// ---------------------------------------------------------------------------
// HTML assembly
// ---------------------------------------------------------------------------

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Music Reps</title>
  <link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png">
  <link rel="icon" type="image/png" sizes="32x32" href="favicon-32x32.png">

  <style>
    ${css}
  </style>
</head>
<body>
  <!-- Home screen -->
${HOME_SCREEN_HTML}

  <!-- Guitar Fretboard mode -->
${modeScreen("fretboard", {
  modeName: 'Guitar Fretboard',
  idleHTML: fretboardIdleHTML({ stringNames: ['e', 'B', 'G', 'D', 'A', 'E'], defaultString: 5, id: 'fretboard', fretboardSVG: fretboardSVG({ stringCount: 6, fretCount: 13, fretMarkers: [3, 5, 7, 9, 12] }) }),
  quizAreaContent: `${fretboardSVG({ stringCount: 6, fretCount: 13, fretMarkers: [3, 5, 7, 9, 12] })}
      ${pianoNoteButtons()}`,
})}

  <!-- Ukulele Fretboard mode -->
${modeScreen("ukulele", {
  modeName: 'Ukulele Fretboard',
  idleHTML: fretboardIdleHTML({ stringNames: ['A', 'E', 'C', 'G'], defaultString: 2, id: 'ukulele', fretboardSVG: fretboardSVG({ stringCount: 4, fretCount: 13, fretMarkers: [3, 5, 7, 10, 12] }) }),
  quizAreaContent: `${fretboardSVG({ stringCount: 4, fretCount: 13, fretMarkers: [3, 5, 7, 10, 12] })}
      ${pianoNoteButtons()}`,
})}

  <!-- Speed Tap mode -->
${modeScreen("speedTap", {
  modeName: 'Speed Tap',
  idleHTML: tabbedIdleHTML({ practiceScope: `<label class="setting-group">
            <input type="checkbox" id="speed-tap-naturals-only" checked>
            Natural only
          </label>` }),
  quizAreaContent: `<div class="speed-tap-status">
        <span class="speed-tap-progress"></span>
      </div>
      ${fretboardSVG()}
      ${noteAnswerButtons({ hidden: true })}`,
})}

  <!-- Note Semitones mode -->
${modeScreen("noteSemitones", {
  modeName: 'Note \u2194 Semitones',
  idleHTML: tabbedIdleHTML({}),
  quizAreaContent: `${noteAnswerButtons()}
      ${numberButtons(0, 11)}`,
})}

  <!-- Interval Semitones mode -->
${modeScreen("intervalSemitones", {
  modeName: 'Interval \u2194 Semitones',
  idleHTML: tabbedIdleHTML({}),
  quizAreaContent: `${intervalAnswerButtons()}
      ${numberButtons(1, 12)}`,
})}

  <!-- Semitone Math mode -->
${modeScreen("semitoneMath", {
  modeName: 'Semitone Math',
  idleHTML: tabbedIdleHTML({ practiceScope: DISTANCE_TOGGLES }),
  quizAreaContent: `${noteAnswerButtons()}`,
})}

  <!-- Interval Math mode -->
${modeScreen("intervalMath", {
  modeName: 'Interval Math',
  idleHTML: tabbedIdleHTML({ practiceScope: DISTANCE_TOGGLES }),
  quizAreaContent: `${noteAnswerButtons()}`,
})}

  <!-- Key Signatures mode -->
${modeScreen("keySignatures", {
  modeName: 'Key Signatures',
  idleHTML: tabbedIdleHTML({ practiceScope: DISTANCE_TOGGLES }),
  quizAreaContent: `${keysigAnswerButtons()}
      ${noteAnswerButtons({ hidden: true })}`,
})}

  <!-- Scale Degrees mode -->
${modeScreen("scaleDegrees", {
  modeName: 'Scale Degrees',
  idleHTML: tabbedIdleHTML({ practiceScope: DISTANCE_TOGGLES }),
  quizAreaContent: `${noteAnswerButtons()}
      ${degreeAnswerButtons({ hidden: true })}`,
})}

  <!-- Diatonic Chords mode -->
${modeScreen("diatonicChords", {
  modeName: 'Diatonic Chords',
  idleHTML: tabbedIdleHTML({ practiceScope: DISTANCE_TOGGLES }),
  quizAreaContent: `${noteAnswerButtons()}
      ${numeralAnswerButtons({ hidden: true })}`,
})}

  <!-- Chord Spelling mode -->
${modeScreen("chordSpelling", {
  modeName: 'Chord Spelling',
  idleHTML: tabbedIdleHTML({ practiceScope: DISTANCE_TOGGLES }),
  quizAreaContent: `<div class="chord-slots"></div>
      ${noteAnswerButtons()}`,
})}

  <script>
${adaptiveJS}
${musicDataJS}
${quizEngineStateJS}
${quizEngineJS}
${statsDisplayJS}
${recommendationsJS}
${quizFretboardStateJS}
${quizFretboardJS}
${quizSpeedTapJS}
${quizNoteSemitonesJS}
${quizIntervalSemitonesJS}
${quizSemitoneMathJS}
${quizIntervalMathJS}
${quizKeySignaturesJS}
${quizScaleDegreesJS}
${quizDiatonicChordsJS}
${quizChordSpellingJS}
${settingsJS}
${navigationJS}
${appJS}
  </script>
</body>
</html>`;

const sw = `// Network-first service worker: always fetch latest, fall back to cache offline
const CACHE = 'fretboard-v1';

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
`;

// ---------------------------------------------------------------------------
// Moments page generation
// ---------------------------------------------------------------------------

interface MomentOverrides {
  phase?: 'active' | 'round-complete';
  quizAreaActive?: boolean;
  quizPrompt?: string;
  feedbackHtml?: string;
  timeDisplay?: string;
  hint?: string;
  countdown?: number;
  countdownWarning?: boolean;
  infoContext?: string;
  infoTime?: string;
  infoCount?: string;
  progressPercent?: number;
  progressText?: string;
  roundHeading?: string;
  roundCorrect?: string;
  roundMedian?: string;
  roundFluent?: string;
  practiceStatusLabel?: string;
  practiceStatusDetail?: string;
  practiceRecText?: string;
  sessionSummary?: string;
  showMastery?: boolean;
  highlightNotes?: Array<{s: number; f: number; fill: string}>;
  chordSlotsHtml?: string;
  hideAccidentals?: boolean;
  toggleState?: { active: number[]; recommended?: number };
  progressTabActive?: boolean;
  statsHtml?: string;
  statsText?: string;
}

/** Replace `target` with `replacement` in `html`, throwing if target is absent. */
function replaceOrThrow(html: string, target: string | RegExp, replacement: string | ((...args: string[]) => string)): string {
  if (typeof target === 'string') {
    if (!html.includes(target)) {
      throw new Error(`prepareMoment: target not found: ${target.slice(0, 80)}`);
    }
    return html.replace(target, replacement as string);
  }
  // RegExp target
  if (!target.test(html)) {
    throw new Error(`prepareMoment: regex not matched: ${target.source.slice(0, 80)}`);
  }
  return html.replace(target, replacement as (...args: string[]) => string);
}

function prepareMoment(source: string, o: MomentOverrides): string {
  let h = source;
  const r = (target: string | RegExp, replacement: string | ((...args: string[]) => string)) => {
    h = replaceOrThrow(h, target, replacement);
  };

  // Phase + visibility
  if (o.phase) r('phase-idle', `phase-${o.phase}`);
  if (o.quizAreaActive) r('class="quiz-area"', 'class="quiz-area active"');

  // Quiz content
  if (o.quizPrompt) r(
    '<div class="quiz-prompt"></div>',
    `<div class="quiz-prompt">${o.quizPrompt}</div>`,
  );
  if (o.feedbackHtml) r(
    '<div class="feedback"></div>',
    `<div class="feedback">${o.feedbackHtml}</div>`,
  );
  if (o.timeDisplay) r(
    '<div class="time-display"></div>',
    `<div class="time-display">${o.timeDisplay}</div>`,
  );
  if (o.hint) r(
    '<div class="hint"></div>',
    `<div class="hint">${o.hint}</div>`,
  );

  // Countdown
  if (o.countdown !== undefined) r(
    '<div class="quiz-countdown-fill"></div>',
    `<div class="quiz-countdown-fill" style="width: ${o.countdown}%;"></div>`,
  );
  if (o.countdownWarning) r(
    'class="quiz-countdown-bar"',
    'class="quiz-countdown-bar round-timer-warning"',
  );

  // Session info
  if (o.infoContext) r(
    '<span class="quiz-info-context"></span>',
    `<span class="quiz-info-context">${o.infoContext}</span>`,
  );
  if (o.infoTime) r(
    '<span class="quiz-info-time"></span>',
    `<span class="quiz-info-time">${o.infoTime}</span>`,
  );
  if (o.infoCount) r(
    '<span class="quiz-info-count"></span>',
    `<span class="quiz-info-count">${o.infoCount}</span>`,
  );

  // Progress bar
  if (o.progressPercent !== undefined) r(
    'style="width: 0%"',
    `style="width: ${o.progressPercent}%"`,
  );
  if (o.progressText) r(
    '<div class="progress-text">0 / 0 fluent</div>',
    `<div class="progress-text">${o.progressText}</div>`,
  );

  // Round complete
  if (o.roundHeading) r(
    '<div class="round-complete-heading"></div>',
    `<div class="round-complete-heading">${o.roundHeading}</div>`,
  );
  if (o.roundCorrect) r(
    '<span class="round-stat-value round-stat-correct"></span>',
    `<span class="round-stat-value round-stat-correct">${o.roundCorrect}</span>`,
  );
  if (o.roundMedian) r(
    '<span class="round-stat-value round-stat-median"></span>',
    `<span class="round-stat-value round-stat-median">${o.roundMedian}</span>`,
  );
  if (o.roundFluent) r(
    '<span class="round-stat-value round-stat-fluent"></span>',
    `<span class="round-stat-value round-stat-fluent">${o.roundFluent}</span>`,
  );

  // Practice card
  if (o.practiceStatusLabel) r(
    '<span class="practice-status-label"></span>',
    `<span class="practice-status-label">${o.practiceStatusLabel}</span>`,
  );
  if (o.practiceStatusDetail) r(
    '<span class="practice-status-detail"></span>',
    `<span class="practice-status-detail">${o.practiceStatusDetail}</span>`,
  );
  if (o.practiceRecText) r(
    '<span class="practice-rec-text"></span>',
    `<span class="practice-rec-text">${o.practiceRecText}</span>`,
  );
  if (o.sessionSummary) r(
    '<div class="session-summary-text"></div>',
    `<div class="session-summary-text">${o.sessionSummary}</div>`,
  );
  if (o.showMastery) r(
    'class="mastery-message"',
    'class="mastery-message mastery-visible"',
  );

  // Fretboard note highlighting (circle-based design)
  if (o.highlightNotes) {
    for (const n of o.highlightNotes) {
      const circleRe = new RegExp(
        `(<circle\\s+class="fb-pos"\\s+data-string="${n.s}"\\s+data-fret="${n.f}"\\s+cx="[^"]*"\\s+cy="[^"]*"\\s+)r="10"`,
      );
      r(circleRe, `$1r="10" style="fill: ${n.fill}"`);
    }
  }

  // Chord slots
  if (o.chordSlotsHtml) r(
    '<div class="chord-slots"></div>',
    `<div class="chord-slots">${o.chordSlotsHtml}</div>`,
  );

  // Hide accidentals (naturals-only mode)
  if (o.hideAccidentals) r(
    'class="note-row-accidentals"',
    'class="note-row-accidentals" style="display: none;"',
  );

  // String toggle state
  if (o.toggleState) {
    // Reset all toggles (remove default active) — global replace, no throw needed
    h = h.replace(/class="string-toggle active"/g, 'class="string-toggle"');
    for (const idx of o.toggleState.active) {
      r(
        `class="string-toggle" data-string="${idx}"`,
        `class="string-toggle active" data-string="${idx}"`,
      );
    }
    if (o.toggleState.recommended !== undefined) {
      const ri = o.toggleState.recommended;
      r(
        new RegExp(`class="string-toggle( active)?" data-string="${ri}"`),
        (_, act) => `class="string-toggle${act || ''} recommended" data-string="${ri}"`,
      );
    }
  }

  // Progress tab active
  if (o.progressTabActive) {
    r('class="mode-tab active" data-tab="practice"', 'class="mode-tab" data-tab="practice"');
    r('class="mode-tab" data-tab="progress"', 'class="mode-tab active" data-tab="progress"');
    r('class="tab-content tab-practice active"', 'class="tab-content tab-practice"');
    r('class="tab-content tab-progress"', 'class="tab-content tab-progress" style="display:block;"');
  }

  // Stats injection
  if (o.statsHtml) r(
    '<div class="stats-container"></div>',
    `<div class="stats-container">${o.statsHtml}</div>`,
  );
  if (o.statsText) r(
    '<span class="stats"></span>',
    `<span class="stats">${o.statsText}</span>`,
  );

  return h;
}

function momentFrame(label: string, bodyHtml: string, annotation: string): string {
  return `  <div class="moment-frame">
    <div class="moment-label">${label}</div>
    <div class="moment-body">
${bodyHtml}
    </div>
    <div class="moment-anno">${annotation}</div>
  </div>`;
}

function buildMoments(): void {
  // --- Mode screen generators (fresh copy per moment) ---
  const fbScreen = () => modeScreen("fretboard", {
    modeName: 'Guitar Fretboard',
    idleHTML: fretboardIdleHTML({ stringNames: ['e', 'B', 'G', 'D', 'A', 'E'], defaultString: 5, id: 'fretboard', fretboardSVG: fretboardSVG({ stringCount: 6, fretCount: 13, fretMarkers: [3, 5, 7, 9, 12] }) }),
    quizAreaContent: `${fretboardSVG({ stringCount: 6, fretCount: 13, fretMarkers: [3, 5, 7, 9, 12] })}
      ${pianoNoteButtons()}`,
  });
  const smScreen = () => modeScreen("semitoneMath", {
    modeName: 'Semitone Math',
    idleHTML: tabbedIdleHTML({ practiceScope: DISTANCE_TOGGLES }),
    quizAreaContent: `${noteAnswerButtons()}`,
  });
  const imScreen = () => modeScreen("intervalMath", {
    modeName: 'Interval Math',
    idleHTML: tabbedIdleHTML({ practiceScope: DISTANCE_TOGGLES }),
    quizAreaContent: `${noteAnswerButtons()}`,
  });
  const csScreen = () => modeScreen("chordSpelling", {
    modeName: 'Chord Spelling',
    idleHTML: tabbedIdleHTML({ practiceScope: DISTANCE_TOGGLES }),
    quizAreaContent: `<div class="chord-slots"></div>
      ${noteAnswerButtons()}`,
  });
  const nsScreen = () => modeScreen("noteSemitones", {
    modeName: 'Note \u2194 Semitones',
    idleHTML: tabbedIdleHTML({}),
    quizAreaContent: `${noteAnswerButtons()}
      ${numberButtons(0, 11)}`,
  });

  // --- Moment 1: Awaiting answer (fretboard, active) ---
  const m1 = momentFrame(
    'Fretboard mode &mdash; awaiting answer',
    prepareMoment(fbScreen(), {
      phase: 'active',
      quizAreaActive: true,
      quizPrompt: 'What note is this?',
      highlightNotes: [{ s: 5, f: 3, fill: 'hsl(50, 100%, 50%)' }],
      hideAccidentals: true,
      countdown: 72,
      infoContext: 'e, B strings',
      infoTime: '0:42',
      infoCount: '7 answers',
      progressPercent: 30,
      progressText: '5 / 18 fluent',
    }),
    'phase-active &middot; quiz-area.active &middot; highlighted note circle &middot; naturals only',
  );

  // --- Moment 2: Correct feedback (semitoneMath, active) ---
  const m2 = momentFrame(
    'Semitone Math &mdash; correct answer',
    prepareMoment(smScreen(), {
      phase: 'active',
      quizAreaActive: true,
      quizPrompt: 'C + 3 = ?',
      feedbackHtml: '<span class="correct" style="font-weight:600;">Correct!</span>',
      timeDisplay: '0.82s',
      hint: 'Press Space for next question',
      countdown: 55,
      infoContext: '+1 to +5',
      infoTime: '0:28',
      infoCount: '14 answers',
      progressPercent: 45,
      progressText: '8 / 18 fluent',
    }),
    'phase-active &middot; feedback: .correct &middot; time-display &middot; hint text',
  );

  // --- Moment 3: Wrong feedback (intervalMath, active) ---
  const m3 = momentFrame(
    'Interval Math &mdash; wrong answer',
    prepareMoment(imScreen(), {
      phase: 'active',
      quizAreaActive: true,
      quizPrompt: 'G + M3 = ?',
      feedbackHtml: '<span class="incorrect" style="font-weight:600;">Wrong &mdash; it was B</span>',
      timeDisplay: '1.34s',
      hint: 'Press Space for next question',
      countdown: 38,
      infoContext: '+m2 to +P5',
      infoTime: '0:18',
      infoCount: '22 answers',
      progressPercent: 52,
      progressText: '10 / 20 fluent',
    }),
    'phase-active &middot; feedback: .incorrect &middot; wrong answer shown',
  );

  // --- Moment 4: Chord spelling (chordSpelling, active) ---
  const m4 = momentFrame(
    'Chord Spelling &mdash; mid-answer (2 of 4 filled)',
    prepareMoment(csScreen(), {
      phase: 'active',
      quizAreaActive: true,
      quizPrompt: 'Spell: D major',
      chordSlotsHtml: `
            <span class="chord-slot correct">D</span>
            <span class="chord-slot correct">F#</span>
            <span class="chord-slot active">_</span>
            <span class="chord-slot">_</span>`,
      countdown: 60,
      infoContext: 'major, minor',
      infoTime: '0:35',
      infoCount: '5 answers',
      progressPercent: 20,
      progressText: '3 / 14 fluent',
    }),
    'phase-active &middot; chord-slots: correct/active/empty &middot; note answer buttons',
  );

  // --- Moment 5a: Round complete — good round ---
  const m5a = momentFrame(
    'Round complete &mdash; good round',
    prepareMoment(fbScreen(), {
      phase: 'round-complete',
      quizAreaActive: true,
      countdown: 0,
      infoContext: 'e, B strings',
      infoTime: '1:00',
      infoCount: '18 answers',
      progressPercent: 65,
      progressText: '12 / 18 fluent',
      roundHeading: 'Round 3 complete',
      roundCorrect: '16 / 18',
      roundMedian: '0.9s',
      roundFluent: '12 / 18',
    }),
    'phase-round-complete &middot; good stats: 89% correct, fast median',
  );

  // --- Moment 5b: Round complete — rough round ---
  const m5b = momentFrame(
    'Round complete &mdash; rough round',
    prepareMoment(fbScreen(), {
      phase: 'round-complete',
      quizAreaActive: true,
      countdown: 0,
      infoContext: 'all strings',
      infoTime: '1:00',
      infoCount: '9 answers',
      progressPercent: 15,
      progressText: '3 / 24 fluent',
      roundHeading: 'Round 1 complete',
      roundCorrect: '5 / 9',
      roundMedian: '2.8s',
      roundFluent: '3 / 24',
    }),
    'phase-round-complete &middot; rough stats: 56% correct, slow median',
  );

  // --- Moment 7: Practice — consolidating ---
  const m7 = momentFrame(
    'Practice tab &mdash; consolidating (recommendation available)',
    prepareMoment(fbScreen(), {
      practiceStatusLabel: 'Consolidating',
      practiceStatusDetail: 'Master current strings before adding more',
      practiceRecText: 'Recommended: add string D',
      sessionSummary: '26 items across 2 strings',
      toggleState: { active: [0, 1], recommended: 3 },
    }),
    'phase-idle &middot; practice-status: consolidating &middot; .recommended glow on toggle',
  );

  // --- Moment 8: Practice — ready to expand ---
  const m8 = momentFrame(
    'Practice tab &mdash; ready to expand',
    prepareMoment(fbScreen(), {
      practiceStatusLabel: 'Ready to expand',
      practiceStatusDetail: 'Current strings mastered',
      practiceRecText: 'Recommended: add string G',
      sessionSummary: '39 items across 3 strings',
      showMastery: true,
      toggleState: { active: [0, 1, 3], recommended: 2 },
    }),
    'phase-idle &middot; mastery-message visible &middot; ready to expand',
  );

  // --- Moment 9: Home screen ---
  const m9 = momentFrame(
    'Home screen',
    HOME_SCREEN_HTML,
    'home-screen layout &middot; group labels + mode buttons + footer',
  );

  // --- Moment 10: Progress + heatmap ---
  const heatmapHtml = `
            <table class="stats-table">
              <thead><tr><th></th><th>Forward</th><th>Reverse</th></tr></thead>
              <tbody>
                <tr><th>C</th>
                  <td><div class="stats-cell" style="background: var(--heatmap-5); color: white;">5</div></td>
                  <td><div class="stats-cell" style="background: var(--heatmap-4); color: white;">4</div></td></tr>
                <tr><th>C#</th>
                  <td><div class="stats-cell" style="background: var(--heatmap-3); color: white;">3</div></td>
                  <td><div class="stats-cell" style="background: var(--heatmap-2);">2</div></td></tr>
                <tr><th>D</th>
                  <td><div class="stats-cell" style="background: var(--heatmap-5); color: white;">5</div></td>
                  <td><div class="stats-cell" style="background: var(--heatmap-3); color: white;">3</div></td></tr>
                <tr><th>D#</th>
                  <td><div class="stats-cell" style="background: var(--heatmap-1);">1</div></td>
                  <td><div class="stats-cell" style="background: var(--heatmap-none);">&mdash;</div></td></tr>
                <tr><th>E</th>
                  <td><div class="stats-cell" style="background: var(--heatmap-4); color: white;">4</div></td>
                  <td><div class="stats-cell" style="background: var(--heatmap-5); color: white;">5</div></td></tr>
                <tr><th>F</th>
                  <td><div class="stats-cell" style="background: var(--heatmap-2);">2</div></td>
                  <td><div class="stats-cell" style="background: var(--heatmap-1);">1</div></td></tr>
              </tbody>
            </table>
            <div class="heatmap-legend" style="display:flex;">
              <div class="legend-item"><span class="legend-swatch" style="background: var(--heatmap-none);"></span>No data</div>
              <div class="legend-item"><span class="legend-swatch" style="background: var(--heatmap-1);"></span>Needs work</div>
              <div class="legend-item"><span class="legend-swatch" style="background: var(--heatmap-2);"></span>Fading</div>
              <div class="legend-item"><span class="legend-swatch" style="background: var(--heatmap-3);"></span>Getting there</div>
              <div class="legend-item"><span class="legend-swatch" style="background: var(--heatmap-4);"></span>Solid</div>
              <div class="legend-item"><span class="legend-swatch" style="background: var(--heatmap-5);"></span>Automatic</div>
            </div>`;
  const m10 = momentFrame(
    'Progress tab &mdash; recall heatmap',
    prepareMoment(nsScreen(), {
      progressTabActive: true,
      statsHtml: heatmapHtml,
      statsText: '4 / 12 items fluent',
    }),
    'phase-idle &middot; progress tab active &middot; heatmap + legend + stats toggle',
  );

  // --- Moment 11: Countdown bar states (isolated) ---
  const m11 = momentFrame(
    'Countdown bar &mdash; fill levels + warning',
    `      <div class="countdown-demo">
        <div class="countdown-demo-label">100% &mdash; round start</div>
        <div class="quiz-countdown-bar"><div class="quiz-countdown-fill" style="width: 100%;"></div></div>

        <div class="countdown-demo-label">65% &mdash; mid-round</div>
        <div class="quiz-countdown-bar"><div class="quiz-countdown-fill" style="width: 65%;"></div></div>

        <div class="countdown-demo-label">30% &mdash; getting low</div>
        <div class="quiz-countdown-bar"><div class="quiz-countdown-fill" style="width: 30%;"></div></div>

        <div class="countdown-demo-label">12% &mdash; warning (last 10s, red fill)</div>
        <div class="quiz-countdown-bar round-timer-warning"><div class="quiz-countdown-fill" style="width: 12%;"></div></div>

        <div class="countdown-demo-label">0% &mdash; time&rsquo;s up</div>
        <div class="quiz-countdown-bar round-timer-warning"><div class="quiz-countdown-fill" style="width: 0%;"></div></div>
      </div>`,
    'quiz-countdown-bar &middot; 4px height &middot; brand fill &rarr; red (.round-timer-warning)',
  );

  // --- Assemble page ---
  const momentsPage = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Screen Moments &mdash; Music Reps</title>
  <link rel="stylesheet" href="../../src/styles.css">
  <style>
    /* Override app layout for this reference page */
    body {
      display: block;
      max-width: 960px;
      padding: 2rem 1rem;
      min-height: auto;
      color: var(--color-text);
      line-height: 1.5;
      background: var(--color-surface);
      border: none;
    }
    body > h1 { font-size: 1.5rem; margin: 0 0 0.25rem; }
    .subtitle { color: var(--color-text-muted); font-size: 0.9rem; margin-bottom: 2rem; }
    body > h2 {
      font-size: 1.1rem;
      margin: 2.5rem 0 0.75rem;
      padding-bottom: 0.25rem;
      border-bottom: 1px solid var(--color-border-lighter);
    }
    body > p { font-size: 0.85rem; color: var(--color-text-muted); margin: 0 0 1rem; }
    code {
      font-family: ui-monospace, 'SF Mono', Monaco, monospace;
      font-size: 0.8em;
      background: var(--color-surface);
      padding: 0.1em 0.35em;
      border-radius: 3px;
    }

    /* Nav link */
    .page-nav {
      display: flex;
      gap: 1rem;
      margin-bottom: 1rem;
      font-size: 0.8rem;
    }
    .page-nav a { color: var(--color-brand-dark); text-decoration: none; }
    .page-nav a:hover { text-decoration: underline; }

    /* Moment frames */
    .moment-frame {
      width: 402px;
      border: 1px solid var(--color-border-light);
      border-radius: 8px;
      overflow: hidden;
      margin: 0.75rem 0;
      background: var(--color-bg);
    }
    .moment-label {
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--color-text-light);
      padding: 0.4rem 0.75rem;
      background: var(--color-surface);
      border-bottom: 1px solid var(--color-border-lighter);
    }
    .moment-body {
      max-width: 402px;
      padding: 0 var(--space-5);
      font-family: system-ui, -apple-system, sans-serif;
    }
    .moment-anno {
      font-size: 0.7rem;
      color: var(--color-text-light);
      font-family: ui-monospace, 'SF Mono', Monaco, monospace;
      padding: 0.4rem 0.75rem;
      background: var(--color-surface);
      border-top: 1px solid var(--color-border-lighter);
    }

    /* Side-by-side moment pairs */
    .moment-row { display: flex; gap: 1rem; flex-wrap: wrap; }

    /* --- Neutralize production CSS inside moment frames --- */
    .moment-body .mode-screen {
      display: block;
      padding-top: var(--space-3);
      flex: none;
    }
    .moment-body .phase-active,
    .moment-body .phase-round-complete {
      margin: 0;
      background: var(--color-surface);
      padding: 0;
    }
    .moment-body .quiz-countdown-bar {
      margin: 0;
      margin-bottom: var(--space-2);
    }
    .moment-body .quiz-area.active {
      display: block;
      background: var(--color-surface);
      border-radius: 12px;
      padding: var(--space-5);
    }
    .moment-body .phase-active .quiz-area.active {
      border: 1px solid var(--color-border-lighter);
      padding: var(--space-3) var(--space-3);
    }
    .moment-body .phase-round-complete .round-complete { display: block; }
    .moment-body .quiz-session { display: block; }

    /* Home screen moment */
    .moment-body .home-screen {
      display: flex;
      flex-direction: column;
      padding: var(--space-5);
      min-height: auto;
    }
    .moment-body .home-screen.hidden { display: flex; }

    /* Countdown bar demo (section 11) */
    .countdown-demo { padding: var(--space-4); }
    .countdown-demo-label {
      font-size: 0.7rem;
      color: var(--color-text-muted);
      margin-bottom: var(--space-2);
    }
    .countdown-demo .quiz-countdown-bar { margin: 0 0 var(--space-4) 0; }
  </style>
</head>
<body>
  <h1>Screen Moments</h1>
  <div class="subtitle">
    Build-generated layouts at 402px &mdash; edit <code>src/styles.css</code>,
    run <code>npx tsx build.ts</code>, refresh.
  </div>
  <div class="page-nav">
    <a href="components.html">Components &rarr;</a>
    <a href="colors.html">Colors &rarr;</a>
  </div>

  <h2>1. Quiz: Awaiting Answer</h2>
  <p>Active quiz with question displayed, waiting for user input.</p>
${m1}

  <h2>2. Quiz: Correct Feedback</h2>
  <p>After answering correctly &mdash; feedback text, time display, hint.</p>
${m2}

  <h2>3. Quiz: Wrong Feedback</h2>
  <p>After answering incorrectly &mdash; error feedback with correct answer.</p>
${m3}

  <h2>4. Quiz: Chord Spelling</h2>
  <p>Sequential slot-fill with chord slots and note answer buttons.</p>
${m4}

  <h2>5. Round Complete</h2>
  <p>End-of-round summary &mdash; good and rough variants side by side.</p>
  <div class="moment-row">
${m5a}
${m5b}
  </div>

  <h2>6. Practice Tab: Consolidating</h2>
  <p>Idle state with practice card showing consolidation recommendation.</p>
${m7}

  <h2>7. Practice Tab: Ready to Expand</h2>
  <p>All current items mastered &mdash; recommendation to add more scope.</p>
${m8}

  <h2>8. Home Screen</h2>
  <p>Mode selector with grouped mode buttons and footer.</p>
${m9}

  <h2>9. Progress Tab + Heatmap</h2>
  <p>Progress tab with stats toggle and heatmap table.</p>
${m10}

  <h2>10. Countdown Bar States</h2>
  <p>Isolated countdown bar at different fill levels, including warning state.</p>
${m11}

</body>
</html>`;

  writeFileSync(join(__dirname, "guides/design/moments.html"), momentsPage);
}

buildMoments();

// ---------------------------------------------------------------------------
// Write output files
// ---------------------------------------------------------------------------

mkdirSync(join(__dirname, "docs"), { recursive: true });
writeFileSync(join(__dirname, "docs/index.html"), html);
writeFileSync(join(__dirname, "docs/sw.js"), sw);

// Copy design reference pages to docs/design/ so they're accessible from deploys.
// Rewrite the stylesheet path from ../../src/styles.css to styles.css (co-located copy).
const designSrc = join(__dirname, "guides/design");
const designDst = join(__dirname, "docs/design");
mkdirSync(designDst, { recursive: true });
writeFileSync(join(designDst, "styles.css"), css);
for (const file of readdirSync(designSrc).filter(f => f.endsWith(".html"))) {
  const content = readFileSync(join(designSrc, file), "utf-8")
    .replace('href="../../src/styles.css"', 'href="styles.css"');
  writeFileSync(join(designDst, file), content);
}

console.log("Built to docs/index.html + docs/sw.js + docs/design/");
