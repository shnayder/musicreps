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
  <!-- Home screen -->
  <div class="home-screen" id="home-screen">
    <div class="home-header">
      <h1 class="home-title">Fretboard Trainer</h1>
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
      <span class="version">v5.0</span>
    </div>
  </div>

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
