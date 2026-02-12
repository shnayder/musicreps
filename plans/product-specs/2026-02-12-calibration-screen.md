# Plan: Calibration as a Dedicated Screen

## Problem

Currently, calibration starts immediately when a user first hits "Start" on a
quiz mode — the buttons just start highlighting green with a brief "Quick
warm-up!" message. There's no explanation of what's happening or why, and no
summary of results afterward. The user goes straight into quiz questions with
no understanding of how their measured baseline maps to the thresholds.

## Goal

Make calibration a proper, self-contained experience:

1. **Pre-calibration screen** — explains what's about to happen, user explicitly
   starts it
2. **Calibration trials** — same 10-tap sequence (no changes needed here)
3. **Post-calibration results screen** — shows measured baseline and explains
   what the derived thresholds mean in plain language

## Design

### Pre-Calibration Screen

When a quiz mode is opened and no baseline exists:

- Instead of the normal idle state, show a **calibration intro screen** in the
  quiz container area
- Content:
  - Heading: **"Quick Calibration"**
  - Explanation: "We'll measure your tap/type speed so we can set personalized
    targets. Tap each highlighted button as fast as you can — 10 taps total."
  - A **"Start"** button to begin the trials
- The quiz isn't "running" yet — no countdown, no scoring

### Post-Calibration Results Screen

After the 10 trials complete:

- Show a **results screen** with the measured baseline and derived thresholds
- Content:
  - Heading: **"Calibration Complete"**
  - Measured motor baseline (e.g., "Your baseline response time: 620ms")
  - Threshold table in plain language, using the actual computed values:

    | Speed | Time | Meaning |
    |-------|------|---------|
    | Automatic | < {1.5× baseline} | Fully memorized — instant recall |
    | Good | < {3.0× baseline} | Solid recall, minor hesitation |
    | Developing | < {4.5× baseline} | Working on it — needs practice |
    | Slow | < {6.0× baseline} | Significant hesitation |
    | Very slow | > {6.0× baseline} | Not yet learned |

  - These thresholds match the heatmap color bands from CLAUDE.md
  - A **"Done"** button to dismiss the results

### After Calibration — Return to Idle

Both first-time calibration and recalibration end the same way: after the user
dismisses the results screen, the engine returns to the normal idle state (the
"just opened this quiz" screen with the Start button). The calibration is a
standalone step — the user then starts the quiz manually whenever they're ready.

This means `start()` no longer needs to chain calibration into question flow.
Instead, when a mode is opened without a baseline, the calibration intro screen
is shown in place of the normal idle state. Once calibration is done, the
normal idle state appears.

### Recalibration Flow

The existing "Recalibrate" button (shown in idle state) follows the same
flow: show intro → run trials → show results → return to idle.

### Implementation Approach

All changes are in `src/quiz-engine.js` — the calibration is part of the engine,
not individual quiz modes.

#### Key Changes

1. **New function: `showCalibrationIntro(onReady)`** — renders the intro screen
   in the quiz container, calls `onReady` when user clicks Start.

2. **New function: `showCalibrationResults(baseline, onContinue)`** — renders
   the results screen with computed thresholds, calls `onContinue` when user
   clicks the continue button.

3. **Modify `startCalibration()`** — no longer takes `onComplete` callback.
   Full flow is self-contained:
   - Show intro screen
   - On "Start" click → run existing `runCalibration()` trials
   - On completion → call `applyBaseline(median)` → show results screen
   - On "Done" click → call `render()` to show normal idle state

4. **Modify `start()` / mode initialization** — when a mode is opened without
   a baseline, show the calibration intro screen instead of the normal idle
   state. `start()` itself only runs the quiz (never calibration).

5. **Modify `recalibrate()`** — calls the same `startCalibration()` flow.

6. **CSS** — minimal styling for the calibration screens. Reuse existing
   `.feedback` / `.hint` styling where possible, add a styled info card for
   the results table.

#### DOM Strategy

The intro and results screens will be rendered into the existing quiz container
elements (`.feedback`, `.hint`, answer button area). No new top-level DOM
elements needed. The screens replace the content temporarily, then restore
normal quiz UI when done.

Specifically:
- Use `els.feedback` for headings
- Use `els.hint` for explanatory text
- Repurpose the answer button area for the Start/Continue buttons
- For the results table on the post-calibration screen, insert a temporary
  element into the container that gets removed on continue

### What Does NOT Change

- `runCalibration()` internals (trial mechanics, timing, median computation)
- `deriveScaledConfig()` scaling ratios
- `computeMedian()`
- Storage format (`motorBaseline_{namespace}`)
- Per-mode independence (each mode calibrates separately)

### Version

Bump from v3.1 → v3.2.

## Testing

- Add tests for the threshold-description helper function (pure logic: given
  a baseline, produce the right labels and time values)
- Manual testing of the full flow: open mode → intro → trials → results → idle → start quiz
- Manual testing of recalibrate flow: idle → recalibrate → intro → trials → results → idle

## Implementation Notes (post-implementation)

### Initial implementation

Used a `calibrating` boolean as a shadow state parallel to the engine's state
machine. This caused multiple bug-prone patterns: `if (calibrating)` guards in
`submitAnswer`, `handleKeydown`, `handleClick`; `isActive` needing
`|| calibrating`; `stop()` needing DOM-query cleanup; imperative DOM
manipulation bypassing `render()`.

### Refactor: calibration as proper state machine phases

After architectural review, refactored to add `calibration-intro`,
`calibrating`, and `calibration-results` as proper phases in the engine state
machine (`quiz-engine-state.js`). This eliminated:

- The `calibrating` boolean — phase is the single source of truth
- All `if (calibrating)` guards — state machine routing handles them
- Imperative DOM manipulation — `render()` handles calibration UI declaratively
- DOM-query cleanup in `stop()` — `render()` clears `calibrationContentEl`
- `|| calibrating` in `isActive` — just `state.phase !== 'idle'`

Key functions:
- `engineCalibrationIntro(state)` — pure state transition
- `engineCalibrating(state)` — pure state transition
- `engineCalibrationResults(state, baseline)` — pure state transition
- `beginCalibrationTrials()` — wired to Start button click
- `finishCalibration()` — wired to Done button click, just calls `stop()`
- `render()` creates/clears `calibrationContentEl` based on phase
- `engineRouteKey` updated: Escape stops from any non-idle phase

19 new tests for calibration state transitions and key routing in
quiz-engine-state_test.ts. Total test count: 283.
