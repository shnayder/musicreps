# Playwright Testing Strategy for musicreps

**Status:** Draft — needs review and refinement

## Context

The app has strong unit test coverage (~1119 tests across 24 files) for pure
logic, state machines, algorithms, and music theory. It has 1 E2E test
(skip/unskip recommendations) and a deterministic screenshot system. But **the
glue between these layers — the runtime behavior users actually experience — has
no automated testing.** As the app evolves, regressions in quiz flow, navigation,
and persistence will be invisible to the existing test suite.

---

## 1. Coverage Gap Analysis (ranked by fragility)

### What IS well tested today

- Pure mode logic (all 10 `logic_test.ts` files) — question generation, answer
  checking, item IDs, grouping
- Pure engine state transitions (`quiz-engine-state_test.ts`)
- Adaptive selector (`adaptive_test.ts`) — EWMA, weighted selection, spaced
  repetition
- Recommendations (`recommendations_test.ts`) — consolidate-before-expanding
- Music data, stats display, architecture validation, answer checking, hooks
- Keyboard handlers (`quiz-engine_test.ts`) — note/solfège/adaptive key handlers
  with synthetic KeyboardEvents
- E2E: skip/unskip recommendation cycle (Chromium + WebKit)
- Visual: deterministic fixture-based screenshots for all modes and phases

### What is NOT tested (gaps ranked by fragility)

| Gap | Fragility | Rationale |
|-----|-----------|-----------|
| **Full quiz flow** (start → answer → feedback → next → round-complete) | CRITICAL | Core UX. `GenericMode` + `useQuizEngine` + phase classes + timer interact in ways unit tests can't cover. Any change to `generic-mode.tsx` or `use-quiz-engine.ts` risks silent breakage. |
| **Navigation lifecycle** (home ↔ mode, init/activate/deactivate, Escape) | HIGH | `navigation.ts` does direct DOM classList + focus manipulation. A regression breaks all 11 modes at once. |
| **localStorage persistence & recovery across reloads** | HIGH | Scope state, learner model, motor baseline, notation all persist. Schema changes or corrupt data silently break modes. No automated testing of reload recovery. |
| **Text input + Enter submission** (AnswerInput) | MEDIUM-HIGH | Primary input path for all 11 modes (textbox + Enter). Involves focus management, Enter handling, shake animation on invalid input, disabled state during feedback. Not tested through real DOM. |
| **Round timer** (60s expiry, last-question mode, 30s cap) | MEDIUM-HIGH | `setInterval` with mutable refs, duration snapshotting, last-question timeout. Complex edge cases with no testing. |
| **Settings/notation switching propagation** | MEDIUM | Toggling letter/solfège triggers `refreshNoteButtonLabels` (DOM queries). If selectors drift, buttons silently keep old labels. |
| **Sequential input** (chord spelling) | MEDIUM | Only sequential mode. Multi-note collection, batch text parsing, per-entry evaluation — architecturally distinct from all other modes. |
| **Phase-to-CSS class sync + focus** | MEDIUM | `usePhaseClass` sets CSS classes; `PHASE_FOCUS_TARGETS` moves focus. Desync breaks UX. |
| **Group toggle & recommendation application** | LOW-MEDIUM | Skip/unskip is tested. Toggling groups on/off and applying recommendations are not. |
| **Calibration flow** | LOW | Three-phase calibration. Changes are rare. |

---

## 2. What Needs Playwright E2E Tests

### Suite 1: Core Quiz Flow (PRIORITY 1 — highest ROI)

**`tests/e2e/quiz-flow.test.ts`** — Tests the full quiz engine lifecycle
through `GenericMode`.

Use a simple declarative mode (e.g., `noteSemitones` or `semitoneMath`) to avoid
fretboard-specific complexity. Seed `motorBaseline` to skip calibration.

1. **Start quiz, answer via button, see feedback, advance** — Click Start, click
   correct answer button, verify feedback text ("Correct!"), press Space, verify
   new question + count increment.
2. **Answer incorrectly, see correct answer revealed** — Click wrong answer,
   verify feedback shows correct answer, verify correct button gets highlight
   class.
3. **Answer via text input + Enter** — Type answer in AnswerInput, press Enter,
   verify submission and feedback. Type invalid input, verify rejection (shake
   class).
4. **Round completes after timer** — Answer questions until round-complete phase
   appears. Verify stats (count, accuracy). Press Continue → new round starts.
5. **Stop quiz mid-round with Escape** — Start quiz, press Escape, verify return
   to idle. Start again, verify clean state.
6. **Stop from round-complete screen** — Complete round, click Stop, verify idle.

These 6 tests cover: `useQuizEngine`, `GenericMode` rendering branches,
`usePhaseClass`, `AnswerInput`, timer, answer submission + feedback.

### Suite 2: Navigation Lifecycle (PRIORITY 2 — low effort, high coverage)

**`tests/e2e/navigation.test.ts`**

1. **Home → mode → home round trip** — Click mode button, verify `mode-active`
   class and home hidden. Click back, verify home visible. Check focus returns to
   mode button.
2. **Escape from idle mode → home** — Navigate to mode, Escape while idle →
   home.
3. **Escape during quiz → stops quiz, stays in mode** — Start quiz, Escape →
   idle phase, mode still active.
4. **Mode switching preserves scope** — Toggle groups in mode A, go home,
   navigate to mode B, go home, back to A → groups preserved.

### Suite 3: Persistence (PRIORITY 3 — low effort, catches schema drift)

**`tests/e2e/persistence.test.ts`**

1. **Scope persists across reload** — Disable a group, reload, verify still
   disabled.
2. **Learner data persists after answering** — Answer 3 questions, stop, reload,
   verify `adaptive_*` keys exist in localStorage with expected shape.
3. **Motor baseline persists** — Seed motorBaseline, reload, verify no
   calibration prompt on quiz start.
4. **Notation preference persists** — Switch to solfège, reload, verify solfège
   labels on buttons.
5. **Corrupt localStorage recovery** — Set invalid JSON in `enabledGroups` key,
   reload, verify mode loads without crash.

### Suite 4: Sequential Input / Chord Spelling (PRIORITY 4)

**`tests/e2e/chord-spelling.test.ts`**

1. **Button-by-button input** — Tap notes one at a time, verify sequential slots
   fill, verify evaluation on last note.
2. **Batch text input** — Type "C E G" in text field, Enter → all slots fill +
   feedback.
3. **Wrong note count** — Type "C E" for 3-note chord, Enter → rejection
   (shake).

### Not proposed as separate E2E suites (lower priority)

- **Settings/notation switching**: Could be 1–2 tests in persistence suite.
- **Calibration flow**: Rare changes, well-covered by screenshots.
- **Timer edge cases**: Timer refactoring (section 3) would make these
  unit-testable.

---

## 3. What Needs Refactoring for Unit Testability

Two areas contain testable logic entangled with browser APIs:

### a. Round timer → extract `RoundTimer` class

**File:** `src/hooks/use-quiz-engine.ts`

The timer start/stop/expiry/cap logic uses `setInterval`/`setTimeout` with
mutable refs. The `roundDurationSnapshotRef` and last-question cap timeout (30s)
are particularly fragile. Extract a `RoundTimer` with `start()`, `tick(now)`,
`expire()`, `snapshot()` returning `{pct, text, warning, expired,
lastQuestion}`. This makes all timer edge cases unit-testable without slow E2E
tests.

### b. Navigation state → extract pure transition logic

**File:** `src/navigation.ts`

The mode-switching logic (which mode is active, should we show home) is simple
but coupled to `document.getElementById`. Extracting the pure state
(`currentModeId` transitions) would help, but low priority since E2E tests cover
it well.

**Both are opportunistic** — do them when modifying those files, not as
standalone tasks.

---

## 4. What Stays Manual / Visual

| Area | Why |
|------|-----|
| **Visual design** (spacing, colors, fonts) | Screenshot system + iterate/capture workflow. Pixel-comparison tests would be brittle. |
| **Heatmap color gradients** | Unit tests cover color functions. Visual correctness needs human judgment. |
| **Mobile touch behavior** | `:active` on iOS, scrolling, viewport. Playwright touch emulation ≠ real device. |
| **Animation smoothness** | CSS transition timing is a perception issue. |
| **Fretboard SVG layout** | Screenshots capture deterministically. Layout changes are visually obvious. |
| **Service worker / PWA caching** | Too environment-specific for CI. |
| **Cross-browser rendering** | Existing WebKit skip-unskip test is sufficient. Manual Safari spot-checks for rendering. |

---

## 5. Test Architecture

### File organization

```
tests/e2e/
  helpers/
    server.ts              # dev server start/stop (extracted from skip-unskip)
    page-helpers.ts         # navigation, localStorage injection, assertions
    fixture-builders.ts     # builders wrapping generateLocalStorageData
  skip-unskip.test.ts      # existing
  quiz-flow.test.ts         # Suite 1: core quiz lifecycle
  navigation.test.ts        # Suite 2: home/mode switching
  persistence.test.ts       # Suite 3: localStorage round-trip
  chord-spelling.test.ts    # Suite 4: sequential mode
```

### Shared helpers

**`helpers/server.ts`** — Extract `startServer()` currently duplicated in
`skip-unskip.test.ts` and `take-screenshots.ts`. Both use identical dev-server
spawning with port detection.

**`helpers/page-helpers.ts`** — Lightweight helpers (not full page objects):

- `createTestPage(browser, baseUrl)` — context with 402x873 viewport
- `seedLocalStorage(page, data)` — inject entries + reload
- `navigateToMode(page, baseUrl, modeId)` — goto + click + wait for
  `mode-active`
- `startQuiz(page, modeSelector)` — click start, wait for `phase-active`
- `waitForFeedback(page, modeSelector)` — wait for feedback text to appear
- `advanceToNext(page)` — press Space, wait for question change

**`helpers/fixture-builders.ts`** — Wraps existing `generateLocalStorageData` +
adds:

- `buildMotorBaseline(namespace, value)`
- `buildEnabledGroups(storageKey, groups)`

### Dev server management

Follow existing pattern from `skip-unskip.test.ts`: single server per test file
(`before`/`after`), fresh browser context per test to avoid state leakage, port
auto-detection.

### CI integration

**Phase 1:** Keep E2E manual (`deno task e2e`), same as today. Add new test
files to the e2e task.

**Phase 2:** After suite stabilizes, add CI job running Suites 1–3 on Chromium
after build succeeds.

**Phase 3 (optional):** Run E2E against built `docs/` served statically (no dev
server).

### Browser matrix

**Chromium only for CI.** Existing WebKit skip-unskip test catches
WebKit-specific issues. Extending all tests to WebKit doubles CI time for
minimal value.

---

## 6. Implementation Order

| Step | What | Effort | Why this order |
|------|------|--------|----------------|
| 1 | Extract `helpers/server.ts` | LOW | Pay down duplication before adding test files |
| 2 | Build `helpers/page-helpers.ts` + `fixture-builders.ts` | LOW | Foundation for all new tests |
| 3 | **Quiz Flow** (Suite 1, 6 scenarios) | MEDIUM | Highest ROI — validates entire engine lifecycle |
| 4 | **Navigation** (Suite 2, 4 scenarios) | LOW | Simple, reuses helpers |
| 5 | **Persistence** (Suite 3, 5 scenarios) | LOW | Simple reload-and-check tests |
| 6 | **Chord Spelling** (Suite 4, 3 scenarios) | MEDIUM | Architecturally distinct mode |
| — | Refactor round timer (opportunistic) | MEDIUM | When modifying `use-quiz-engine.ts` |

### Key files

- `tests/e2e/skip-unskip.test.ts` — reference pattern for all new tests
- `src/hooks/use-quiz-engine.ts` — core engine hook (primary code under test for
  Suite 1)
- `src/declarative/generic-mode.tsx` — renders all declarative modes
- `src/quiz-engine.ts` — calibration helpers, note display utilities
- `src/fixtures/recommendation-scenarios.ts` — `generateLocalStorageData` to
  reuse in fixture builders

### Verification

- `deno task e2e` runs all E2E tests (update task to glob or chain all files)
- Each file runnable standalone: `npx tsx tests/e2e/<file>.test.ts`
- `deno task test` (unit tests) unaffected (E2E stays in `--ignore=tests/e2e`)
- `deno task ok` continues to pass
