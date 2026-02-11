// App initialization: registers quiz modes and starts navigation.
// Loaded last in the script — depends on all other modules being
// available as globals (adaptive.js, music-data.js, quiz-engine.js,
// quiz-fretboard.js, navigation.js).

(function () {
  const nav = createNavigation();

  // Register fretboard mode
  const fretboard = createFretboardMode();
  nav.registerMode('fretboard', {
    name: 'Fretboard',
    init: fretboard.init,
    activate: fretboard.activate,
    deactivate: fretboard.deactivate,
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

  // Register service worker for cache busting on iOS home screen
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
  }
})();
