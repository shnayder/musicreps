// Navigation: home screen and mode switching.
// Persists last-used mode in localStorage.

export function createNavigation() {
  const LAST_MODE_KEY = 'fretboard_lastMode';
  const modes = {}; // id -> { init, activate, deactivate, name }
  let currentModeId = null;

  const homeScreen = document.getElementById('home-screen');

  function registerMode(id, modeController) {
    modes[id] = modeController;
  }

  function navigateHome() {
    // Stop quiz if active in current mode
    if (currentModeId && modes[currentModeId]) {
      modes[currentModeId].deactivate();
      const currentScreen = document.getElementById('mode-' + currentModeId);
      if (currentScreen) currentScreen.classList.remove('mode-active');
    }
    currentModeId = null;

    // Show home screen
    if (homeScreen) homeScreen.classList.remove('hidden');
  }

  function switchTo(modeId) {
    if (!modes[modeId]) return;

    // Hide home screen
    if (homeScreen) homeScreen.classList.add('hidden');

    // Deactivate current mode
    if (currentModeId && modes[currentModeId]) {
      modes[currentModeId].deactivate();
      const currentScreen = document.getElementById('mode-' + currentModeId);
      if (currentScreen) currentScreen.classList.remove('mode-active');
    }

    // Activate new mode
    currentModeId = modeId;
    const newScreen = document.getElementById('mode-' + modeId);
    if (newScreen) newScreen.classList.add('mode-active');
    modes[modeId].activate();

    // Persist
    localStorage.setItem(LAST_MODE_KEY, modeId);
  }

  function init() {
    // Home screen mode buttons
    if (homeScreen) {
      homeScreen.querySelectorAll('.home-mode-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          switchTo(btn.dataset.mode);
        });
      });
    }

    // Mode back buttons (one per mode screen)
    document.querySelectorAll('.mode-back-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        navigateHome();
      });
    });

    // Escape key navigates home when idle on a mode screen.
    // During active quiz/calibration the container has phase-active,
    // phase-calibration, or phase-round-complete — we only act on phase-idle
    // so the quiz engine handles Escape independently in other phases.
    document.addEventListener('keydown', function(e) {
      if (e.key !== 'Escape' || !currentModeId) return;
      // Don't interfere with open modals (e.g. settings)
      if (document.querySelector('.settings-overlay.open')) return;
      // Only navigate home when the quiz is idle (not running/calibrating)
      var modeScreen = document.getElementById('mode-' + currentModeId);
      if (modeScreen && !modeScreen.classList.contains('phase-idle')) return;
      navigateHome();
    });

    // Initialize all registered modes
    for (const id of Object.keys(modes)) {
      modes[id].init();
    }

    // Switch to last-used mode or show home screen
    const lastMode = localStorage.getItem(LAST_MODE_KEY);
    if (lastMode && modes[lastMode]) {
      switchTo(lastMode);
    } else {
      navigateHome();
    }
  }

  return { registerMode, switchTo, navigateHome, init };
}
