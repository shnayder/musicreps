#!/usr/bin/env npx tsx
// Node-compatible build script — mirrors the Deno --build path in main.ts.
// Usage: npx tsx build.ts

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  fretPositions,
  fretLines,
  stringLines,
  noteElements,
  fretNumberElements,
} from "./src/fretboard.ts";
import {
  noteAnswerButtons,
  numberButtons,
  intervalAnswerButtons,
  keysigAnswerButtons,
  degreeAnswerButtons,
  numeralAnswerButtons,
  countdownAndPrompt,
  feedbackBlock,
  modeScreen,
} from "./src/html-helpers.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(__dirname, rel), "utf-8");
const readModule = (rel: string) => read(rel).replace(/^export /gm, "");

const css = read("src/styles.css");
const adaptiveJS = readModule("src/adaptive.js");
const musicDataJS = readModule("src/music-data.js");
const quizEngineStateJS = readModule("src/quiz-engine-state.js");
const deadlineJS = readModule("src/deadline.js");
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
const navigationJS = read("src/navigation.js");
const appJS = read("src/app.js");

// ---------------------------------------------------------------------------
// Shared HTML fragments
// ---------------------------------------------------------------------------

function fretboardSVG(id?: string): string {
  const idAttr = id ? ` id="${id}"` : "";
  return `<div class="fretboard-wrapper">
      <div class="fretboard-container">
        <svg class="fretboard"${idAttr} viewBox="0 0 600 240">
          <!-- Nut (thick line at fret 0) -->
          <line x1="${fretPositions[1]}" y1="0" x2="${fretPositions[1]}" y2="240" stroke="#333" stroke-width="4"/>
          <!-- Frets (vertical lines) -->
          ${fretLines()}
          <!-- Strings (horizontal lines) -->
          ${stringLines()}
          <!-- Note circles -->
          ${noteElements()}
        </svg>
        <div class="fret-numbers">
          ${fretNumberElements()}
        </div>
      </div>
    </div>`;
}

const DISTANCE_TOGGLES = '<div class="distance-toggles"></div>';

// ---------------------------------------------------------------------------
// HTML assembly
// ---------------------------------------------------------------------------

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fretboard Trainer</title>
  <link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png">
  <link rel="icon" type="image/png" sizes="32x32" href="favicon-32x32.png">

  <style>
    ${css}
  </style>
</head>
<body>
  <!-- Navigation -->
  <div class="nav-overlay"></div>
  <div class="nav-drawer" id="nav-drawer">
    <button data-mode="fretboard">Fretboard</button>
    <button data-mode="speedTap">Speed Tap</button>
    <button data-mode="noteSemitones">Note \u2194 Semitones</button>
    <button data-mode="intervalSemitones">Interval \u2194 Semitones</button>
    <button data-mode="semitoneMath">Semitone Math</button>
    <button data-mode="intervalMath">Interval Math</button>
    <button data-mode="keySignatures">Key Signatures</button>
    <button data-mode="scaleDegrees">Scale Degrees</button>
    <button data-mode="diatonicChords">Diatonic Chords</button>
    <button data-mode="chordSpelling">Chord Spelling</button>
  </div>

  <div class="top-bar">
    <button class="hamburger" type="button" aria-label="Toggle navigation menu" aria-expanded="false" aria-controls="nav-drawer">\u2630</button>
    <h1 id="mode-title">Fretboard</h1>
    <div class="version">v3.8</div>
  </div>

  <!-- Fretboard mode -->
${modeScreen("fretboard", {
  settingsHTML: `<div class="string-toggles" id="string-toggles">
          <button class="string-toggle" data-string="0">e</button>
          <button class="string-toggle" data-string="1">B</button>
          <button class="string-toggle" data-string="2">G</button>
          <button class="string-toggle" data-string="3">D</button>
          <button class="string-toggle" data-string="4">A</button>
          <button class="string-toggle active" data-string="5">E</button>
        </div>
        <label class="setting-group">
          <input type="checkbox" id="naturals-only" checked>
          Natural only
        </label>`,
  beforeQuizArea: fretboardSVG("fretboard"),
  quizAreaContent: `<div class="countdown-container">
        <div class="countdown-track"><div class="countdown-bar"></div></div><span class="deadline-display"></span>
      </div>
      <div class="note-buttons">
        <button class="note-btn" data-note="C">C</button>
        <button class="note-btn accidental" data-note="C#">C#</button>
        <button class="note-btn" data-note="D">D</button>
        <button class="note-btn accidental" data-note="D#">D#</button>
        <button class="note-btn" data-note="E">E</button>
        <button class="note-btn" data-note="F">F</button>
        <button class="note-btn accidental" data-note="F#">F#</button>
        <button class="note-btn" data-note="G">G</button>
        <button class="note-btn accidental" data-note="G#">G#</button>
        <button class="note-btn" data-note="A">A</button>
        <button class="note-btn accidental" data-note="A#">A#</button>
        <button class="note-btn" data-note="B">B</button>
      </div>
      ${feedbackBlock()}`,
})}

  <!-- Speed Tap mode -->
${modeScreen("speedTap", {
  settingsHTML: `<label class="setting-group">
          <input type="checkbox" id="speed-tap-naturals-only" checked>
          Natural only
        </label>`,
  sessionUnit: "rounds",
  quizAreaContent: `<div class="speed-tap-prompt"></div>
      <div class="speed-tap-status">
        <span class="speed-tap-progress"></span>
        <span class="speed-tap-timer"></span>
      </div>
      ${fretboardSVG()}
      ${noteAnswerButtons('display: none;')}
      ${feedbackBlock()}`,
})}

  <!-- Note Semitones mode -->
${modeScreen("noteSemitones", {
  quizAreaContent: `${countdownAndPrompt()}
      ${noteAnswerButtons()}
      ${numberButtons(0, 11)}
      ${feedbackBlock()}`,
})}

  <!-- Interval Semitones mode -->
${modeScreen("intervalSemitones", {
  quizAreaContent: `${countdownAndPrompt()}
      ${intervalAnswerButtons()}
      ${numberButtons(1, 12)}
      ${feedbackBlock()}`,
})}

  <!-- Semitone Math mode -->
${modeScreen("semitoneMath", {
  settingsHTML: DISTANCE_TOGGLES,
  quizAreaContent: `${countdownAndPrompt()}
      ${noteAnswerButtons()}
      ${feedbackBlock()}`,
})}

  <!-- Interval Math mode -->
${modeScreen("intervalMath", {
  settingsHTML: DISTANCE_TOGGLES,
  quizAreaContent: `${countdownAndPrompt()}
      ${noteAnswerButtons()}
      ${feedbackBlock()}`,
})}

  <!-- Key Signatures mode -->
${modeScreen("keySignatures", {
  settingsHTML: DISTANCE_TOGGLES,
  quizAreaContent: `${countdownAndPrompt()}
      ${keysigAnswerButtons()}
      ${noteAnswerButtons('display: none;')}
      ${feedbackBlock()}`,
})}

  <!-- Scale Degrees mode -->
${modeScreen("scaleDegrees", {
  settingsHTML: DISTANCE_TOGGLES,
  quizAreaContent: `${countdownAndPrompt()}
      ${noteAnswerButtons()}
      ${degreeAnswerButtons('display: none;')}
      ${feedbackBlock()}`,
})}

  <!-- Diatonic Chords mode -->
${modeScreen("diatonicChords", {
  settingsHTML: DISTANCE_TOGGLES,
  quizAreaContent: `${countdownAndPrompt()}
      ${noteAnswerButtons()}
      ${numeralAnswerButtons('display: none;')}
      ${feedbackBlock()}`,
})}

  <!-- Chord Spelling mode -->
${modeScreen("chordSpelling", {
  settingsHTML: DISTANCE_TOGGLES,
  quizAreaContent: `${countdownAndPrompt()}
      <div class="chord-slots"></div>
      ${noteAnswerButtons()}
      ${feedbackBlock()}`,
})}

  <script>
${adaptiveJS}
${musicDataJS}
${quizEngineStateJS}
${deadlineJS}
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

mkdirSync(join(__dirname, "docs"), { recursive: true });
writeFileSync(join(__dirname, "docs/index.html"), html);
writeFileSync(join(__dirname, "docs/sw.js"), sw);
console.log("Built to docs/index.html + docs/sw.js");
