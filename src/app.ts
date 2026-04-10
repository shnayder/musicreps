// App initialization: registers all quiz modes and starts navigation.
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
import type { ModeHandle } from './types.ts';
import { cleanupLegacyKeys, HomeScreen } from './ui/home-screen.tsx';
import { APP_CONFIG } from './app-config.ts';
import { registerModeForEffort } from './effort.ts';
import { initStorage, migrateFromLocalStorage } from './storage.ts';
import { Preferences } from '@capacitor/preferences';
import { reportHealthy, scheduleUpdateCheck } from './updater.ts';

// Declarative mode definitions + GenericMode
import { GenericMode } from './declarative/generic-mode.tsx';
import type { ModeDefinition } from './declarative/types.ts';
import { ALL_MODE_DEFINITIONS } from './mode-definitions.ts';

// Enable :active pseudo-class on iOS Safari. WebKit doesn't fire :active on
// touch unless the document has a touchstart listener.
document.addEventListener('touchstart', () => {}, { passive: true });

// --- Declarative modes — GenericMode interprets each ModeDefinition ---
// deno-lint-ignore no-explicit-any
function registerDeclarativeMode(
  nav: ReturnType<typeof createNavigation>,
  def: ModeDefinition<any>,
) {
  registerModeForEffort({
    id: def.id,
    namespace: def.namespace,
    allItems: def.allItems,
  });
  let handle: ModeHandle | null = null;
  const container = document.getElementById('mode-' + def.id)!;
  nav.registerMode(def.id, {
    name: def.name,
    init() {
      container.textContent = '';
      render(
        h(GenericMode, {
          def,
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

  // Declarative modes — single source of truth in mode-definitions.ts
  for (const def of ALL_MODE_DEFINITIONS) {
    registerDeclarativeMode(nav, def);
  }

  nav.init();

  // Settings state controller — re-render on notation change
  const settings = createSettingsController({
    onNotationChange(): void {
      document.querySelectorAll('.mode-screen.mode-active').forEach(
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

  // Mount Preact home screen — replaces static build-time HTML
  const homeRoot = document.getElementById('home-screen')!;
  const version = homeRoot.dataset.version || '';
  homeRoot.textContent = '';
  render(
    h(HomeScreen, {
      onSelectMode: (modeId: string) => nav.switchTo(modeId),
      settings,
      appConfig: APP_CONFIG,
      showDevLink: true,
      version,
      isNativeApp,
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
