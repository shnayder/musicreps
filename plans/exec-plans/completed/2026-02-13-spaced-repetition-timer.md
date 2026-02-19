# Spaced Repetition Timer — Implementation Plan

## Context

Implements the
[timer design spec](../product-specs/active/2026-02-13-spaced-repetition-timer-spec.md).
The existing countdown bar is visual-only. This plan makes it consequential:
per-item adaptive deadlines, auto-submit on expiry, persistence across sessions.

## Design

### Deadline staircase (new module: `deadline.js`)

Pure functions + factory, same pattern as `adaptive.js`. ES module so tests can
import it.

**Per-item state:**

```
{ deadline: number }   // current deadline in ms
```

**Storage:** Extend the existing adaptive storage adapter — add a parallel key
namespace (`deadline_{namespace}_{itemId}`) so deadlines sit alongside adaptive
stats in localStorage.

**Factory API:**

```js
createDeadlineTracker(storage, config);
getDeadline(itemId, ewma); // Returns current deadline (loads from storage,
//   cold-starts from ewma*2 or maxResponseTime)
recordOutcome(itemId, correct); // Adjusts deadline: *0.85 on correct,
//   *1.4 on incorrect/timeout
```

**Config shape** (derived from adaptive config, scaled by motor baseline):

```js
{
  decreaseFactor: 0.85,      // multiply deadline after correct
  increaseFactor: 1.4,       // multiply deadline after incorrect/timeout
  minDeadline: minTime * 1.3, // floor (baseline + margin)
  maxDeadline: maxResponseTime, // ceiling
  defaultDeadline: maxResponseTime, // cold start for unseen items
  ewmaMultiplier: 2.0,       // cold start multiplier for items with EWMA
}
```

### Engine state additions (`quiz-engine-state.js`)

Add `timedOut: boolean` to engine state. The `engineSubmitAnswer` function gains
a variant for timeouts:

```js
engineTimedOut(state, correctAnswer);
// → answered: true, answersEnabled: false,
//   feedbackText: "Time's up — {correctAnswer}",
//   feedbackClass: "feedback incorrect",
//   timeDisplayText: "limit: {deadline}s",
//   timedOut: true
```

Modify `engineSubmitAnswer` to format response time as seconds with 1 decimal
(e.g. "1.2s") instead of raw ms.

### Engine changes (`quiz-engine.js`)

1. **Create deadline tracker** alongside the adaptive selector in
   `createQuizEngine`. Pass the same storage adapter (extended with deadline
   methods) and derive deadline config from the adaptive config.

2. **`startCountdown()` uses per-item deadline** instead of fixed
   `automaticityTarget`. Gets deadline from tracker using item's EWMA.

3. **Add timeout callback** to countdown: when bar reaches 0%, call a new
   `handleTimeout()` function that:
   - Gets the correct answer via `mode.checkAnswer(itemId, null)` or similar
   - Calls `deadlineTracker.recordOutcome(itemId, false)`
   - Records to adaptive selector as incorrect
   - Transitions state via `engineTimedOut()`
   - Renders

4. **`submitAnswer()` integrates with deadline tracker**: after checking answer,
   calls `deadlineTracker.recordOutcome(itemId, correct)`.

5. **Deadline display**: Show deadline value next to the countdown bar. Add
   `els.deadlineDisplay` DOM reference. Updated in `nextQuestion()`.

### HTML changes (`html-helpers.ts`)

Update `countdownAndPrompt()` to include a deadline display element:

```html
<div class="countdown-container">
  <div class="countdown-bar"></div>
  <span class="deadline-display"></span>
</div>
```

The fretboard mode has its own countdown-container (not using the shared
helper), so update that too in `main.ts`/`build.ts`.

### CSS changes (`styles.css`)

- Style `.deadline-display` — small text positioned to the right of the
  countdown bar
- Adjust `.countdown-container` to accommodate the label (flexbox)

### Storage extension

Add deadline-specific methods to `createLocalStorageAdapter`:

```js
getDeadline(itemId); // reads deadline_{namespace}_{itemId}
saveDeadline(itemId, deadline); // writes deadline_{namespace}_{itemId}
```

Add matching methods to `createMemoryStorage` for testing.

## Implementation Steps

1. **Add deadline storage methods** to both `createLocalStorageAdapter` and
   `createMemoryStorage` in `adaptive.js`.

2. **Create `src/deadline.js`** — pure deadline staircase functions +
   `createDeadlineTracker` factory. ES module with exports.

3. **Add `engineTimedOut` state transition** to `quiz-engine-state.js`. Modify
   `engineSubmitAnswer` to format time as "X.Xs" instead of "X ms".

4. **Add deadline display HTML** — update `countdownAndPrompt()` in
   `html-helpers.ts`, and the fretboard countdown in `main.ts`/`build.ts`.

5. **Add CSS** for `.deadline-display` and adjusted `.countdown-container`.

6. **Wire up timer in `quiz-engine.js`**:
   - Create deadline tracker in `createQuizEngine`
   - `startCountdown()`: use per-item deadline, add timeout callback
   - `submitAnswer()`: record outcome to deadline tracker
   - `nextQuestion()`: show deadline display
   - Add `els.deadlineDisplay` DOM reference

7. **Update `main.ts` and `build.ts`** — add `readModule("./src/deadline.js")`
   to the file reads and concatenation. Must be after `adaptive.js` (depends on
   storage) and before `quiz-engine.js` (consumed by engine).

8. **Write tests** for deadline.js (pure functions + tracker with memory
   storage) and engine state transitions (engineTimedOut).

9. **Version bump** v3.7 → v3.8.

## Files Modified

| File                            | Changes                                                                     |
| ------------------------------- | --------------------------------------------------------------------------- |
| `src/deadline.js`               | **New** — staircase functions + tracker factory                             |
| `src/adaptive.js`               | Add `getDeadline`/`saveDeadline` to storage adapters                        |
| `src/quiz-engine-state.js`      | Add `engineTimedOut`, update time format in `engineSubmitAnswer`            |
| `src/quiz-engine.js`            | Integrate deadline tracker, timeout callback, deadline display              |
| `src/html-helpers.ts`           | Add deadline display to `countdownAndPrompt()`                              |
| `src/styles.css`                | Style deadline display, adjust countdown container                          |
| `main.ts`                       | Add `deadline.js` to reads + concatenation, update fretboard countdown HTML |
| `build.ts`                      | Same as main.ts                                                             |
| `src/deadline_test.ts`          | **New** — tests for staircase logic                                         |
| `src/quiz-engine-state_test.ts` | Tests for `engineTimedOut`                                                  |

## Testing

- **deadline.js pure functions**: cold start from EWMA, cold start unseen,
  decrease on correct, increase on incorrect, floor/ceiling clamping,
  persistence round-trip
- **engineTimedOut state**: feedback text, feedback class, timedOut flag, time
  display format
- **engineSubmitAnswer format change**: verify "X.Xs" format instead of "X ms"
- Manual: run quiz, verify countdown shows deadline, verify auto-submit on
  timeout, verify deadline adjusts across questions

## Version

v3.7 → v3.8
