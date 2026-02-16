#!/usr/bin/env npx tsx
// Node-compatible build script — mirrors the Deno --build path in main.ts.
// Usage: npx tsx build.ts

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
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
    <div class="nav-group-label">Fretboard</div>
    <button data-mode="fretboard">Guitar Fretboard</button>
    <button data-mode="ukulele">Ukulele Fretboard</button>
    <button data-mode="speedTap">Speed Tap</button>
    <div class="nav-group-label">Theory Lookup</div>
    <button data-mode="noteSemitones">Note \u2194 Semitones</button>
    <button data-mode="intervalSemitones">Interval \u2194 Semitones</button>
    <div class="nav-group-label">Calculation</div>
    <button data-mode="semitoneMath">Semitone Math</button>
    <button data-mode="intervalMath">Interval Math</button>
    <div class="nav-group-label">Keys &amp; Chords</div>
    <button data-mode="keySignatures">Key Signatures</button>
    <button data-mode="scaleDegrees">Scale Degrees</button>
    <button data-mode="diatonicChords">Diatonic Chords</button>
    <button data-mode="chordSpelling">Chord Spelling</button>
  </div>

  <div class="top-bar">
    <button class="hamburger" type="button" aria-label="Toggle navigation menu" aria-expanded="false" aria-controls="nav-drawer">\u2630</button>
    <h1 id="mode-title">Guitar Fretboard</h1>
    <div class="version">v4.8</div>
    <button class="gear-btn" type="button" aria-label="Settings">\u2699</button>
  </div>

  <!-- Guitar Fretboard mode -->
${modeScreen("fretboard", {
  idleHTML: fretboardIdleHTML({ stringNames: ['e', 'B', 'G', 'D', 'A', 'E'], defaultString: 5, id: 'fretboard', fretboardSVG: fretboardSVG({ stringCount: 6, fretCount: 13, fretMarkers: [3, 5, 7, 9, 12] }) }),
  quizAreaContent: `${fretboardSVG({ stringCount: 6, fretCount: 13, fretMarkers: [3, 5, 7, 9, 12] })}
      ${pianoNoteButtons()}`,
})}

  <!-- Ukulele Fretboard mode -->
${modeScreen("ukulele", {
  idleHTML: fretboardIdleHTML({ stringNames: ['A', 'E', 'C', 'G'], defaultString: 2, id: 'ukulele', fretboardSVG: fretboardSVG({ stringCount: 4, fretCount: 13, fretMarkers: [3, 5, 7, 10, 12] }) }),
  quizAreaContent: `${fretboardSVG({ stringCount: 4, fretCount: 13, fretMarkers: [3, 5, 7, 10, 12] })}
      ${pianoNoteButtons()}`,
})}

  <!-- Speed Tap mode -->
${modeScreen("speedTap", {
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
  idleHTML: tabbedIdleHTML({}),
  quizAreaContent: `${noteAnswerButtons()}
      ${numberButtons(0, 11)}`,
})}

  <!-- Interval Semitones mode -->
${modeScreen("intervalSemitones", {
  idleHTML: tabbedIdleHTML({}),
  quizAreaContent: `${intervalAnswerButtons()}
      ${numberButtons(1, 12)}`,
})}

  <!-- Semitone Math mode -->
${modeScreen("semitoneMath", {
  idleHTML: tabbedIdleHTML({ practiceScope: DISTANCE_TOGGLES }),
  quizAreaContent: `${noteAnswerButtons()}`,
})}

  <!-- Interval Math mode -->
${modeScreen("intervalMath", {
  idleHTML: tabbedIdleHTML({ practiceScope: DISTANCE_TOGGLES }),
  quizAreaContent: `${noteAnswerButtons()}`,
})}

  <!-- Key Signatures mode -->
${modeScreen("keySignatures", {
  idleHTML: tabbedIdleHTML({ practiceScope: DISTANCE_TOGGLES }),
  quizAreaContent: `${keysigAnswerButtons()}
      ${noteAnswerButtons({ hidden: true })}`,
})}

  <!-- Scale Degrees mode -->
${modeScreen("scaleDegrees", {
  idleHTML: tabbedIdleHTML({ practiceScope: DISTANCE_TOGGLES }),
  quizAreaContent: `${noteAnswerButtons()}
      ${degreeAnswerButtons({ hidden: true })}`,
})}

  <!-- Diatonic Chords mode -->
${modeScreen("diatonicChords", {
  idleHTML: tabbedIdleHTML({ practiceScope: DISTANCE_TOGGLES }),
  quizAreaContent: `${noteAnswerButtons()}
      ${numeralAnswerButtons({ hidden: true })}`,
})}

  <!-- Chord Spelling mode -->
${modeScreen("chordSpelling", {
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

mkdirSync(join(__dirname, "docs"), { recursive: true });
writeFileSync(join(__dirname, "docs/index.html"), html);
writeFileSync(join(__dirname, "docs/sw.js"), sw);
console.log("Built to docs/index.html + docs/sw.js");
