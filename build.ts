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

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(__dirname, rel), "utf-8");
const readModule = (rel: string) => read(rel).replace(/^export /gm, "");

const css = read("src/styles.css");
const adaptiveJS = readModule("src/adaptive.js");
const musicDataJS = readModule("src/music-data.js");
const quizEngineJS = readModule("src/quiz-engine.js");
const statsDisplayJS = readModule("src/stats-display.js");
const quizFretboardJS = read("src/quiz-fretboard.js");
const quizSpeedTapJS = read("src/quiz-speed-tap.js");
const quizNoteSemitonesJS = read("src/quiz-note-semitones.js");
const quizIntervalSemitonesJS = read("src/quiz-interval-semitones.js");
const quizSemitoneMathJS = read("src/quiz-semitone-math.js");
const quizIntervalMathJS = read("src/quiz-interval-math.js");
const navigationJS = read("src/navigation.js");
const appJS = read("src/app.js");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fretboard Trainer</title>
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
  </div>

  <div class="top-bar">
    <button class="hamburger" type="button" aria-label="Toggle navigation menu" aria-expanded="false" aria-controls="nav-drawer">\u2630</button>
    <h1 id="mode-title">Fretboard</h1>
    <div class="version">v2.4</div>
  </div>

  <!-- Fretboard mode -->
  <div class="mode-screen" id="mode-fretboard">
    <div class="fretboard-wrapper">
      <div class="fretboard-container">
        <svg class="fretboard" id="fretboard" viewBox="0 0 600 240">
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
    </div>
    <div class="stats-container"></div>
    <div class="stats-controls">
      <button class="heatmap-btn">Show Recall</button>
      <span class="stats"></span>
    </div>
    <div class="quiz-controls">
      <div class="settings-row">
        <div class="string-toggles" id="string-toggles">
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
        </label>
      </div>
      <div class="mastery-message" style="display: none;">Looks like you've got this!</div>
      <div>
        <button class="start-btn">Start Quiz</button>
        <button class="stop-btn" style="display: none;">Stop Quiz</button>
      </div>
    </div>
    <div class="quiz-area">
      <div class="countdown-container">
        <div class="countdown-bar"></div>
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
      <div class="feedback"></div>
      <div class="time-display"></div>
      <div class="hint"></div>
    </div>
  </div>

  <!-- Speed Tap mode -->
  <div class="mode-screen" id="mode-speedTap">
    <div class="fretboard-wrapper">
      <div class="fretboard-container">
        <svg class="fretboard" viewBox="0 0 600 240">
          <line x1="${fretPositions[1]}" y1="0" x2="${fretPositions[1]}" y2="240" stroke="#333" stroke-width="4"/>
          ${fretLines()}
          ${stringLines()}
          ${noteElements()}
        </svg>
        <div class="fret-numbers">
          ${fretNumberElements()}
        </div>
      </div>
    </div>
    <div class="stats-container"></div>
    <div class="stats-controls">
      <button class="heatmap-btn">Show Recall</button>
      <span class="stats"></span>
    </div>
    <div class="quiz-controls">
      <div class="settings-row">
        <label class="setting-group">
          <input type="checkbox" id="speed-tap-naturals-only" checked>
          Natural only
        </label>
      </div>
      <div class="mastery-message" style="display: none;">Looks like you've got this!</div>
      <div>
        <button class="start-btn">Start Quiz</button>
        <button class="stop-btn" style="display: none;">Stop Quiz</button>
      </div>
    </div>

    <div class="quiz-area">
      <div class="speed-tap-prompt"></div>
      <div class="speed-tap-status">
        <span class="speed-tap-progress"></span>
        <span class="speed-tap-timer"></span>
      </div>
      <div class="feedback"></div>
      <div class="hint"></div>
    </div>
  </div>

  <!-- Note Semitones mode -->
  <div class="mode-screen" id="mode-noteSemitones">
    <div class="stats-container"></div>
    <div class="stats-controls">
      <button class="heatmap-btn">Show Recall</button>
      <span class="stats"></span>
    </div>
    <div class="quiz-controls">
      <div class="mastery-message" style="display: none;">Looks like you've got this!</div>
      <div>
        <button class="start-btn">Start Quiz</button>
        <button class="stop-btn" style="display: none;">Stop Quiz</button>
      </div>
    </div>
    <div class="quiz-area">
      <div class="countdown-container"><div class="countdown-bar"></div></div>
      <div class="quiz-prompt"></div>
      <div class="answer-buttons answer-buttons-notes">
        <button class="answer-btn answer-btn-note" data-note="C">C</button>
        <button class="answer-btn answer-btn-note" data-note="C#">C#/Db</button>
        <button class="answer-btn answer-btn-note" data-note="D">D</button>
        <button class="answer-btn answer-btn-note" data-note="D#">D#/Eb</button>
        <button class="answer-btn answer-btn-note" data-note="E">E</button>
        <button class="answer-btn answer-btn-note" data-note="F">F</button>
        <button class="answer-btn answer-btn-note" data-note="F#">F#/Gb</button>
        <button class="answer-btn answer-btn-note" data-note="G">G</button>
        <button class="answer-btn answer-btn-note" data-note="G#">G#/Ab</button>
        <button class="answer-btn answer-btn-note" data-note="A">A</button>
        <button class="answer-btn answer-btn-note" data-note="A#">A#/Bb</button>
        <button class="answer-btn answer-btn-note" data-note="B">B</button>
      </div>
      <div class="answer-buttons answer-buttons-numbers">
        <button class="answer-btn answer-btn-num" data-num="0">0</button>
        <button class="answer-btn answer-btn-num" data-num="1">1</button>
        <button class="answer-btn answer-btn-num" data-num="2">2</button>
        <button class="answer-btn answer-btn-num" data-num="3">3</button>
        <button class="answer-btn answer-btn-num" data-num="4">4</button>
        <button class="answer-btn answer-btn-num" data-num="5">5</button>
        <button class="answer-btn answer-btn-num" data-num="6">6</button>
        <button class="answer-btn answer-btn-num" data-num="7">7</button>
        <button class="answer-btn answer-btn-num" data-num="8">8</button>
        <button class="answer-btn answer-btn-num" data-num="9">9</button>
        <button class="answer-btn answer-btn-num" data-num="10">10</button>
        <button class="answer-btn answer-btn-num" data-num="11">11</button>
      </div>
      <div class="feedback"></div>
      <div class="time-display"></div>
      <div class="hint"></div>
    </div>
  </div>

  <!-- Interval Semitones mode -->
  <div class="mode-screen" id="mode-intervalSemitones">
    <div class="stats-container"></div>
    <div class="stats-controls">
      <button class="heatmap-btn">Show Recall</button>
      <span class="stats"></span>
    </div>
    <div class="quiz-controls">
      <div class="mastery-message" style="display: none;">Looks like you've got this!</div>
      <div>
        <button class="start-btn">Start Quiz</button>
        <button class="stop-btn" style="display: none;">Stop Quiz</button>
      </div>
    </div>
    <div class="quiz-area">
      <div class="countdown-container"><div class="countdown-bar"></div></div>
      <div class="quiz-prompt"></div>
      <div class="answer-buttons answer-buttons-intervals">
        <button class="answer-btn answer-btn-interval" data-interval="m2">m2</button>
        <button class="answer-btn answer-btn-interval" data-interval="M2">M2</button>
        <button class="answer-btn answer-btn-interval" data-interval="m3">m3</button>
        <button class="answer-btn answer-btn-interval" data-interval="M3">M3</button>
        <button class="answer-btn answer-btn-interval" data-interval="P4">P4</button>
        <button class="answer-btn answer-btn-interval" data-interval="TT">TT</button>
        <button class="answer-btn answer-btn-interval" data-interval="P5">P5</button>
        <button class="answer-btn answer-btn-interval" data-interval="m6">m6</button>
        <button class="answer-btn answer-btn-interval" data-interval="M6">M6</button>
        <button class="answer-btn answer-btn-interval" data-interval="m7">m7</button>
        <button class="answer-btn answer-btn-interval" data-interval="M7">M7</button>
        <button class="answer-btn answer-btn-interval" data-interval="P8">P8</button>
      </div>
      <div class="answer-buttons answer-buttons-numbers">
        <button class="answer-btn answer-btn-num" data-num="1">1</button>
        <button class="answer-btn answer-btn-num" data-num="2">2</button>
        <button class="answer-btn answer-btn-num" data-num="3">3</button>
        <button class="answer-btn answer-btn-num" data-num="4">4</button>
        <button class="answer-btn answer-btn-num" data-num="5">5</button>
        <button class="answer-btn answer-btn-num" data-num="6">6</button>
        <button class="answer-btn answer-btn-num" data-num="7">7</button>
        <button class="answer-btn answer-btn-num" data-num="8">8</button>
        <button class="answer-btn answer-btn-num" data-num="9">9</button>
        <button class="answer-btn answer-btn-num" data-num="10">10</button>
        <button class="answer-btn answer-btn-num" data-num="11">11</button>
        <button class="answer-btn answer-btn-num" data-num="12">12</button>
      </div>
      <div class="feedback"></div>
      <div class="time-display"></div>
      <div class="hint"></div>
    </div>
  </div>

  <!-- Semitone Math mode -->
  <div class="mode-screen" id="mode-semitoneMath">
    <div class="stats-container"></div>
    <div class="stats-controls">
      <button class="heatmap-btn">Show Recall</button>
      <span class="stats"></span>
    </div>
    <div class="quiz-controls">
      <div class="mastery-message" style="display: none;">Looks like you've got this!</div>
      <div>
        <button class="start-btn">Start Quiz</button>
        <button class="stop-btn" style="display: none;">Stop Quiz</button>
      </div>
    </div>
    <div class="quiz-area">
      <div class="countdown-container"><div class="countdown-bar"></div></div>
      <div class="quiz-prompt"></div>
      <div class="answer-buttons answer-buttons-notes">
        <button class="answer-btn answer-btn-note" data-note="C">C</button>
        <button class="answer-btn answer-btn-note" data-note="C#">C#/Db</button>
        <button class="answer-btn answer-btn-note" data-note="D">D</button>
        <button class="answer-btn answer-btn-note" data-note="D#">D#/Eb</button>
        <button class="answer-btn answer-btn-note" data-note="E">E</button>
        <button class="answer-btn answer-btn-note" data-note="F">F</button>
        <button class="answer-btn answer-btn-note" data-note="F#">F#/Gb</button>
        <button class="answer-btn answer-btn-note" data-note="G">G</button>
        <button class="answer-btn answer-btn-note" data-note="G#">G#/Ab</button>
        <button class="answer-btn answer-btn-note" data-note="A">A</button>
        <button class="answer-btn answer-btn-note" data-note="A#">A#/Bb</button>
        <button class="answer-btn answer-btn-note" data-note="B">B</button>
      </div>
      <div class="feedback"></div>
      <div class="time-display"></div>
      <div class="hint"></div>
    </div>
  </div>

  <!-- Interval Math mode -->
  <div class="mode-screen" id="mode-intervalMath">
    <div class="stats-container"></div>
    <div class="stats-controls">
      <button class="heatmap-btn">Show Recall</button>
      <span class="stats"></span>
    </div>
    <div class="quiz-controls">
      <div class="mastery-message" style="display: none;">Looks like you've got this!</div>
      <div>
        <button class="start-btn">Start Quiz</button>
        <button class="stop-btn" style="display: none;">Stop Quiz</button>
      </div>
    </div>
    <div class="quiz-area">
      <div class="countdown-container"><div class="countdown-bar"></div></div>
      <div class="quiz-prompt"></div>
      <div class="answer-buttons answer-buttons-notes">
        <button class="answer-btn answer-btn-note" data-note="C">C</button>
        <button class="answer-btn answer-btn-note" data-note="C#">C#/Db</button>
        <button class="answer-btn answer-btn-note" data-note="D">D</button>
        <button class="answer-btn answer-btn-note" data-note="D#">D#/Eb</button>
        <button class="answer-btn answer-btn-note" data-note="E">E</button>
        <button class="answer-btn answer-btn-note" data-note="F">F</button>
        <button class="answer-btn answer-btn-note" data-note="F#">F#/Gb</button>
        <button class="answer-btn answer-btn-note" data-note="G">G</button>
        <button class="answer-btn answer-btn-note" data-note="G#">G#/Ab</button>
        <button class="answer-btn answer-btn-note" data-note="A">A</button>
        <button class="answer-btn answer-btn-note" data-note="A#">A#/Bb</button>
        <button class="answer-btn answer-btn-note" data-note="B">B</button>
      </div>
      <div class="feedback"></div>
      <div class="time-display"></div>
      <div class="hint"></div>
    </div>
  </div>

  <script>
${adaptiveJS}
${musicDataJS}
${quizEngineJS}
${statsDisplayJS}
${quizFretboardJS}
${quizSpeedTapJS}
${quizNoteSemitonesJS}
${quizIntervalSemitonesJS}
${quizSemitoneMathJS}
${quizIntervalMathJS}
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
