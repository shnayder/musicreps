# Architecture Review: Testability & Maintainability

## Context

The fretboard-trainer is a single-page quiz app built with vanilla JS, no
framework, all files concatenated into one HTML file at build time. It's
growing from prototype to long-lived product. Two concerns motivate this review:

1. **DOM-dependent logic is hard to unit test** and prone to ordering bugs
   ("called hideTheMessage() after displayTheThingy(), should have called it
   before"). Can we make most logic pure and testable, with a thin DOM layer?

2. **Stale UI state after subset changes** — two concrete bugs illustrate the
   structural problem:
   - Mastery/review message not clearing when strings or naturals-only toggle
   - Recommendation highlights (orange borders) never refreshing after init

   Root cause: fire-and-forget UI updates with no mechanism to recompute
   derived state when inputs change. This is an O(n*m) wiring problem — every
   mutation must trigger all dependent UI updates, every new derived element
   must be wired into every mutation site.

## What's Already Good

- **adaptive.js** — Pure functions, injected storage, injected RNG, 790 lines
  of tests. Gold standard for the rest of the codebase.
- **music-data.js** — Pure data + pure functions, fully tested.
- **stats-display.js** — Color functions are pure, tested.
- **Mode interface** — Clean contract (`getEnabledItems`, `presentQuestion`,
  `checkAnswer`, `handleKey`, `onStart`/`onStop`). Modes are pluggable.
- **checkAnswer()** — Already 100% pure in every mode.

The untested/fragile code is concentrated in: **QuizEngine** (shared lifecycle)
and **DOM-interleaved logic in quiz modes**.

## Recommended Pattern: State + Render

Instead of imperatively mutating DOM across scattered function calls, maintain
a **state object** and always **render the full state to DOM**.

```
state = pureTransition(state, event)   // testable
render(state, domElements)             // thin, declarative, idempotent
```

**Why this eliminates ordering bugs:** The render function reads the state and
sets every DOM property independently. There's no sequence to get wrong.
Whether you called `start()` then `submitAnswer()` or went through some unusual
path, `render()` always produces the correct DOM for the current state.

**Why this eliminates stale-UI bugs:** With a single `render(state)` call
after every state change, derived displays are always recomputed. No O(n*m)
wiring — just "mutate state, call render."

**Why not full Elm Architecture:** Virtual DOM diffing is heavy machinery for
an app this size. State + Render gives the same benefits without a framework.
Render functions are simple enough (~10-20 lines of `el.style.display = ...`)
that they don't need their own test coverage.

## Implementation Plan (Priority Order)

### Phase 1: Fix stale UI bugs + extract recommendations (immediate)

This phase fixes the two concrete bugs and deduplicates the recommendation
algorithm. Low risk, high value, no architectural change to the engine.

#### Step 1a: Create shared `src/recommendations.js`

Extract the duplicated ~50-line algorithm from three files into a single shared
ES module:
- `src/quiz-fretboard.js:150-196`
- `src/quiz-semitone-math.js:91-139`
- `src/quiz-interval-math.js:97-145`

```javascript
// src/recommendations.js — ES module, exports stripped for browser inlining
export function computeRecommendations(selector, allIndices, getItemIds, config, options) {
  // Returns { recommended: Set, enabled: Set | null }
  // Pure function — no side effects, no DOM
}
```

The only difference between modes: math modes sort unstarted by
`a.string - b.string` (next sequential group), fretboard uses `unstarted[0]`
directly. Handle via optional `sortUnstarted` in options.

#### Step 1b: Create `src/recommendations_test.ts`

Test the pure algorithm:
- No started items → empty recommended, null enabled
- Consolidation below threshold → no expansion
- Consolidation above threshold → includes next unstarted
- Median-work ranking → recommends high-work items
- Single started item → still recommends it
- Custom sortUnstarted → controls expansion order

#### Step 1c: Refactor each mode into compute/update/apply layers

For each of the 3 modes (fretboard, semitoneMath, intervalMath):

```javascript
function updateRecommendations(selector) {
  // Recompute highlights only — safe to call anytime
  const result = computeRecommendations(selector, allIndices, getItemIds,
                                         DEFAULT_CONFIG, options);
  recommendedXxx = result.recommended;
  updateXxxToggles();
}

function applyRecommendations(selector) {
  // Full init: highlights + override enabled set — called only at page load
  const result = computeRecommendations(selector, allIndices, getItemIds,
                                         DEFAULT_CONFIG, options);
  recommendedXxx = result.recommended;
  if (result.enabled) {
    enabledXxx = result.enabled;
    saveEnabledXxx();
  }
  updateXxxToggles();
}
```

#### Step 1d: Add `refreshUI()` per mode + wire into mutation sites

Each mode with recommendations gets a single `refreshUI()` entry point:

```javascript
function refreshUI() {
  updateRecommendations(engine.selector);
  engine.updateIdleMessage();
}
```

Wire into all mutation sites:

**quiz-fretboard.js:**
- `toggleString()` — add `refreshUI()` *(fixes Bug 1: mastery message)*
- Naturals-only handler — add `refreshUI()` *(fixes Bug 1)*
- `activate()` — replace bare `engine.updateIdleMessage()` with `refreshUI()` *(fixes Bug 2: stale borders)*
- `onStop()` — add `refreshUI()` *(fixes Bug 2)*

**quiz-semitone-math.js:**
- `toggleGroup()` — replace `engine.updateIdleMessage()` with `refreshUI()`
- `activate()` — replace bare `engine.updateIdleMessage()` with `refreshUI()` *(fixes Bug 2)*
- `onStop()` — add `refreshUI()` *(fixes Bug 2)*

**quiz-interval-math.js:**
- Same changes as semitone-math

#### Step 1e: Update build files

Add `recommendations.js` to both `main.ts` and `build.ts`:
- Read with `readModule()` (strips exports)
- Concatenate after `statsDisplayJS`, before quiz mode files
- Update the `Promise.all` array in `main.ts:46-59`
- Update the sequential reads in `build.ts:21-30`
- Update the template interpolation in both files

#### Step 1f: Version bump + build + test

- Bump v2.7 → v2.8 in `main.ts:90` and `build.ts:62`
- Run `npx tsx --test src/*_test.ts`
- Build with `npx tsx build.ts`

### Phase 2: Extract QuizEngine state transitions (DONE)

**Problem:** `quiz-engine.js` has state spread across closure variables
(`active`, `currentItemId`, `answered`, `questionStartTime`, `expired`) and
directly manipulates DOM in `start()`, `stop()`, `submitAnswer()`,
`clearFeedback()`, `startCountdown()`, `updateIdleMessage()`. The test file
says "createQuizEngine requires DOM + globals."

**Solution:** Create `src/quiz-engine-state.js` with pure state transitions:

```javascript
export function initialEngineState() {
  return {
    phase: 'idle',          // 'idle' | 'active'
    currentItemId: null,
    answered: false,
    questionStartTime: null,
    feedbackText: '',
    feedbackClass: 'feedback',
    timeDisplayText: '',
    hintText: '',
    masteryText: '',
    showMastery: false,
  };
}

export function engineNextQuestion(state, nextItemId, nowMs) {
  return { ...state, phase: 'active', currentItemId: nextItemId,
           answered: false, questionStartTime: nowMs,
           feedbackText: '', feedbackClass: 'feedback',
           timeDisplayText: '', hintText: '' };
}

export function engineSubmitAnswer(state, isCorrect, correctAnswer, responseTimeMs) {
  return { ...state, answered: true,
           feedbackText: isCorrect ? 'Correct!' : 'Incorrect — ' + correctAnswer,
           feedbackClass: isCorrect ? 'feedback correct' : 'feedback incorrect',
           timeDisplayText: responseTimeMs + ' ms',
           hintText: 'Tap anywhere or press Space for next' };
}

export function engineStop(state) {
  return { ...state, phase: 'idle', currentItemId: null, answered: false,
           questionStartTime: null, feedbackText: '', timeDisplayText: '',
           hintText: '' };
}

export function engineHandleKey(state, key) {
  if (state.phase !== 'active') return { action: 'ignore' };
  if (key === 'Escape') return { action: 'escape' };
  if ((key === ' ' || key === 'Enter') && state.answered) return { action: 'next' };
  if (!state.answered) return { action: 'delegate' };
  return { action: 'ignore' };
}
```

Then `quiz-engine.js` becomes a thin coordinator with a `renderEngineState()`
function:

```javascript
function renderEngineState(state, els) {
  const idle = state.phase === 'idle';
  if (els.startBtn)      els.startBtn.style.display     = idle ? 'inline' : 'none';
  if (els.stopBtn)       els.stopBtn.style.display      = idle ? 'none' : 'inline';
  if (els.heatmapBtn)    els.heatmapBtn.style.display   = idle ? 'inline' : 'none';
  if (els.statsControls) els.statsControls.style.display = idle ? '' : 'none';
  if (els.quizArea)      els.quizArea.classList.toggle('active', !idle);
  if (els.feedback) {
    els.feedback.textContent = state.feedbackText;
    els.feedback.className   = state.feedbackClass;
  }
  if (els.timeDisplay) els.timeDisplay.textContent = state.timeDisplayText;
  if (els.hint)        els.hint.textContent        = state.hintText;
  if (els.masteryMessage) {
    els.masteryMessage.textContent   = state.masteryText;
    els.masteryMessage.style.display = state.showMastery ? 'block' : 'none';
  }
}
```

**What becomes testable:** Every state transition, keyboard routing, feedback
text/class, mastery messages — all without DOM or timers.

**Build integration:** `readModule()`, concatenate before `quiz-engine.js`.

### Phase 3: Extract mode-specific pure logic (DONE — fretboard only)

Each quiz mode has pure logic tangled with DOM. Split into state module +
thin render.

**Before** (`quiz-fretboard.js` `presentQuestion`):
```javascript
presentQuestion(itemId) {
  clearAll();                                      // DOM
  const [s, f] = itemId.split('-').map(Number);    // pure
  currentString = s; currentFret = f;              // state
  currentNote = getNoteAtPosition(s, f);           // pure
  highlightCircle(s, f, '#FFD700');                // DOM
}
```

**After** — state module (`quiz-fretboard-state.js`):
```javascript
export function fretboardPresent(state, itemId) {
  const [s, f] = itemId.split('-').map(Number);
  return { ...state, currentString: s, currentFret: f,
           currentNote: getNoteAtPosition(s, f),
           highlight: { string: s, fret: f, color: '#FFD700' },
           shownNotes: [] };
}

export function fretboardOnCorrect(state) {
  return { ...state,
           highlight: { ...state.highlight, color: '#4CAF50' },
           shownNotes: [{ string: state.currentString, fret: state.currentFret }] };
}
```

**Priority within modes:**
- Fretboard — most complex, most benefit
- Math modes — moderate; `presentQuestion` is already almost pure (2 lines)
- Semitone lookup modes — simplest; extraction optional

### Phase 4: Playwright for visual dev iteration (future)

Add a lightweight `scripts/screenshot.ts` that launches Playwright, loads the
built `docs/index.html`, and captures screenshots. Not a test suite — a dev
tool so Claude can see the screen during feature iteration and give UX feedback.

- `npx playwright install chromium` (one-time setup)
- `npx tsx scripts/screenshot.ts` → captures full page + per-mode screenshots
- Could also do targeted captures: "toggle string 3, screenshot the toggle bar"
- Separate from unit tests — run on demand, not in CI

### Phase 5: JSDoc types for .js source files (future)

The current TS/JS mix is well-suited to the concatenation build — `.js` source
files don't need compilation. Converting to `.ts` would require a TS→JS step
before concatenation.

Better: add JSDoc type annotations to `.js` files + `"checkJs": true` in
`tsconfig.json`. Gets type checking without changing the build:

```javascript
/** @param {ReturnType<typeof createAdaptiveSelector>} selector */
export function computeRecommendations(selector, ...) { }
```

Run `npx tsc --noEmit` to check. Editor gets autocomplete/errors. Build
stays the same.

### Phase 6: Navigation state (future, low priority)

Navigation is ~100 lines and simple. Defer until there's a reason (sub-menus,
routes, etc.).

## Files Modified (Phase 1 — what we're implementing now)

| File | Changes |
|------|---------|
| `src/recommendations.js` | **New** — shared pure `computeRecommendations()` |
| `src/recommendations_test.ts` | **New** — tests for the algorithm |
| `src/quiz-fretboard.js` | Replace `applyRecommendations` with compute/update/apply + `refreshUI()` + wire into toggleString, naturals handler, activate, onStop |
| `src/quiz-semitone-math.js` | Same refactor + `refreshUI()` + wire into toggleGroup, activate, onStop |
| `src/quiz-interval-math.js` | Same refactor + `refreshUI()` + wire into toggleGroup, activate, onStop |
| `main.ts` | Add `recommendationsJS` to reads + template |
| `build.ts` | Add `recommendationsJS` to reads + template |

## Build System Integration (all phases)

New files follow the same pattern as `adaptive.js`:

| New file | Build treatment | Concatenation position |
|----------|----------------|----------------------|
| `src/recommendations.js` | `readModule()` | After `stats-display.js` |
| `src/quiz-engine-state.js` *(Phase 2)* | `readModule()` | Before `quiz-engine.js` |
| `src/quiz-fretboard-state.js` *(Phase 3)* | `readModule()` | Before `quiz-fretboard.js` |

## Testing Strategy

New state modules are tested the same way as `adaptive.js` — ES module imports,
run with `npx tsx --test src/*_test.ts`.

**What stays untested (by design):** The `render` / `refreshUI` functions are
declarative and idempotent. Their only possible bugs are typos in CSS class
names or missing elements — both immediately visible in the browser.

## Verification (Phase 1)

1. `npx tsx --test src/*_test.ts` — all tests pass (existing + new)
2. `npx tsx build.ts` — build succeeds
3. Manual verification scenarios:
   - Toggle fretboard string → mastery message disappears if new items not mastered
   - Toggle naturals-only → mastery message recalculates
   - Complete quiz, stop → orange recommendation borders update
   - Switch modes and back → recommendations reflect current data
   - First launch, practice, stop → borders appear (not empty from init)

---

## Phase 2 Implementation Notes (v2.11)

### What was done

Created `src/quiz-engine-state.js` with 8 pure state transition functions:
- `initialEngineState()` — idle state with UI visibility flags
- `engineStart(state)` — activate quiz, flip button visibility
- `engineNextQuestion(state, nextItemId, nowMs)` — set item/timestamp, clear feedback
- `engineSubmitAnswer(state, isCorrect, correctAnswer, responseTimeMs)` — compute feedback
- `engineStop(state)` — return to idle (delegates to `initialEngineState()`)
- `engineUpdateIdleMessage(state, allMastered, needsReview)` — mastery/review message
- `engineUpdateMasteryAfterAnswer(state, allMastered)` — in-quiz mastery check
- `engineRouteKey(state, key)` — pure keyboard routing → `{action: 'stop'|'next'|'delegate'|'ignore'}`

The state shape includes UI visibility booleans (`showStartBtn`, `showStopBtn`,
`showHeatmapBtn`, `showStatsControls`, `quizActive`, `answersEnabled`) that the
original plan didn't have. These let tests verify that state transitions produce
the correct UI configuration.

Refactored `quiz-engine.js`:
- Replaced closure variables (`active`, `currentItemId`, `answered`,
  `questionStartTime`) with a single `state` object
- Added `render()` function that declaratively maps state→DOM
- Removed `clearFeedback()` — render always sets feedback from state
- `expired` moved to local scope inside `startCountdown()` (purely visual)
- `isActive`/`isAnswered` getters now read from `state.phase`/`state.answered`

### Deviations from plan
- Plan sketched `engineHandleKey` returning `{action: 'escape'}` — implemented
  as `{action: 'stop'}` for clarity (matches the function it triggers)
- `engineStop` returns `initialEngineState()` instead of spreading individual
  fields — simpler and guarantees reset to clean state
- Added `engineUpdateMasteryAfterAnswer` as separate from `engineUpdateIdleMessage`
  (plan had this)

### Tests: 35 test cases in `src/quiz-engine-state_test.ts`

### Files modified
| File | Changes |
|------|---------|
| `src/quiz-engine-state.js` | **New** — 8 pure state transition functions |
| `src/quiz-engine-state_test.ts` | **New** — 35 test cases |
| `src/quiz-engine.js` | Replaced closure vars with state object + render() |
| `main.ts` | Added `quizEngineStateJS` to reads + template |
| `build.ts` | Added `quizEngineStateJS` to reads + template |

---

## Phase 3 Implementation Notes (v2.12)

### What was done

Created `src/quiz-fretboard-state.js` with:
- `toggleFretboardString(enabledStrings, string)` — immutable Set toggle
- `createFretboardHelpers(musicData)` — factory that binds music data and returns:
  - `getNoteAtPosition(string, fret)`
  - `parseFretboardItem(itemId)`
  - `checkFretboardAnswer(currentNote, input)`
  - `getFretboardEnabledItems(enabledStrings, naturalsOnly)`
  - `getItemIdsForString(string, naturalsOnly)`

The factory pattern solves the import/global problem: `readModule()` only strips
`export`, not `import`, so the module can't use ES `import` statements (they'd
appear as syntax errors in the concatenated browser code). Instead, the browser
passes globals (`NOTES`, `STRING_OFFSETS`, etc.) via the factory; tests pass
the imported values.

Refactored `quiz-fretboard.js`:
- Creates `fb = createFretboardHelpers({...})` at module scope
- `getEnabledItems()` → `fb.getFretboardEnabledItems(enabledStrings, naturalsOnly)`
- `presentQuestion()` → uses `fb.parseFretboardItem(itemId)` for pure parse
- `checkAnswer()` → `fb.checkFretboardAnswer(currentNote, input)`
- `getItemIdsForString()` → `fb.getItemIdsForString(s, naturalsOnly)`
- `toggleString()` → `toggleFretboardString(enabledStrings, s)` (immutable)
- **Eliminated duplicated handleKey state machine** (40 lines) — replaced with
  `createNoteKeyHandler` from quiz-engine.js (same helper used by all other modes)
- Added `noteKeyHandler.reset()` to `onStart()`, `onStop()`, and `deactivate()`

### Scope decision
Only fretboard mode was extracted (most complex, most benefit). Math modes
(`quiz-semitone-math.js`, `quiz-interval-math.js`) were skipped — their
`presentQuestion` is 2 lines and `handleKey` already delegates to
`createNoteKeyHandler`. Lookup modes (`quiz-note-semitones.js`,
`quiz-interval-semitones.js`) were also skipped for the same reason.

### Deviations from plan
- Plan sketched `fretboardPresent(state, itemId)` returning a full state object
  with `highlight` and `shownNotes` fields. Instead used a lighter approach:
  `parseFretboardItem` returns `{currentString, currentFret, currentNote}` and
  the mode file assigns to closure vars + calls DOM helpers. This avoids a
  full render function for fretboard-specific DOM (SVG circle highlighting),
  which would be complex to implement declaratively.
- Plan didn't mention the factory pattern for music data injection — this was
  needed to solve the import/global problem.
- `checkFretboardAnswer` takes `currentNote` as a parameter rather than being
  part of a stateful object, keeping it simpler.

### Tests: 30 test cases in `src/quiz-fretboard-state_test.ts`

### Files modified
| File | Changes |
|------|---------|
| `src/quiz-fretboard-state.js` | **New** — `toggleFretboardString` + `createFretboardHelpers` factory |
| `src/quiz-fretboard-state_test.ts` | **New** — 30 test cases |
| `src/quiz-fretboard.js` | Use state module, replace inline handleKey with createNoteKeyHandler |
| `main.ts` | Added `quizFretboardStateJS` to reads + template |
| `build.ts` | Added `quizFretboardStateJS` to reads + template |
