import {
  fretPositions,
  fretLines,
  stringLines,
  noteElements,
  fretNumberElements,
} from "./src/fretboard.ts";

// ---------------------------------------------------------------------------
// Read source files
// ---------------------------------------------------------------------------

function resolve(rel: string): string | URL {
  return new URL(rel, import.meta.url);
}

async function readFile(rel: string): Promise<string> {
  return Deno.readTextFile(resolve(rel));
}

/** Read a JS module and strip `export ` keywords for browser inlining. */
async function readModule(rel: string): Promise<string> {
  const src = await readFile(rel);
  return src.replace(/^export /gm, "");
}

// ---------------------------------------------------------------------------
// HTML assembly
// ---------------------------------------------------------------------------

async function buildHTML(): Promise<string> {
  const [
    css,
    adaptiveJS,
    musicDataJS,
    quizEngineStateJS,
    quizEngineJS,
    statsDisplayJS,
    recommendationsJS,
    quizFretboardStateJS,
    quizFretboardJS,
    quizSpeedTapJS,
    quizNoteSemitonesJS,
    quizIntervalSemitonesJS,
    quizSemitoneMathJS,
    quizIntervalMathJS,
    quizKeySignaturesJS,
    quizScaleDegreesJS,
    quizDiatonicChordsJS,
    quizChordSpellingJS,
    navigationJS,
    appJS,
  ] = await Promise.all([
    readFile("./src/styles.css"),
    readModule("./src/adaptive.js"),
    readModule("./src/music-data.js"),
    readModule("./src/quiz-engine-state.js"),
    readModule("./src/quiz-engine.js"),
    readModule("./src/stats-display.js"),
    readModule("./src/recommendations.js"),
    readModule("./src/quiz-fretboard-state.js"),
    readFile("./src/quiz-fretboard.js"),
    readFile("./src/quiz-speed-tap.js"),
    readFile("./src/quiz-note-semitones.js"),
    readFile("./src/quiz-interval-semitones.js"),
    readFile("./src/quiz-semitone-math.js"),
    readFile("./src/quiz-interval-math.js"),
    readFile("./src/quiz-key-signatures.js"),
    readFile("./src/quiz-scale-degrees.js"),
    readFile("./src/quiz-diatonic-chords.js"),
    readFile("./src/quiz-chord-spelling.js"),
    readFile("./src/navigation.js"),
    readFile("./src/app.js"),
  ]);

  return `<!DOCTYPE html>
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
    <div class="version">v3.5</div>
  </div>

  <!-- Fretboard mode -->
  <div class="mode-screen" id="mode-fretboard">
    <div class="stats-container"></div>
    <div class="stats-controls">
      <div class="stats-toggle"><button class="stats-toggle-btn active" data-mode="retention">Recall</button><button class="stats-toggle-btn" data-mode="speed">Speed</button></div>
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
        <button class="recalibrate-btn" style="display: none;">Redo speed check</button>
      </div>
    </div>
    <div class="quiz-header" style="display: none;">
      <span class="quiz-header-title">Practicing</span>
      <button class="quiz-header-close" aria-label="Stop quiz">\u00D7</button>
    </div>
    <div class="session-stats" style="display: none;">
      <span><span class="question-count">0</span> questions</span>
      <span class="elapsed-time">0s</span>
    </div>
    <div class="progress-bar" style="display: none;">
      <div class="progress-fill" style="width: 0%"></div>
      <div class="progress-text">0 / 0</div>
    </div>
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
    <div class="stats-container"></div>
    <div class="stats-controls">
      <div class="stats-toggle"><button class="stats-toggle-btn active" data-mode="retention">Recall</button><button class="stats-toggle-btn" data-mode="speed">Speed</button></div>
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
        <button class="recalibrate-btn" style="display: none;">Redo speed check</button>
      </div>
    </div>

    <div class="quiz-header" style="display: none;">
      <span class="quiz-header-title">Practicing</span>
      <button class="quiz-header-close" aria-label="Stop quiz">\u00D7</button>
    </div>
    <div class="session-stats" style="display: none;">
      <span><span class="question-count">0</span> rounds</span>
      <span class="elapsed-time">0s</span>
    </div>
    <div class="progress-bar" style="display: none;">
      <div class="progress-fill" style="width: 0%"></div>
      <div class="progress-text">0 / 0</div>
    </div>

    <div class="quiz-area">
      <div class="speed-tap-prompt"></div>
      <div class="speed-tap-status">
        <span class="speed-tap-progress"></span>
        <span class="speed-tap-timer"></span>
      </div>
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
      <div class="answer-buttons answer-buttons-notes" style="display: none;">
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

  <!-- Note Semitones mode -->
  <div class="mode-screen" id="mode-noteSemitones">
    <div class="stats-container"></div>
    <div class="stats-controls">
      <div class="stats-toggle"><button class="stats-toggle-btn active" data-mode="retention">Recall</button><button class="stats-toggle-btn" data-mode="speed">Speed</button></div>
      <span class="stats"></span>
    </div>
    <div class="quiz-controls">
      <div class="mastery-message" style="display: none;">Looks like you've got this!</div>
      <div>
        <button class="start-btn">Start Quiz</button>
        <button class="stop-btn" style="display: none;">Stop Quiz</button>
        <button class="recalibrate-btn" style="display: none;">Redo speed check</button>
      </div>
    </div>
    <div class="quiz-header" style="display: none;">
      <span class="quiz-header-title">Practicing</span>
      <button class="quiz-header-close" aria-label="Stop quiz">\u00D7</button>
    </div>
    <div class="session-stats" style="display: none;">
      <span><span class="question-count">0</span> questions</span>
      <span class="elapsed-time">0s</span>
    </div>
    <div class="progress-bar" style="display: none;">
      <div class="progress-fill" style="width: 0%"></div>
      <div class="progress-text">0 / 0</div>
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
      <div class="stats-toggle"><button class="stats-toggle-btn active" data-mode="retention">Recall</button><button class="stats-toggle-btn" data-mode="speed">Speed</button></div>
      <span class="stats"></span>
    </div>
    <div class="quiz-controls">
      <div class="mastery-message" style="display: none;">Looks like you've got this!</div>
      <div>
        <button class="start-btn">Start Quiz</button>
        <button class="stop-btn" style="display: none;">Stop Quiz</button>
        <button class="recalibrate-btn" style="display: none;">Redo speed check</button>
      </div>
    </div>
    <div class="quiz-header" style="display: none;">
      <span class="quiz-header-title">Practicing</span>
      <button class="quiz-header-close" aria-label="Stop quiz">\u00D7</button>
    </div>
    <div class="session-stats" style="display: none;">
      <span><span class="question-count">0</span> questions</span>
      <span class="elapsed-time">0s</span>
    </div>
    <div class="progress-bar" style="display: none;">
      <div class="progress-fill" style="width: 0%"></div>
      <div class="progress-text">0 / 0</div>
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
      <div class="stats-toggle"><button class="stats-toggle-btn active" data-mode="retention">Recall</button><button class="stats-toggle-btn" data-mode="speed">Speed</button></div>
      <span class="stats"></span>
    </div>
    <div class="quiz-controls">
      <div class="settings-row">
        <div class="distance-toggles"></div>
      </div>
      <div class="mastery-message" style="display: none;">Looks like you've got this!</div>
      <div>
        <button class="start-btn">Start Quiz</button>
        <button class="stop-btn" style="display: none;">Stop Quiz</button>
        <button class="recalibrate-btn" style="display: none;">Redo speed check</button>
      </div>
    </div>
    <div class="quiz-header" style="display: none;">
      <span class="quiz-header-title">Practicing</span>
      <button class="quiz-header-close" aria-label="Stop quiz">\u00D7</button>
    </div>
    <div class="session-stats" style="display: none;">
      <span><span class="question-count">0</span> questions</span>
      <span class="elapsed-time">0s</span>
    </div>
    <div class="progress-bar" style="display: none;">
      <div class="progress-fill" style="width: 0%"></div>
      <div class="progress-text">0 / 0</div>
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
      <div class="stats-toggle"><button class="stats-toggle-btn active" data-mode="retention">Recall</button><button class="stats-toggle-btn" data-mode="speed">Speed</button></div>
      <span class="stats"></span>
    </div>
    <div class="quiz-controls">
      <div class="settings-row">
        <div class="distance-toggles"></div>
      </div>
      <div class="mastery-message" style="display: none;">Looks like you've got this!</div>
      <div>
        <button class="start-btn">Start Quiz</button>
        <button class="stop-btn" style="display: none;">Stop Quiz</button>
        <button class="recalibrate-btn" style="display: none;">Redo speed check</button>
      </div>
    </div>
    <div class="quiz-header" style="display: none;">
      <span class="quiz-header-title">Practicing</span>
      <button class="quiz-header-close" aria-label="Stop quiz">\u00D7</button>
    </div>
    <div class="session-stats" style="display: none;">
      <span><span class="question-count">0</span> questions</span>
      <span class="elapsed-time">0s</span>
    </div>
    <div class="progress-bar" style="display: none;">
      <div class="progress-fill" style="width: 0%"></div>
      <div class="progress-text">0 / 0</div>
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

  <!-- Key Signatures mode -->
  <div class="mode-screen" id="mode-keySignatures">
    <div class="stats-container"></div>
    <div class="stats-controls">
      <div class="stats-toggle"><button class="stats-toggle-btn active" data-mode="retention">Recall</button><button class="stats-toggle-btn" data-mode="speed">Speed</button></div>
      <span class="stats"></span>
    </div>
    <div class="quiz-controls">
      <div class="settings-row">
        <div class="distance-toggles"></div>
      </div>
      <div class="mastery-message" style="display: none;">Looks like you've got this!</div>
      <div>
        <button class="start-btn">Start Quiz</button>
        <button class="stop-btn" style="display: none;">Stop Quiz</button>
        <button class="recalibrate-btn" style="display: none;">Redo speed check</button>
      </div>
    </div>
    <div class="quiz-header" style="display: none;">
      <span class="quiz-header-title">Practicing</span>
      <button class="quiz-header-close" aria-label="Stop quiz">\u00D7</button>
    </div>
    <div class="session-stats" style="display: none;">
      <span><span class="question-count">0</span> questions</span>
      <span class="elapsed-time">0s</span>
    </div>
    <div class="progress-bar" style="display: none;">
      <div class="progress-fill" style="width: 0%"></div>
      <div class="progress-text">0 / 0</div>
    </div>
    <div class="quiz-area">
      <div class="countdown-container"><div class="countdown-bar"></div></div>
      <div class="quiz-prompt"></div>
      <div class="answer-buttons answer-buttons-keysig">
        <button class="answer-btn answer-btn-keysig" data-sig="0">0</button>
        <button class="answer-btn answer-btn-keysig" data-sig="1#">1#</button>
        <button class="answer-btn answer-btn-keysig" data-sig="2#">2#</button>
        <button class="answer-btn answer-btn-keysig" data-sig="3#">3#</button>
        <button class="answer-btn answer-btn-keysig" data-sig="4#">4#</button>
        <button class="answer-btn answer-btn-keysig" data-sig="5#">5#</button>
        <button class="answer-btn answer-btn-keysig" data-sig="6#">6#</button>
        <button class="answer-btn answer-btn-keysig" data-sig="7#">7#</button>
        <button class="answer-btn answer-btn-keysig" data-sig="1b">1b</button>
        <button class="answer-btn answer-btn-keysig" data-sig="2b">2b</button>
        <button class="answer-btn answer-btn-keysig" data-sig="3b">3b</button>
        <button class="answer-btn answer-btn-keysig" data-sig="4b">4b</button>
        <button class="answer-btn answer-btn-keysig" data-sig="5b">5b</button>
        <button class="answer-btn answer-btn-keysig" data-sig="6b">6b</button>
        <button class="answer-btn answer-btn-keysig" data-sig="7b">7b</button>
      </div>
      <div class="answer-buttons answer-buttons-notes" style="display: none;">
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

  <!-- Scale Degrees mode -->
  <div class="mode-screen" id="mode-scaleDegrees">
    <div class="stats-container"></div>
    <div class="stats-controls">
      <div class="stats-toggle"><button class="stats-toggle-btn active" data-mode="retention">Recall</button><button class="stats-toggle-btn" data-mode="speed">Speed</button></div>
      <span class="stats"></span>
    </div>
    <div class="quiz-controls">
      <div class="settings-row">
        <div class="distance-toggles"></div>
      </div>
      <div class="mastery-message" style="display: none;">Looks like you've got this!</div>
      <div>
        <button class="start-btn">Start Quiz</button>
        <button class="stop-btn" style="display: none;">Stop Quiz</button>
        <button class="recalibrate-btn" style="display: none;">Redo speed check</button>
      </div>
    </div>
    <div class="quiz-header" style="display: none;">
      <span class="quiz-header-title">Practicing</span>
      <button class="quiz-header-close" aria-label="Stop quiz">\u00D7</button>
    </div>
    <div class="session-stats" style="display: none;">
      <span><span class="question-count">0</span> questions</span>
      <span class="elapsed-time">0s</span>
    </div>
    <div class="progress-bar" style="display: none;">
      <div class="progress-fill" style="width: 0%"></div>
      <div class="progress-text">0 / 0</div>
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
      <div class="answer-buttons answer-buttons-degrees" style="display: none;">
        <button class="answer-btn answer-btn-degree" data-degree="1">1st</button>
        <button class="answer-btn answer-btn-degree" data-degree="2">2nd</button>
        <button class="answer-btn answer-btn-degree" data-degree="3">3rd</button>
        <button class="answer-btn answer-btn-degree" data-degree="4">4th</button>
        <button class="answer-btn answer-btn-degree" data-degree="5">5th</button>
        <button class="answer-btn answer-btn-degree" data-degree="6">6th</button>
        <button class="answer-btn answer-btn-degree" data-degree="7">7th</button>
      </div>
      <div class="feedback"></div>
      <div class="time-display"></div>
      <div class="hint"></div>
    </div>
  </div>

  <!-- Diatonic Chords mode -->
  <div class="mode-screen" id="mode-diatonicChords">
    <div class="stats-container"></div>
    <div class="stats-controls">
      <div class="stats-toggle"><button class="stats-toggle-btn active" data-mode="retention">Recall</button><button class="stats-toggle-btn" data-mode="speed">Speed</button></div>
      <span class="stats"></span>
    </div>
    <div class="quiz-controls">
      <div class="settings-row">
        <div class="distance-toggles"></div>
      </div>
      <div class="mastery-message" style="display: none;">Looks like you've got this!</div>
      <div>
        <button class="start-btn">Start Quiz</button>
        <button class="stop-btn" style="display: none;">Stop Quiz</button>
        <button class="recalibrate-btn" style="display: none;">Redo speed check</button>
      </div>
    </div>
    <div class="quiz-header" style="display: none;">
      <span class="quiz-header-title">Practicing</span>
      <button class="quiz-header-close" aria-label="Stop quiz">\u00D7</button>
    </div>
    <div class="session-stats" style="display: none;">
      <span><span class="question-count">0</span> questions</span>
      <span class="elapsed-time">0s</span>
    </div>
    <div class="progress-bar" style="display: none;">
      <div class="progress-fill" style="width: 0%"></div>
      <div class="progress-text">0 / 0</div>
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
      <div class="answer-buttons answer-buttons-numerals" style="display: none;">
        <button class="answer-btn answer-btn-numeral" data-numeral="I">I</button>
        <button class="answer-btn answer-btn-numeral" data-numeral="ii">ii</button>
        <button class="answer-btn answer-btn-numeral" data-numeral="iii">iii</button>
        <button class="answer-btn answer-btn-numeral" data-numeral="IV">IV</button>
        <button class="answer-btn answer-btn-numeral" data-numeral="V">V</button>
        <button class="answer-btn answer-btn-numeral" data-numeral="vi">vi</button>
        <button class="answer-btn answer-btn-numeral" data-numeral="vii\u00B0">vii\u00B0</button>
      </div>
      <div class="feedback"></div>
      <div class="time-display"></div>
      <div class="hint"></div>
    </div>
  </div>

  <!-- Chord Spelling mode -->
  <div class="mode-screen" id="mode-chordSpelling">
    <div class="stats-container"></div>
    <div class="stats-controls">
      <div class="stats-toggle"><button class="stats-toggle-btn active" data-mode="retention">Recall</button><button class="stats-toggle-btn" data-mode="speed">Speed</button></div>
      <span class="stats"></span>
    </div>
    <div class="quiz-controls">
      <div class="settings-row">
        <div class="distance-toggles"></div>
      </div>
      <div class="mastery-message" style="display: none;">Looks like you've got this!</div>
      <div>
        <button class="start-btn">Start Quiz</button>
        <button class="stop-btn" style="display: none;">Stop Quiz</button>
        <button class="recalibrate-btn" style="display: none;">Redo speed check</button>
      </div>
    </div>
    <div class="quiz-header" style="display: none;">
      <span class="quiz-header-title">Practicing</span>
      <button class="quiz-header-close" aria-label="Stop quiz">\u00D7</button>
    </div>
    <div class="session-stats" style="display: none;">
      <span><span class="question-count">0</span> questions</span>
      <span class="elapsed-time">0s</span>
    </div>
    <div class="progress-bar" style="display: none;">
      <div class="progress-fill" style="width: 0%"></div>
      <div class="progress-text">0 / 0</div>
    </div>
    <div class="quiz-area">
      <div class="countdown-container"><div class="countdown-bar"></div></div>
      <div class="quiz-prompt"></div>
      <div class="chord-slots"></div>
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
${navigationJS}
${appJS}
  </script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Service worker
// ---------------------------------------------------------------------------

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
// Exports
// ---------------------------------------------------------------------------

export { buildHTML, sw };

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (import.meta.main) {
  if (Deno.args.includes("--build")) {
    const html = await buildHTML();
    await Deno.mkdir("docs", { recursive: true });
    await Deno.writeTextFile("docs/index.html", html);
    await Deno.writeTextFile("docs/sw.js", sw);
    console.log("Built to docs/index.html + docs/sw.js");
  } else {
    const html = await buildHTML();
    Deno.serve({ port: 8001 }, (req) => {
      const url = new URL(req.url);
      if (url.pathname === "/sw.js") {
        return new Response(sw, {
          headers: { "content-type": "application/javascript" },
        });
      }
      return new Response(html, {
        headers: { "content-type": "text/html" },
      });
    });
  }
}
