# Stats Mode Toggle: Side-by-Side Design

## Problem

The current stats toggle is a single `<button class="heatmap-btn">` whose text
alternates between "Show Recall" and "Show Speed". The user has to guess what
modes exist and what's currently displayed.

## Solution

Replace the single button with a segmented toggle (two labels side by side,
the active one highlighted). Both labels ("Recall" / "Speed") are always
visible so the user immediately understands the options and current state.

## HTML Change

Replace every instance of:
```html
<button class="heatmap-btn">Show Recall</button>
```

With:
```html
<div class="stats-toggle">
  <button class="stats-toggle-btn active" data-mode="retention">Recall</button>
  <button class="stats-toggle-btn" data-mode="speed">Speed</button>
</div>
```

This appears 10 times in both `main.ts` and `build.ts`.

## CSS

New `.stats-toggle` styles: inline-flex container with border, rounded corners.
`.stats-toggle-btn` styles: minimal padding, no individual borders.
`.stats-toggle-btn.active`: highlighted background (green).

## JS Changes

Each quiz mode's `showStats(mode)` / `showHeatmapView(mode)` currently sets
`btn.textContent = ...`. Change to:

```js
container.querySelectorAll('.stats-toggle-btn').forEach(b => {
  b.classList.toggle('active', b.dataset.mode === mode);
});
```

Each mode's `init()` currently does:
```js
container.querySelector('.heatmap-btn').addEventListener('click', toggleStats);
```

Change to register click on both toggle buttons:
```js
container.querySelectorAll('.stats-toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => showStats(btn.dataset.mode));
});
```

This simplifies things: no more `toggleStats()` function needed since the button
knows its target mode. But we keep it for the fretboard mode's slightly different
`showHeatmapView` pattern.

## Files Modified

- `src/styles.css` — add `.stats-toggle`, `.stats-toggle-btn` styles
- `main.ts` — replace 10 button instances
- `build.ts` — replace 10 button instances
- `src/quiz-fretboard.js` — update toggle wiring + showHeatmapView
- `src/quiz-note-semitones.js` — update toggle wiring + showStats
- `src/quiz-interval-semitones.js` — update toggle wiring + showStats
- `src/quiz-semitone-math.js` — update toggle wiring + showStats
- `src/quiz-interval-math.js` — update toggle wiring + showStats
- `src/quiz-key-signatures.js` — update toggle wiring + showStats
- `src/quiz-scale-degrees.js` — update toggle wiring + showStats
- `src/quiz-diatonic-chords.js` — update toggle wiring + showStats
- `src/quiz-chord-spelling.js` — update toggle wiring + showStats

## Follow-up: Shared Helper Refactoring

After the initial implementation, the toggle/hide/show boilerplate was
duplicated across all 10 quiz modes (~15 lines each). Extracted into
`createStatsControls(container, renderFn)` in `stats-display.js`.

The helper manages:
- `statsMode` state internally
- Toggle button active-class switching
- Click handler wiring on `.stats-toggle-btn` elements
- `show(mode)`: clears container, calls renderFn, shows container, updates toggle
- `hide()`: clears and hides container
- `mode` getter for external checks (fretboard/speed-tap use it)

Each mode now provides only its render callback. ~120 lines removed total.

## Version

Bump v3.1 -> v3.2.
