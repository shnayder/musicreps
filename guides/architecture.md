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
  music-data.ts            ← NOTES, INTERVALS, helpers, input validators
  recommendations.ts       ← Consolidate-before-expanding algorithm
  types.ts                 ← Shared type definitions (zero runtime)

Engine layer:
  quiz-engine-state.ts     ← Pure engine state transitions (idle/active/round-complete)
  quiz-engine.ts           ← Keyboard handlers, calibration utilities
    imports: music-data

Display layer:
  stats-display.ts         ← Heatmap color functions, legend builder
  mode-ui-state.ts         ← Practice summary computation
  quiz-fretboard-state.ts  ← Pure fretboard helpers (factory pattern)
    imports: music-data

Mode logic layer:
  mode-utils.ts              ← Shared ID parsing/building, stats row helpers
    imports: music-data
  modes/{name}/logic.ts      ← Per-mode pure logic (question, answer, items, groups)
    imports: music-data, mode-utils
  modes/{name}/definition.ts ← Declarative mode definition (ModeDefinition<Q>)
    imports: ./logic, music-data

Hooks layer:
  hooks/use-quiz-engine.ts   ← Quiz engine lifecycle (wraps quiz-engine-state)
    imports: quiz-engine-state, adaptive
  hooks/use-scope-state.ts   ← Scope persistence (localStorage)
  hooks/use-learner-model.ts ← Adaptive selector + storage
    imports: adaptive
  hooks/use-group-scope.ts   ← Group scope + recommendations (wraps use-scope-state)
    imports: use-scope-state, recommendations, mode-ui-state
  hooks/use-mode-lifecycle.ts ← Navigation activate/deactivate registration
    imports: use-quiz-engine, use-learner-model
  hooks/use-key-handler.ts   ← Keyboard event attachment
  hooks/use-phase-class.ts   ← Phase-to-CSS-class sync
  hooks/use-round-summary.ts ← Round-complete derived state + stats selector
  declarative/types.ts       ← ModeDefinition, ButtonsDef, ScopeDef, StatsDef

UI layer:
  ui/mode-screen.tsx         ← Structural components (ModeScreen, QuizArea, etc.)
  ui/buttons.tsx             ← Answer button components
  ui/scope.tsx               ← Scope control components (toggles, filters)
  ui/stats.tsx               ← Stats table/grid/legend components
    imports: stats-display
  declarative/generic-mode.tsx ← GenericMode: interprets ModeDefinition → full UI
    imports: hooks, ui components, declarative/types
  ui/interactive-fretboard.tsx ← Reusable tappable fretboard component
    imports: html-helpers, declarative/types

App layer:
  navigation.ts            ← Home screen, mode switching
  settings.ts              ← Settings modal
  app.ts                   ← Entry point: registers modes, starts navigation
```

**Layers**: Foundation (adaptive, music-data, recommendations) → Engine (state
transitions) → Display (stats, practice summaries) → Mode Logic (pure per-mode
functions) → Hooks (Preact wrappers) → UI (components + mode compositions) →
App init.

**Enforced by tests.** `src/architecture_test.ts` uses `deno info --json` to
build the real import graph, then asserts layer boundaries: no cycles, no
cross-mode imports, foundation only imports foundation, engine only imports
foundation + engine, display only imports foundation + display, hooks/UI don't
import from modes or app. Every source file must be classified into a layer —
adding a new file without classifying it fails the test. See
[development.md](development.md#architecture-test) for details.

## Build System

### esbuild Bundling

Source files are standard ES modules with `import`/`export`. esbuild bundles
them from the entry point (`src/app.ts`) into a single IIFE — no globals leak
into the browser scope. `main.ts` (Deno) shells out to esbuild CLI via
`Deno.Command`. Tests import the same source files directly.

### Shared Template (`src/build-template.ts`)

The HTML shell lives in `src/build-template.ts`. It assembles the page with empty mode container divs (derived from `TRACKS`), inlined CSS and JS. `main.ts` imports from it:

```typescript
import { assembleHTML, SERVICE_WORKER } from './src/build-template.ts';
```

Key exports:

| Export                  | Purpose                                   |
| ----------------------- | ----------------------------------------- |
| `assembleHTML(css, js)` | Assembles the complete index.html         |
| `SERVICE_WORKER`        | Service worker JS string                  |
| `HOME_SCREEN_HTML`      | Home screen markup (`__VERSION__` placeholder) |

### Adding a New Source File

1. Create `src/new-file.ts` with proper `import`/`export` statements
2. Import it from the file(s) that need it — esbuild handles the rest
3. Add it to the correct layer set in `src/architecture_test.ts` (e.g.
   `FOUNDATION`, `ENGINE`, `DISPLAY`, `APP`, `TOOL`, or `BUILD_TIME`) — the test
   will fail if the file isn't classified

### Screenshot Fixtures

`src/fixtures/` contains shared state fixtures for deterministic screenshots.
Leaf fixtures (feedback, timer, session, round-complete) are plain data objects;
page-level fixtures compose them into `EngineState` + timer overrides using the
pure functions from `quiz-engine-state.ts`.

The `useQuizEngine` hook accepts an optional `fixtureTarget` element. When
`?fixtures` is in the URL, it listens for `__fixture__` custom events on the
container and applies the state override. `scripts/take-screenshots.ts` uses
this to capture screenshots by dispatching fixtures — no clicking needed.

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
- `quiz-fretboard-state.ts`: pure helpers for note lookup, answer checking, item
  enumeration — consumed by fretboard mode component

**When to use it**: Any logic that affects UI state and could benefit from
testability. Pure state modules get the `*-state.ts` suffix.

### Declarative Modes (all 11 modes)

All quiz modes use the **declarative system**: a `ModeDefinition<Q>` data
object describes what varies (item space, question logic, answer buttons, scope,
stats), and `GenericMode` handles all shared hook composition and rendering.
Three answer variants: single (`answer`), sequential (`sequential`), and
multi-tap (`multiTap`).

A typical mode definition is 20–100 lines in `src/modes/{name}/definition.ts`:

```typescript
export const SEMITONE_MATH_DEF: ModeDefinition<Question> = {
  id: 'semitoneMath',
  name: 'Semitone Math',
  namespace: 'semitoneMath',
  description: MODE_DESCRIPTIONS.semitoneMath,
  beforeAfter: MODE_BEFORE_AFTER.semitoneMath,
  itemNoun: 'items',
  allItems: ALL_ITEMS,
  getQuestion,
  getPromptText: (q) => q.promptText,
  answer: {
    getExpectedValue: (q) => q.answer.name,
    comparison: 'note-enharmonic',
    getDisplayAnswer: (q) => displayNote(pickAccidentalName(q.answer.displayName, q.useFlats)),
  },
  validateInput: (_, input) => isValidNoteInput(input),
  buttons: { kind: 'note' },
  scope: {
    kind: 'groups',
    groups: DISTANCE_GROUPS,
    getItemIdsForGroup,
    allGroupIndices: ALL_GROUP_INDICES,
    storageKey: 'semitoneMath_enabledGroups',
    scopeLabel: 'Distances',
    defaultEnabled: [0],
    formatLabel: (groups) => { /* ... */ },
  },
  stats: { kind: 'grid', colLabels: GRID_COL_LABELS, getItemId: getGridItemId },
};
```

**GenericMode** (`src/declarative/generic-mode.tsx`) interprets the definition:
1. Calls shared hooks (`useLearnerModel`, `useGroupScope`, `useQuizEngine`, etc.)
2. Renders an `<AnswerInput>` text field for keyboard answers + buttons for tap
3. Handles phase-conditional rendering (idle → practice/progress tabs, active →
   quiz area, round-complete → summary)

**ModeController** — modes needing custom rendering provide a `useController`
hook returning a `ModeController<Q>` with optional overrides: `renderPrompt` (SVG
fretboard), `renderStats` (SVG heatmap), `handleKey` (custom keyboard handler),
`onAnswer`/`onStart`/`onStop` lifecycle hooks. Fretboard modes use this for SVG
prompt rendering while reusing all other GenericMode infrastructure.

**Keyboard input: text field.** Instead of per-response-type keyboard handlers
(note narrowing, digit buffering, keysig combos), all keyboard input goes
through a single `<input>` element — type the answer, press Enter. Buttons
remain for tap/click (important on mobile). An optional `validateInput` on the
definition rejects garbage input with a shake animation instead of scoring it
wrong.

**Input validation: correct normalization, exact acceptance.** Validators
(`isValidNoteInput`, `isValidIntervalInput`, `isValidKeysigInput`,
`isValidNumeralInput`) must accept exactly the strings that the answer spec can
score correctly — nothing more, nothing less. The current implementations use
`Set` lookups derived from the actual data arrays (`NOTES`, `INTERVALS`,
`MAJOR_KEYS`, `DIATONIC_CHORDS`), but any implementation (sets, iteration,
regex) is fine as long as it meets that contract.

**Registration** (in `app.ts`):

```typescript
registerDeclarativeMode(SEMITONE_MATH_DEF);
```

**Key hooks (shared by all modes):**

- `useGroupScope` — wraps scope persistence, enabled-item derivation,
  recommendations, and practicing-label formatting into one call. Returns stable
  ref-backed `getEnabledItems`/`getPracticingLabel` functions that never change
  identity, so they can be used in `engineConfig` without adding scope to the
  dependency array. Used by the 6 group-based modes.
- `useModeLifecycle` — registers the activate/deactivate handle with navigation.
  Activate syncs the motor baseline and updates the idle message; deactivate
  stops the engine, runs mode-specific cleanup, and clears calibration. Used by
  all quiz mode components.

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

### Recommendation Pipeline (v4)

Shared algorithm in `recommendations.ts` deciding which item groups to practice.
Used by 6 different systems: fretboard strings, semitone math groups, interval
math groups, key signature groups, scale degree groups, diatonic chord groups,
chord spelling groups.

```javascript
computeRecommendations(selector, allIndices, getItemIds, config, options);
// Returns { recommended: Set, enabled: Set|null, levelRecs, expandIndex, ... }
```

See [Algorithms](#recommendation-pipeline-v4-1) below for the full algorithm.

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

All modes share a baseline via a **motor task type** system. Modes declare a
`motorTaskType` (default `'note-button'`); the baseline is stored as
`motorBaseline_{taskType}`. Completing calibration in any mode makes it
available to all modes sharing that task type.

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
`getCalibrationThresholds()`, `pickCalibrationNote()` in `quiz-engine.ts`.

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
- Subsequent correct: freshness-modulated growth `stability * (1 + growthMax * (1 - freshness))`
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

### Recommendation Pipeline (v4)

The recommendation algorithm uses per-level status to decide what to practice:

1. **Partition** groups into "started" (at least 1 item seen) and "unstarted"
   (all items unseen)
2. **Per-level status**: compute P10 speed and P10 freshness for each started
   level. Speed labels: Automatic (≥0.9), Learned (≥0.7), Learning (≥0.3),
   Hesitant (>0), Starting (=0). Needs review when P10 freshness < 0.5.
3. **Build recommendations** in priority order:
   - **Review** — any level needs review → recommend reviewing that level
   - **Practice** — any level Starting/Hesitant/Learning → recommend practicing
   - **Expand** — expansion gate open + unstarted level available → start next
   - **Automate** — any level Learned (not Automatic) → recommend drilling
4. **Expansion gate** opens when all started levels ≥ Learned (P10 speed ≥ 0.7)
   AND none need review. If ≥3 Learned levels, expansion is deprioritized
   (placed after automate) to encourage automating before expanding further.
5. **Item budget**: `maxWorkItems` (default 30) limits how many items are
   included. Recs are added in priority order until budget is exhausted.
6. **First launch**: no data → recommend the first unstarted group (respecting
   `sortUnstarted` if provided) with `enabled` populated so "Use suggestion"
   works immediately

**Ownership rule**: `computeRecommendations()` owns _all_ suggestion logic,
including the first-launch default. The result's `levelRecs` array drives
both in-skill suggestion text and home screen cue labels, keeping them in sync.

### Distance Group Progression (Math Modes)

264 items per math mode, grouped into 6 distance groups unlocked progressively.
Uses the recommendation pipeline (v4). Default: group 0 only.

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

All 11 quiz modes share the same DOM structure. Build-time HTML provides empty
`<div class="mode-screen" id="mode-{id}">` containers (derived from `TRACKS`
in `mode-catalog.ts`). At runtime, Preact renders all UI into these containers.
Phase classes on the mode container control which section is visible.

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
.tab-progress (.tab-content)               ← hidden until clicked
  .stats-container                         ← heatmap grid/table + legend
  .baseline-info                           ← speed check section
    .baseline-header                       ← "Speed check"
    .baseline-metric                       ← "Response time  0.5s"
    .baseline-explanation                  ← threshold explanation
    .baseline-rerun-btn                    ← "Redo speed check"
```

### Mode categories

**Fretboard modes** (Guitar, Ukulele): Single `FretboardMode` component
parameterized by `Instrument`. Uses `StringToggles` + `NoteFilter` for scope,
fretboard SVG heatmap in Progress tab.

**Group modes** (Semitone Math, Interval Math, Key Signatures, Scale Degrees,
Diatonic Chords, Chord Spelling): Use `useGroupScope` hook for scope state,
recommendations, and practicing label. Use `GroupToggles` component for UI.

**Simple modes** (Note Semitones, Interval Semitones): No scope controls — all
items always enabled. Recommendation and mastery elements fold into the status
zone (no separate scope zone), avoiding double dividers.

**Speed Tap**: Uses `NoteFilter` for scope. The fretboard lives in the quiz area
(not in idle) and is hidden/shown via `.fretboard-hidden` during start/stop.

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

**Prefer declarative.** Most new modes should use a `ModeDefinition` — write
~30 lines of data, get all hook composition, rendering, and keyboard input for
free. Only write a hand-written component if the mode needs truly custom
response interfaces (like sequential note entry or fretboard-as-response).

**Consistency over accommodation.** When a mode behaves differently, ask "should
it?" not "how do we support that?" Change the outlier to match the standard
rather than adding complexity. Per-mode flags are a code smell.

### Declarative mode checklist (preferred)

1. **Create** `src/modes/{name}/logic.ts` — pure functions for question
   generation, answer checking, item IDs, group definitions. No DOM, no hooks.
2. **Create** `src/modes/{name}/definition.ts` — a `ModeDefinition<Q>` object
   (~20-50 lines) specifying buttons, scope, stats, and pure logic references
3. **Input validation** (if text input is used): add a `validateInput` function
   that accepts exactly the strings the answer spec can score. Derive from the
   source data arrays (e.g., `NOTES`, `INTERVALS`, `DIATONIC_CHORDS`).
4. **HTML**: add the mode to a track in `TRACKS` in `src/mode-catalog.ts`
   (container div is auto-generated from track skills)
5. **Register** in `app.ts` with `registerDeclarativeMode(YOUR_DEF)`
6. **Tests**: create `src/modes/{name}/logic_test.ts` for the pure logic
7. **Architecture test**: `logic.ts` and `definition.ts` files are
   auto-classified by path (`src/modes/` prefix)
8. **Accidentals**: determine which naming convention applies (see
   [accidental-conventions.md](accidental-conventions.md)) and update that
   guide's mode table
9. **CLAUDE.md**: update quiz modes table with item count, answer type, and ID
   format

### Multi-tap mode checklist

For modes where the user taps multiple targets on a spatial surface (fretboard):

1. **Create** `src/modes/{name}/logic.ts` — pure logic with `evaluate()`,
   `getTargets()`, group helpers
2. **Create** `src/modes/{name}/definition.ts` — `ModeDefinition<Q>` with
   `multiTap` variant, `buttons: { kind: 'none' }`, and optional `useController`
   for custom stats rendering
3. **Register** in `app.ts` with `registerDeclarativeMode()`
4. Steps 4-9 from the declarative checklist above
