// Shared build template — single source of truth for the HTML assembly.
// Imported by main.ts (Deno) to eliminate duplication between build
// scripts. Version is injected at build time by replacing the
// __VERSION__ placeholder (see getVersion() in main.ts).

import {
  degreeAnswerButtons,
  fretboardSVG,
  intervalAnswerButtons,
  modeScreen,
  noteAnswerButtons,
  notesToggleHTML,
  numberButtons,
  numeralAnswerButtons,
  tabbedIdleHTML,
} from './html-helpers.ts';
import { MODE_NAMES } from './mode-catalog.ts';
// ---------------------------------------------------------------------------
// Shared HTML fragments
// ---------------------------------------------------------------------------

export const DISTANCE_TOGGLES =
  '<div class="toggle-group"><span class="toggle-group-label">Groups</span><div class="distance-toggles"></div></div>';

// Minimal placeholder — Preact HomeScreen component renders the full UI at runtime.
export const HOME_SCREEN_HTML =
  `  <div class="home-screen" id="home-screen" data-version="__VERSION__"></div>`;

// ---------------------------------------------------------------------------
// Mode screen HTML — each mode's unique content
// ---------------------------------------------------------------------------

function modeScreens(): string {
  return `
  <!-- Guitar Fretboard mode -->
${
    modeScreen('fretboard', {
      modeName: MODE_NAMES.fretboard,
      idleHTML: tabbedIdleHTML({
        practiceScope: DISTANCE_TOGGLES,
        progressContent: fretboardSVG({
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
      <div class="answer-grid"></div>`,
    })
  }

  <!-- Ukulele Fretboard mode -->
${
    modeScreen('ukulele', {
      modeName: MODE_NAMES.ukulele,
      idleHTML: tabbedIdleHTML({
        practiceScope: DISTANCE_TOGGLES,
        progressContent: fretboardSVG({
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
      <div class="answer-grid"></div>`,
    })
  }

  <!-- Speed Tap mode -->
${
    modeScreen('speedTap', {
      modeName: MODE_NAMES.speedTap,
      idleHTML: tabbedIdleHTML({ practiceScope: notesToggleHTML() }),
      quizAreaContent: `<div class="speed-tap-status">
        <span class="speed-tap-progress"></span>
      </div>
      ${fretboardSVG()}
      ${noteAnswerButtons()}`,
    })
  }

  <!-- Note Semitones mode -->
${
    modeScreen('noteSemitones', {
      modeName: MODE_NAMES.noteSemitones,
      idleHTML: tabbedIdleHTML({}),
      quizAreaContent: `${noteAnswerButtons()}
      ${numberButtons(0, 11)}`,
    })
  }

  <!-- Interval Semitones mode -->
${
    modeScreen('intervalSemitones', {
      modeName: MODE_NAMES.intervalSemitones,
      idleHTML: tabbedIdleHTML({}),
      quizAreaContent: `${intervalAnswerButtons()}
      ${numberButtons(1, 12)}`,
    })
  }

  <!-- Semitone Math mode -->
${
    modeScreen('semitoneMath', {
      modeName: MODE_NAMES.semitoneMath,
      idleHTML: tabbedIdleHTML({ practiceScope: DISTANCE_TOGGLES }),
      quizAreaContent: `${noteAnswerButtons()}`,
    })
  }

  <!-- Interval Math mode -->
${
    modeScreen('intervalMath', {
      modeName: MODE_NAMES.intervalMath,
      idleHTML: tabbedIdleHTML({ practiceScope: DISTANCE_TOGGLES }),
      quizAreaContent: `${noteAnswerButtons()}`,
    })
  }

  <!-- Key Signatures mode -->
${
    modeScreen('keySignatures', {
      modeName: MODE_NAMES.keySignatures,
      idleHTML: tabbedIdleHTML({ practiceScope: DISTANCE_TOGGLES }),
      quizAreaContent: `<div class="split-keysig-buttons"></div>
      ${noteAnswerButtons()}`,
    })
  }

  <!-- Scale Degrees mode -->
${
    modeScreen('scaleDegrees', {
      modeName: MODE_NAMES.scaleDegrees,
      idleHTML: tabbedIdleHTML({ practiceScope: DISTANCE_TOGGLES }),
      quizAreaContent: `${noteAnswerButtons()}
      ${degreeAnswerButtons()}`,
    })
  }

  <!-- Diatonic Chords mode -->
${
    modeScreen('diatonicChords', {
      modeName: MODE_NAMES.diatonicChords,
      idleHTML: tabbedIdleHTML({ practiceScope: DISTANCE_TOGGLES }),
      quizAreaContent: `${noteAnswerButtons()}
      ${numeralAnswerButtons()}`,
    })
  }

  <!-- Chord Spelling mode -->
${
    modeScreen('chordSpelling', {
      modeName: MODE_NAMES.chordSpelling,
      idleHTML: tabbedIdleHTML({ practiceScope: DISTANCE_TOGGLES }),
      quizAreaContent: `<div class="seq-slots"></div>
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>Music Reps</title>
  <link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png">
  <link rel="icon" type="image/png" sizes="32x32" href="favicon-32x32.png">
  <link rel="manifest" href="manifest.json">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="theme-color" content="#ffffff">

  <style>
    ${css}
  </style>
</head>
<body>
  <div id="app">
${HOME_SCREEN_HTML}
${modeScreens()}
  </div>

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
