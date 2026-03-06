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
import type { ModeHandle } from './types.ts';
import { HomeScreen } from './ui/home-screen.tsx';
import { NoteSemitonesMode } from './modes/note-semitones/note-semitones-mode.tsx';
import { IntervalSemitonesMode } from './modes/interval-semitones/interval-semitones-mode.tsx';
import { SemitoneMathMode } from './modes/semitone-math/semitone-math-mode.tsx';
import { IntervalMathMode } from './modes/interval-math/interval-math-mode.tsx';
import { KeySignaturesMode } from './modes/key-signatures/key-signatures-mode.tsx';
import { ScaleDegreesMode } from './modes/scale-degrees/scale-degrees-mode.tsx';
import { DiatonicChordsMode } from './modes/diatonic-chords/diatonic-chords-mode.tsx';
import { ChordSpellingMode } from './modes/chord-spelling/chord-spelling-mode.tsx';
import { FretboardMode } from './modes/fretboard/fretboard-mode.tsx';
import { SpeedTapMode } from './modes/speed-tap/speed-tap-mode.tsx';

// Enable :active pseudo-class on iOS Safari. WebKit doesn't fire :active on
// touch unless the document has a touchstart listener.
document.addEventListener('touchstart', () => {}, { passive: true });

const nav = createNavigation();

// --- Preact-based modes ---

// deno-lint-ignore no-explicit-any
function registerPreactMode(id: string, name: string, Component: any) {
  let handle: ModeHandle | null = null;
  const container = document.getElementById('mode-' + id)!;
  nav.registerMode(id, {
    name,
    init() {
      container.textContent = ''; // Clear build-time HTML before Preact takes over
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
      cont.textContent = ''; // Clear build-time HTML before Preact takes over
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
      },
    );
  },
});

// Mount Preact home screen — replaces static build-time HTML
const homeRoot = document.getElementById('home-screen')!;
const version = homeRoot.dataset.version || '';
homeRoot.textContent = '';
render(
  h(HomeScreen, {
    onSelectMode: (modeId: string) => nav.switchTo(modeId),
    onOpenSettings: () => settings.open(),
    version,
  }),
  homeRoot,
);

// Register service worker for cache busting on iOS home screen
// Skip in Capacitor — app runs from local files, no SW needed
if ('serviceWorker' in navigator && !window.Capacitor) {
  navigator.serviceWorker.register('sw.js');
}
