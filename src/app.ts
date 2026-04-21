// App initialization: registers all quiz skills and starts navigation.
// Entry point — esbuild bundles all imports into a single IIFE.

declare global {
  interface Window {
    Capacitor?: { isNativePlatform?: () => boolean };
  }
}

import { h, render } from 'preact';
import { loadNotationPreference } from './music-data.ts';
import { createNavigation } from './navigation.ts';
import { createSettingsController } from './settings.ts';
import { refreshNoteButtonLabels } from './quiz-engine.ts';
import type { SkillHandle } from './types.ts';
import { BrandStrip } from './ui/brand-strip.tsx';
import { cleanupLegacyKeys, HomeScreen } from './ui/home-screen.tsx';
import { APP_CONFIG } from './app-config.ts';
import { registerSkillForEffort } from './effort.ts';
import { initStorage, migrateFromLocalStorage } from './storage.ts';
import { Preferences } from '@capacitor/preferences';
import { reportHealthy, scheduleUpdateCheck } from './updater.ts';

// Declarative skill definitions + GenericSkill
import { GenericSkill } from './declarative/generic-skill.tsx';
import type { SkillDefinition } from './declarative/types.ts';
import { ALL_SKILL_DEFINITIONS } from './skill-definitions.ts';

// Enable :active pseudo-class on iOS Safari. WebKit doesn't fire :active on
// touch unless the document has a touchstart listener.
document.addEventListener('touchstart', () => {}, { passive: true });

// --- Declarative skills — GenericSkill interprets each SkillDefinition ---
// deno-lint-ignore no-explicit-any
function registerDeclarativeSkill(
  nav: ReturnType<typeof createNavigation>,
  def: SkillDefinition<any>,
) {
  registerSkillForEffort({
    id: def.id,
    namespace: def.namespace,
    allItems: def.allItems,
  });
  let handle: SkillHandle | null = null;
  const container = document.getElementById('skill-' + def.id)!;
  nav.registerSkill(def.id, {
    name: def.name,
    init() {
      container.textContent = '';
      render(
        h(GenericSkill, {
          def,
          container,
          navigateHome: () => nav.navigateHome(),
          onMount: (h: SkillHandle) => {
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

async function boot() {
  // Initialize storage backend before anything reads persisted data.
  // On web this is instant (localStorage). On native (Capacitor) it
  // bulk-loads Preferences into an in-memory cache.
  await initStorage(Preferences);

  const isNativeApp = !!window.Capacitor?.isNativePlatform?.();

  // One-time migration: copy localStorage → Capacitor Preferences on
  // first native launch so existing users don't lose data.  Must run
  // before any persisted reads so migrated values are visible.
  if (isNativeApp) {
    await migrateFromLocalStorage();
  }

  // Deferred reads — after initStorage() + migration so the cache
  // is fully populated before any storage.getItem calls.
  loadNotationPreference();
  cleanupLegacyKeys();

  const nav = createNavigation();

  // Declarative skills — single source of truth in skill-definitions.ts
  for (const def of ALL_SKILL_DEFINITIONS) {
    registerDeclarativeSkill(nav, def);
  }

  nav.init();

  // Settings state controller — re-render on notation change
  const settings = createSettingsController({
    onNotationChange(): void {
      document.querySelectorAll('.skill-screen.skill-active').forEach(
        (el: Element) => {
          refreshNoteButtonLabels(el as HTMLElement);
        },
      );
    },
  });

  // ?native URL param simulates native mode in a desktop browser for testing.
  const simulateNative = new URLSearchParams(globalThis.location?.search ?? '')
    .has('native');
  if (isNativeApp || simulateNative) {
    document.body.classList.add('native-app');
  }
  // Marker class so desktop-browser ?native simulations can stand in for
  // real device safe-area insets (which env() doesn't expose in Chromium).
  if (simulateNative && !isNativeApp) {
    document.body.classList.add('native-sim');
  }

  // Mount the persistent brand strip once. Hidden on native via CSS.
  const brandRoot = document.getElementById('brand-strip');
  if (brandRoot) {
    brandRoot.textContent = '';
    render(h(BrandStrip, {}), brandRoot);
  }

  // Mount Preact home screen — replaces static build-time HTML
  const homeRoot = document.getElementById('home-screen')!;
  const version = homeRoot.dataset.version || '';
  homeRoot.textContent = '';
  render(
    h(HomeScreen, {
      onSelectSkill: (skillId: string) => nav.switchTo(skillId),
      settings,
      appConfig: APP_CONFIG,
      showDevLink: true,
      version,
    }),
    homeRoot,
  );

  // Register service worker for cache busting on iOS home screen
  // Skip in Capacitor — native OTA plugin handles updates instead
  if ('serviceWorker' in navigator && !isNativeApp) {
    navigator.serviceWorker.register('sw.js');
  }

  // OTA updates: mark this boot as healthy, schedule background checks
  if (isNativeApp) {
    reportHealthy();
    scheduleUpdateCheck();
  }
}

boot().catch((err) => {
  console.error('Boot failed:', err);
  // Show a visible error — especially important for storage init failures
  // where silently continuing would lose user data.
  const el = document.getElementById('home-screen');
  if (el) {
    el.textContent = '';
    const msg = document.createElement('div');
    msg.style.cssText =
      'padding:2rem;text-align:center;font-family:system-ui;color:#c00';
    const title = document.createElement('h2');
    title.textContent = 'Failed to start';
    const details = document.createElement('p');
    details.textContent = String(err?.message || err);
    const help = document.createElement('p');
    help.style.cssText = 'color:#666;font-size:0.85em';
    help.textContent = 'Try force-quitting and reopening the app.';
    msg.append(title, details, help);
    el.appendChild(msg);
  }
});
