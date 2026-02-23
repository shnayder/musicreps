# Keyboard Input UX — Design Spec

## Overview

Keyboard input works across all 10 quiz modes but is completely invisible. Users
have no way to discover that keyboard shortcuts exist, get no visual feedback
while typing, and can't tell whether a keypress has been committed or is still
buffering. This spec designs two features: (a) a keyboard hint shown to
non-phone users, and (b) progressive visual narrowing on the answer buttons as
the user types.

## Problem

- Keyboard shortcuts exist but are undiscoverable — nothing in the UI mentions
  them
- No visual feedback during typing — the user can't tell if their keypress
  registered or what will happen next
- The 400ms accidental buffer is invisible — after typing "C", the user doesn't
  know whether C was submitted or whether the system is waiting for "#" or "b"
- Solfège mode buffers multi-character syllables ("d" → waiting for "o") with no
  indication of state
- Number input has similar buffering for two-digit values (typing "1" waits for
  a possible second digit)
- Power users who would benefit most from keyboard input have no way to learn it

## Goals

- Help keyboard users discover that shortcuts exist
- Give immediate visual feedback on every keypress so the user always knows
  what's happening
- Make the accidental/digit buffer visible and intuitive
- Work across all quiz modes that accept typed input

## Non-Goals

- Changing the underlying keyboard handler logic (key bindings, timing, routing)
- Adding keyboard shortcuts for navigation, settings, or non-answer input
- Supporting keyboard input on mobile (this is about surfacing what already
  exists on desktop)
- Custom key rebinding

## Feature 1: Keyboard Hint

### Who sees it

Show the hint to users with a fine pointer (mouse/trackpad). Use
`@media (pointer: fine)` — this correctly hides it on phones and most tablets,
and shows it on desktops and laptops. A tablet user with a Bluetooth keyboard is
an edge case we can revisit if it comes up; the hint is a convenience, not a
gate.

The hint is CSS-only visibility — the element is always in the DOM, just hidden
on touch-primary devices. No JS device detection needed.

### What it says

The hint text varies by answer type:

| Answer type      | Hint text                                       | Modes using it                                       |
| ---------------- | ----------------------------------------------- | ---------------------------------------------------- |
| Note (letter)    | **Keyboard:** C D E … or C# Db (type # b s)    | Fretboard, Semitone Math, Interval Math, Chord Spelling, Key Sigs*, Scale Degrees*, Diatonic Chords* |
| Note (solfège)   | **Keyboard:** do re mi … or do# reb             | Same modes when solfège is enabled                   |
| Number 0–11      | **Keyboard:** 0–9, 10, 11                       | Note↔Semitones (forward direction)                   |
| Number 1–12      | **Keyboard:** 1–9, 10, 11, 12                   | Interval↔Semitones (forward direction)               |
| Interval name    | _(no keyboard hint — no keyboard handler today)_ | Interval↔Semitones (reverse direction)               |
| Key sig label    | _(no keyboard hint — no keyboard handler today)_ | Key Sigs (forward direction)                         |
| Degree label     | _(no keyboard hint — no keyboard handler today)_ | Scale Degrees (forward direction)                    |
| Roman numeral    | _(no keyboard hint — no keyboard handler today)_ | Diatonic Chords (forward direction)                  |

*These bidirectional modes show note input in one direction and a non-keyboard
input type in the other. The hint should reflect the current question's answer
type — show it when keyboard input applies, hide it when it doesn't.

### Where it appears

Below the answer buttons, as a single line of muted helper text. Same visual
weight as the existing "tap anywhere for next" hint — tertiary, glanceable, not
competing with the question or answer buttons.

### When it appears

- Visible during the **answering phase** of the quiz (when buttons are active)
- Hidden during feedback, between-question transitions, and calibration
- Hidden on the idle/stats screen (no buttons to explain)
- Persistent across questions within a quiz session (not a one-time tooltip that
  could be missed)

## Feature 2: Progressive Narrowing

### Core idea

As the user types, highlight the answer buttons that still match the partial
input. This replaces the invisible buffer with a visible, intuitive preview of
what will happen.

### How it works — note input (letter mode)

1. User types `C` → buttons **C** and **C#** both highlight as "possible
   matches." All other buttons dim slightly.
2. Three ways to resolve:
   - Type `#` or `s` → **C#** commits immediately, highlighting clears
   - Type `b` → **Cb** commits immediately, highlighting clears
   - Type another note letter (e.g., `D`) → **C** commits (natural), then
     **D** and **D#** highlight as new possible matches
   - Wait 400ms → **C** auto-commits (existing timeout behavior), highlighting
     clears
3. If accidentals are disabled (e.g., naturals-only mode on fretboard), typing
   `C` highlights only **C** and commits immediately — no buffer, no wait.

### How it works — note input (solfège mode)

1. User types `d` → no buttons highlight yet (ambiguous — could be "do")
2. User types `o` → syllable resolves to "do" = C. Buttons **C** and **C#**
   highlight as possible matches (same as letter mode after resolving the note).
3. Resolution follows the same three paths: accidental key, new syllable start,
   or timeout.

Since solfège syllables require two characters before the note is known, the
first keypress won't narrow the buttons. That's fine — the user gets feedback on
the second keypress, which is when the note resolves.

### How it works — number input

1. User types `1` → buttons **1**, **10**, **11**, and **12** all highlight
   (any number starting with 1).
2. Three ways to resolve:
   - Type `0` → **10** commits immediately
   - Type `1` → **11** commits immediately
   - Type `2` → **12** commits immediately
   - Wait 400ms → **1** auto-commits
3. Digits 2–9 commit immediately with no buffer and no highlighting delay.

### Visual treatment of highlighted buttons

Two states beyond the default:

- **Possible match** — the button is a candidate for the current partial input.
  Visual: thicker border in brand color (green), subtle background tint.
  Distinct from hover (which uses surface-hover gray) and from
  correct/incorrect feedback colors.
- **Dimmed** — the button is not a possible match. Visual: reduced opacity
  (e.g., 0.4). Buttons are still visible but clearly de-emphasized.

When no keys have been typed (or after a commit clears the buffer), all buttons
return to their default state — no highlighting, no dimming.

These states must be visually distinct from:
- **Hover** (surface-hover gray background, dark border) — mouse hovering
- **Active/pressed** (surface-pressed background, scale down) — finger/click
- **Correct feedback** (green) — shown after correct answer
- **Incorrect feedback** (red) — shown after wrong answer
- **Disabled** (0.5 opacity, no cursor) — buttons inactive between questions

### Interaction with existing feedback

Progressive narrowing is only active during the **answering phase**. When an
answer is submitted (whether by keyboard commit or button tap), narrowing clears
immediately and the normal correct/incorrect feedback takes over. No visual
state conflict.

### Chord Spelling mode

Chord Spelling already has sequential note slots that fill in one at a time.
Progressive narrowing works the same way — it highlights which note buttons
match the partial keyboard input for the *current* slot. The per-slot visual
(filled vs. empty) is orthogonal to the per-button narrowing.

## Cross-Cutting Design Notes

- **No changes to key bindings or timing.** The 400ms buffer, the key
  assignments, and the routing logic all stay the same. This spec is purely
  about surfacing what's already happening.
- **Button components gain a "narrowing" prop.** Each button component
  (`NoteButtons`, `PianoNoteButtons`, `NumberButtons`, etc.) needs to accept a
  set of highlighted button IDs and apply the possible-match / dimmed styles.
  The keyboard handler needs to expose its current partial state so the mode
  component can derive which buttons to highlight.
- **Solfège/letter mode switching.** The hint text and narrowing logic must
  follow the current notation mode (letter vs. solfège). When the user switches
  modes in settings, the hint updates and any pending buffer clears.
- **Works alongside button taps.** Tapping a button still works exactly as
  before — it submits immediately with no buffer. Narrowing only activates on
  keyboard input. If the user switches between keyboard and taps within a
  session, both work without conflict.
- **Accessibility.** The hint is plain text, readable by screen readers. The
  narrowing states use border color and opacity (not color alone) so they're
  distinguishable for colorblind users. Dimmed buttons are still visible
  (opacity 0.4, not 0).

## Resolved Decisions

- **Device detection: `@media (pointer: fine)` over viewport width.** The
  existing 599px breakpoint would hide the hint on small desktop windows and
  show it on large tablets — both wrong. Pointer detection matches actual input
  capability. We accept that tablet + Bluetooth keyboard users won't see the
  hint; the keyboard still works, they just won't get the hint text.

- **Hint placement: below buttons, not above.** The question → buttons flow is
  the primary visual path. The hint is supplementary — it shouldn't interrupt
  that flow. Below the buttons, it's available when the user's eye scans down
  after seeing the answer options.

- **Progressive narrowing coexists with the timeout, doesn't replace it.** The
  400ms auto-commit is important for fast typists who don't want to press Enter
  after every note. Narrowing makes the buffer *visible* but doesn't change the
  commit behavior. Users who see the highlighting and want to commit early can
  type the accidental or press Enter; users who are fast enough to not notice
  the 400ms keep their existing flow.

- **No visible text input field.** Button highlighting is sufficient to show
  the buffer state. A text field would add UI weight, create confusion about
  whether to type there or use buttons, and wouldn't map well to number or
  interval input. The buttons *are* the display.

- **Dimming non-matching buttons over hiding them.** Hiding buttons would cause
  layout shifts and make it harder to visually locate the button you want.
  Dimming preserves spatial stability while clearly communicating which options
  are possible.

## Phasing

1. **Keyboard hint** — add the hint text below buttons, hidden on touch
   devices. Low risk, immediately useful, no interaction with existing behavior.
2. **Progressive narrowing for note input (letter mode)** — the most common
   case. Covers fretboard, semitone math, interval math, and one direction of
   several bidirectional modes.
3. **Progressive narrowing for number input** — covers the forward direction of
   Note↔Semitones and Interval↔Semitones.
4. **Progressive narrowing for solfège mode** — same visual behavior, different
   trigger (syllable resolution instead of single letter).
