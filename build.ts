#!/usr/bin/env npx tsx
// Node-compatible build script — mirrors the Deno --build path in main.ts.
// Usage: npx tsx build.ts

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  fretPositions,
  fretLines,
  stringLines,
  noteElements,
  fretNumberElements,
} from "./src/fretboard.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(__dirname, rel), "utf-8");

const css = read("src/styles.css");
const adaptiveJS = read("src/adaptive.js").replace(/^export /gm, "");
const appJS = read("src/app.js");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fretboard Trainer</title>
  <style>
    ${css}
  </style>
</head>
<body>
  <div class="version">v1.0</div>
  <h1>Fretboard Trainer</h1>

  <div class="fretboard-wrapper">
    <div class="fretboard-row">
      <div class="settings-row">
        <div class="string-toggles" id="string-toggles">
          <button class="string-toggle" data-string="0">e</button>
          <button class="string-toggle" data-string="1">B</button>
          <button class="string-toggle" data-string="2">G</button>
          <button class="string-toggle" data-string="3">D</button>
          <button class="string-toggle" data-string="4">A</button>
          <button class="string-toggle active" data-string="5">E</button>
        </div>
        <label class="setting-group">
          <input type="checkbox" id="naturals-only" checked>
          Natural only
        </label>
      </div>
      <div class="fretboard-container">
        <svg class="fretboard" id="fretboard" viewBox="0 0 600 240">
          <!-- Nut (thick line at fret 0) -->
          <line x1="${fretPositions[1]}" y1="0" x2="${fretPositions[1]}" y2="240" stroke="#333" stroke-width="4"/>
          <!-- Frets (vertical lines) -->
          ${fretLines()}
          <!-- Strings (horizontal lines) -->
          ${stringLines()}
          <!-- Note circles -->
          ${noteElements()}
        </svg>
        <div class="fret-numbers">
          ${fretNumberElements()}
        </div>
      </div>
    </div>

  </div>

  <div class="quiz-controls">
    <div>
      <button id="start-btn" onclick="startQuiz()">Start Quiz</button>
      <button id="heatmap-btn" onclick="toggleHeatmap()">Show Retention</button>
      <button id="stop-btn" onclick="stopQuiz()" style="display: none;">Stop Quiz</button>
      <span id="stats" class="stats"></span>
    </div>
  </div>

  <div class="quiz-area" id="quiz-area">
    <div class="heatmap-legend" id="retention-legend">
      <div class="legend-item"><div class="legend-swatch" style="background:#ddd"></div>No data</div>
      <div class="legend-item"><div class="legend-swatch" style="background:hsl(120,60%,65%)"></div>&gt; 80%</div>
      <div class="legend-item"><div class="legend-swatch" style="background:hsl(80,60%,65%)"></div>60\u201380%</div>
      <div class="legend-item"><div class="legend-swatch" style="background:hsl(50,60%,65%)"></div>40\u201360%</div>
      <div class="legend-item"><div class="legend-swatch" style="background:hsl(30,60%,65%)"></div>20\u201340%</div>
      <div class="legend-item"><div class="legend-swatch" style="background:hsl(0,60%,65%)"></div>&lt; 20%</div>
    </div>
    <div class="heatmap-legend" id="speed-legend">
      <div class="legend-item"><div class="legend-swatch" style="background:#ddd"></div>No data</div>
      <div class="legend-item"><div class="legend-swatch" style="background:hsl(120,60%,65%)"></div>&lt; 1.5s</div>
      <div class="legend-item"><div class="legend-swatch" style="background:hsl(80,60%,65%)"></div>1.5\u20133s</div>
      <div class="legend-item"><div class="legend-swatch" style="background:hsl(50,60%,65%)"></div>3\u20134.5s</div>
      <div class="legend-item"><div class="legend-swatch" style="background:hsl(30,60%,65%)"></div>4.5\u20136s</div>
      <div class="legend-item"><div class="legend-swatch" style="background:hsl(0,60%,65%)"></div>&gt; 6s</div>
    </div>
    <div class="countdown-container">
      <div class="countdown-bar" id="countdown-bar"></div>
    </div>
    <div class="note-buttons" id="note-buttons">
      <button class="note-btn" data-note="C">C</button>
      <button class="note-btn accidental" data-note="C#">C#</button>
      <button class="note-btn" data-note="D">D</button>
      <button class="note-btn accidental" data-note="D#">D#</button>
      <button class="note-btn" data-note="E">E</button>
      <button class="note-btn" data-note="F">F</button>
      <button class="note-btn accidental" data-note="F#">F#</button>
      <button class="note-btn" data-note="G">G</button>
      <button class="note-btn accidental" data-note="G#">G#</button>
      <button class="note-btn" data-note="A">A</button>
      <button class="note-btn accidental" data-note="A#">A#</button>
      <button class="note-btn" data-note="B">B</button>
    </div>
    <div class="feedback" id="feedback"></div>
    <div class="time-display" id="time-display"></div>
    <div class="hint" id="hint"></div>
  </div>

  <script>
${adaptiveJS}
${appJS}
  </script>
</body>
</html>`;

const sw = `// Network-first service worker: always fetch latest, fall back to cache offline
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

mkdirSync(join(__dirname, "docs"), { recursive: true });
writeFileSync(join(__dirname, "docs/index.html"), html);
writeFileSync(join(__dirname, "docs/sw.js"), sw);
console.log("Built to docs/index.html + docs/sw.js");
