// App initialization: registers quiz modes and starts navigation.
// Entry point — esbuild bundles all imports into a single IIFE.

import { createGuitarFretboardMode, createUkuleleFretboardMode } from './quiz-fretboard.js';
import { createSpeedTapMode } from './quiz-speed-tap.js';
import { createNoteSemitonesMode } from './quiz-note-semitones.js';
import { createIntervalSemitonesMode } from './quiz-interval-semitones.js';
import { createSemitoneMathMode } from './quiz-semitone-math.js';
import { createIntervalMathMode } from './quiz-interval-math.js';
import { createKeySignaturesMode } from './quiz-key-signatures.js';
import { createScaleDegreesMode } from './quiz-scale-degrees.js';
import { createDiatonicChordsMode } from './quiz-diatonic-chords.js';
import { createChordSpellingMode } from './quiz-chord-spelling.js';
import { createNavigation } from './navigation.js';
import { createSettingsModal } from './settings.js';
import { refreshNoteButtonLabels } from './quiz-engine.js';

const nav = createNavigation();

// Register guitar fretboard mode
const guitar = createGuitarFretboardMode();
nav.registerMode('fretboard', {
  name: 'Guitar Fretboard',
  init: guitar.init,
  activate: guitar.activate,
  deactivate: guitar.deactivate,
});

// Register ukulele fretboard mode
const ukulele = createUkuleleFretboardMode();
nav.registerMode('ukulele', {
  name: 'Ukulele Fretboard',
  init: ukulele.init,
  activate: ukulele.activate,
  deactivate: ukulele.deactivate,
});

// Speed Tap mode
const speedTap = createSpeedTapMode();
nav.registerMode('speedTap', {
  name: 'Speed Tap',
  init: speedTap.init,
  activate: speedTap.activate,
  deactivate: speedTap.deactivate,
});

// Note <-> Semitones mode
const noteSemitones = createNoteSemitonesMode();
nav.registerMode('noteSemitones', {
  name: 'Note \u2194 Semitones',
  init: noteSemitones.init,
  activate: noteSemitones.activate,
  deactivate: noteSemitones.deactivate,
});

// Interval <-> Semitones mode
const intervalSemitones = createIntervalSemitonesMode();
nav.registerMode('intervalSemitones', {
  name: 'Interval \u2194 Semitones',
  init: intervalSemitones.init,
  activate: intervalSemitones.activate,
  deactivate: intervalSemitones.deactivate,
});

// Semitone Math mode
const semitoneMath = createSemitoneMathMode();
nav.registerMode('semitoneMath', {
  name: 'Semitone Math',
  init: semitoneMath.init,
  activate: semitoneMath.activate,
  deactivate: semitoneMath.deactivate,
});

// Interval Math mode
const intervalMath = createIntervalMathMode();
nav.registerMode('intervalMath', {
  name: 'Interval Math',
  init: intervalMath.init,
  activate: intervalMath.activate,
  deactivate: intervalMath.deactivate,
});

// Key Signatures mode
const keySignatures = createKeySignaturesMode();
nav.registerMode('keySignatures', {
  name: 'Key Signatures',
  init: keySignatures.init,
  activate: keySignatures.activate,
  deactivate: keySignatures.deactivate,
});

// Scale Degrees mode
const scaleDegrees = createScaleDegreesMode();
nav.registerMode('scaleDegrees', {
  name: 'Scale Degrees',
  init: scaleDegrees.init,
  activate: scaleDegrees.activate,
  deactivate: scaleDegrees.deactivate,
});

// Diatonic Chords mode
const diatonicChords = createDiatonicChordsMode();
nav.registerMode('diatonicChords', {
  name: 'Diatonic Chords',
  init: diatonicChords.init,
  activate: diatonicChords.activate,
  deactivate: diatonicChords.deactivate,
});

// Chord Spelling mode
const chordSpelling = createChordSpellingMode();
nav.registerMode('chordSpelling', {
  name: 'Chord Spelling',
  init: chordSpelling.init,
  activate: chordSpelling.activate,
  deactivate: chordSpelling.deactivate,
});

nav.init();

// Re-render stats on visible mode screens after notation change
function refreshVisibleStats() {
  document.querySelectorAll('.mode-screen.mode-active').forEach(function(el) {
    var activeToggle = el.querySelector('.stats-toggle-btn.active');
    if (activeToggle) activeToggle.click();
  });
}

// Settings modal
var settings = createSettingsModal({
  onNotationChange: function() {
    document.querySelectorAll('.mode-screen.mode-active').forEach(function(el) {
      refreshNoteButtonLabels(el);
      refreshVisibleStats();
    });
    guitar.onNotationChange();
    ukulele.onNotationChange();
  }
});

var settingsBtn = document.querySelector('.home-settings-btn');
if (settingsBtn) {
  settingsBtn.addEventListener('click', function() {
    settings.open();
  });
}

// Register service worker for cache busting on iOS home screen
// Skip in Capacitor — app runs from local files, no SW needed
if ('serviceWorker' in navigator && !window.Capacitor) {
  navigator.serviceWorker.register('sw.js');
}
