// Navigation: hamburger menu and mode switching.
// Persists last-used mode in localStorage.
//
// Depends on DOM: .hamburger, .nav-drawer, .mode-screen, [data-mode]

function createNavigation() {
  const LAST_MODE_KEY = 'fretboard_lastMode';
  const modes = {}; // id -> { init, activate, deactivate, name }
  let currentModeId = null;

  const hamburger = document.querySelector('.hamburger');
  const drawer = document.querySelector('.nav-drawer');
  const overlay = document.querySelector('.nav-overlay');
  const modeTitle = document.getElementById('mode-title');

  function closeDrawer() {
    if (drawer) drawer.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
  }

  function openDrawer() {
    if (drawer) drawer.classList.add('open');
    if (overlay) overlay.classList.add('open');
    if (hamburger) hamburger.setAttribute('aria-expanded', 'true');
  }

  function registerMode(id, modeController) {
    modes[id] = modeController;
  }

  function switchTo(modeId) {
    if (!modes[modeId]) return;
    if (currentModeId === modeId) {
      closeDrawer();
      return;
    }

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

    // Update title
    if (modeTitle) modeTitle.textContent = modes[modeId].name || modeId;

    // Update active state in drawer
    drawer.querySelectorAll('[data-mode]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === modeId);
    });

    // Persist
    localStorage.setItem(LAST_MODE_KEY, modeId);
    closeDrawer();
  }

  function init() {
    // Hamburger toggle
    if (hamburger) {
      hamburger.addEventListener('click', () => {
        if (drawer.classList.contains('open')) {
          closeDrawer();
        } else {
          openDrawer();
        }
      });
    }

    // Overlay click closes drawer
    if (overlay) {
      overlay.addEventListener('click', closeDrawer);
    }

    // Mode buttons in drawer
    if (drawer) {
      drawer.querySelectorAll('[data-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
          switchTo(btn.dataset.mode);
        });
      });
    }

    // Initialize all registered modes
    for (const id of Object.keys(modes)) {
      modes[id].init();
    }

    // Switch to last-used mode or default
    const lastMode = localStorage.getItem(LAST_MODE_KEY);
    const startMode = (lastMode && modes[lastMode]) ? lastMode : Object.keys(modes)[0];
    if (startMode) switchTo(startMode);
  }

  return { registerMode, switchTo, init };
}
