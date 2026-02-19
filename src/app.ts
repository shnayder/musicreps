// App initialization: registers quiz modes and starts navigation.
// Entry point — esbuild bundles all imports into a single IIFE.
//
// During ModeDefinition refactoring, only 3 representative modes are active:
//   - Guitar Fretboard (SVG prompt, note buttons, heatmap stats, fretboard scope)
//   - Semitone Math (text prompt, note buttons, grid stats, group scope)
//   - Note Semitones (text prompt, bidirectional response, table stats, no scope)
// The rest are temporarily disabled. See plans/design-docs/ for the full plan.

declare global {
  interface Window {
    Capacitor?: unknown;
  }
}

import { GUITAR } from './music-data.ts';
import { createModeController } from './mode-controller.ts';
import { fretboardDefinition } from './modes/fretboard.ts';
import { noteSemitonesDefinition } from './modes/note-semitones.ts';
import { semitoneMathDefinition } from './modes/semitone-math.ts';
// Disabled during refactoring:
// import { createUkuleleFretboardMode } from './quiz-fretboard.ts';
// import { createSpeedTapMode } from './quiz-speed-tap.ts';
// import { createIntervalSemitonesMode } from './quiz-interval-semitones.ts';
// import { createIntervalMathMode } from './quiz-interval-math.ts';
// import { createKeySignaturesMode } from './quiz-key-signatures.ts';
// import { createScaleDegreesMode } from './quiz-scale-degrees.ts';
// import { createDiatonicChordsMode } from './quiz-diatonic-chords.ts';
// import { createChordSpellingMode } from './quiz-chord-spelling.ts';
import { createNavigation } from './navigation.ts';
import { createSettingsModal } from './settings.ts';
import { refreshNoteButtonLabels } from './quiz-engine.ts';

const nav = createNavigation();

// --- Guitar Fretboard ---
const guitar = createModeController(fretboardDefinition(GUITAR));
nav.registerMode('fretboard', {
  name: 'Guitar Fretboard',
  init: guitar.init,
  activate: guitar.activate,
  deactivate: guitar.deactivate,
});

// --- Modes disabled during ModeDefinition refactoring ---
// const ukulele = createModeController(fretboardDefinition(UKULELE));
// nav.registerMode('ukulele', { name: 'Ukulele Fretboard', init: ukulele.init, activate: ukulele.activate, deactivate: ukulele.deactivate });
// const speedTap = createSpeedTapMode();
// nav.registerMode('speedTap', { name: 'Speed Tap', init: speedTap.init, activate: speedTap.activate, deactivate: speedTap.deactivate });

// --- Note <-> Semitones ---
const noteSemitones = createModeController(noteSemitonesDefinition());
nav.registerMode('noteSemitones', {
  name: 'Note \u2194 Semitones',
  init: noteSemitones.init,
  activate: noteSemitones.activate,
  deactivate: noteSemitones.deactivate,
});

// --- More modes disabled during ModeDefinition refactoring ---
// const intervalSemitones = createIntervalSemitonesMode();
// nav.registerMode('intervalSemitones', { name: 'Interval ↔ Semitones', init: intervalSemitones.init, activate: intervalSemitones.activate, deactivate: intervalSemitones.deactivate });

// --- Semitone Math ---
const semitoneMath = createModeController(semitoneMathDefinition());
nav.registerMode('semitoneMath', {
  name: 'Semitone Math',
  init: semitoneMath.init,
  activate: semitoneMath.activate,
  deactivate: semitoneMath.deactivate,
});

// --- More modes disabled during ModeDefinition refactoring ---
// const intervalMath = createIntervalMathMode();
// nav.registerMode('intervalMath', { name: 'Interval Math', init: intervalMath.init, activate: intervalMath.activate, deactivate: intervalMath.deactivate });
// const keySignatures = createKeySignaturesMode();
// nav.registerMode('keySignatures', { name: 'Key Signatures', init: keySignatures.init, activate: keySignatures.activate, deactivate: keySignatures.deactivate });
// const scaleDegrees = createScaleDegreesMode();
// nav.registerMode('scaleDegrees', { name: 'Scale Degrees', init: scaleDegrees.init, activate: scaleDegrees.activate, deactivate: scaleDegrees.deactivate });
// const diatonicChords = createDiatonicChordsMode();
// nav.registerMode('diatonicChords', { name: 'Diatonic Chords', init: diatonicChords.init, activate: diatonicChords.activate, deactivate: diatonicChords.deactivate });
// const chordSpelling = createChordSpellingMode();
// nav.registerMode('chordSpelling', { name: 'Chord Spelling', init: chordSpelling.init, activate: chordSpelling.activate, deactivate: chordSpelling.deactivate });

nav.init();

// Re-render stats on visible mode screens after notation change
function refreshVisibleStats(): void {
  document.querySelectorAll('.mode-screen.mode-active').forEach(
    function (el: Element): void {
      const activeToggle: Element | null = el.querySelector(
        '.stats-toggle-btn.active',
      );
      if (activeToggle) (activeToggle as HTMLElement).click();
    },
  );
}

// Settings modal
const settings = createSettingsModal({
  onNotationChange: function (): void {
    document.querySelectorAll('.mode-screen.mode-active').forEach(
      function (el: Element): void {
        refreshNoteButtonLabels(el as HTMLElement);
        refreshVisibleStats();
      },
    );
    guitar.onNotationChange?.();
    noteSemitones.onNotationChange?.();
    semitoneMath.onNotationChange?.();
  },
});

const settingsBtn: Element | null = document.querySelector(
  '.home-settings-btn',
);
if (settingsBtn) {
  settingsBtn.addEventListener('click', function (): void {
    settings.open();
  });
}

// Register service worker for cache busting on iOS home screen
// Skip in Capacitor — app runs from local files, no SW needed
if ('serviceWorker' in navigator && !window.Capacitor) {
  navigator.serviceWorker.register('sw.js');
}
