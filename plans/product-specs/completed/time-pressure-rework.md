# Time Pressure Rework: 60-Second Rounds

## Problem

The per-item adaptive deadline system (countdown bar + timeout) creates
frustration. Deadlines tighten as you improve, so you're always near the edge of
timing out. Getting "Time's up" on an item you _would have_ answered correctly
feels punitive. The system is technically sound but emotionally punishing.

## Proposal

Replace per-item deadlines with **timed rounds**: "How many questions can you
answer in 60 seconds?" Still creates time pressure, but the pressure is ambient
(a ticking clock) rather than per-question (a bar about to expire).

Key shift: instead of _penalizing slow answers_, we _reward fast throughput_.

## Design

### Phase: Idle (pre-quiz)

No changes to the idle screen layout. Stats heatmap, recall/speed toggle,
settings, mastery message, "Start Quiz" and "Redo speed check" all remain.

One addition: below the "Start Quiz" button, show a brief label: **"60-second
rounds"** — so users know what to expect. Subtle, not a modal or interstitial.

### Phase: Active (during round)

**Removed:**

- Per-item countdown bar and track (`.countdown-container`)
- Per-item deadline display (`.deadline-display`)
- Per-item timeout logic (`handleTimeout`, `engineTimedOut`)
- Per-item deadline staircase (all of `deadline.js` usage)

**Changed:**

- The `session-stats` area becomes the primary status display:
  - **Round timer**: `0:42` counting down from `1:00`, displayed prominently.
    Large enough to see at a glance. Placed where the current `#N` counter is.
  - **Question count**: `12 answers` shown alongside the timer. This is the
    score the user is trying to maximize.
- The quiz-session header title shows the round number: `Round 1`, `Round 2`,
  etc.

**Unchanged:**

- Question presentation, answer buttons, feedback, keyboard handling
- Adaptive selector (still records response time + correctness for EWMA)
- Motor baseline calibration (still used for speed heatmap and automaticity)
- Progress bar (mastered / total fluent)
- Feedback text ("Correct!" / "Incorrect — X")
- Tap/Space/Enter to advance to next question
- Escape to stop

**When 60 seconds expires:**

- If the user is mid-question (hasn't answered yet): **let them finish the
  current question**. The timer display shows `0:00` but doesn't interrupt.
  After they answer (or press Space/Enter to advance), transition to
  round-complete.
- If the user has already answered and is on the feedback screen: transition
  immediately to round-complete.

Rationale for letting users finish: interrupting mid-thought is exactly the
frustration we're eliminating. The 60s is a soft boundary. The timer reaching
zero is the signal, not a hard cutoff.

### Phase: Round Complete (new)

Shows inside the quiz-area, replacing the question/answer UI:

```
Time's up!

12 answers in 60s
10 correct (83%)

[Keep Going]     [Stop]
```

- **"Keep Going"** (primary button): starts a new 60s round. Round counter
  increments. Question count resets to 0 for the new round.
- **"Stop"** (secondary/ghost button): returns to idle.
- Keyboard: **Enter/Space** → Keep Going, **Escape** → Stop.

The round-complete screen is intentionally minimal — just the key numbers and
two clear actions. No charts or detailed breakdowns here; that's what the idle
stats screen is for.

### What Gets Removed

| Component                        | Current role                                  | Disposition                          |
| -------------------------------- | --------------------------------------------- | ------------------------------------ |
| `deadline.js`                    | Per-item deadline staircase                   | **Dead code** — remove all usage     |
| `deadlineTracker` in quiz-engine | Manages per-item deadlines                    | **Remove**                           |
| `getItemDeadline()`              | Looks up deadline for next question           | **Remove**                           |
| `startCountdown()`               | Animates per-item countdown bar               | **Remove**                           |
| `handleTimeout()`                | Auto-submits on per-item expiry               | **Remove**                           |
| `engineTimedOut()`               | State transition for per-item timeout         | **Remove**                           |
| `state.timedOut`                 | Flag for timeout feedback styling             | **Remove**                           |
| Countdown bar HTML               | `.countdown-container` etc.                   | **Repurpose or remove**              |
| `deadline-display`               | Shows "3.2s" per item                         | **Remove**                           |
| Deadline storage                 | Per-item deadline persistence in localStorage | **Stop writing** (old data harmless) |

### What Stays

| Component                                         | Why                                                            |
| ------------------------------------------------- | -------------------------------------------------------------- |
| Motor baseline calibration                        | Still needed for speed heatmap colors and automaticity scoring |
| Adaptive selector (EWMA, response time recording) | Question selection and learning model unchanged                |
| Speed heatmap                                     | Per-item speed visualization in idle is still valuable         |
| `deriveScaledConfig()`                            | Automaticity thresholds still scale with baseline              |
| Progress bar (mastered/fluent)                    | Still tracks long-term progress                                |

### State Machine Changes

Current phases: `idle`, `active`, `calibration-intro`, `calibrating`,
`calibration-results`

New phases: same plus `round-complete`

New state fields:

```
roundNumber: number          // 1-indexed, increments on "Keep Going"
roundAnswered: number        // questions answered in current round
roundCorrect: number         // correct answers in current round
roundTimerExpired: boolean   // true when 60s elapsed (soft — wait for current Q)
```

Removed state fields:

```
timedOut: boolean            // no more per-item timeout
```

### Engine Lifecycle Changes

**`start()`** → sets `roundNumber: 1`, `roundAnswered: 0`, `roundCorrect: 0`,
starts the 60s timer, then calls `nextQuestion()` as before.

**`submitAnswer()`** → increments `roundAnswered` (and `roundCorrect` if
correct). If `roundTimerExpired`, transitions to `round-complete` instead of
calling `nextQuestion()`.

**`nextQuestion()`** → if `roundTimerExpired`, transitions to `round-complete`.
Otherwise, same as before (select next item, present question).

**New: `handleRoundTimerExpiry()`** → sets `roundTimerExpired = true`. If
already on feedback screen (answered + waiting for Space), immediately
transition to `round-complete`. If mid-question, do nothing (let user finish).

**New: `continueQuiz()`** → increments `roundNumber`, resets `roundAnswered` and
`roundCorrect` and `roundTimerExpired`, starts new 60s timer, calls
`nextQuestion()`.

**`stop()`** → clears round timer, returns to idle.

### Round Timer Implementation

- Single `setInterval` (or `requestAnimationFrame` loop) for the 60s countdown,
  running in `quiz-engine.js` alongside the existing engine.
- Display updates every second (no need for 50ms granularity like the old
  per-item bar).
- Timer counts down from 60 to 0. At 0, calls `handleRoundTimerExpiry()`.

### UI Layout During Active Round

```
┌─────────────────────────────────┐
│ Round 1                      ✕  │  ← quiz-header
├─────────────────────────────────┤
│        0:42    12 answers       │  ← session-stats (timer + count)
│     ████████████░░░░ 3/12 fluent│  ← progress-bar (unchanged)
├─────────────────────────────────┤
│                                 │
│   What note is at string 3,    │
│   fret 5?                       │
│                                 │
│   [C] [C#] [D] [D#] [E] ...   │  ← answer buttons (unchanged)
│                                 │
│   Correct!                      │  ← feedback (unchanged)
│   Tap anywhere for next         │
│                                 │
└─────────────────────────────────┘
```

### Timer Display Design

The `0:42` countdown should be visually prominent but not distracting:

- Larger than current `#N` text (use `--text-lg` or `--text-xl`)
- `font-variant-numeric: tabular-nums` for stable width
- Neutral color normally; transitions to `--color-error` in last 10 seconds
- Placed left in session-stats; answer count placed right

### Round-Complete Screen

Replaces quiz-area content when round ends:

```
┌─────────────────────────────────┐
│ Round 1                      ✕  │
├─────────────────────────────────┤
│                                 │
│          Time's up!             │  ← large heading
│                                 │
│     12 answers · 10 correct     │  ← round summary
│             83%                 │  ← accuracy percentage, large
│                                 │
│  ┌──────────┐  ┌──────────┐    │
│  │Keep Going│  │   Stop   │    │
│  └──────────┘  └──────────┘    │
│                                 │
└─────────────────────────────────┘
```

## Open Questions

1. **Should the round duration be configurable?** 60s is a good default. Adding
   30s/60s/90s options is straightforward but adds UI complexity. Recommend:
   ship with 60s fixed, consider making it configurable later if users ask.

2. **Should we show cumulative stats across rounds?** e.g., "Round 3 — 38
   answers total". Probably yes, as a secondary line on the round-complete
   screen. Low priority.

3. **Should the timer be visible in the last-question grace period?** When the
   timer hits 0:00 but the user is finishing a question, showing "0:00" is fine
   — it communicates "this is your last one" without being aggressive.

4. **Should we track questions-per-minute as a persistent stat?** Could be
   displayed on the idle screen as a trend. Out of scope for this change but a
   natural follow-up.
