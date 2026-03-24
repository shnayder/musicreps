// Navigation: home screen and mode switching.
// Persists last-used mode via storage abstraction (for future "Resume" feature).

import { storage } from './storage.ts';

type ModeController = {
  init(): void;
  activate(): void;
  deactivate(): void;
  name: string;
};

/** Set up global navigation listeners (back buttons, Escape key). */
function initNavigationListeners(
  getCurrentModeId: () => string | null,
  navigateHome: () => void,
): void {
  // Mode back buttons (one per mode screen)
  document.querySelectorAll('.mode-top-bar .close-btn').forEach((btn) => {
    btn.addEventListener('click', () => navigateHome());
  });

  // Escape key navigates home when idle on a mode screen.
  document.addEventListener('keydown', (e) => {
    const modeId = getCurrentModeId();
    if (e.key !== 'Escape' || !modeId) return;
    if (document.querySelector('.settings-overlay.open')) return;
    const modeScreen = document.getElementById('mode-' + modeId);
    if (modeScreen && !modeScreen.classList.contains('phase-idle')) return;
    navigateHome();
  });
}

export function createNavigation(): {
  registerMode: (id: string, modeController: ModeController) => void;
  switchTo: (modeId: string) => void;
  navigateHome: () => void;
  init: () => void;
} {
  const LAST_MODE_KEY = 'fretboard_lastMode';
  const modes: Record<string, ModeController> = {};
  let currentModeId: string | null = null;
  const homeScreen = document.getElementById('home-screen');

  function registerMode(id: string, modeController: ModeController): void {
    modes[id] = modeController;
  }

  function navigateHome(): void {
    const previousModeId = currentModeId;
    if (currentModeId && modes[currentModeId]) {
      modes[currentModeId].deactivate();
      const currentScreen = document.getElementById('mode-' + currentModeId);
      if (currentScreen) currentScreen.classList.remove('mode-active');
    }
    currentModeId = null;
    if (homeScreen) homeScreen.classList.remove('hidden');
    requestAnimationFrame(() => {
      if (previousModeId && homeScreen) {
        const btn = homeScreen.querySelector(
          '.home-mode-btn[data-mode="' + previousModeId + '"]',
        ) as HTMLElement | null;
        if (btn) btn.focus();
      }
    });
  }

  function switchTo(modeId: string): void {
    if (!modes[modeId]) return;
    if (homeScreen) homeScreen.classList.add('hidden');
    if (currentModeId && modes[currentModeId]) {
      modes[currentModeId].deactivate();
      const currentScreen = document.getElementById('mode-' + currentModeId);
      if (currentScreen) currentScreen.classList.remove('mode-active');
    }
    currentModeId = modeId;
    const newScreen = document.getElementById('mode-' + modeId);
    if (newScreen) newScreen.classList.add('mode-active');
    modes[modeId].activate();
    requestAnimationFrame(() => {
      if (newScreen) {
        const target = newScreen.querySelector('.start-btn') as
          | HTMLElement
          | null;
        if (target) target.focus();
      }
    });
    storage.setItem(LAST_MODE_KEY, modeId);
  }

  function init(): void {
    initNavigationListeners(() => currentModeId, navigateHome);
    for (const id of Object.keys(modes)) modes[id].init();
    navigateHome();
  }

  return { registerMode, switchTo, navigateHome, init };
}
