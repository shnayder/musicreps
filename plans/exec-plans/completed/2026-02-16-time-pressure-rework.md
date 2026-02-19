# Time Pressure Rework: 60-Second Rounds — Execution Plan

## Context

Implements the
[time-pressure-rework product spec](../../product-specs/completed/time-pressure-rework.md).

The per-item adaptive deadline system (countdown bar + timeout + deadline.js)
created frustration: deadlines tightened as users improved, leading to frequent
"Time's up" on items they would have answered correctly. Replaced the entire
system with timed rounds — "how many can you answer in 60 seconds?"

This supersedes the earlier
[spaced-repetition-timer exec plan](./2026-02-13-spaced-repetition-timer.md)
which implemented the per-item deadline system being removed here.

## Design

### Remove per-item deadline infrastructure

- Remove `engineTimedOut` state transition and `timedOut` state field
- Remove all `deadline.js` usage from `quiz-engine.js` (deadline tracker
  creation, `getItemDeadline`, `startCountdown`, `handleTimeout`, countdown bar
  animation)
- Remove `deadline.js` from build script concatenation (file kept in repo, just
  no longer loaded)
- Remove countdown-container/countdown-bar/deadline-display HTML and CSS

### Add round timer state machine

New state fields in `initialEngineState()`:

- `roundNumber: 0` — 1-indexed during quiz, 0 when idle
- `roundAnswered: 0` — answers in current round
- `roundCorrect: 0` — correct answers in current round
- `roundTimerExpired: false` — soft flag, set when 60s elapses

New phase: `round-complete` (between rounds)

New transitions:

- `engineRoundTimerExpired(state)` — sets `roundTimerExpired: true`
- `engineRoundComplete(state)` — enters `round-complete` phase, preserves round
  counts, clears current item and feedback
- `engineContinueRound(state)` — increments `roundNumber`, resets round
  counters, returns to `active` phase

Modified transitions:

- `engineStart` — initializes `roundNumber: 1` and round counters
- `engineSubmitAnswer` — increments `roundAnswered` (and `roundCorrect` if
  correct)
- `engineRouteKey` — handles `round-complete` phase (Space/Enter → continue,
  Escape → stop)

### Round timer in quiz-engine.js

- 60-second `setInterval` timer (200ms tick for smooth display)
- `formatRoundTime(ms)` → `"0:42"` format with `tabular-nums`
- Soft boundary: when timer expires mid-question, sets `roundTimerExpired` flag.
  User finishes current question, then transitions on `nextQuestion()` or
  `submitAnswer()`. If already on feedback screen, transitions immediately.
- `startRoundTimer()` / `stopRoundTimer()` lifecycle
- Timer turns red (`.round-timer-warning`) in last 10 seconds

### New `continueQuiz()` function

Called from "Keep Going" button or Space/Enter on round-complete screen. Calls
`engineContinueRound()`, starts new 60s timer, calls `nextQuestion()`.

### HTML changes

Session-stats area:

- Replaced `#<span class="question-count">0</span>` with
  `<span class="round-timer"></span>` + `<span class="round-answer-count">`

Round-complete overlay (inside `.quiz-area`):

```html
<div class="round-complete" style="display: none">
  <div class="round-complete-heading">Time's up!</div>
  <div class="round-complete-count"></div>
  <div class="round-complete-correct"></div>
  <div class="round-complete-actions">
    <button class="round-complete-continue">Keep Going</button>
    <button class="round-complete-stop">Stop</button>
  </div>
</div>
```

Quiz header title shows `Round N` during active quiz.

Added `60-second rounds` label below Start Quiz button.

Fretboard modes: removed inline `countdown-container` HTML (now just
`pianoNoteButtons() + feedbackBlock()`).

### CSS changes

- Removed: `.countdown-container`, `.countdown-track`, `.countdown-bar`,
  `.countdown-bar.expired`, `.deadline-display`
- Added: `.round-timer`, `.round-timer-warning`, `.round-answer-count`,
  `.round-duration-label`
- Added: `.round-complete` card with heading, stats, action buttons
- Added: `.phase-round-complete` visibility rules (hides quiz content, shows
  round-complete overlay)

## Implementation Steps (as executed)

1. **State machine** (`quiz-engine-state.js`): Added round tracking fields,
   `round-complete` phase, 3 new transitions. Removed `engineTimedOut` and
   `timedOut` field.

2. **Engine** (`quiz-engine.js`): Removed deadline tracker, countdown bar,
   `handleTimeout`. Added round timer (60s setInterval), soft boundary logic,
   `continueQuiz()`, round-complete rendering. Added `pickCalibrationButton`
   helper (from main's search calibration).

3. **HTML template** (`html-helpers.ts`): Updated `modeScreen()` scaffold with
   round timer, answer count, round-complete overlay. Replaced
   `countdownAndPrompt()` with `quizPrompt()`. Added round-duration label.

4. **Build scripts** (`main.ts`, `build.ts`): Removed `deadline.js` from reads
   and concatenation. Removed inline countdown HTML from fretboard modes.
   Updated version v3.16 → v4.0.

5. **CSS** (`styles.css`): Replaced countdown styles with round timer and
   round-complete styles. Added phase-round-complete visibility rules.

6. **Tests** (`quiz-engine-state_test.ts`): Removed `engineTimedOut` tests.
   Added tests for `engineRoundTimerExpired`, `engineRoundComplete`,
   `engineContinueRound`, round counting in `engineSubmitAnswer`,
   `engineRouteKey` in `round-complete` phase.

## Files Modified

| File                            | Changes                                                                 |
| ------------------------------- | ----------------------------------------------------------------------- |
| `src/quiz-engine-state.js`      | Add round fields + transitions, remove `engineTimedOut`/`timedOut`      |
| `src/quiz-engine.js`            | Remove deadline tracker + countdown, add round timer + `continueQuiz()` |
| `src/html-helpers.ts`           | Round timer in session-stats, round-complete overlay, `quizPrompt()`    |
| `src/styles.css`                | Remove countdown CSS, add round-timer + round-complete CSS              |
| `main.ts`                       | Remove `deadline.js`, remove countdown HTML, version bump               |
| `build.ts`                      | Same as main.ts                                                         |
| `src/quiz-engine-state_test.ts` | Replace `engineTimedOut` tests with round tests                         |
| `docs/index.html`               | Rebuilt output                                                          |

## Testing

- 438 tests pass (0 failures)
- Pure state tests: round tracking, phase transitions, key routing
- Manual: round timer counts down, soft boundary works, round-complete shows
  stats, Keep Going starts new round, Stop returns to idle

## Version

v3.16 → v4.0
