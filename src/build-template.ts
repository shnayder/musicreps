// Shared build template — single source of truth for the HTML assembly.
// Imported by main.ts (Deno) to eliminate duplication between build
// scripts. Version is injected at build time by replacing the
// __VERSION__ placeholder (see getVersion() in main.ts).

import {
  degreeAnswerButtons,
  fretboardIdleHTML,
  fretboardSVG,
  intervalAnswerButtons,
  keysigAnswerButtons,
  modeScreen,
  naturalNoteButtons,
  noteAnswerButtons,
  notesToggleHTML,
  numberButtons,
  numeralAnswerButtons,
  pianoNoteButtons,
  tabbedIdleHTML,
} from './html-helpers.ts';
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

  <!-- Note Reading mode -->
${
    modeScreen('noteReading', {
      modeName: 'Note Reading',
      idleHTML: tabbedIdleHTML({ practiceScope: DISTANCE_TOGGLES }),
      quizAreaContent: `<div class="staff-display"></div>
      ${naturalNoteButtons()}`,
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
