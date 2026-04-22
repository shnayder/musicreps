// Navigation: home screen and skill switching.
// Persists last-used skill via storage abstraction (for future "Resume" feature).

import { storage } from './storage.ts';

type SkillController = {
  init(): void;
  activate(): void;
  deactivate(): void;
  name: string;
};

/** Set up global navigation listeners (back buttons, Escape key). */
function initNavigationListeners(
  getCurrentSkillId: () => string | null,
  navigateHome: () => void,
): void {
  // Escape key navigates home when idle on a skill screen.
  document.addEventListener('keydown', (e) => {
    const skillId = getCurrentSkillId();
    if (e.key !== 'Escape' || !skillId) return;
    if (document.querySelector('.settings-overlay.open')) return;
    const skillScreen = document.getElementById('skill-' + skillId);
    if (skillScreen && !skillScreen.classList.contains('phase-idle')) return;
    navigateHome();
  });
}

export function createNavigation(): {
  registerSkill: (id: string, skillController: SkillController) => void;
  switchTo: (skillId: string) => void;
  navigateHome: () => void;
  init: () => void;
} {
  // Legacy storage key — uses old "fretboard_lastMode" naming.
  const LAST_SKILL_KEY = 'fretboard_lastMode';
  const skills: Record<string, SkillController> = {};
  let currentSkillId: string | null = null;
  const homeScreen = document.getElementById('home-screen');

  function registerSkill(id: string, skillController: SkillController): void {
    skills[id] = skillController;
  }

  function navigateHome(): void {
    const previousSkillId = currentSkillId;
    if (currentSkillId && skills[currentSkillId]) {
      skills[currentSkillId].deactivate();
      const currentScreen = document.getElementById('skill-' + currentSkillId);
      if (currentScreen) currentScreen.classList.remove('skill-active');
    }
    currentSkillId = null;
    if (homeScreen) homeScreen.classList.remove('hidden');
    requestAnimationFrame(() => {
      if (previousSkillId && homeScreen) {
        const btn = homeScreen.querySelector(
          '.home-skill-btn[data-skill="' + previousSkillId + '"]',
        ) as HTMLElement | null;
        if (btn) btn.focus();
      }
    });
  }

  function switchTo(skillId: string): void {
    if (!skills[skillId]) return;
    if (homeScreen) homeScreen.classList.add('hidden');
    if (currentSkillId && skills[currentSkillId]) {
      skills[currentSkillId].deactivate();
      const currentScreen = document.getElementById('skill-' + currentSkillId);
      if (currentScreen) currentScreen.classList.remove('skill-active');
    }
    currentSkillId = skillId;
    const newScreen = document.getElementById('skill-' + skillId);
    if (newScreen) newScreen.classList.add('skill-active');
    skills[skillId].activate();
    requestAnimationFrame(() => {
      if (newScreen) {
        const target = newScreen.querySelector('.start-btn') as
          | HTMLElement
          | null;
        if (target) target.focus();
      }
    });
    storage.setItem(LAST_SKILL_KEY, skillId);
  }

  function init(): void {
    initNavigationListeners(() => currentSkillId, navigateHome);
    for (const id of Object.keys(skills)) skills[id].init();
    navigateHome();
  }

  return { registerSkill, switchTo, navigateHome, init };
}
