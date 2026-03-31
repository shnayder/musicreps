// Build template — assembles the complete index.html with CSS, JS, and
// minimal container divs for the Preact app. Mode IDs are derived from
// TRACKS so adding a mode to the catalog automatically creates its container.

import { TRACKS } from './mode-catalog.ts';

// ---------------------------------------------------------------------------
// Mode screen containers — empty divs that Preact renders into at runtime.
// ---------------------------------------------------------------------------

function modeScreens(): string {
  const ids = [...new Set(TRACKS.flatMap((t) => t.skills))];
  return ids
    .map((id) => `  <div class="mode-screen phase-idle" id="mode-${id}"></div>`)
    .join('\n');
}

// Minimal placeholder — Preact HomeScreen component renders the full UI at runtime.
export const HOME_SCREEN_HTML =
  `  <div class="home-screen" id="home-screen" data-version="__VERSION__"></div>`;

// ---------------------------------------------------------------------------
// HTML assembly
// ---------------------------------------------------------------------------

/**
 * Assemble the complete index.html.
 *
 * @param css - Contents of styles.css
 * @param js - Bundled JS (esbuild IIFE output)
 */
export function assembleHTML(css: string, js: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>Music Reps</title>
  <link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png">
  <link rel="icon" type="image/png" sizes="32x32" href="favicon-32x32.png">
  <link rel="manifest" href="manifest.json">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="theme-color" content="#ffffff">

  <style>
    ${css}
  </style>
</head>
<body>
  <div id="app">
${HOME_SCREEN_HTML}
${modeScreens()}
  </div>

  <script>
${js}
  </script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Service worker
// ---------------------------------------------------------------------------

export const SERVICE_WORKER =
  `// Network-first service worker: always fetch latest, fall back to cache offline
const CACHE = 'fretboard-v1';

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
`;
