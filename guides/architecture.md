# Architecture

How the app is built today — code structure, patterns, algorithms, and DOM
layout. This is a current-state reference, not aspirational design. For design
principles, see [design-principles.md](design-principles.md). For where the
product is headed, see [vision.md](vision.md).

## System Overview

Single-page vanilla JS app — no framework, minimal tooling. Source files are
standard ES modules with `import`/`export` statements. esbuild bundles them into
a single IIFE `<script>` block inside one HTML file at build time. No globals
leak into the browser scope.

## Module Dependency Graph

All source files use standard ES module `import`/`export`. esbuild resolves the
dependency graph from the entry point (`src/app.js`):

```
adaptive.js              ← Config, selector factory, forgetting model
music-data.js            ← NOTES, INTERVALS, helpers
quiz-engine-state.js     ← Pure state transitions (idle/active/calibration)
quiz-engine.js           ← Engine factory, keyboard handler, calibration
  imports: quiz-engine-state, adaptive, music-data
stats-display.js         ← Color functions, table/grid rendering
  imports: music-data
recommendations.js       ← Consolidate-before-expanding algorithm
quiz-fretboard-state.js  ← Pure fretboard helpers (factory pattern)
  imports: music-data
quiz-fretboard.js        ← Fretboard quiz mode
  imports: music-data, adaptive, quiz-engine, stats-display, recommendations, quiz-fretboard-state
quiz-speed-tap.js .. quiz-chord-spelling.js  ← 9 more quiz modes
  imports: music-data, quiz-engine, stats-display, + mode-specific deps
navigation.js            ← Home screen, mode switching
settings.js              ← Settings modal
  imports: music-data
app.js                   ← Entry point: imports all modes, registers, starts
```

**Layers**: Foundation modules (adaptive, music-data) → Engine (state + engine)
→ Shared display (stats, recommendations) → Mode-specific state → Mode
implementations → Navigation → App init.

## Build System

### esbuild Bundling

Source files are standard ES modules with `import`/`export`. esbuild bundles
them from the entry point (`src/app.js`) into a single IIFE — no globals leak
into the browser scope. Both build scripts and tests use the same source files
directly.

- `build.ts` (Node): uses esbuild's JS API (`esbuild.buildSync()`)
- `main.ts` (Deno): shells out to esbuild CLI via `Deno.Command`

### Shared Template (`src/build-template.ts`)

The HTML template and version number live in `src/build-template.ts` — the
single source of truth. Both build scripts import from it:

```typescript
import { assembleHTML, SERVICE_WORKER } from './src/build-template.ts';
```

Key exports:

| Export                  | Purpose                                   |
| ----------------------- | ----------------------------------------- |
| `VERSION`               | Single version string (e.g. `"v6.9"`)     |
| `assembleHTML(css, js)` | Assembles the complete index.html         |
| `SERVICE_WORKER`        | Service worker JS string                  |
| `HOME_SCREEN_HTML`      | Home screen markup (also used by moments) |
| `DISTANCE_TOGGLES`      | Shared toggle HTML fragment               |

### Adding a New Source File

1. Create `src/new-file.js` with proper `import`/`export` statements
2. Import it from the file(s) that need it — esbuild handles the rest

### Moments Page Generation

`build.ts` also generates `guides/design/moments.html` — a design reference page
showing assembled screen layouts at mobile width. It reuses the same HTML
helpers (`modeScreen()`, `fretboardSVG()`, `pianoNoteButtons()`, etc.) as the
production app, so the moments never drift from reality.

Key functions in `build.ts`:

- **`prepareMoment(html, overrides)`** — string replacement engine. Takes
  generated mode-screen HTML and injects phase classes, quiz content, feedback,
  toggle states, fretboard highlights, etc.
- **`momentFrame(label, html, annotation)`** — wraps content in the moment
  frame/label/annotation chrome.
- **`buildMoments()`** — generates all moments and writes the file. Each moment
  creates a fresh mode screen (via the HTML helpers) then applies overrides.

The existing copy logic handles `docs/design/moments.html` automatically.

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
  return {
    ...state,
    phase: 'active',
    currentItemId: nextItemId,
    answered: false,
    questionStartTime: nowMs,
    feedbackText: '',
    feedbackClass: 'feedback',
  };
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

- `quiz-engine-state.js` → `quiz-engine.js`: 8 state transitions covering idle,
  active, and calibration phases
- `quiz-fretboard-state.js` → `quiz-fretboard.js`: pure helpers for note lookup,
  answer checking, item enumeration

**When to use it**: Any logic that affects UI state and could benefit from
testability. Pure state modules get the `*-state.js` suffix.

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

### Factory Pattern for Multi-Instrument Reuse

`createFretboardHelpers(musicData)` accepts instrument-specific parameters
(string offsets, fret count) to support multiple instruments with shared logic:

```javascript
export function createFretboardHelpers(musicData) {
  const { notes, naturalNotes, stringOffsets, fretCount, noteMatchesInput } = musicData;
  return {
    getNoteAtPosition(string, fret) { ... },
    checkFretboardAnswer(currentNote, input) { ... },
    // ...
  };
}
```

Guitar:
`createFretboardHelpers({ ..., stringOffsets: GUITAR.stringOffsets, fretCount: GUITAR.fretCount })`
Ukulele:
`createFretboardHelpers({ ..., stringOffsets: UKULELE.stringOffsets, fretCount: UKULELE.fretCount })`

#### Instrument Configs

Fretted instrument modes are driven by config objects in `music-data.js`:

```javascript
const GUITAR = {
  id: 'fretboard',
  name: 'Guitar Fretboard',
  storageNamespace: 'fretboard',
  stringCount: 6,
  fretCount: 13,
  stringNames: ['e', 'B', 'G', 'D', 'A', 'E'],
  stringOffsets: [4, 11, 7, 2, 9, 4],
  defaultString: 5,
  fretMarkers: [3, 5, 7, 9, 12],
};
```

`createFrettedInstrumentMode(instrument)` in `quiz-fretboard.js` is the shared
factory — thin wrappers like `createGuitarFretboardMode()` and
`createUkuleleFretboardMode()` just pass the config. To add a new fretted
instrument, define a config object and a one-line wrapper.

### Stats Display Pattern

`createStatsControls(container, renderFn)` manages the Recall/Speed toggle and
wires up the stats display. Each mode provides only its render callback. This
avoids duplicating toggle logic across 10 modes.

Related helpers:

- `getAutomaticityColor(auto)` — automaticity-based heatmap color
- `getSpeedHeatmapColor(ms, baseline)` — speed-based heatmap color
- `getStatsCellColor(selector, itemId, statsMode, baseline)` — unified cell
  coloring
- `renderStatsTable()` — for lookup modes (tables)
- `buildStatsLegend()` — color scale legend

### Consolidate Before Expanding

Shared algorithm in `recommendations.js` gating progression to new item groups.
Used by 6 different systems: fretboard strings, semitone math groups, interval
math groups, key signature groups, scale degree groups, diatonic chord groups,
chord spelling groups.

```javascript
computeRecommendations(selector, allIndices, getItemIds, config, options);
// Returns { recommended: Set, enabled: Set|null }
```

See [Algorithms](#consolidate-before-expanding-1) below for the full algorithm.

## Algorithms

### Adaptive Selector

Lives in `adaptive.js`. Creates a weighted random selector that prioritizes
items the user is slowest on, with exploration of unseen items.

`createAdaptiveSelector(config, storageAdapter)` — factory with injected storage
(localStorage adapter in browser, `Map` adapter in tests) and optional injected
RNG for deterministic testing.

Key behaviors:

- **Unseen items** get `unseenBoost` weight (exploration)
- **Seen items** get `ewma / minTime` weight (slower = more practice)
- No extra multiplier for low-sample items (this was a bug that caused startup
  ruts — new items would get drilled excessively)
- Response times clamped to `maxResponseTime` to reject outliers
- Last-selected item gets weight 0 (no immediate repeats)
- `updateConfig(newCfg)` / `getConfig()` allow runtime config changes (used by
  calibration to apply scaled thresholds)

### Motor Baseline Calibration

On first quiz start, a 10-trial "Quick Speed Check" measures the user's pure
motor response time (reaction + tap + device latency). A random button is
highlighted green; user taps as fast as they can. The median becomes the **motor
baseline**.

All modes share a baseline via a **calibration provider** system. Modes declare
a `calibrationProvider` (default `'button'`); the baseline is stored as
`motorBaseline_{provider}`. Completing calibration in any mode makes it
available to all modes sharing that provider.

All timing thresholds scale proportionally:

| Threshold               | Ratio to baseline |
| ----------------------- | ----------------- |
| minTime                 | 1.0x              |
| automaticityTarget      | 3.0x              |
| selfCorrectionThreshold | 1.5x              |
| maxResponseTime         | 9.0x              |
| Heatmap green           | < 1.5x            |
| Heatmap yellow-green    | < 3.0x            |
| Heatmap yellow          | < 4.5x            |
| Heatmap orange          | < 6.0x            |

Key functions: `deriveScaledConfig()`, `computeMedian()` in `adaptive.js`;
`runCalibration()` in `quiz-engine.js`; `engine.baseline` property.

#### Response-count scaling (planned)

Some modes require multiple physical responses per question: Chord Spelling
needs 3-4 sequential note entries, Speed Tap needs 6-8 fretboard taps. All
timing thresholds should scale by the expected response count so that speed
scores and automaticity are comparable across modes. The mode declares the
expected count via `getExpectedResponseCount(itemId)` (can vary per item —
triads need 3, 7th chords need 4), and the engine multiplies through:

```
effective_minTime = baseline × 1.0 × responseCount
effective_target  = baseline × 3.0 × responseCount
effective_max     = baseline × 9.0 × responseCount
```

This keeps the ratios consistent: "automatic" always means "responding near the
physical speed limit." Without this scaling, multi-response items can never
reach "automatic" on the heatmap because their response times are inherently
longer. See `plans/exec-plans/active/2026-02-14-layout-ia-fixes.md` Phase 2.

### Forgetting Model (Spaced Repetition)

Per-item half-life forgetting curve: `P(recall) = 2^(-t/stability)`.

- Each item tracks `stability` (half-life in hours) and `lastCorrectAt`
- First correct answer: `stability = initialStability` (4 hours)
- Subsequent correct: stability grows by `stabilityGrowthBase * speedFactor`
- Wrong answer: stability reduced by `stabilityDecayOnWrong` (floored at
  `initialStability`)
- **Self-correction**: fast answer after long gap → stability boosted to at
  least `elapsedHours * 1.5` (handles off-app learning, e.g., guitar practice)
- Within-session weighting: recall factor `1 + (1 - recall)` multiplies speed
  weight
- Two heatmap modes: **retention** (predicted recall) and **speed** (EWMA)

### Completion Display (Progress Bar & Mastery Message)

The progress bar and "Looks like you've got this!" message use the
**automaticity** threshold, not just recall:

- An item counts toward the progress bar when
  `automaticity > automaticityThreshold` (0.8), where
  `automaticity = recall * speedScore`. This matches the green "Automatic" band
  in the stats heatmap (`getAutomaticityColor` in `stats-display.js`).
- The mastery message appears when **all** enabled items exceed this threshold
  (`checkAllAutomatic` in `adaptive.js`).
- This is deliberately stricter than the recommendation system's "mastered"
  classification (which uses `recall >= recallThreshold`, i.e. 0.5). You can
  have items that are "mastered" enough for the recommendation algorithm to
  expand to new groups, but not yet "automatic" enough to show completion.

Config: `automaticityThreshold` (default 0.8) in `DEFAULT_CONFIG`.

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
5. **First launch**: no data → recommend the first unstarted group (respecting
   `sortUnstarted` if provided) with `enabled` populated so "Use suggestion"
   works immediately

Config: `expansionThreshold` (default 0.7) in `DEFAULT_CONFIG`.

**Ownership rule**: `computeRecommendations()` owns _all_ suggestion logic,
including the first-launch default. Per-mode `renderPracticeSummary` should
never special-case "no data yet" — the recommendation result's `expandIndex` and
`expandNewCount` fields tell the UI what to display. This keeps suggestion logic
unit-testable in one place instead of scattered across 8 mode files.

### Distance Group Progression (Math Modes)

264 items per math mode, grouped into 6 distance groups unlocked progressively.
Uses the consolidate-before-expanding algorithm. Default: group 0 only.

| Group | Distances | Semitone label | Interval label | Items |
| ----- | --------- | -------------- | -------------- | ----- |
| 0     | 1, 2      | 1,2            | m2,M2          | 48    |
| 1     | 3, 4      | 3,4            | m3,M3          | 48    |
| 2     | 5, 6      | 5,6            | P4,TT          | 48    |
| 3     | 7, 8      | 7,8            | P5,m6          | 48    |
| 4     | 9, 10     | 9,10           | M6,m7          | 48    |
| 5     | 11        | 11             | M7             | 24    |

Expansion always recommends the next sequential group (smallest distance first),
controlled by `sortUnstarted` option in `computeRecommendations()`.

### Accidental Naming (Sharp vs Flat)

When a note has two enharmonic spellings (C#/Db, D#/Eb, etc.), the choice is
governed by standard music-theory conventions. Five rules are documented in
priority order in [accidental-conventions.md](accidental-conventions.md). In
practice:

- **Chord/scale modes** (chord spelling, scale degrees, diatonic chords, key
  signatures): letter-name arithmetic in `getScaleDegreeNote()` and
  `getChordTones()` automatically produces the correct spelling based on
  harmonic context and key signature.
- **Math modes** (semitone math, interval math): directional convention —
  `useFlats = (op === '-')`. Ascending questions use sharps, descending use
  flats, for both the question note and answer buttons.
- **Context-free modes** (fretboard, note↔semitones): no direction or key
  applies, so canonical forms are used (sharp form on fretboard, dual display
  elsewhere).

When adding a new mode that displays accidental notes, determine which rule
applies and document the choice in `accidental-conventions.md`.

## Universal Mode Layout

All 11 quiz modes share the same DOM structure, generated by `modeScreen()` in
`html-helpers.ts`. Each mode has three top-level sections: a mode top bar (back
button + title), idle content (tabs), and quiz content (session + quiz area).
Phase classes on the mode container control which section is visible. The mode
top bar is hidden during active quiz, calibration, and round-complete phases.

For the design principles behind this layout, see
[layout-and-ia.md](design/layout-and-ia.md).

### Idle phase: Practice/Progress tabs

Every mode uses `tabbedIdleHTML()` (or `fretboardIdleHTML()` which wraps it) to
generate a two-tab idle layout:

```
.mode-tabs
  [Practice] [Progress]                    ← tab bar

.tab-practice (.tab-content)               ← active by default
  .practice-card                           ← consolidated card
    .practice-status
      .practice-status-label               ← "Overall: Solid"
      .practice-status-detail              ← "12 of 78 items fluent"
    .practice-recommendation
      .practice-rec-text                   ← "Recommended: G, D strings"
      .practice-rec-btn                    ← "Use recommendation"
    .practice-scope                        ← mode-specific config
      .settings-row
        (string toggles, group toggles,
         notes toggle, etc.)
    .practice-start
      .session-summary-text                ← "48 items · 60s"
      .mastery-message                     ← "Looks like you've got this!"
      .start-btn                           ← "Start Quiz"
  .practice-advanced (<details>)           ← collapsible section
    .recalibrate-btn                       ← "Redo speed check"

.tab-progress (.tab-content)               ← hidden until clicked
  (optional: mode-specific content,
   e.g. fretboard SVG for heatmap)
  .stats-container                         ← rendered on demand
  .stats-controls
    .stats-toggle                          ← [Recall] [Speed]
```

### Mode categories

**Fretboard modes** (Guitar, Ukulele): Use `fretboardIdleHTML()` which adds
string toggles + notes toggle (natural / sharps & flats / all) to
`practiceScope`, and a fretboard SVG to `progressContent` for the heatmap
overlay.

**Group modes** (Semitone Math, Interval Math, Key Signatures, Scale Degrees,
Diatonic Chords, Chord Spelling): Pass `DISTANCE_TOGGLES` as `practiceScope`.
Each mode generates its own group toggle buttons at init time and uses
`computeRecommendations()` for recommendations.

**Simple modes** (Note Semitones, Interval Semitones): No `practiceScope` — all
items always enabled. When `practiceScope` is empty, the recommendation and
mastery elements fold into the status zone (no separate scope zone is emitted),
avoiding double dividers.

**Speed Tap**: Passes a notes toggle (natural / sharps & flats / all) as
`practiceScope`. The fretboard lives in the quiz area (not in idle) and is
hidden/shown via `.fretboard-hidden` during start/stop.

### Quiz phase

All modes share the same quiz-phase structure:

```
.quiz-session
  .quiz-countdown-bar                      ← 4px bar depleting over 60s
    .quiz-countdown-fill                   ← brand color, red in last 10s
  .quiz-session-info                       ← compact info row
    .quiz-info-context                     ← "e, B strings"
    .quiz-info-time                        ← "0:42"
    .quiz-info-count                       ← "13 answers"
    .quiz-header-close                     ← × stop button

.quiz-area
  .quiz-prompt                             ← question text
  (answer buttons — varies by mode)
  .feedback                                ← correct/wrong + time
  .time-display                            ← response time
  .hint                                    ← correctAnswer on wrong
  .round-complete                          ← end-of-round summary
    .round-complete-heading                ← "Round 1 complete"
    .round-complete-stats                  ← 3 stats in a row
      .round-stat (×3)                     ← correct, median time, fluent
    .round-complete-actions                ← Keep Going + Stop buttons
```

### Phase visibility

CSS phase classes on `.mode-screen` control what's visible:

| Class                   | Tabs    | Quiz session | Quiz area |
| ----------------------- | ------- | ------------ | --------- |
| `.phase-idle`           | visible | hidden       | hidden    |
| `.phase-active`         | hidden  | visible      | visible   |
| `.phase-calibration`    | hidden  | visible      | visible   |
| `.phase-round-complete` | hidden  | visible      | visible   |

## Adding a New Quiz Mode

**Reuse shared infrastructure.** Adaptive selector, `computeRecommendations()`,
`createStatsControls()`, `createNoteKeyHandler()`. A new mode should feel like a
natural extension, not a separate app.

**Consistency over accommodation.** When a mode behaves differently, ask "should
it?" not "how do we support that?" Change the outlier to match the standard
rather than adding complexity. Per-mode flags are a code smell.

Step-by-step checklist:

1. **Create** `src/quiz-{mode}.js` following the `createXxxMode()` pattern with
   proper `import`/`export` statements
2. **Define** item ID format and `ALL_ITEMS` list
3. **Implement** mode object: `getEnabledItems`, `presentQuestion`,
   `checkAnswer`, `handleKey`, `onStart`, `onStop`
4. **Groups** (if applicable): use `computeRecommendations()` from
   `recommendations.js` for progressive unlocking
5. **Stats**: add `createStatsControls()` with a render callback
6. **HTML**: add mode screen call in `modeScreens()` in `src/build-template.ts`,
   and nav button in `HOME_SCREEN_HTML`
7. **Register** mode in `app.js` (import the create function + register)
8. **Tests**: create `src/quiz-{mode}_test.ts` if pure logic was extracted
9. **Accidentals**: determine which naming convention applies (see
   [accidental-conventions.md](accidental-conventions.md)) and update that
   guide's mode table
10. **CLAUDE.md**: update quiz modes table with item count, answer type, and ID
    format
11. **Version**: bump `VERSION` in `src/build-template.ts`
