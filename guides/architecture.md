# Architecture

How the app is built today — code structure, patterns, algorithms, and DOM
layout. This is a current-state reference, not aspirational design. For design
principles, see [design-principles.md](design-principles.md). For where the
product is headed, see [vision.md](vision.md).

## System Overview

Single-page app using Preact for UI components. Source files are standard ES
modules (`.ts` and `.tsx`) with `import`/`export` statements. esbuild bundles
them with automatic JSX transform (`--jsx=automatic --jsx-import-source=preact`)
into a single IIFE `<script>` block inside one HTML file at build time. No
globals leak into the browser scope.

## Module Dependency Graph

All source files use standard ES module `import`/`export`. esbuild resolves the
dependency graph from the entry point (`src/app.ts`):

```
Foundation layer:
  adaptive.ts              ← Config, selector factory, forgetting model
  music-data.ts            ← NOTES, INTERVALS, helpers
  types.ts                 ← Shared type definitions (zero runtime)

Engine layer:
  quiz-engine-state.ts     ← Pure engine state transitions (idle/active/round-complete)
  quiz-engine.ts           ← Keyboard handlers, calibration utilities
    imports: music-data

Display layer:
  stats-display.ts         ← Heatmap color functions, legend builder
  recommendations.ts       ← Consolidate-before-expanding algorithm
  mode-ui-state.ts         ← Practice summary computation
  quiz-fretboard-state.ts  ← Pure fretboard helpers (factory pattern)
    imports: music-data

Hooks layer:
  hooks/use-quiz-engine.ts   ← Quiz engine lifecycle (wraps quiz-engine-state)
    imports: quiz-engine-state, adaptive
  hooks/use-scope-state.ts   ← Scope persistence (localStorage)
  hooks/use-learner-model.ts ← Adaptive selector + storage
    imports: adaptive
  hooks/use-key-handler.ts   ← Keyboard event attachment

UI layer:
  ui/mode-screen.tsx         ← Structural components (ModeScreen, QuizArea, etc.)
  ui/buttons.tsx             ← Answer button components
  ui/scope.tsx               ← Scope control components (toggles, filters)
  ui/stats.tsx               ← Stats table/grid/legend components
    imports: stats-display
  ui/modes/*.tsx             ← 11 Preact mode components
    imports: hooks, ui components, music-data, recommendations, mode-ui-state

App layer:
  navigation.ts            ← Home screen, mode switching
  settings.ts              ← Settings modal
  app.ts                   ← Entry point: registers Preact modes, starts navigation
```

**Layers**: Foundation (adaptive, music-data) → Engine (state transitions) →
Display (stats, recommendations) → Hooks (Preact wrappers) → UI (components) →
App init.

## Build System

### esbuild Bundling

Source files are standard ES modules with `import`/`export`. esbuild bundles
them from the entry point (`src/app.ts`) into a single IIFE — no globals leak
into the browser scope. `main.ts` (Deno) shells out to esbuild CLI via
`Deno.Command`. Tests import the same source files directly.

### Shared Template (`src/build-template.ts`)

The HTML template and version number live in `src/build-template.ts` — the
single source of truth. `main.ts` imports from it:

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

1. Create `src/new-file.ts` with proper `import`/`export` statements
2. Import it from the file(s) that need it — esbuild handles the rest

### Moments Page Generation

`main.ts` also generates `guides/design/moments.html` — a design reference page
showing assembled screen layouts at mobile width. It reuses the same HTML
helpers (`modeScreen()`, `fretboardSVG()`, `pianoNoteButtons()`, etc.) as the
production app, so the moments never drift from reality.

Key functions in `main.ts`:

- **`prepareMoment(html, overrides)`** — string replacement engine. Takes
  generated mode-screen HTML and injects phase classes, quiz content, feedback,
  toggle states, fretboard highlights, etc.
- **`momentFrame(label, html, annotation)`** — wraps content in the moment
  frame/label/annotation chrome.
- **`buildMoments()`** — generates all moments and writes the file. Each moment
  creates a fresh mode screen (via the HTML helpers) then applies overrides.

The existing copy logic handles `docs/design/moments.html` automatically.

## Key Patterns

### Pure State + Preact Reactivity

Pure state transitions remain the foundation. The `useQuizEngine` hook wraps
them with Preact's `useState`/`useEffect` for reactive rendering:

Pure state module (`quiz-engine-state.ts`):

```typescript
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

Preact mode component (uses the hook which calls the pure transitions):

```tsx
const engine = useQuizEngine(engineConfig, learner.selector);
// engine.state.phase, engine.state.feedbackText, etc. are reactive
// engine.start(), engine.submitAnswer(), etc. trigger state transitions
```

**Files using the pure state pattern**:

- `quiz-engine-state.ts`: 8+ state transitions covering idle, active, and
  round-complete phases — consumed by `useQuizEngine` hook
- `quiz-fretboard-state.ts`: pure helpers for note lookup, answer checking,
  item enumeration — consumed by fretboard mode component

**When to use it**: Any logic that affects UI state and could benefit from
testability. Pure state modules get the `*-state.ts` suffix.

### Preact Mode Components

Each quiz mode is a single `.tsx` component that composes shared hooks and UI
components. A typical mode is 100-300 lines:

```tsx
export function SemitoneMathMode({ container, navigateHome, onMount }) {
  // 1. Scope state (persisted toggles)
  const scope = useScopeState(scopeSpec);

  // 2. Learner model (adaptive selector + storage)
  const learner = useLearnerModel(NAMESPACE, allItemIds);

  // 3. Engine config (pure mode logic)
  const engineConfig = useMemo(() => ({
    storageNamespace: NAMESPACE,
    allItemIds,
    getEnabledItems: () => getEnabled(scope.state),
    getQuestion: (id) => parseItemId(id),
    checkAnswer: (id, input) => check(id, input),
    // ...
  }), [scope.state]);

  // 4. Quiz engine (lifecycle, timer, state)
  const engine = useQuizEngine(engineConfig, learner.selector);

  // 5. Render: compose shared UI components
  return (
    <ModeScreen phase={engine.state.phase} container={container}>
      <PracticeCard summary={summary} ... />
      <QuizArea prompt={question.text} engine={engine}>
        <NoteButtons onAnswer={engine.submitAnswer} />
      </QuizArea>
    </ModeScreen>
  );
}
```

**Registration** (in `app.ts`):

```typescript
function registerPreactMode(id: string, name: string, Component: any) {
  let handle: ModeHandle | null = null;
  const container = document.getElementById('mode-' + id)!;
  nav.registerMode(id, {
    name,
    init() { render(h(Component, { container, navigateHome, onMount }), container); },
    activate() { handle?.activate(); },
    deactivate() { handle?.deactivate(); },
  });
}
```

The `onMount` callback provides a `ModeHandle` with `activate()`/`deactivate()`
methods so navigation can signal visibility changes. The Preact component owns
all DOM rendering — navigation just manages which mode-screen is visible.

### Factory Pattern for Multi-Instrument Reuse

`createFretboardHelpers(musicData)` in `quiz-fretboard-state.ts` accepts
instrument-specific parameters (string offsets, fret count) to support multiple
instruments with shared logic:

```typescript
export function createFretboardHelpers(musicData) {
  const { notes, naturalNotes, stringOffsets, fretCount, noteMatchesInput } = musicData;
  return {
    getNoteAtPosition(string, fret) { ... },
    checkFretboardAnswer(currentNote, input) { ... },
    // ...
  };
}
```

#### Instrument Configs

Fretted instrument modes are driven by config objects in `music-data.ts`:

```typescript
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

A single `FretboardMode` Preact component in `src/ui/modes/fretboard-mode.tsx`
is parameterized by `Instrument`. In `app.ts`, `registerFretboardMode()` passes
the instrument config as a prop. To add a new fretted instrument, define a
config object and register it with a one-line call.

### Stats Display Pattern

Preact `StatsTable` and `StatsGrid` components in `src/ui/stats.tsx` render
stats visualizations. Each mode passes rows/columns and the adaptive selector.
The `StatsToggle` component manages the Recall/Speed toggle.

Color helpers in `stats-display.ts` (pure functions, no DOM):

- `getAutomaticityColor(auto)` — automaticity-based heatmap color
- `getSpeedHeatmapColor(ms, baseline)` — speed-based heatmap color
- `getStatsCellColor(selector, itemId, statsMode, baseline)` — unified cell
  coloring
- `buildStatsLegend()` — color scale legend HTML string

### Consolidate Before Expanding

Shared algorithm in `recommendations.ts` gating progression to new item groups.
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

Lives in `adaptive.ts`. Creates a weighted random selector that prioritizes
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

Key functions: `deriveScaledConfig()`, `computeMedian()` in `adaptive.ts`;
`getCalibrationThresholds()`, `pickCalibrationButton()` in `quiz-engine.ts`.

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
  in the stats heatmap (`getAutomaticityColor` in `stats-display.ts`).
- The mastery message appears when **all** enabled items exceed this threshold
  (`checkAllAutomatic` in `adaptive.ts`).
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

All 11 quiz modes share the same DOM structure. Build-time HTML (generated by
`modeScreen()` in `html-helpers.ts`) provides the initial scaffold. At runtime,
Preact components render into the mode-screen container, producing the same
CSS class names for style parity. Phase classes on the mode container control
which section is visible.

For the design principles behind this layout, see
[layout-and-ia.md](design/layout-and-ia.md).

### Idle phase: Practice/Progress tabs

Every mode renders a two-tab idle layout via Preact components (`PracticeCard`,
`StatsTable`/`StatsGrid`, `GroupToggles`, etc.):

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

**Fretboard modes** (Guitar, Ukulele): Single `FretboardMode` component
parameterized by `Instrument`. Uses `StringToggles` + `NoteFilter` for scope,
fretboard SVG heatmap in Progress tab.

**Group modes** (Semitone Math, Interval Math, Key Signatures, Scale Degrees,
Diatonic Chords, Chord Spelling): Use `GroupToggles` component for scope.
Each mode uses `computeRecommendations()` for progressive unlocking.

**Simple modes** (Note Semitones, Interval Semitones): No scope controls — all
items always enabled. Recommendation and mastery elements fold into the status
zone (no separate scope zone), avoiding double dividers.

**Speed Tap**: Uses `NoteFilter` for scope. The fretboard lives in the quiz
area (not in idle) and is hidden/shown via `.fretboard-hidden` during
start/stop.

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

**Reuse shared infrastructure.** Shared hooks (`useQuizEngine`,
`useScopeState`, `useLearnerModel`), shared components (`ModeScreen`,
`PracticeCard`, `NoteButtons`, `StatsTable`), `computeRecommendations()`,
`createAdaptiveKeyHandler()`. A new mode should feel like a natural extension,
not a separate app.

**Consistency over accommodation.** When a mode behaves differently, ask "should
it?" not "how do we support that?" Change the outlier to match the standard
rather than adding complexity. Per-mode flags are a code smell.

Step-by-step checklist:

1. **Create** `src/ui/modes/{mode}-mode.tsx` — a Preact component composing
   shared hooks and UI components (~100-300 lines)
2. **Define** item ID format, `allItemIds`, and pure logic functions
   (`getQuestion`, `checkAnswer`, `getEnabledItems`)
3. **Compose hooks**: `useScopeState` (if scope controls needed),
   `useLearnerModel`, `useQuizEngine`
4. **Groups** (if applicable): use `computeRecommendations()` from
   `recommendations.ts` for progressive unlocking
5. **Stats**: use `StatsTable` or `StatsGrid` component from `src/ui/stats.tsx`
6. **HTML**: add mode screen in `modeScreens()` in `src/build-template.ts`
   (container div), and nav button in `HOME_SCREEN_HTML`
7. **Register** mode in `app.ts` with `registerPreactMode()`
8. **Tests**: create `src/{mode}_test.ts` if pure logic was extracted
9. **Accidentals**: determine which naming convention applies (see
   [accidental-conventions.md](accidental-conventions.md)) and update that
   guide's mode table
10. **CLAUDE.md**: update quiz modes table with item count, answer type, and ID
    format
11. **Version**: bump `VERSION` in `src/build-template.ts`
