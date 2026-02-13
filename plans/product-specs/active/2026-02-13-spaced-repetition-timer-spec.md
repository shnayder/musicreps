# Spaced Repetition Timer — Design Spec

## Overview

Add adaptive time pressure to quiz sessions so users transition from
accurate-but-slow "calculating" recall to fast automatic recall. A per-item
countdown timer gives the user a target response window calibrated so they
succeed roughly 75% of the time. When the timer expires before an answer, the
correct answer is revealed and the attempt counts as a miss.

## Problem

Users who reach 100% accuracy with slow recall are still mentally computing
answers (e.g. counting intervals, running through the alphabet). The existing
countdown bar is purely visual — it has no consequence when it expires. Without
real time pressure there is no incentive to push past the calculation stage
toward direct memory retrieval.

## Goals

- Push users from slow, accurate calculation to fast automatic recall
- Set per-item time limits that target ~75% success rate — challenging enough
  to force retrieval, generous enough that most attempts involve genuine recall
  (not just passively seeing the answer)
- Track and display the user's timed success rate within a session
- Auto-reveal the correct answer on timeout so the user always sees it

## Non-Goals

- Per-item response-time prediction model that estimates P(correct | time).
  A model-free adaptive approach (adjust deadline up/down based on outcomes)
  is simpler and sufficient.
- Persisting timer deadlines across sessions (session-scoped for now; the
  adaptive selector's EWMA already persists long-term speed data)
- Changing the adaptive selector's item-selection weights based on timer
  outcomes (the existing recordResponse path handles that)
- Gamification or streak mechanics around the timer

## Cognitive Science Rationale

The testing effect research shows that **successful retrieval** (actually
recalling the answer, even slowly) builds stronger memory than passive
recognition. Very short time limits cause too many timeouts, turning practice
into passive "see the answer" exposure. Very long limits remove the pressure
that forces the transition from calculation to direct recall.

The 75% target is a sweet spot: most attempts involve genuine retrieval effort,
while the ~25% failures still provide learning signal and keep the user at the
edge of their capability. As the user speeds up, the deadline tightens to
continue driving improvement.

## Feature Design

### Timer behavior

The spaced repetition timer replaces the existing visual-only countdown with a
consequential countdown. When the timer expires, the question is auto-answered
as a miss.

**Per-question flow:**

1. Question appears, countdown starts from the item's current deadline
2. User answers before timer expires → normal correct/incorrect handling
3. Timer expires before answer → auto-reveal correct answer, count as timeout

**After timeout:**

- Show the correct answer using the existing feedback display ("Time's up — C")
- Record the attempt as incorrect via `recordResponse(itemId, deadline, false)`
  so the adaptive selector treats it as a miss (stability decay, etc.)
- User taps/presses Space to advance, same as after a normal answer

### Deadline model

Use a **model-free staircase** approach per item. Each item starts with a
generous default deadline and adjusts up or down based on outcomes:

- **Starting deadline**: Use the item's EWMA from the adaptive selector if
  available (the user's actual average speed), with a generous multiplier.
  For unseen items or items with no EWMA, use the `automaticityTarget` from
  the adaptive config (which is already scaled by motor baseline).
- **After correct answer within deadline**: Decrease deadline by a factor
  (e.g. multiply by 0.85) — push harder
- **After timeout (or incorrect)**: Increase deadline by a factor (e.g.
  multiply by 1.4) — ease off

This naturally converges to a deadline where the user succeeds ~75% of the
time — the decrease factor is applied 3x as often as the increase factor at
equilibrium: `0.85^3 ≈ 0.614`, `1.4^1 ≈ 1.4`, product ≈ 0.86, which slowly
tightens. The exact factors should be tunable but these are reasonable
starting points.

**Floor and ceiling:**

- Minimum deadline: `minTime` from adaptive config (motor baseline floor —
  can't respond faster than physical reaction time)
- Maximum deadline: `maxResponseTime` from adaptive config (no point waiting
  longer than the clamp)

**Cold start strategy:**

For an item's first appearance with the timer:
- If the adaptive selector has an EWMA for the item: start at `ewma * 2.0`
  (generous — ~2x their average speed gives lots of room)
- If no EWMA (unseen item): start at `maxResponseTime` (9s default,
  baseline-scaled). Unseen items require working out the answer from scratch,
  not recall — `automaticityTarget` (3s) would be far too aggressive since
  that's calibrated for the midpoint of *learned* items. Starting at the
  generous ceiling lets the staircase tighten naturally as the user learns.

This avoids punishing users on unfamiliar items while still providing
meaningful time pressure on items they've practiced.

### Session success rate

Track and display what fraction of answers were submitted before the timer
expired (whether correct or incorrect — the timer metric is specifically
about speed, not accuracy):

- **Numerator**: answers submitted before timeout (correct or incorrect)
- **Denominator**: total questions presented
- **Display**: Show as a percentage in the session stats area, e.g. "Timer:
  72%"
- **Update**: After every question (timeout or answered)

This gives the user a single number representing how well they're keeping up
with the time pressure. The 75% target means this number should hover around
75% when the staircase has converged.

### Opt-in activation

The timer is **off by default**. Users opt in via a toggle in the quiz
controls area (alongside existing controls like string selection, naturals
only, etc.).

- **Toggle label**: "Timer" with on/off state
- **Persistence**: Save the toggle state per mode in localStorage
  (key: `timerEnabled_{storageNamespace}`)
- **Mid-quiz toggle**: The timer can be toggled during a quiz session.
  Turning it on mid-session starts the countdown on the next question.
  Turning it off mid-session stops the countdown immediately and hides the
  success rate display.

### Visual design

**Countdown bar changes:**

When the timer is active, the existing countdown bar gains real consequence:
- Shrinks from 100% to 0% over the item's deadline (same animation as today)
- On expiration: auto-submits as timeout (new behavior)

When the timer is off, the countdown bar works exactly as it does today
(visual-only, no auto-submit on expiration).

**Timeout feedback:**

- Feedback text: "Time's up — {correctAnswer}"
- Feedback class: `feedback incorrect` (same red styling as wrong answers)
- Time display: show the deadline that was active, e.g. "limit: 2.1s"

**Success rate display:**

- Location: in the session stats row, after question count and elapsed time
- Format: "Timer: 72%" (or similar compact format)
- Only visible when timer is enabled

**Timer toggle:**

- A small toggle/checkbox in the quiz controls area
- Styled consistently with existing controls (string toggles, naturals-only)

## Cross-cutting Design Notes

### Integration with existing countdown

The current `startCountdown()` in quiz-engine.js runs the bar animation and
adds an `.expired` class when time runs out, but takes no action on expiry.
The timer feature adds an expiry callback that auto-submits a timeout answer.
When the timer is disabled, the existing visual-only behavior is preserved.

### Integration with adaptive selector

Timer outcomes feed into the existing `recordResponse` path:
- Correct within deadline: `recordResponse(id, responseTime, true)` — same
  as today
- Incorrect within deadline: `recordResponse(id, responseTime, false)` — same
  as today
- Timeout: `recordResponse(id, deadline, false)` — treated as wrong answer
  with response time = deadline. This causes stability decay, which is the
  right behavior (the user couldn't recall in time).

### Per-item deadlines are session-scoped

Deadlines live in an in-memory map during the quiz session, initialized on
first appearance from EWMA or defaults. They are not persisted to localStorage.
This keeps the implementation simple and avoids stale deadline data. The
adaptive selector's EWMA (which is persisted) provides the warm-start data
for future sessions.

### Motor baseline scaling

All timing parameters (starting deadlines, floor, ceiling) derive from the
adaptive config which is already scaled by motor baseline. No additional
baseline handling is needed.

### Applicability across modes

The timer is a quiz-engine-level feature, available to all quiz modes. The
toggle and success rate display are part of the shared quiz scaffold. No
mode-specific changes are needed — every mode that uses `createQuizEngine`
gets the timer capability.

## State shape additions

```
EngineState additions:
  timerEnabled: boolean           // user preference (persisted per mode)
  timerSuccessCount: number       // answers submitted before timeout
  timerTotalCount: number         // total questions presented
  timedOut: boolean               // true if current question timed out

Session-scoped (in-memory, not in EngineState):
  itemDeadlines: Map<itemId, number>   // current deadline per item in ms
```

## Resolved Decisions

- **Model-free staircase over predictive model** — A staircase that adjusts
  deadline by fixed factors after success/failure is simpler, requires no
  training data, and naturally converges to the target success rate. A
  predictive model (P(correct | time)) would need more data per item and adds
  complexity without clear benefit for this use case.

- **75% success target** — Balances retrieval effort (testing effect) against
  passive exposure from too-frequent timeouts. Supported by desirable
  difficulty research. The factors (0.85 down, 1.4 up) produce approximately
  this ratio at equilibrium.

- **Off by default** — Users should build accuracy before adding time
  pressure. Forcing the timer on new users who are still learning item
  identities would cause frustrating timeout cascades. The existing
  "mastered" indicators help users know when they're ready for the timer.

- **Session-scoped deadlines** — Persisting deadlines adds storage complexity
  and risks stale data (a deadline from a week ago doesn't reflect current
  skill). Starting fresh from EWMA each session is simpler and the staircase
  converges quickly (a few presentations per item).

- **Timeout counts as incorrect for adaptive selector** — Even though the
  user didn't answer "wrong", they failed to recall in time, which should
  decay stability. This is consistent with the spaced repetition principle
  that failed retrieval = weaker memory trace.

- **Success rate tracks speed, not accuracy** — The timer success rate counts
  any answer submitted before timeout as a "timer success", regardless of
  whether the answer was correct. This separates the speed metric (am I fast
  enough?) from the accuracy metric (do I know it?). The existing progress
  bar already tracks accuracy/mastery.

- **Unseen items start at maxResponseTime, not automaticityTarget** —
  `automaticityTarget` (3s) is calibrated as the midpoint for *learned* items
  (speedScore = 0.5). Unseen items require calculation, not recall, and could
  easily take 5-9s. Starting at `maxResponseTime` (9s) avoids immediate
  timeout cascades on new material and lets the staircase tighten naturally.
