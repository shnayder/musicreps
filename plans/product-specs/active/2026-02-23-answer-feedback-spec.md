# Answer Feedback — Design Spec

> **Superseded.** The button-highlighting design below was replaced by a simpler
> feedback banner approach — see
> [2026-02-23-answer-feedback.md](../../../exec-plans/active/2026-02-23-answer-feedback.md)
> (v2: Feedback Banner). The banner shows the correct answer in green (correct)
> or "No, {answer}" in red (wrong) between the prompt and the buttons, avoiding
> the finger-occlusion and visual-noise problems described in that plan.

## Overview

Replace the text-based feedback line ("Correct!" / "Incorrect — B") with
button-level visual feedback. When the user answers, the button they tapped
flashes green (correct) or red (wrong). On a wrong answer the correct button
simultaneously highlights green, so the user sees both their mistake and the
right answer in one glance.

## Standard modes (single-step answer)

Applies to: Guitar Fretboard, Ukulele Fretboard, Note ↔ Semitones, Interval ↔
Semitones, Semitone Math, Interval Math, Key Signatures, Scale Degrees, Diatonic
Chords.

### Correct answer

1. User taps a button.
2. That button flashes **green** (success color).
3. All other buttons become disabled (as today).
4. After 1s (or manual advance), next question loads and all buttons reset to
   neutral.

### Wrong answer

1. User taps a button.
2. That button flashes **red** (error color).
3. The correct button simultaneously highlights **green**.
4. All other buttons become disabled.
5. After 1s (or manual advance), next question loads and all buttons reset to
   neutral.

### Button visual states

| State           | Background             | Border                 | Text color             |
| --------------- | ---------------------- | ---------------------- | ---------------------- |
| Neutral         | `--color-bg`           | `--color-text-muted`   | `--color-text`         |
| Correct flash   | `--color-success-bg`   | `--color-success`      | `--color-success-text` |
| Wrong flash     | `--color-error-bg`     | `--color-error`        | `--color-error-text`   |
| Correct reveal  | `--color-success-bg`   | `--color-success`      | `--color-success-text` |
| Disabled        | unchanged              | unchanged              | opacity 0.5            |

"Correct flash" and "correct reveal" look the same — the distinction is
semantic (user tapped it vs. system is showing it). Same CSS class.

Transitions use the existing 0.15s ease timing for background, border-color, and
color. No keyframe animations — just CSS class swaps that trigger transitions.
This respects `prefers-reduced-motion` automatically since the existing media
query already collapses `transition-duration` to 0.01ms.

### What replaces the feedback text

The visible feedback text line (`FeedbackDisplay`) is **removed**. The button
colors carry the feedback. The hint text ("Tap anywhere or press Space for
next") and time display remain — they move into the space where the feedback text
was.

For screen readers: add a visually-hidden `aria-live="polite"` region that
receives the same text the old `FeedbackDisplay` showed ("Correct!" /
"Incorrect — B"). Sighted users see button colors; screen reader users hear the
announcement.

### Modes with two button groups

Some modes show two answer button sets and hide one based on question direction
(e.g., Note ↔ Semitones shows NoteButtons for reverse, NumberButtons for
forward). The flash applies to whichever button group is visible — the hidden
group is unaffected.

### Piano-layout buttons (PianoNoteButtons)

Fretboard modes use the piano-style button layout (accidental row + natural
row). The flash works identically — same CSS classes, same timing. The
two-row layout doesn't change the interaction.

## Multi-step mode: Chord Spelling

Chord Spelling already has per-step slot coloring (ChordSlots turns green/red as
each note is entered). The buttons should **also** flash per step to be
consistent with the rest of the app:

1. User enters a note.
2. The tapped button flashes green (correct) or red (wrong, with the correct
   button highlighted green) — same as standard modes.
3. Buttons reset to neutral after a brief pause (~300ms or when the next step
   activates, whichever comes first) so the user can tap again for the next note.
4. ChordSlots continues to show cumulative per-step results (as today).

The slot coloring and button flash are complementary: slots show cumulative
progress, buttons show instant feedback on the current step.

### Mid-question hints

When the user enters a wrong note partway through a chord, the correct button
highlighting green reveals that note. This is intentional — it gives the user a
hint mid-question, helping them learn the chord incrementally rather than failing
the whole thing. Example: entering C, F for C major shows that E was the correct
second note before the user enters the third. This is fine.

## Speed Tap mode

Speed Tap already flashes tapped fretboard circles green/red (800ms revert for
wrong). Two additions:

### Show the correct position on wrong tap

When the user taps the wrong position, the tapped circle flashes **red** (as
today) and the correct position on **that same string** simultaneously
highlights **green**. This tells the user exactly where they should have tapped.

If the target note appears in two positions on the string (e.g., open string and
12th fret), highlight whichever is closer to the tapped position. If equidistant,
highlight the lower fret.

### Timing

Keep the existing 800ms revert for wrong taps. The correct-position green
highlight appears simultaneously and reverts on the same 800ms timer.

## What does NOT change

- Auto-advance timing (1s for standard modes, 600ms for round-expired).
- Manual advance via Space/Enter/tap (clears flash immediately, moves to next
  question).
- Engine state fields (`feedbackText`, `feedbackClass`) — these still get set
  for the aria-live region; they just no longer drive visible UI.
- Keyboard shortcuts for answering.
- Stats display, heatmap colors, round-complete screen.
- Calibration flow (calibration uses its own UI, not answer buttons).

## Resolved decisions

- **Simultaneous, not sequential**: wrong-button red and correct-button green
  appear at the same time. Faster visual comparison, no sequencing complexity.
- **Remove visible feedback text**: button colors are sufficient for sighted
  users. Aria-live region preserves screen reader access.
- **Same 1s timing for correct and wrong**: keep it snappy. The simultaneous
  red/green highlight is legible in 1s.
- **Chord Spelling buttons flash per step**: consistent with the rest of the
  app. Slots and buttons are complementary (cumulative vs. instant).
- **Speed Tap shows correct position on same string**: scoped to the string the
  user was supposed to tap. Closest fret wins if the note appears twice.
