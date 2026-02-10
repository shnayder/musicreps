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

  // Future modes will be registered here:
  // nav.registerMode('noteSemitones', { ... });
  // nav.registerMode('intervalSemitones', { ... });
  // nav.registerMode('semitoneMath', { ... });
  // nav.registerMode('intervalMath', { ... });

  nav.init();

  // Register service worker for cache busting on iOS home screen
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
  }
})();
