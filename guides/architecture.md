# Architecture

How the app is structured, why it's built this way, and the patterns that
new code should follow.

## System Overview

Single-page vanilla JS app — no framework, no bundler, no npm dependencies.
All `.js` source files are concatenated into a single `<script>` block inside
one HTML file at build time. This was chosen for simplicity: the app is small
enough that a concatenation build gives full code visibility and instant
builds, with no module resolution overhead in the browser.

## Module Dependency Graph

Concatenation order (from `build.ts`) defines the dependency graph. Each file
can reference globals defined by files above it:

```
adaptive.js              ← Config, selector factory, forgetting model
music-data.js            ← NOTES, INTERVALS, helpers
quiz-engine-state.js     ← Pure state transitions (idle/active/calibration)
quiz-engine.js           ← Engine factory, keyboard handler, calibration
stats-display.js         ← Color functions, table/grid rendering
recommendations.js       ← Consolidate-before-expanding algorithm
quiz-fretboard-state.js  ← Pure fretboard helpers (factory pattern)
quiz-fretboard.js        ← Fretboard quiz mode
quiz-speed-tap.js        ← Speed tap mode
quiz-note-semitones.js   ← Note ↔ Semitones mode
quiz-interval-semitones.js
quiz-semitone-math.js
quiz-interval-math.js
quiz-key-signatures.js
quiz-scale-degrees.js
quiz-diatonic-chords.js
quiz-chord-spelling.js
navigation.js            ← Hamburger menu, mode switching
app.js                   ← Registers all modes, starts navigation (loaded last)
```

**Layers**: Foundation modules (adaptive, music-data) → Engine (state +
engine) → Shared display (stats, recommendations) → Mode-specific state →
Mode implementations → Navigation → App init.

## Build System

### readModule() vs read()

```javascript
const read = (rel) => readFileSync(join(__dirname, rel), "utf-8");
const readModule = (rel) => read(rel).replace(/^export /gm, "");
```

- `readModule()`: reads the file and strips `export` at the start of lines.
  Used for ES module files that tests import directly.
- `read()`: reads the file verbatim. Used for browser-only files.

### The ES Module ↔ Browser Global Bridge

Source files use `export` so tests can import functions directly (`import {
computeMedian } from './src/adaptive.js'`). At build time, `readModule()`
strips `export` keywords, turning exported functions into globals within the
concatenated `<script>` scope.

This means:
- Tests see proper ES modules with named exports
- The browser sees a flat script where all functions are in scope
- **No `import` statements** in source files — they wouldn't work in the
  concatenated context. Dependencies come from concatenation order.

### Adding a New Source File

1. Create `src/new-file.js`
2. Add a read call in **both** `main.ts` and `build.ts`:
   - `readModule("src/new-file.js")` if it uses `export`
   - `read("src/new-file.js")` if it doesn't
3. Add the template interpolation `${newFileJS}` in the `<script>` block
4. Position it after its dependencies, before its dependents
5. If using `export`: add to both files with `readModule()`

### Template Sync

Both `main.ts` (Deno) and `build.ts` (Node) contain identical HTML templates.
Any change to one must be mirrored in the other. This includes: HTML structure,
nav drawer buttons, mode screen divs, `<script>` file reads, version number.

## Key Patterns

### State + Render

The central architectural pattern. Separates pure logic from DOM interaction:

```
state = pureTransition(state, event)   // testable, no DOM
render(state, domElements)             // thin, declarative, idempotent
```

**Why it exists**: Imperative DOM manipulation leads to ordering bugs ("called
hideX() after showY(), should have been before") and stale UI ("changed the
enabled set but didn't update the mastery message"). With State + Render, the
render function reads the full state and sets every DOM property independently.
There's no sequence to get wrong.

**How it works in practice**:

Pure state module (`quiz-engine-state.js`):
```javascript
export function engineNextQuestion(state, nextItemId, nowMs) {
  return { ...state, phase: 'active', currentItemId: nextItemId,
           answered: false, questionStartTime: nowMs,
           feedbackText: '', feedbackClass: 'feedback' };
}
```

Thin render function (in `quiz-engine.js`):
```javascript
function render() {
  els.startBtn.style.display = state.showStartBtn ? 'inline' : 'none';
  els.feedback.textContent = state.feedbackText;
  els.feedback.className = state.feedbackClass;
  // ... one line per DOM element
}
```

**Files using this pattern**:
- `quiz-engine-state.js` → `quiz-engine.js`: 8 state transitions covering
  idle, active, and calibration phases
- `quiz-fretboard-state.js` → `quiz-fretboard.js`: pure helpers for note
  lookup, answer checking, item enumeration

**When to use it**: Any logic that affects UI state and could benefit from
testability. Pure state modules get the `*-state.js` suffix and are built
with `readModule()`.

### Mode Plugin Interface

Every quiz mode follows the same factory pattern:

```javascript
function createXxxMode() {
  // 1. Closure state
  let enabledItems = new Set([...]);
  let currentItem = null;

  // 2. Mode interface (passed to QuizEngine)
  const mode = {
    id: 'xxx',
    name: 'Mode Title',
    storageNamespace: 'xxx',
    getEnabledItems() { return [...]; },
    presentQuestion(itemId) { /* render question */ },
    checkAnswer(itemId, input) { return { correct, correctAnswer }; },
    handleKey(e) { return false; /* true if handled */ },
    onStart() { /* setup */ },
    onStop() { /* cleanup */ },
  };

  // 3. Lifecycle hooks (passed to Navigation)
  return {
    init() { /* one-time: DOM queries, engine creation, event listeners */ },
    activate() { /* mode becomes visible: refresh stats/recommendations */ },
    deactivate() { /* mode hidden: stop quiz if running */ },
  };
}
```

**Registration** (in `app.js`):
```javascript
const xxx = createXxxMode();
nav.registerMode('xxx', {
  name: 'Mode Title',
  init: xxx.init,
  activate: xxx.activate,
  deactivate: xxx.deactivate,
});
```

### Factory Pattern for Testability

Solves the dependency injection problem without ES imports.

Problem: `quiz-fretboard-state.js` needs `NOTES` and `STRING_OFFSETS` from
`music-data.js`. In the browser they're globals (concatenation order). But
tests can't rely on globals — they import from ES modules.

Solution: a factory function that accepts dependencies as parameters:

```javascript
export function createFretboardHelpers(musicData) {
  const { NOTES, NATURAL_NOTES, STRING_OFFSETS, noteMatchesInput } = musicData;
  return {
    getNoteAtPosition(string, fret) { ... },
    checkFretboardAnswer(currentNote, input) { ... },
    // ...
  };
}
```

Browser: `createFretboardHelpers({ NOTES, NATURAL_NOTES, STRING_OFFSETS, noteMatchesInput })`
Tests: `createFretboardHelpers(await import('./music-data.js'))`

### Stats Display Pattern

`createStatsControls(container, renderFn)` manages the Recall/Speed toggle
and wires up the stats display. Each mode provides only its render callback.
This avoids duplicating toggle logic across 10 modes.

Related helpers:
- `getAutomaticityColor(recall)` — retention-based heatmap color
- `getSpeedHeatmapColor(ms, baseline)` — speed-based heatmap color
- `getStatsCellColor(selector, itemId, statsMode, baseline)` — unified cell coloring
- `renderStatsTable()` — for lookup modes (tables)
- `buildStatsLegend()` — color scale legend

### Consolidate Before Expanding

Shared algorithm in `recommendations.js` gating progression to new item
groups. Used by 6 different systems: fretboard strings, semitone math groups,
interval math groups, key signature groups, scale degree groups, diatonic
chord groups, chord spelling groups.

```javascript
computeRecommendations(selector, allIndices, getItemIds, config, options)
// Returns { recommended: Set, enabled: Set|null }
```

See [Algorithms](#consolidate-before-expanding-1) below for the full algorithm.

## Algorithms

### Adaptive Selector

Lives in `adaptive.js`. Creates a weighted random selector that prioritizes
items the user is slowest on, with exploration of unseen items.

`createAdaptiveSelector(config, storageAdapter)` — factory with injected
storage (localStorage adapter in browser, `Map` adapter in tests) and
optional injected RNG for deterministic testing.

Key behaviors:
- **Unseen items** get `unseenBoost` weight (exploration)
- **Seen items** get `ewma / minTime` weight (slower = more practice)
- No extra multiplier for low-sample items (this was a bug that caused
  startup ruts — new items would get drilled excessively)
- Response times clamped to `maxResponseTime` to reject outliers
- Last-selected item gets weight 0 (no immediate repeats)
- `updateConfig(newCfg)` / `getConfig()` allow runtime config changes
  (used by calibration to apply scaled thresholds)

### Motor Baseline Calibration

On first quiz start, a 10-trial "Quick Speed Check" measures the user's pure
motor response time (reaction + tap + device latency). A random button is
highlighted green; user taps as fast as they can. The median becomes the
**motor baseline**.

All modes share a baseline via a **calibration provider** system. Modes
declare a `calibrationProvider` (default `'button'`); the baseline is stored
as `motorBaseline_{provider}`. Completing calibration in any mode makes it
available to all modes sharing that provider.

All timing thresholds scale proportionally:

| Threshold              | Ratio to baseline |
|------------------------|-------------------|
| minTime                | 1.0x              |
| automaticityTarget     | 3.0x              |
| selfCorrectionThreshold| 1.5x              |
| maxResponseTime        | 9.0x              |
| Heatmap green          | < 1.5x            |
| Heatmap yellow-green   | < 3.0x            |
| Heatmap yellow         | < 4.5x            |
| Heatmap orange         | < 6.0x            |

Key functions: `deriveScaledConfig()`, `computeMedian()` in `adaptive.js`;
`runCalibration()` in `quiz-engine.js`; `engine.baseline` property.

### Forgetting Model (Spaced Repetition)

Per-item half-life forgetting curve: `P(recall) = 2^(-t/stability)`.

- Each item tracks `stability` (half-life in hours) and `lastCorrectAt`
- First correct answer: `stability = initialStability` (4 hours)
- Subsequent correct: stability grows by `stabilityGrowthBase * speedFactor`
- Wrong answer: stability reduced by `stabilityDecayOnWrong` (floored at
  `initialStability`)
- **Self-correction**: fast answer after long gap → stability boosted to at
  least `elapsedHours * 1.5` (handles off-app learning, e.g., guitar practice)
- Within-session weighting: recall factor `1 + (1 - recall)` multiplies
  speed weight
- Two heatmap modes: **retention** (predicted recall) and **speed** (EWMA)

### Consolidate Before Expanding

The recommendation algorithm gates expansion to new item groups behind
consolidation of what's already been started:

1. **Partition** groups into "started" (at least 1 item seen) and "unstarted"
   (all items unseen)
2. **Consolidation ratio** = mastered items / total seen items across all
   started groups. An item is "mastered" when `recall >= recallThreshold` (0.5)
3. **Rank** started groups by work remaining (`dueCount + unseenCount`);
   recommend those above the median
4. **Expansion gate**: only suggest one unstarted group when
   `consolidationRatio >= expansionThreshold` (0.7)
5. **First launch**: no data → return null (keep persisted selection)

Config: `expansionThreshold` (default 0.7) in `DEFAULT_CONFIG`.

### Distance Group Progression (Math Modes)

264 items per math mode, grouped into 6 distance groups unlocked progressively.
Uses the consolidate-before-expanding algorithm. Default: group 0 only.

| Group | Distances | Semitone label | Interval label | Items |
|-------|-----------|---------------|----------------|-------|
| 0     | 1, 2      | 1,2           | m2,M2          | 48    |
| 1     | 3, 4      | 3,4           | m3,M3          | 48    |
| 2     | 5, 6      | 5,6           | P4,TT          | 48    |
| 3     | 7, 8      | 7,8           | P5,m6          | 48    |
| 4     | 9, 10     | 9,10          | M6,m7          | 48    |
| 5     | 11        | 11            | M7             | 24    |

Expansion always recommends the next sequential group (smallest distance
first), controlled by `sortUnstarted` option in `computeRecommendations()`.

### Accidental Naming (Sharp vs Flat)

When a note has two enharmonic spellings (C#/Db, D#/Eb, etc.), the
choice is governed by standard music-theory conventions. Five rules are
documented in priority order in
[accidental-conventions.md](accidental-conventions.md). In practice:

- **Chord/scale modes** (chord spelling, scale degrees, diatonic chords,
  key signatures): letter-name arithmetic in `getScaleDegreeNote()` and
  `getChordTones()` automatically produces the correct spelling based on
  harmonic context and key signature.
- **Math modes** (semitone math, interval math): directional convention —
  `useFlats = (op === '-')`. Ascending questions use sharps, descending
  use flats, for both the question note and answer buttons.
- **Context-free modes** (fretboard, note↔semitones): no direction or
  key applies, so canonical forms are used (sharp form on fretboard,
  dual display elsewhere).

When adding a new mode that displays accidental notes, determine which
rule applies and document the choice in `accidental-conventions.md`.

## Adding a New Quiz Mode

Step-by-step checklist:

1. **Create** `src/quiz-{mode}.js` following the `createXxxMode()` pattern
2. **Define** item ID format and `ALL_ITEMS` list
3. **Implement** mode object: `getEnabledItems`, `presentQuestion`,
   `checkAnswer`, `handleKey`, `onStart`, `onStop`
4. **Groups** (if applicable): use `computeRecommendations()` from
   `recommendations.js` for progressive unlocking
5. **Stats**: add `createStatsControls()` with a render callback
6. **HTML**: add mode screen (`<div class="mode-screen" id="mode-{id}">`)
   in **both** `main.ts` and `build.ts`
7. **Nav button**: add `<button data-mode="{id}">` in nav drawer in **both**
   template files
8. **JS reads**: add `read()` or `readModule()` in **both** `main.ts` and
   `build.ts`; position after dependencies in the `<script>` block
9. **Register** mode in `app.js`
10. **Tests**: create `src/quiz-{mode}_test.ts` if pure logic was extracted
11. **Accidentals**: determine which naming convention applies (see
    [accidental-conventions.md](accidental-conventions.md)) and update
    that guide's mode table
12. **CLAUDE.md**: update quiz modes table with item count, answer type,
    and ID format
13. **Version**: bump in both `main.ts` and `build.ts`
