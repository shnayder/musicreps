# Plan: Migrate to Preact Component Architecture

## Context

The mode-definition refactor extracted pure logic from DOM code into 10
`ModeDefinition` factories. A shared `ModeController` (983 lines) interprets
these definitions and handles all DOM lifecycle. This works but is rigid:
adding a new prompt type or scope control means extending a discriminated union
and adding a case to the controller.

The architecture vision (`guides/architecture-vision.md`) describes the target:
Preact components composing shared UI pieces with pure mode logic. Each mode is
~30-50 lines of composition. No mega-interfaces, no discriminated unions.

This plan implements that migration bottom-up and incrementally. Old
ModeController modes and new Preact modes coexist during the transition.

## Strategy

**Bottom-up, incremental.** Build leaf components first, then structural
components, then hooks, then migrate modes one at a time. Each phase produces
working, testable output. A component preview page enables visual iteration.

**Coexistence.** Navigation (`src/navigation.ts`) manages modes via
`{ init, activate, deactivate }`. Preact modes register the same interface:
`init()` mounts the component, `activate()`/`deactivate()` signal it. Both
old and new modes work side by side.

**Testing.** Two complementary approaches:
1. **Render-to-string tests** — `preact-render-to-string` in Deno test runner.
   Render each component with fixture data, assert on HTML structure/content.
   Fast, no browser, catches DOM structure drift and missing CSS classes.
2. **Screenshot review page** — Extend existing `scripts/take-screenshots.ts`
   to capture "before" screenshots (baseline), then after each migration
   phase capture "after" screenshots. Generate a static HTML page showing
   before/after pairs side by side for quick human review. Also useful for
   design iteration later.

## Critical Files

| File | Role | What changes |
|---|---|---|
| `main.ts:26-44` | esbuild invocation | Add JSX flags |
| `deno.json` | Compiler + task config | Add JSX options, .tsx globs |
| `src/app.ts` | Mode registration | Swap ModeController for Preact per mode |
| `src/mode-controller.ts` (983 lines) | Shared controller | Decomposed into components + hooks, then deleted |
| `src/quiz-engine.ts` + `quiz-engine-state.ts` | Engine lifecycle | Wrapped by `useQuizEngine` hook |
| `src/modes/*.ts` | Mode definitions | Pure logic extracted, definitions eventually deleted |
| `src/html-helpers.ts` | Build-time HTML | Button generators replaced by components |
| `src/build-template.ts` | HTML template | Mode screens simplified to empty containers |
| `src/stats-display.ts` | Stats rendering | Color functions kept; rendering replaced by components |
| `src/navigation.ts` | Mode switching | Interface unchanged; implementations vary |

## Phases

### Phase 0: Preact Build Foundation

Configure esbuild and Deno to compile TSX. Verify Preact renders alongside
existing vanilla JS.

- [ ] Add JSX config to `deno.json`:
  ```json
  "compilerOptions": {
    "lib": ["deno.window", "dom", "dom.iterable"],
    "jsx": "react-jsx",
    "jsxImportSource": "preact"
  }
  ```
- [ ] Add esbuild JSX flags in `main.ts` `bundleJS()` (line 30-33):
  `'--jsx=automatic'`, `'--jsx-import-source=preact'`
- [ ] Update `deno.json` tasks to include `.tsx` files:
  `"check": "deno check src/**/*.ts src/**/*.tsx"`
  `"ok":` same pattern
- [ ] Create smoke-test `src/ui/smoke.tsx` — render a trivial Preact element,
  import from app.ts, verify build works
- [ ] `deno task ok` passes, app runs with Preact element visible
- [ ] Remove smoke test, bump version

**Risk:** Deno JSX config may need `"jsxFactory"` / `"jsxFragmentFactory"`
instead of automatic transform depending on Deno version. Test early.

### Phase 1: Component Preview + Screenshot Review Pages

A live dev page for rendering Preact components with mock data, plus a
screenshot comparison page for visual regression checks.

- [ ] Create `src/ui/preview.tsx` — entry point rendering component previews
- [ ] Add second esbuild entry in `main.ts` for preview bundle
- [ ] Add `/preview` route to dev server
- [ ] Generate `guides/design/components-preview.html` (loads styles.css + preview bundle)
- [ ] Render initial previews: NoteButtons + StatsGrid with mock data
- [ ] Add `preact-render-to-string` to package.json (for Deno test runner)
- [ ] Capture baseline screenshots: run existing `scripts/take-screenshots.ts`
  and save output to `screenshots/baseline/`
- [ ] Create `scripts/build-screenshot-review.ts` — generates a static HTML
  page (`guides/design/screenshot-review.html`) showing baseline vs current
  screenshots side by side for each mode/phase
- [ ] Add `deno task screenshots` and `deno task review` tasks

**Deliverables:**
- `http://localhost:8001/preview` shows components with mock data
- `screenshots/baseline/` contains reference images for all modes
- `guides/design/screenshot-review.html` shows before/after pairs

### Phase 2: Leaf Components

Build smallest, self-contained components. Each renderable independently with
mock data on the preview page.

**Answer buttons** (replace `html-helpers.ts` generators):

| Component | Replaces | Est. lines |
|---|---|---|
| `NoteButtons` | `pianoNoteButtons()` + `noteAnswerButtons()` | ~30 |
| `NumberButtons` | `numberButtons()` | ~15 |
| `IntervalButtons` | `intervalAnswerButtons()` | ~20 |
| `KeysigButtons` | `keysigAnswerButtons()` | ~20 |
| `DegreeButtons` | `degreeAnswerButtons()` | ~15 |
| `NumeralButtons` | `numeralAnswerButtons()` | ~15 |

**Stats** (replace `stats-display.ts` rendering):

| Component | Replaces | Est. lines |
|---|---|---|
| `StatsTable` | `renderStatsTable()` | ~40 |
| `StatsGrid` | `renderStatsGrid()` | ~40 |
| `StatsLegend` | `buildStatsLegend()` | ~25 |
| `StatsToggle` | `createStatsControls()` toggle | ~15 |

**Scope controls** (replace `mode-controller.ts` wireScope):

| Component | Replaces | Est. lines |
|---|---|---|
| `GroupToggles` | Distance toggle wiring | ~30 |
| `StringToggles` | String toggle wiring | ~25 |
| `NoteFilter` | Notes toggle wiring | ~25 |

**Quiz feedback:**

| Component | Replaces | Est. lines |
|---|---|---|
| `TextPrompt` | `quizPrompt.textContent = ...` | ~5 |
| `FeedbackDisplay` | feedback + time + hint rendering | ~15 |
| `CountdownBar` | countdown fill rendering | ~10 |

- [ ] Create `src/ui/` directory with component files
- [ ] Build ~17 leaf components (~345 lines total)
- [ ] Add all to preview page with mock data
- [ ] Write render-to-string tests with fixture data for each component
- [ ] Verify visual parity with existing rendering on preview page

**Design notes:**
- Pure color functions (`getAutomaticityColor`, etc.) from `stats-display.ts`
  are imported directly — no wrapping needed.
- `NoteButtons` reads notation setting and calls `displayNote()` on labels.
  `onAnswer` passes canonical note name, not display label.
- Components emit the same CSS class names as current build-time HTML.

### Phase 3: Structural Components

Layout components that compose leaf components into mode screen structure.

| Component | Replaces | Est. lines |
|---|---|---|
| `ModeScreen` | `modeScreen()` HTML + phase classes | ~30 |
| `ModeTopBar` | mode-back-btn + mode-title | ~10 |
| `TabbedIdle` | Tab switching logic | ~25 |
| `PracticeSummary` | `renderIdleUI()` practice status | ~25 |
| `Recommendation` | Recommendation text + button | ~15 |
| `StartButton` | start-btn + session-summary | ~10 |
| `QuizSession` | Quiz header + content wrapper | ~30 |
| `RoundComplete` | Round-complete display | ~25 |
| `SessionInfo` | quiz-info-context/time/count | ~10 |

- [ ] Build 9 structural components (~180 lines total)
- [ ] Compose on preview page to show full mode screen in each phase
  (idle/practice, idle/progress, active, round-complete)
- [ ] Render-to-string tests for composed layouts
- [ ] Verify composed preview matches existing `moments.html` visuals

### Phase 4: Shared Hooks

Hooks wrapping existing pure logic with Preact reactivity. These replace the
state management portions of `mode-controller.ts` and `quiz-engine.ts`.

#### `useScopeState(scopeSpec): [ScopeState, ScopeActions]`
Wraps scope loading/saving from `mode-controller.ts` lines 47-120.
~60 lines.

#### `useLearnerModel(namespace, allItemIds): LearnerModel`
Wraps `createAdaptiveSelector()` + storage + baseline loading.
~40 lines.

#### `useQuizEngine(logic, learner): EngineState & Actions`
The most complex hook. Wraps `quiz-engine-state.ts` pure transitions +
timer + item selection. ~200 lines.

**Engine hook design:**
- Internal `useState<EngineState>` for pure state
- `useEffect` for round timer interval (200ms tick, cleanup on phase change)
- `useEffect` for auto-advance timeout after answer
- `useCallback` for each action (start, stop, submitAnswer, nextQuestion)
- `currentQuestion` derived from `logic.getQuestion(state.currentItemId)`
- Keyboard handler attached/detached via `useEffect` on mount/unmount

**Calibration:** Keep current `runCalibration()` as imperative escape hatch
called from `useEffect` when `phase === 'calibrating'`. Refactor to
state-driven later.

#### `useKeyHandler(handler, active)`
Attaches/detaches document keydown listener. ~30 lines.

- [ ] Create `src/hooks/` directory
- [ ] Build 4 hooks (~330 lines total)
- [ ] Test hooks on preview page with a "demo mode" wiring
- [ ] Unit tests for scope state and engine state transitions

### Phase 5: First Mode Migration (Note Semitones)

Migrate the simplest mode end-to-end. No scope controls, bidirectional
response, table stats.

- [ ] Create `BidirectionalButtons` component (~30 lines)
- [ ] Extract pure logic from `noteSemitonesDefinition()` into a function
  the component calls directly (getQuestion, checkAnswer, allItemIds, etc.)
- [ ] Create `src/ui/modes/NoteSemitonesMode.tsx` (~50 lines)
- [ ] Update `src/app.ts`: mount Preact component for Note Semitones,
  register with navigation via same `{ init, activate, deactivate }` interface
- [ ] Keep build-template mode-screen container div (Preact renders into it)
- [ ] Render-to-string tests for the composed mode component
- [ ] Verify: all 9 other modes still work unchanged
- [ ] Verify: Note Semitones works end-to-end (quiz, feedback, stats, keyboard)
- [ ] Capture "after" screenshots, generate screenshot review page, check for
  visual regressions
- [ ] `deno task ok`, bump version

**Coexistence detail:** In `app.ts`, Note Semitones registers differently:
```typescript
// Preact mode
const nsContainer = document.getElementById('mode-noteSemitones')!;
nav.registerMode('noteSemitones', {
  name: 'Note ↔ Semitones',
  init() { render(h(NoteSemitonesMode, {}), nsContainer); },
  activate() { /* component auto-refreshes */ },
  deactivate() { /* component stops engine on visibility change */ },
});
```

### Phase 6: Remaining Modes

Migrate one at a time, simplest first:

| Order | Mode | Complexity | Key challenge |
|---|---|---|---|
| 1 | Interval Semitones | Low | Nearly identical to Note Semitones |
| 2 | Semitone Math | Low | GroupToggles + Recommendation |
| 3 | Interval Math | Low | Same as Semitone Math |
| 4 | Key Signatures | Medium | Bidirectional + groups |
| 5 | Scale Degrees | Medium | Bidirectional + groups |
| 6 | Diatonic Chords | Medium | Bidirectional + groups |
| 7 | Guitar Fretboard | High | Custom SVG prompt, FretboardHeatmap, HoverCard |
| 8 | Ukulele Fretboard | Low (after Guitar) | Same component, different instrument |
| 9 | Chord Spelling | High | Sequential response, ChordSlots component |
| 10 | Speed Tap | High | Spatial response, fretboard tapping |

For each mode:
- [ ] Create mode component in `src/ui/modes/`
- [ ] Create any mode-specific components not yet built
- [ ] Update `app.ts` registration
- [ ] Manual test all interactions
- [ ] `deno task ok`, bump version

### Phase 7: Cleanup

- [ ] Delete `src/mode-controller.ts` (983 lines)
- [ ] Delete ModeDefinition + related types from `src/types.ts`
- [ ] Simplify `src/quiz-engine.ts` — keep pure key handlers as utilities,
  remove monolithic `createQuizEngine()`
- [ ] Simplify `src/html-helpers.ts` — remove button generators (keep
  `fretboardSVG()` if still used for build-time SVG)
- [ ] Simplify `src/build-template.ts` — mode screens become empty container
  divs
- [ ] Delete old `src/modes/*.ts` definition files (logic already extracted)
- [ ] Update `CLAUDE.md`, `guides/architecture.md`, `guides/coding-style.md`
- [ ] `deno task ok`, bump major version (v8.0)

**Estimated net:** ~2,370 lines removed, ~1,430 lines added. ~940 line reduction.

## Key Risks

| Risk | Mitigation |
|---|---|
| CSS mismatch — Preact DOM differs from build-time HTML | Emit same class names. Preview page for visual comparison. |
| Keyboard handler conflicts during coexistence | Only active mode's handler attached. `useEffect` cleanup. |
| Timer leaks on unmount | `useEffect` return cleanup. `useRef` for timer IDs. |
| Calibration imperative code inside hooks | Isolate in escape hatch. Refactor to state-driven later. |
| `deno check` failing on .tsx | Test JSX config first in Phase 0. |
| esbuild JSX flag compatibility | Verify with esbuild 0.27.3 before proceeding. |

## Verification

Each phase:
1. `deno task ok` (lint + fmt + type-check + test + build)
2. Render-to-string tests pass for all new components
3. Screenshot review page checked for visual regressions (run
   `take-screenshots.ts`, rebuild review page, skim before/after pairs)
4. Keyboard shortcuts work in both old and new modes
5. Manual spot-check in browser for any mode that changed
