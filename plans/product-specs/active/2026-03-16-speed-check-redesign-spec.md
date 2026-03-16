# Speed Check Redesign — Product Spec

## Overview

Speed check measures the user's motor response time so the app can set
personalized timing thresholds. Currently it asks users to "tap the green
button" — a task that doesn't match the actual motor skill being calibrated.
Pressing a highlighted button tests visual reaction time, not the time it takes
to enter a known answer. The result is a baseline that may not accurately
reflect the user's real entry speed for different input types.

This redesign changes the interaction model: instead of tapping a highlighted
button, the user sees the answer and enters it, measuring how long the motor
entry takes when cognition isn't a factor. It also extracts speed check from
being embedded in individual quiz modes into a shared service that supports
multiple motor task types, since pressing a single note button, typing a chord
sequence, and pressing a number button are meaningfully different motor tasks.

**Source documents:**

- Original calibration screen spec:
  `plans/product-specs/completed/2026-02-12-calibration-screen.md`
- Mastery terminology decisions:
  `project_mastery_terminology_v4.md` (v4 speed levels)
- Current implementation: `src/ui/speed-check.tsx`, `src/quiz-engine.ts`

---

## Interaction Model

### Current: "Tap the green button"

A random note button is highlighted green. The user taps it. This measures
visual-reaction-to-tap latency, which conflates visual search time with motor
entry time and doesn't vary by answer input type.

### New: "Enter the shown answer"

The speed check presents a prompt with the answer visible, and the user enters
that answer using the same input method they use during practice. The prompt
tells the user exactly what to press.

Examples by motor task type:

- **Note button**: "Press F#" — user taps F# on the note button grid
- **Number**: "Press 7" — user taps 7 on the number pad
- **Chord sequence**: "Enter C Eb G Bb" — user taps C, then Eb, then G, then Bb

This measures the actual motor skill: given a known answer, how long does it
take to physically enter it? The cognitive component is removed by showing the
answer, isolating pure motor entry time.

### Trial structure

- 10 trials total, first 2 are warmup (discarded)
- Brief pause between trials (same as current ~400ms)
- Result: median of 8 scored trials
- Each trial presents a different answer to enter (randomized, no immediate
  repeats)

For multi-step entries (chord sequences), the trial measures total time from
first to last input, not per-note time. The baseline for chord entry should
reflect the full motor sequence.

---

## Motor Task Types

Different answer input methods have meaningfully different motor times. A single
note button press is faster than entering a 4-note chord sequence. Using one
baseline for both would produce inaccurate thresholds.

### Task type catalog

| Task type | Input method | Used by modes | Trial prompt example |
|-----------|-------------|---------------|---------------------|
| **note-button** | Tap one of 12 note buttons | Fretboard, Semitone Math, Interval Math, Scale Degrees, Diatonic Chords, Key Signatures (rev) | "Press F#" |
| **number** | Tap a number button | Note/Interval Semitones (fwd) | "Press 7" |
| **chord-sequence** | Tap 3-4 note buttons in order | Chord Spelling | "Enter C Eb G Bb" |
| **keysig** | Tap a key signature button | Key Signatures (fwd) | "Press 3b" |
| **fretboard-tap** | Tap positions on the fretboard SVG | Speed Tap | "Tap the highlighted positions" |

### Calibration storage

Each task type stores its own baseline independently. A mode requests the
baseline for its task type; if none exists, return a default 1-second-per-press baseline. A skill's progress and timing expectations should scale this by the number of taps in the answer. e.g. a two-note chord should have a default expected time of 2s, a four-note chord 4s. 

### Which types to implement first

**Phase 1: note-button only.** This covers 8 of 10 declarative modes (the
modes that answer with a note name). The interaction model change (show answer
instead of highlight button) applies here. Other task types use the default
baseline until their speed checks are built.

**Phase 2: number, chord-sequence, keysig.** Add as needed when timing accuracy
for these modes becomes a priority. 

**Phase 3: fretboard-tap.** Speed Tap's spatial input is a special case — the
"enter the shown answer" model applies differently here: "tap the
highlighted positions" is appropriate since the spatial search _is_ the
motor task.

## Entry point

The entry point for speed check remains unchanged -- the progress tab of individual skills. Copy should be updated to reflect which task type it is. e.g. "Response time for note input", "Response time for fretboard taps", or similar.

---

## Architecture: Speed Check as Shared Service

### Current state

Speed check is a Preact component (`SpeedCheck`) rendered inline within quiz
modes during a `calibrating` engine phase. The `BUTTON_PROVIDER` object defines
intro/trial text. Only one provider exists. The baseline is stored per-mode
namespace (`motorBaseline_{namespace}`).

### Redesign

Speed check becomes a standalone screen accessible from multiple entry points,
not embedded within a quiz mode's engine phases.

Key changes:

- **Per-task-type baselines** replace per-mode baselines. Modes that share a
  task type share a baseline. Storage key: `motorBaseline_{taskType}` (e.g.,
  `motorBaseline_note-button`).
- **Modes declare their task type.** Each mode definition specifies which motor
  task type it uses. The mode reads its baseline from the shared task-type
  storage.
- **Speed check should be reachable independently if we choose to do so.** For this redesign, keep it to just skill progress view, but it should be easy to add a dedicated speed check page. 

### Migration

No migration needed. We're changing what we're measuring in any case.

---

## Screen States

Speed check has three states: **intro**, **testing**, and **results**. Each is
a distinct layout.

### Intro

Primary intention: explain what's about to happen and let the user start.

**Content (top to bottom):**

1. Heading: "Speed Check"
2. Explanation text: "We'll show you the answer — enter it as fast as you can.
   This measures your entry speed so the app can set personalized timing
   targets. 10 quick trials."
3. Subtext noting the task type being calibrated (e.g., "Calibrating: note
   button entry") — helps the user understand what's being measured, especially
   if they've done speed checks for other task types.
4. **Start** button

**What's not shown:**

- No quiz progress bar (there's no quiz happening)
- No countdown timer
- No mode top bar — speed check is its own context. A close button (×) cancels
  the speed check and returns to the mode without updating the baseline.

### Testing

Primary intention: enter the shown answer as quickly as possible.

**Content (top to bottom):**

1. Prompt showing the answer to enter: "Press F#" or "Enter C Eb G Bb"
2. The appropriate answer input (note buttons, number buttons, etc.) — same
   components used during normal practice
3. Trial counter: "3 / 10"

**What's not shown:**

- No countdown bar — speed check measures response time, it doesn't count down
- No quiz progress bar
- No feedback (correct/wrong) — the user can only press the shown answer; wrong
  presses are ignored (same as current behavior)

**Key difference from current:** The answer is shown as text in the prompt area.
The buttons are displayed normally (not with one highlighted green). The user
reads the prompt and presses the matching button.

### Results

Primary intention: show the user their baseline and what it means.

**Content (top to bottom):**

1. Heading: "Speed Check Complete"
2. Measured baseline displayed prominently (e.g., "0.62s")
3. Thresholds table with speed level labels, color swatches, multipliers, and
   meanings:

| Color | Level | Max time | Meaning |
|-------|-------|----------|---------|
| (--heatmap-5 swatch) | Automatic | < {1.5x}s | Fully memorized — instant recall |
| (--heatmap-4 swatch) | Solid | < {3.0x}s | Solid recall, minor hesitation |
| (--heatmap-3 swatch) | Learning | < {4.5x}s | Working on it — needs practice |
| (--heatmap-2 swatch) | Hesitant | < {6.0x}s | Significant hesitation |
| (--heatmap-1 swatch) | Starting | >= {6.0x}s | Not yet learned |

4. **Done** button

The color swatches use the existing `--heatmap-*` CSS custom properties so users
connect speed check labels to the colors they see in progress heatmaps. The
level names match the v4 speed terminology: Automatic, Solid, Learning,
Hesitant, Starting.

**What's not shown:**

- No quiz progress bar

---

## Results Display: Terminology and Colors

### Speed level labels

The results table uses the v4 speed level terminology consistently:

| Level | P10 speed threshold | Multiplier of baseline | Heatmap color token |
|-------|-------------------|----------------------|-------------------|
| Automatic | >= 0.9 | < 1.5x | `--heatmap-5` |
| Solid | >= 0.7 | < 3.0x | `--heatmap-4` |
| Learning | >= 0.3 | < 4.5x | `--heatmap-3` |
| Hesitant | > 0 | < 6.0x | `--heatmap-2` |
| Starting | = 0 | >= 6.0x | `--heatmap-1` |

### Color swatches

Each row in the thresholds table includes a small color swatch (square or rectangle) filled with the corresponding heatmap color. This creates a direct
visual link: "When I see this shade of green in my progress heatmap, it means
Automatic." The swatches use the same `--heatmap-*` tokens that the heatmap
cells use, so the colors always match.

### "No data" row

The table does not include a "No data" row. The `--heatmap-none` color
(grey, unseen items) is not a speed level — it means the item has never been
attempted. It appears in heatmaps but doesn't belong in the speed check results.

---

## Entry Points

### From a mode's progress/practice tab

The current "Redo speed check" button in the progress tab continues to work.
When tapped, it launches the speed check for that mode's task type. The
`BaselineInfo` component shows the current baseline and a run/rerun button.

Label change: the button shows the task type being calibrated. For the common
case (note-button), it says "Redo speed check". If a mode had a different task
type, the button could say "Redo speed check (chord entry)" — but for phase 1
with only note-button, no qualifier is needed.

### Future possibility: standalone entry point

A standalone speed check accessible from the home screen or settings could let
users proactively calibrate without entering a specific mode. This is a natural
extension but not required for phase 1 — the mode-embedded entry points are
sufficient. 

(Note: we had calibrate-on-first-use before and removed it because jumping straight into reps was better. No current
plans to add it back.)

---

## Action Button Positioning

Start, Done, and other action buttons on speed check screens anchor to a
consistent position convenient for phone tapping. The action button sits at the
bottom of the content area, in the same zone where quiz-mode action buttons
(Start Quiz, Keep Going) appear. This maintains spatial consistency: the
primary action is always in the same thumb-reachable zone.

This follows the "Action gravity" principle — the next step is visually obvious
and spatially consistent across screens.

---

## Scope

### Goals

- Change the speed check interaction model from "tap highlighted button" to
  "enter the shown answer"
- Support per-task-type baselines so different answer input methods can have
  different calibrations
- Update results display to use v4 speed terminology with heatmap color swatches
- Remove the progress bar from speed check screens
- Remove countdown bar from the testing phase
- Consistent action button positioning across speed check states

### Non-goals

- Building speed checks for all task types in phase 1 (only note-button)
- Standalone speed check accessible from home screen (future extension)
- Changing the trial count, warmup count, or statistical method (median)
- Changing how modes use the baseline to derive thresholds (the
  `deriveScaledConfig` multipliers stay the same)
- Redesigning the BaselineInfo component in the progress tab (cosmetic refresh
  only if needed for terminology alignment)

---

## Resolved Decisions

- **"Enter the answer" over "tap the green button"**: The new model measures the
  actual motor task (entering a known answer) rather than visual reaction time.
  This produces a more accurate baseline for timing thresholds. The cognitive
  component is removed by showing the answer, isolating pure motor entry time.

- **Per-task-type baselines over per-mode baselines**: Multiple modes share the
  same answer input method (e.g., note buttons). Calibrating once for a task
  type is more efficient and avoids redundant speed checks. Modes that share an
  input method should share a baseline.

- **Phase 1 covers note-button only**: This single task type covers 8 of 10
  declarative modes. Other task types (number, chord-sequence, keysig) can be
  added incrementally without redesigning the architecture.

- **No progress bar during speed check**: Speed check is not a quiz — there's
  no countdown or question count to track. The progress bar belongs to the quiz
  flow, not the calibration flow. The trial counter ("3 / 10") provides
  sufficient progress indication.

- **No countdown bar during testing**: Speed check measures how fast the user
  responds. A countdown would create artificial time pressure that distorts the
  measurement. The user should respond at their natural speed.

- **Results use v4 speed level names**: Automatic, Solid, Learning, Hesitant,
  Starting — consistent with the terminology used in mode practice summaries and
  the recommendation pipeline. The previous labels (Good, Developing, Slow, Very
  slow) are replaced to eliminate terminology divergence.

- **Heatmap color swatches in results**: Users see these colors throughout the
  app in progress heatmaps. Showing the same colors alongside their speed-level
  meanings in the results table creates a direct visual connection, reducing the
  need to consult legends later. Uses `--heatmap-*` CSS tokens.

- **Consistent action button position**: Start and Done buttons anchor to the
  same screen zone as other mode action buttons. Spatial consistency reduces
  cognitive load and supports phone use (thumb-reachable zone).

- **No migration needed**: We're changing what we measure (motor entry time
  vs. reaction time), so existing baselines aren't meaningful. Users
  recalibrate naturally.

- **Speed Tap fretboard-tap calibration deferred**: The spatial input model for
  Speed Tap is different enough that the "enter the shown answer" approach needs
  separate design. The existing "tap the highlighted button" model may actually
  be appropriate for fretboard spatial tasks, since spatial search is the motor
  skill being measured. Defer to a later spec.
