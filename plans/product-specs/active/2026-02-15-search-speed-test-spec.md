# Search Speed Test — Design Spec

## Overview

The current speed test ("Quick Speed Check") measures raw motor speed: a button
highlights green, and the user taps it as fast as possible. This captures
physical response time but not the visual search component that's present in
real quiz questions — finding the right button among many.

The improved speed test tells the user *which answer to give*, so they still
don't need domain knowledge, but they do need to locate and press the correct
button. This makes the baseline a better proxy for the minimum achievable
response time on actual quiz questions.

## Current behavior

During calibration, a random button highlights green. The user taps that button
(or presses its keyboard shortcut). 10 trials, 2 warmup, median of remaining 8
becomes the motor baseline. All modes share one baseline via the `button`
calibration provider.

## New behavior

Instead of highlighting the target button, the speed test **tells the user
what to press** via a text prompt, and the user must find and press the correct
button themselves. The button is NOT highlighted — the user must visually
search the button layout.

### Per-mode prompt format

The prompt appears in the feedback area (where "Speed check!" currently shows).

| Mode category | Prompt example | What user does |
|---|---|---|
| Note selection (fretboard, semitone math, interval math, key sigs, scale degrees, diatonic chords) | "Press **F#**" | Find and tap the F# button |
| Interval selection (interval↔semitones) | "Press **P5**" | Find and tap the P5 button |
| Chord spelling | "Press **C G E**" | Press C, then G, then E sequentially |
| Speed tap | "Press the highlighted note" | Same as current (button highlights green) |

Note: note↔semitones calibration uses note buttons (not number buttons), so it
falls into the "note selection" category above. This matches the current
behavior where calibration always uses note buttons regardless of question
direction.

### Why speed tap keeps the current behavior

Speed tap's actual quiz task involves tapping fretboard positions, not buttons.
The button-based calibration is already an approximation. Adding a text search
component on top would make the baseline less representative, not more. The
existing "tap the highlighted button" approach is the right match.

### Chord spelling: sequential multi-press

Chord spelling answers require pressing multiple notes in sequence. The speed
test should mirror this:

- Prompt shows e.g. "Press **C G E**"
- User presses C, then G, then E in order
- Each correct press advances to the next note (the current target could be
  shown bold or underlined in the prompt)
- Time measured from prompt display to final note pressed
- This is one trial (counts as 1 of 10), not 3 separate trials

The notes shown should be random selections of 2–4 notes from the chromatic
scale (matching realistic chord lengths). They don't need to be actual chord
spellings.

### Accidentals in prompts

When the calibration buttons include sharps/flats (not just naturals), prompts
should include accidentals some of the time. This ensures the baseline captures
the cost of finding accidental buttons, which matters for actual quiz performance.

Roughly 30–40% of prompts should use accidentals when the mode includes them.

### Keyboard shortcuts during search trials

Keyboard input continues to work. Typing the letter (or letter + #/b for
accidentals) submits the answer, same as clicking the button. This is
intentional — the baseline should reflect the user's actual input method.

### Intro screen text update

The intro text should change from:

> "We'll measure your tap speed to set personalized targets. Tap each
> highlighted button as fast as you can — 10 taps total."

To:

> "We'll measure your response speed to set personalized targets. Press the
> button shown in the prompt — 10 rounds total."

The chord spelling variant:

> "We'll measure your response speed to set personalized targets. Press the
> notes shown in the prompt, in order — 10 rounds total."

### Results screen

No changes to the results screen. The threshold table and baseline display
remain the same.

### Chord spelling baseline normalization

Chord spelling trials involve 2–4 button presses per trial. To keep the shared
baseline comparable across modes, the baseline calculation should use per-press
times, not per-trial times. Each individual press in a multi-press sequence is
recorded as a separate time sample (from prompt display or previous press to
current press). This way chord spelling contributes per-button search times to
the median, just like single-press modes.

### Screen states

**Intro screen**: Same layout as current — heading in feedback area, explanation
in hint area, Start button below. Only the text changes (see intro text update
above).

**During trials**: The prompt text (e.g., "Press F#") appears in the feedback
area where "Speed check!" currently shows. The hint area shows "Find and press
the button". Trial counter ("3 / 10") remains in the time display area. Answer
buttons are visible but none are highlighted. Wrong presses are silently
ignored.

**Results screen**: No changes.

## Resolved decisions

- **Speed tap keeps highlight behavior** — its quiz interaction (fretboard taps)
  is fundamentally different from the button calibration, so adding text search
  to calibration wouldn't improve the baseline's representativeness.

- **Chord spelling uses multi-press trials** — a single-button trial wouldn't
  capture the sequential search cost that dominates real chord spelling answers.
  The trial count stays at 10 (each multi-press sequence is one trial).

- **Shared baseline stays shared** — all `button` provider modes still share one
  baseline. The search component is similar enough across note-button and
  interval-button modes that a shared baseline is appropriate. Chord spelling
  uses per-press times (not per-trial) to contribute comparable samples to the
  shared baseline.

- **No per-button visual feedback during search trials** — the target button
  should NOT highlight when the user finds it. The prompt text is the only
  indication. Incorrect presses are simply ignored (same as current behavior
  with calibration).

- **Accidental frequency ~30–40%** — enough to capture the search cost without
  making calibration feel unrepresentative for modes that rarely use accidentals.
