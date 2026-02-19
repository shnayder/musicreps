# Quiz Flow Polish: Phase 1

Implements the
[Quiz Flow Polish Phase 1 spec](../../product-specs/active/2026-02-17-quiz-flow-polish-phase1-spec.md).

## Problem / Context

Two flow issues undermine the "minimal friction" principle:

1. **Calibration gate** — On first visit to any mode, a 10-trial speed check
   auto-launches before the user can practice. This interrupts intent, adds ~15
   seconds of friction, and can't be skipped. The app works fine without
   calibration (reasonable default thresholds exist).

2. **Silent timer expiry** — When the 60-second round timer expires
   mid-question, nothing signals that it's the last question. The user doesn't
   know whether to answer, whether the round is over, or what happens next.

## Design

### 1. Remove calibration gate

**Remove `showCalibrationIfNeeded()` calls from all mode `activate()` hooks.**
The function itself stays in the engine API (modes could call it if needed in
the future), but no mode should auto-trigger it.

**Remove the "Advanced" section** (`<details class="practice-advanced">`) from
`tabbedIdleHTML()` in `html-helpers.ts`. Remove associated CSS and JS wiring.

**Add calibration prompt to Progress tab.** In the engine's `render()`, when the
stats controls area is visible, insert a baseline info line above the stats
container. Two variants:

- **No baseline**: "Response time baseline: 1s _default_. Do a speed check (10
  taps, ~15s) to track progress more accurately. [Speed check]"
- **Has baseline**: "Response time baseline: 0.8s [Rerun speed check]"

This is rendered by the engine into a new `.baseline-info` element placed inside
the `.tab-progress` div, above `.stats-container`. The engine creates and
manages this element since it owns baseline state.

### 2. "Last question" signal

When `roundTimerExpired` becomes true and the user hasn't answered yet, show a
"Last question" label in the session info row. This is a pure visual change — no
new engine state needed.

In `handleRoundTimerExpiry()`, after setting `roundTimerExpired`, if the user is
mid-question (not yet answered): add a `.last-question` class to the container
and insert "Last question" text into the session info area (replacing the time
display).

The countdown bar stays visible at 0% width (empty track). The timer text stays
frozen at "0:00". Answer buttons stay active. After answering, brief feedback,
then auto-transition to round-complete.

## Implementation Steps

1. **Remove `showCalibrationIfNeeded()` calls** from all 10 mode `activate()`
   hooks (fretboard ×2, speed-tap, note-semitones, interval-semitones,
   semitone-math, interval-math, key-signatures, scale-degrees, diatonic-chords,
   chord-spelling).

2. **Remove "Advanced" section** from `tabbedIdleHTML()` in `html-helpers.ts`.
   Remove the `<details class="practice-advanced">` block.

3. **Remove recalibrate button wiring** from `quiz-engine.js`: the
   `.recalibrate-btn` element reference, event listener, visibility toggle in
   `renderMessages()`, and the `recalibrate()` function from the public API.

4. **Remove CSS** for `.practice-advanced`, `.recalibrate-btn` visibility rules,
   and `.practice-advanced .recalibrate-btn.has-baseline` from `styles.css`.

5. **Add baseline info element** to `tabbedIdleHTML()` — a `.baseline-info` div
   inside `.tab-progress`, above `.stats-container`.

6. **Add engine rendering for baseline info** in `quiz-engine.js`: a new
   `renderBaselineInfo()` function called at initialization and after
   `applyBaseline()` (not from `render()` — avoids DOM thrashing on every state
   transition). Populates the `.baseline-info` element with either the "no
   baseline" prompt + button or the "has baseline" info + rerun link. Wire the
   speed check button to `startCalibration()`.

7. **Add "last question" signal** in `quiz-engine.js`:
   - In `handleRoundTimerExpiry()`, when user is mid-question, set
     `.quiz-info-time` text to "Last question" (replacing "0:00").
   - Add `last-question` class to the countdown bar for CSS styling (keep the
     empty track visible with a distinct treatment).

8. **Add CSS** for `.baseline-info` styling and `.last-question` countdown bar.

9. **Bump version** v6.0 → v6.1 in both `main.ts` and `build.ts`.

10. **Build and test** — run build, verify with manual testing.

## Files Modified

| File                             | Changes                                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `src/html-helpers.ts`            | Remove `<details class="practice-advanced">` block; add `.baseline-info` div to Progress tab                        |
| `src/quiz-engine.js`             | Remove recalibrate-btn wiring; add `renderBaselineInfo()`; add "last question" signal in `handleRoundTimerExpiry()` |
| `src/styles.css`                 | Remove `.practice-advanced` and related CSS; add `.baseline-info` and `.last-question` styles                       |
| `src/quiz-fretboard.js`          | Remove `showCalibrationIfNeeded()` call                                                                             |
| `src/quiz-speed-tap.js`          | Remove `showCalibrationIfNeeded()` call                                                                             |
| `src/quiz-note-semitones.js`     | Remove `showCalibrationIfNeeded()` call                                                                             |
| `src/quiz-interval-semitones.js` | Remove `showCalibrationIfNeeded()` call                                                                             |
| `src/quiz-semitone-math.js`      | Remove `showCalibrationIfNeeded()` call                                                                             |
| `src/quiz-interval-math.js`      | Remove `showCalibrationIfNeeded()` call                                                                             |
| `src/quiz-key-signatures.js`     | Remove `showCalibrationIfNeeded()` call                                                                             |
| `src/quiz-scale-degrees.js`      | Remove `showCalibrationIfNeeded()` call                                                                             |
| `src/quiz-diatonic-chords.js`    | Remove `showCalibrationIfNeeded()` call                                                                             |
| `src/quiz-chord-spelling.js`     | Remove `showCalibrationIfNeeded()` call                                                                             |
| `main.ts`                        | Version bump                                                                                                        |
| `build.ts`                       | Version bump                                                                                                        |

## Testing

- Manual: open a mode with no baseline → should go straight to idle, no speed
  check. Start Quiz works immediately.
- Manual: open Progress tab with no baseline → see default prompt with speed
  check button. Click it → calibration runs → returns to Progress tab with
  baseline shown.
- Manual: open Progress tab with baseline → see "Response time baseline: X.Xs
  [Rerun speed check]". Click rerun → calibration runs → baseline updates.
- Manual: start a quiz, let timer run to 0 mid-question → "Last question"
  appears in session info. Answer → brief feedback → round-complete.
- Manual: start a quiz, answer a question, timer expires during feedback →
  immediate transition to round-complete (no "Last question" label).
- Unit tests: run `npx tsx --test src/*_test.ts` — existing tests should pass.

## Version

v6.0 → v6.1
