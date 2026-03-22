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

// Hand-written modes (too specialized for GenericMode)
import { SpeedTapMode } from './modes/speed-tap/speed-tap-mode.tsx';
import { ALL_ITEMS as SPEED_TAP_ITEMS } from './modes/speed-tap/logic.ts';

// Enable :active pseudo-class on iOS Safari. WebKit doesn't fire :active on
// touch unless the document has a touchstart listener.
document.addEventListener('touchstart', () => {}, { passive: true });

const nav = createNavigation();

// --- Preact-based modes ---

// deno-lint-ignore no-explicit-any
function registerPreactMode(id: string, name: string, Component: any) {
  let handle: ModeHandle | null = null;
  const container = document.getElementById('mode-' + id)!;
  nav.registerMode(id, {
    name,
    init() {
      container.textContent = ''; // Clear build-time HTML before Preact takes over
      render(
        h(Component, {
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

// Declarative modes — GenericMode interprets the definition
// deno-lint-ignore no-explicit-any
function registerDeclarativeMode(def: ModeDefinition<any>) {
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

// Declarative modes
registerDeclarativeMode(createFretboardDef(GUITAR));
registerDeclarativeMode(createFretboardDef(UKULELE));
registerDeclarativeMode(NOTE_SEMITONES_DEF);
registerDeclarativeMode(INTERVAL_SEMITONES_DEF);
registerDeclarativeMode(SEMITONE_MATH_DEF);
registerDeclarativeMode(INTERVAL_MATH_DEF);
registerDeclarativeMode(KEY_SIGNATURES_DEF);
registerDeclarativeMode(SCALE_DEGREES_DEF);
registerDeclarativeMode(DIATONIC_CHORDS_DEF);
registerDeclarativeMode(CHORD_SPELLING_DEF);

// Hand-written modes (too specialized for GenericMode)
registerModeForEffort({
  id: 'speedTap',
  namespace: 'speedTap',
  allItems: SPEED_TAP_ITEMS,
});
registerPreactMode('speedTap', 'Speed Tap', SpeedTapMode);

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

const isNativeApp = !!window.Capacitor;
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
