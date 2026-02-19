// Shared build template — single source of truth for the HTML assembly,
// and version number. Imported by both main.ts (Deno) and build.ts (Node)
// to eliminate duplication between build scripts.

import {
  degreeAnswerButtons,
  fretboardIdleHTML,
  fretboardSVG,
  intervalAnswerButtons,
  keysigAnswerButtons,
  modeScreen,
  noteAnswerButtons,
  notesToggleHTML,
  numberButtons,
  numeralAnswerButtons,
  pianoNoteButtons,
  tabbedIdleHTML,
} from './html-helpers.ts';

// ---------------------------------------------------------------------------
// Version — single source of truth
// ---------------------------------------------------------------------------

export const VERSION = 'v6.15';

// ---------------------------------------------------------------------------
// Shared HTML fragments
// ---------------------------------------------------------------------------

export const DISTANCE_TOGGLES =
  '<div class="toggle-group"><span class="toggle-group-label">Groups</span><div class="distance-toggles"></div></div>';

export const HOME_SCREEN_HTML = `  <div class="home-screen" id="home-screen">
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
      <span class="version">${VERSION}</span>
    </div>
  </div>`;

// ---------------------------------------------------------------------------
// Mode screen HTML — each mode's unique content
// ---------------------------------------------------------------------------

function modeScreens(): string {
  return `
  <!-- Guitar Fretboard mode -->
${
    modeScreen('fretboard', {
      modeName: 'Guitar Fretboard',
      idleHTML: fretboardIdleHTML({
        stringNames: ['e', 'B', 'G', 'D', 'A', 'E'],
        defaultString: 5,
        id: 'fretboard',
        fretboardSVG: fretboardSVG({
          stringCount: 6,
          fretCount: 13,
          fretMarkers: [3, 5, 7, 9, 12],
        }),
      }),
      quizAreaContent: `${
        fretboardSVG({
          stringCount: 6,
          fretCount: 13,
          fretMarkers: [3, 5, 7, 9, 12],
        })
      }
      ${pianoNoteButtons()}`,
    })
  }

  <!-- Ukulele Fretboard mode -->
${
    modeScreen('ukulele', {
      modeName: 'Ukulele Fretboard',
      idleHTML: fretboardIdleHTML({
        stringNames: ['A', 'E', 'C', 'G'],
        defaultString: 2,
        id: 'ukulele',
        fretboardSVG: fretboardSVG({
          stringCount: 4,
          fretCount: 13,
          fretMarkers: [3, 5, 7, 10, 12],
        }),
      }),
      quizAreaContent: `${
        fretboardSVG({
          stringCount: 4,
          fretCount: 13,
          fretMarkers: [3, 5, 7, 10, 12],
        })
      }
      ${pianoNoteButtons()}`,
    })
  }

  <!-- Speed Tap mode -->
${
    modeScreen('speedTap', {
      modeName: 'Speed Tap',
      idleHTML: tabbedIdleHTML({ practiceScope: notesToggleHTML() }),
      quizAreaContent: `<div class="speed-tap-status">
        <span class="speed-tap-progress"></span>
      </div>
      ${fretboardSVG()}
      ${noteAnswerButtons({ hidden: true })}`,
    })
  }

  <!-- Note Semitones mode -->
${
    modeScreen('noteSemitones', {
      modeName: 'Note \u2194 Semitones',
      idleHTML: tabbedIdleHTML({}),
      quizAreaContent: `${noteAnswerButtons()}
      ${numberButtons(0, 11)}`,
    })
  }

  <!-- Interval Semitones mode -->
${
    modeScreen('intervalSemitones', {
      modeName: 'Interval \u2194 Semitones',
      idleHTML: tabbedIdleHTML({}),
      quizAreaContent: `${intervalAnswerButtons()}
      ${numberButtons(1, 12)}`,
    })
  }

  <!-- Semitone Math mode -->
${
    modeScreen('semitoneMath', {
      modeName: 'Semitone Math',
      idleHTML: tabbedIdleHTML({ practiceScope: DISTANCE_TOGGLES }),
      quizAreaContent: `${noteAnswerButtons()}`,
    })
  }

  <!-- Interval Math mode -->
${
    modeScreen('intervalMath', {
      modeName: 'Interval Math',
      idleHTML: tabbedIdleHTML({ practiceScope: DISTANCE_TOGGLES }),
      quizAreaContent: `${noteAnswerButtons()}`,
    })
  }

  <!-- Key Signatures mode -->
${
    modeScreen('keySignatures', {
      modeName: 'Key Signatures',
      idleHTML: tabbedIdleHTML({ practiceScope: DISTANCE_TOGGLES }),
      quizAreaContent: `${keysigAnswerButtons()}
      ${noteAnswerButtons({ hidden: true })}`,
    })
  }

  <!-- Scale Degrees mode -->
${
    modeScreen('scaleDegrees', {
      modeName: 'Scale Degrees',
      idleHTML: tabbedIdleHTML({ practiceScope: DISTANCE_TOGGLES }),
      quizAreaContent: `${noteAnswerButtons()}
      ${degreeAnswerButtons({ hidden: true })}`,
    })
  }

  <!-- Diatonic Chords mode -->
${
    modeScreen('diatonicChords', {
      modeName: 'Diatonic Chords',
      idleHTML: tabbedIdleHTML({ practiceScope: DISTANCE_TOGGLES }),
      quizAreaContent: `${noteAnswerButtons()}
      ${numeralAnswerButtons({ hidden: true })}`,
    })
  }

  <!-- Chord Spelling mode -->
${
    modeScreen('chordSpelling', {
      modeName: 'Chord Spelling',
      idleHTML: tabbedIdleHTML({ practiceScope: DISTANCE_TOGGLES }),
      quizAreaContent: `<div class="chord-slots"></div>
      ${noteAnswerButtons()}`,
    })
  }`;
}

// ---------------------------------------------------------------------------
// HTML assembly
// ---------------------------------------------------------------------------

/**
 * Assemble the complete index.html.
 *
 * @param css - Contents of styles.css
 * @param js - Bundled JS (esbuild IIFE output)
 */
export function assembleHTML(css: string, js: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
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
${modeScreens()}

  <script>
${js}
  </script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Service worker
// ---------------------------------------------------------------------------

export const SERVICE_WORKER =
  `// Network-first service worker: always fetch latest, fall back to cache offline
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
