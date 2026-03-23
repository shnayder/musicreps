// App initialization: registers all quiz modes and starts navigation.
// Entry point — esbuild bundles all imports into a single IIFE.

declare global {
  interface Window {
    Capacitor?: unknown;
  }
}

import { h, render } from 'preact';
import { GUITAR, UKULELE } from './music-data.ts';
import { createNavigation } from './navigation.ts';
import { createSettingsController } from './settings.ts';
import { refreshNoteButtonLabels } from './quiz-engine.ts';
import type { ModeHandle } from './types.ts';
import { HomeScreen } from './ui/home-screen.tsx';
import { APP_CONFIG } from './app-config.ts';
import { registerModeForEffort } from './effort.ts';
import { initStorage, migrateFromLocalStorage } from './storage.ts';

// Declarative mode definitions + GenericMode
import { GenericMode } from './declarative/generic-mode.tsx';
import type { ModeDefinition } from './declarative/types.ts';
import { NOTE_SEMITONES_DEF } from './modes/note-semitones/definition.ts';
import { INTERVAL_SEMITONES_DEF } from './modes/interval-semitones/definition.ts';
import { SEMITONE_MATH_DEF } from './modes/semitone-math/definition.ts';
import { INTERVAL_MATH_DEF } from './modes/interval-math/definition.ts';
import { KEY_SIGNATURES_DEF } from './modes/key-signatures/definition.ts';
import { SCALE_DEGREES_DEF } from './modes/scale-degrees/definition.ts';
import { DIATONIC_CHORDS_DEF } from './modes/diatonic-chords/definition.ts';

import { createFretboardDef } from './modes/fretboard/definition.tsx';
import { CHORD_SPELLING_DEF } from './modes/chord-spelling/definition.ts';

import { SPEED_TAP_DEF } from './modes/speed-tap/definition.tsx';

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
  await initStorage();

  const isNativeApp = !!window.Capacitor;

  // One-time migration: copy localStorage → Capacitor Preferences on
  // first native launch so existing users don't lose data.
  if (isNativeApp) {
    await migrateFromLocalStorage();
  }

  const nav = createNavigation();

  // Declarative modes
  registerDeclarativeMode(nav, createFretboardDef(GUITAR));
  registerDeclarativeMode(nav, createFretboardDef(UKULELE));
  registerDeclarativeMode(nav, NOTE_SEMITONES_DEF);
  registerDeclarativeMode(nav, INTERVAL_SEMITONES_DEF);
  registerDeclarativeMode(nav, SEMITONE_MATH_DEF);
  registerDeclarativeMode(nav, INTERVAL_MATH_DEF);
  registerDeclarativeMode(nav, KEY_SIGNATURES_DEF);
  registerDeclarativeMode(nav, SCALE_DEGREES_DEF);
  registerDeclarativeMode(nav, DIATONIC_CHORDS_DEF);
  registerDeclarativeMode(nav, CHORD_SPELLING_DEF);
  registerDeclarativeMode(nav, SPEED_TAP_DEF);

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

  if (isNativeApp) document.body.classList.add('native-app');

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
  // Skip in Capacitor — app runs from local files, no SW needed
  if ('serviceWorker' in navigator && !isNativeApp) {
    navigator.serviceWorker.register('sw.js');
  }
}

boot();
