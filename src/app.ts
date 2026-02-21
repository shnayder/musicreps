// App initialization: registers all quiz modes and starts navigation.
// Entry point — esbuild bundles all imports into a single IIFE.

declare global {
  interface Window {
    Capacitor?: unknown;
  }
}

import { h, render } from 'preact';
import { GUITAR, UKULELE } from './music-data.ts';
import { createNavigation } from './navigation.ts';
import { createSettingsModal } from './settings.ts';
import { refreshNoteButtonLabels } from './quiz-engine.ts';
import type { ModeHandle } from './ui/modes/note-semitones-mode.tsx';
import { NoteSemitonesMode } from './ui/modes/note-semitones-mode.tsx';
import { IntervalSemitonesMode } from './ui/modes/interval-semitones-mode.tsx';
import { SemitoneMathMode } from './ui/modes/semitone-math-mode.tsx';
import { IntervalMathMode } from './ui/modes/interval-math-mode.tsx';
import { KeySignaturesMode } from './ui/modes/key-signatures-mode.tsx';
import { ScaleDegreesMode } from './ui/modes/scale-degrees-mode.tsx';
import { DiatonicChordsMode } from './ui/modes/diatonic-chords-mode.tsx';
import { ChordSpellingMode } from './ui/modes/chord-spelling-mode.tsx';
import { FretboardMode } from './ui/modes/fretboard-mode.tsx';
import { SpeedTapMode } from './ui/modes/speed-tap-mode.tsx';

const nav = createNavigation();

// --- Preact-based modes ---

// deno-lint-ignore no-explicit-any
function registerPreactMode(id: string, name: string, Component: any) {
  let handle: ModeHandle | null = null;
  const container = document.getElementById('mode-' + id)!;
  nav.registerMode(id, {
    name,
    init() {
      render(
        h(Component, {
          container,
          navigateHome: () => nav.navigateHome(),
          onMount: (h: ModeHandle) => {
            handle = h;
          },
        }),
        container,
      );
    },
    activate() {
      handle?.activate();
    },
    deactivate() {
      handle?.deactivate();
    },
  });
}

// Fretboard modes need extra instrument prop
function registerFretboardMode(
  id: string,
  name: string,
  instrument: typeof GUITAR,
) {
  let handle: ModeHandle | null = null;
  const cont = document.getElementById('mode-' + id)!;
  nav.registerMode(id, {
    name,
    init() {
      render(
        h(FretboardMode, {
          instrument,
          container: cont,
          navigateHome: () => nav.navigateHome(),
          onMount: (h: ModeHandle) => {
            handle = h;
          },
        }),
        cont,
      );
    },
    activate() {
      handle?.activate();
    },
    deactivate() {
      handle?.deactivate();
    },
  });
}

registerFretboardMode('fretboard', 'Guitar Fretboard', GUITAR);
registerFretboardMode('ukulele', 'Ukulele Fretboard', UKULELE);

registerPreactMode('noteSemitones', 'Note \u2194 Semitones', NoteSemitonesMode);
registerPreactMode(
  'intervalSemitones',
  'Interval \u2194 Semitones',
  IntervalSemitonesMode,
);
registerPreactMode('semitoneMath', 'Semitone Math', SemitoneMathMode);
registerPreactMode('intervalMath', 'Interval Math', IntervalMathMode);
registerPreactMode('keySignatures', 'Key Signatures', KeySignaturesMode);
registerPreactMode('scaleDegrees', 'Scale Degrees', ScaleDegreesMode);
registerPreactMode('diatonicChords', 'Diatonic Chords', DiatonicChordsMode);
registerPreactMode('chordSpelling', 'Chord Spelling', ChordSpellingMode);
registerPreactMode('speedTap', 'Speed Tap', SpeedTapMode);

nav.init();

// Settings modal — re-render on notation change
const settings = createSettingsModal({
  onNotationChange(): void {
    document.querySelectorAll('.mode-screen.mode-active').forEach(
      (el: Element) => {
        refreshNoteButtonLabels(el as HTMLElement);
        const activeToggle = el.querySelector('.stats-toggle-btn.active');
        if (activeToggle) (activeToggle as HTMLElement).click();
      },
    );
  },
});

const settingsBtn = document.querySelector('.home-settings-btn');
if (settingsBtn) {
  settingsBtn.addEventListener('click', () => settings.open());
}

// Register service worker for cache busting on iOS home screen
// Skip in Capacitor — app runs from local files, no SW needed
if ('serviceWorker' in navigator && !window.Capacitor) {
  navigator.serviceWorker.register('sw.js');
}
