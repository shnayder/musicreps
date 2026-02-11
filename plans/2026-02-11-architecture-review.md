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

### Phase 2: Extract QuizEngine state transitions (future)

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

### Phase 3: Extract mode-specific pure logic (future, per mode)

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
