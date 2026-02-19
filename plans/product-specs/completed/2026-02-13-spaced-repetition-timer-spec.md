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
- Set per-item time limits that target ~75% success rate — challenging enough to
  force retrieval, generous enough that most attempts involve genuine recall
  (not just passively seeing the answer)
- Auto-reveal the correct answer on timeout so the user always sees it

## Non-Goals

- Per-item response-time prediction model that estimates P(correct | time). A
  model-free adaptive approach (adjust deadline up/down based on outcomes) is
  simpler and sufficient.
- Changing the adaptive selector's item-selection weights based on timer
  outcomes (the existing recordResponse path handles that)
- Gamification or streak mechanics around the timer
- Separate "speed" vs "accuracy" metrics visible to the user — a single
  correct/incorrect outcome is enough

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

The existing visual-only countdown becomes a consequential countdown. When the
timer expires, the question is auto-answered as a miss. The timer is always
active — no toggle or setting needed.

**Per-question flow:**

1. Question appears, countdown starts from the item's current deadline.

- the starting value should be shown next to the timer, rounded to tenth of a
  second (e.g. 2.4s)

2. User answers before timer expires → normal correct/incorrect handling
3. Timer expires before answer → auto-reveal correct answer, count as miss

**After timeout:**

- Show the correct answer using the existing feedback display ("Time's up — C")
- Record as incorrect so the adaptive selector treats it as a miss (stability
  decay, etc.)
- User taps/presses Space to advance, same as after a normal answer

### Deadline model

Use a **model-free staircase** approach per item. Each item starts with a
generous default deadline and adjusts up or down based on outcomes:

- **After correct answer within deadline**: Decrease deadline by a factor (e.g.
  multiply by 0.85) — push harder
- **After timeout (or incorrect)**: Increase deadline by a factor (e.g. multiply
  by 1.4) — ease off

This naturally converges to a deadline where the user succeeds ~75% of the time
— the decrease factor is applied 3x as often as the increase factor at
equilibrium: `0.85^3 ≈ 0.614`, `1.4^1 ≈ 1.4`, product ≈ 0.86, which slowly
tightens. The exact factors should be tunable but these are reasonable starting
points.

**Floor and ceiling:**

- Minimum deadline: motor baseline floor (can't respond faster than physical
  reaction time), multiplied by a margin factor (set to 1.3 to start) to leave
  room for calibration noise, differences between calibration task and the
  actual task.
- Maximum deadline: max response time clamp (no point waiting longer)

**Cold start strategy:**

For an item's first appearance with the timer:

- If the adaptive selector has an EWMA for the item: start at `ewma * 2.0`
  (generous — ~2x their average speed gives lots of room)
- If no EWMA (unseen item): start at `maxResponseTime` (9s default,
  baseline-scaled). Unseen items require working out the answer from scratch

This avoids punishing users on unfamiliar items while still providing meaningful
time pressure on items they've practiced.

### Deadline persistence

Deadlines are **persisted across sessions**. Users often practice in short
bursts (a few minutes between activities), so a session may only present each
item once or twice — not enough for the staircase to converge. Persisting
deadlines means progress carries over and the timer gets appropriately
challenging without a slow warm-up every session.

Storage is per-item, alongside the adaptive selector's existing per-item stats.

### Visual design

**Countdown bar:**

Countdown duration is the item's current deadline. On expiration, auto-submit as
timeout.

Show the deadline next to the timer, rounded to tenth of a second (e.g. 2.4s).
If it's positioned right next to the timer bar, it shouldn't need a label.

**Timeout feedback:**

- Feedback text: "Time's up — {correctAnswer}"
- Same red styling as wrong answers
- Time display: if the user answers before the deadline, their actual response
  time, rounded to nearest 0.1. e.g. "Response time: 1.2s"

**Answer outcomes:**

Timeout counts as incorrect. Show "Time's up — C" for timeout, keep "Incorrect —
C" for wrong answer. Use the same "incorrect" styling for both.

## Cross-cutting Design Notes

### Integration with adaptive selector

Timer outcomes feed into the existing recording path:

- Correct within deadline: recorded as correct with actual response time
- Incorrect within deadline: recorded as incorrect with actual response time
- Timeout: recorded as incorrect. This causes stability decay, which is the
  right behavior (the user couldn't recall in time).

### Motor baseline scaling

All timing parameters (starting deadlines, floor, ceiling) derive from the
adaptive config which is already scaled by motor baseline. No additional
baseline handling is needed.

### Applicability across modes

The timer is a quiz-engine-level feature, available to all quiz modes. No
mode-specific changes are needed — every mode that uses the quiz engine gets the
timer capability.

## Resolved Decisions

- **Model-free staircase over predictive model** — A staircase that adjusts
  deadline by fixed factors after success/failure is simpler, requires no
  training data, and naturally converges to the target success rate. A
  predictive model (P(correct | time)) would need more data per item and adds
  complexity without clear benefit for this use case.

- **75% success target** — Balances retrieval effort (testing effect) against
  passive exposure from too-frequent timeouts. Supported by desirable difficulty
  research. The factors (0.85 down, 1.4 up) produce approximately this ratio at
  equilibrium.

- **Always on, no toggle** — Fewer user-facing options is better when we can get
  away with it. The generous cold start (maxResponseTime for unseen, 2x EWMA for
  seen) means the timer is unobtrusive for new items and only becomes
  challenging as the user improves. No need to burden the user with a decision
  about when to turn it on.

- **Persist deadlines across sessions** — Sessions are often short (a few
  minutes in free moments). Without persistence, the staircase restarts from a
  generous default every time — the user never reaches meaningful time pressure
  on items they see infrequently. Persistence lets challenge level carry over.

- **Timeout counts as incorrect** — Even though the user didn't answer "wrong",
  they failed to recall in time, which should decay stability. Consistent with
  the spaced repetition principle that failed retrieval = weaker memory trace.

- **Single user-facing outcome metric** — Correct or incorrect, period. Timeouts
  are just a kind of incorrect. No separate speed/accuracy metrics — that adds
  cognitive overhead for the user without clear benefit. The staircase handles
  the speed progression internally.

- **Unseen items start at maxResponseTime, not automaticityTarget** —
  `automaticityTarget` (3s) is calibrated as the midpoint for _learned_ items
  (speedScore = 0.5). Unseen items require calculation, not recall, and could
  easily take 5-9s. Starting at `maxResponseTime` (9s) avoids immediate timeout
  cascades on new material and lets the staircase tighten naturally.
