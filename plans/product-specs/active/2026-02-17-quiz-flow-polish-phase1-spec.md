# Quiz Flow Polish: Phase 1 — Design Spec

Phase 1 (flow fixes) from the
[Quiz Polish exploration](../../design-docs/2026-02-17-quiz-polish.md).

## Overview

The quiz works but the flow has two rough edges that undermine the "minimal
friction" principle. First, new users are forced through a 10-trial speed check
before they can start practicing — derailing their intent. Second, when the
round timer expires mid-question, nothing signals that this is the last question
— the experience just silently changes. Phase 1 fixes both flow issues so every
state transition feels intentional and nothing stands between the user and
drilling.

---

## 1. Remove calibration gate from the start flow

### Problem

On first visit to any mode, the user taps in wanting to drill. Instead, they're
presented with "Quick Speed Check" — an unexplained 10-trial calibration
exercise. After completing it, they land back on the idle screen and _still_
have to press Start Quiz. The speed check:

- Interrupts the user's intent (they came to practice, not calibrate)
- Doesn't explain why it matters
- Can't be skipped
- Adds ~15 seconds of friction before the first real question

### Design

**Remove the calibration gate entirely.** The speed check should never
auto-trigger when entering a mode. The app works fine without it — the adaptive
system uses reasonable fixed thresholds and the speed heatmap uses a sensible
default. Calibration improves accuracy of speed-based features but isn't
required.

**New first-visit flow:**

```
User opens mode → idle (Practice tab) → Start Quiz → active (quizzing)
```

No interruption. No "Quick Speed Check". Straight to drilling.

### Where calibration moves

Calibration belongs on the **Progress tab**, where it serves the user who's
actively examining their speed data and wants it to be more accurate. This
follows "one screen = one primary intention" — the Practice tab is for launching
practice, the Progress tab is for understanding progress.

**Progress tab with no baseline:**

When a user visits the Progress tab and hasn't done a speed check, show the
default and a prompt explaining what speed check does and offering it:

```
Progress tab (Speed view, no baseline)

[Recall]  [Speed]            ← toggle. Either selected.

Response time baseline: 1s _default_. Do a speed check (10 taps, ~15 seconds) to track progress more accurately.
[Speed check]

(heatmap / stats below, using default baseline)
```

The prompt is **non-blocking** — the user can see their data below it. The
heatmap renders normally using the default baseline. The prompt just explains
that calibration would make it more accurate.

**Progress tab with baseline:**

Once calibrated, replace the prompt with a compact info line

```
Response time baseline: 0.8s   [Rerun speed check]
```

This gives the user visibility into their current baseline and a way to redo it
if they want to update it. The recalibrate action is appropriately deprioritized
— small text, not a prominent button.

This is identical for both Recall and Speed views.

### Practice tab changes

- Remove the "Advanced" collapsed section containing "Redo speed check". That
  section is vestigial (contains only one button) and violates "one screen = one
  primary intention."
- No other Practice tab changes. The recommendation system, scope toggles, and
  Start Quiz button remain exactly as they are.

### Calibration flow itself

The calibration exercise (intro → 10 trials → results) is unchanged. Only its
trigger point moves: instead of auto-launching on mode activation, it launches
from the Progress tab's [Speed check] / [Rerun speed check] button. After the
speed check completes (user sees results and taps Done), the user returns to the
Progress tab with their new baseline applied.

---

## 2. Signal "last question" when round timer expires

### Problem

When the 60-second timer expires while the user is mid-question, nothing changes
visually. The countdown bar depletes to zero and the timer reads 0:00, but the
question stays on screen with no indication that this is the final question. The
user doesn't know:

- Whether the round is over (it looks like it might be — the bar is empty)
- Whether they should still answer (they should — the question is live)
- What happens after they answer (auto-transition to round complete)

The result is a moment of uncertainty during what should be a smooth transition.

### Design

**Add a clear "last question" signal.** When the timer expires mid-question, the
user should immediately understand: "time's up, but finish this one."

**What changes when the timer hits zero mid-question:**

1. **Countdown bar freezes at zero** — the bar stays visible at 0% width (empty
   track still showing) rather than disappearing. This maintains the visual
   landmark. The fill color stays at its final state (the warning color from the
   last 10 seconds).

2. **Timer text shows "0s"** — frozen, not removed. Combined with the empty bar,
   this clearly communicates "time has run out."

3. **"Last question" label appears** — a brief text label appears in or near the
   session info row: "Last question". This is the primary signal that tells the
   user what's happening. It should be noticeable but not alarming — this is
   normal, not an error. Use the same muted style as other session info text,
   perhaps slightly emphasized (e.g., medium weight instead of regular).

4. **Answer buttons stay active** — the question remains fully answerable.
   Nothing about the answer interaction changes.

5. **After answering** — brief feedback (as today), then automatic transition to
   the round-complete screen. No manual advance needed.

**What this looks like in sequence:**

```
Timer at 0:03... user is thinking about the current question
  → Countdown bar nearly empty, warning color
  → Timer shows "0:03"

Timer hits 0:00...
  → Countdown bar: empty track visible, fill gone
  → Timer shows "0:00" (frozen)
  → "Last question" appears in session info area
  → Answer buttons still active, user answers normally

User taps answer...
  → Brief feedback shown (correct/incorrect)
  → Auto-transition to round-complete screen
```

**When timer expires during feedback** (user already answered, waiting for
auto-advance): transition immediately to round-complete — no "last question"
label needed since the user isn't making a decision.

---

## Updated screen states

### idle

Practice tab and Progress tab as described above (minus the Advanced section,
plus the speed check prompt on Progress tab).

### active → "last question" micro-state

A visual sub-state within active quizzing. Not a new engine phase — just a
visual treatment when `timer = 0` and the user hasn't answered yet.

| Element        | Normal active   | "Last question"                   |
| -------------- | --------------- | --------------------------------- |
| Countdown bar  | Depleting fill  | Empty track, no fill              |
| Timer text     | Counting down   | "0:00" frozen                     |
| Session info   | Context + count | Context + "Last question" + count |
| Answer buttons | Active          | Active (unchanged)                |
| Question       | Displayed       | Displayed (unchanged)             |

### round-complete (unchanged)

No changes to the round-complete screen in Phase 1. IA improvements to this
screen are planned for Phase 2.

---

## Scope

### In scope

- Remove auto-triggering calibration on mode activation
- Remove "Advanced" collapsed section from Practice tab
- Add calibration prompt to Progress tab (Speed view, no baseline)
- Add baseline info + recalibrate to Progress tab (Speed view, with baseline)
- Add "last question" visual signal when timer expires mid-question

### Out of scope

- Calibration prompt on home screen (deferred — evaluate after seeing how
  Progress tab placement works)
- Changes to the calibration exercise itself (intro, trials, results screens)
- Round-complete screen IA changes (Phase 2)
- Practice card restructuring (Phase 2)
- Any visual/color/animation changes (Phases 3–4)
- Pause button (low priority, deferred indefinitely)

---

## Resolved decisions

- **Calibration trigger**: remove auto-trigger, move to Progress tab — the speed
  check serves progress evaluation, not quizzing. The app works fine with
  default thresholds; calibration is an accuracy improvement, not a requirement.

- **Default baseline behavior**: use existing defaults (fixed adaptive
  thresholds, 1000ms fallback for speed heatmap). No synthetic baseline or
  "estimated" baseline — just the defaults, with a clear prompt explaining
  calibration improves accuracy.

- **Calibration prompt location**: Speed view only, not Recall view —
  calibration only affects speed-based features. Showing it in Recall view would
  confuse the relationship.

- **"Advanced" section**: remove entirely rather than moving content — the only
  item (Redo speed check) moves to the Progress tab. No other Advanced content
  exists or is planned.

- **"Last question" signal**: text label + frozen timer, not a modal or overlay
  — the signal should be informative, not interruptive. The user is mid-question
  and shouldn't be pulled out of their flow.

- **Countdown bar at zero**: keep the empty track visible, don't hide the bar —
  hiding it would remove a visual landmark the user has been watching for 60
  seconds. The empty track + "0:00" clearly communicates "time's up."

- **Timer expiry tone**: no audio signal — the app has no audio currently and
  adding it for this one moment would be inconsistent. Visual signal only.
