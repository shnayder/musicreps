# Split Note Input: Base Note + Accidental

**Date:** 2026-03-08
**Status:** Draft / Discussion

## Problem

The current note input system shows 12 chromatic buttons (one per semitone),
requiring every mode to decide whether to label accidentals as sharps or flats.
This creates pervasive complexity:

- `useFlats` prop threaded through button components and mode definitions
- `pickAccidentalName()` logic to choose sharp vs flat spelling
- `getUseFlats` in every mode definition that uses note buttons
- `accidental-conventions.md` documenting six priority rules for when to show
  which enharmonic spelling
- Piano layout (`PianoNoteButtons`) uses sharp labels only, hides accidentals
  entirely for natural-only groups

The problem gets worse as we add modes needing **enharmonic precision** (Cb vs
B, E# vs F) or **double accidentals** (F##, Bbb). The current 12-button grid
can't represent these — it maps 1:1 to semitones, not to spelled notes.

## Proposal

Replace the 12-button chromatic grid with a **two-row input**:

```
Row 1:  [ C ] [ D ] [ E ] [ F ] [ G ] [ A ] [ B ]     ← base notes
Row 2:  [𝄫] [♭] [♮] [♯] [𝄪]                           ← accidentals
```

Three tiers of accidental display, chosen per mode:

| Tier | Accidental row | Use case |
|------|---------------|----------|
| **none** | Hidden (base note submits immediately) | Fretboard natural-only groups |
| **single** | ♭ ♮ ♯ | Most modes (fretboard with accidentals, math modes, etc.) |
| **double** | 𝄫 ♭ ♮ ♯ 𝄪 | Future: advanced spelling, key signatures with doubles |

## UX Flow

### Button input

1. User taps a **base note** (C–B) → note enters "pending" state, accidental
   row highlights
2. User taps an **accidental** → submits the combined note (e.g., C + ♯ = C♯)
3. Or user taps **♮** (or another base note, or the same note again) → submits
   the natural
4. If tier is "none", tapping a base note submits immediately (no pending state)

### Confirming a natural

No timeout — the user is always in control. Three ways to confirm a natural:

1. **Double-tap** — tap the same base note again (e.g., C → C submits C♮)
2. **Tap ♮** — explicit natural button
3. **Tap a different base note** (sequential modes only, e.g., Chord Spelling)
   — submits the pending note as natural, then starts pending on the new note
   (so D after pending C submits C♮ and starts pending D). In single-answer
   modes, submitting the answer ends the question, so there's no "next note"
   to chain to.

Option 3 means rapid natural-note sequences in sequential modes are still fast:
just tap through the base notes and each previous one auto-submits as natural.

**Discoverability:** The ♮ button serves as a visual hint that confirming is
needed. The accidental row appearing/highlighting after a base note tap signals
"pick one of these." New users will likely tap ♮; experienced users will
double-tap or chain base notes.

### Keyboard input

The keyboard handler (`createNoteKeyHandler`) currently uses a 600ms timeout
(`PENDING_DELAY_AMBIGUOUS`) to auto-submit naturals. This should be updated to
match the no-timeout button model: require explicit confirmation via Enter,
accidental key, or next letter key. The existing "next letter auto-submits
pending" behavior already works — just remove the timeout.

### Swipe gestures (exploratory)

On touch devices, swiping on a base note button could select accidentals:

- **Swipe up** → sharp (♯)
- **Swipe down** → flat (♭)
- **Long swipe up** → double sharp (𝄪)
- **Long swipe down** → double flat (𝄫)
- **Tap (no swipe)** → enters pending state (then confirm via double-tap, ♮,
  or next note)

This would make accidental input single-gesture instead of two-tap, potentially
faster for experienced users. The swipe direction maps to the intuitive "sharp =
higher = up" association.

**Open questions for swipes:**
- Is the speed gain real, or does the precision cost offset it?
- How to make it discoverable? Maybe show a brief tooltip on first use.
- Should swipe *replace* the two-tap flow or be an accelerator alongside it?
- Accessibility: swipe gestures are harder for some users, so the button
  fallback must always work.

## What This Eliminates

- **`useFlats` prop** — gone from buttons, mode definitions, and GenericMode
- **`pickAccidentalName()`** — no longer needed; buttons are base notes, not
  semitone labels
- **`getUseFlats` in mode definitions** — removed entirely
- **Sharp-vs-flat button labeling decisions** — the user constructs the note,
  so the label problem disappears
- **`ACCIDENTAL_NAMES` array** — no longer drives button rendering
- **Piano layout's `hideAccidentals` prop** — replaced by tier selection

## What This Enables

- **Enharmonic precision** — Cb, E#, Fb, B# are all naturally expressible as
  two taps (base + accidental). No special cases needed.
- **Double accidentals** — F## and Bbb just work when tier="double"
- **Consistent keyboard/button mental model** — both inputs follow the same
  letter-then-accidental pattern
- **Simpler mode definitions** — modes declare a tier ("none", "single",
  "double") instead of threading `useFlats` logic

## What Changes per Mode

| Mode | Current | New |
|------|---------|-----|
| Guitar/Ukulele Fretboard | `piano-note` + `hideAccidentals` | `split-note` tier=none/single (per group) |
| Note ↔ Semitones (rev) | `note` + no `useFlats` | `split-note` tier=single |
| Semitone Math | `note` + `getUseFlats` | `split-note` tier=single |
| Interval Math | `note` + `getUseFlats` | `split-note` tier=single |
| Scale Degrees (fwd) | `note` + `getUseFlats` | `split-note` tier=single |
| Diatonic Chords (fwd) | `note` + `getUseFlats` | `split-note` tier=single |
| Chord Spelling | `NoteButtons` + `useFlats` | `SplitNoteButtons` tier=single |

## Answer Checking

Currently: `noteMatchesInput()` accepts both sharps and flats by semitone. E.g.,
if the answer is C#, typing "Db" is accepted.

With split input: the user constructs a specific spelled note (C + ♯ = C#).
Two options:

1. **Keep lenient matching** — C♭ accepted for B, D♭ accepted for C♯. Simpler,
   same behavior as today. Good for modes that care about semitone, not
   spelling.
2. **Strict spelling where appropriate** — modes like Chord Spelling and Scale
   Degrees that care about correct enharmonic spelling can require exact match.
   Other modes stay lenient.

Recommend option 2: keep lenient by default, let modes opt into strict matching
via their `checkAnswer` function (which they already control).

## Visual Design

### Pending state

When a base note is tapped and waiting for accidental:
- The tapped base note button gets a "selected" / "active" visual state
- Accidental row buttons become prominent (full opacity, maybe slight glow)
- Other base note buttons dim slightly

### Layout

Two rows, similar to current piano layout:

```
  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐
  │ C │ │ D │ │ E │ │ F │ │ G │ │ A │ │ B │
  └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘
        ┌───┐ ┌───┐ ┌───┐
        │ ♭ │ │ ♮ │ │ ♯ │
        └───┘ └───┘ └───┘
```

Accidental row is centered, smaller than base notes. Tier "double" adds 𝄫 and
𝄪 on the edges.

### Compare to current layouts

Current NoteButtons (12-button grid):
```
  ┌───┐ ┌────┐ ┌───┐ ┌────┐ ┌───┐ ┌───┐ ┌────┐ ┌───┐ ┌────┐ ┌───┐ ┌────┐ ┌───┐
  │ C │ │C#  │ │ D │ │D#  │ │ E │ │ F │ │F#  │ │ G │ │G#  │ │ A │ │A#  │ │ B │
  └───┘ └────┘ └───┘ └────┘ └───┘ └───┘ └────┘ └───┘ └────┘ └───┘ └────┘ └───┘
```

Current PianoNoteButtons (two-row piano):
```
    ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐
    │ C# │ │ D# │ │ E# │ │ F# │ │ G# │ │ A# │ │ B# │
    └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘
  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐
  │ C │ │ D │ │ E │ │ F │ │ G │ │ A │ │ B │
  └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘
```

The new layout is more compact than both (7 + 3 = 10 buttons vs 12), and the
accidental row has a clear semantic meaning rather than being a continuation of
the same note set.

## Implementation Approach

### Phase 1: New component alongside existing

1. Create `SplitNoteButtons` component in `src/ui/buttons.tsx`
2. Add `split-note` button type to `ButtonsDef` union
3. Wire up in `GenericMode`'s `ResponseButtons`
4. Add pending state management (can reuse keyboard handler's pattern)

### Phase 2: Migrate modes one at a time

5. Convert one simple mode (e.g., Semitone Math) as proof of concept
6. Convert remaining declarative modes
7. Convert Chord Spelling (hand-written component)
8. Convert fretboard modes

### Phase 3: Remove old components

9. Remove `NoteButtons`, `PianoNoteButtons` once no modes reference them
10. Remove `useFlats`, `pickAccidentalName`, `getUseFlats` from the system

## Open Questions

1. **Solfège mode** — base note labels show Do Re Mi Fa Sol La Si instead of
   C D E F G A B. Accidental row stays the same. Straightforward.

2. **Mobile tap targets** — 7 base notes + 3 accidentals = 10 buttons is fewer
   than the current 12. Should be fine or better for mobile.

3. **Keyboard timeout removal** — removing `PENDING_DELAY_AMBIGUOUS` from
   keyboard input changes existing behavior. Currently "press C, wait 600ms"
   auto-submits C. New behavior: "press C, press Enter" (or next letter).
   Is this strictly better, or do some users rely on the auto-submit?

4. **Swipe gesture viability** — worth prototyping? Or better to ship the
   two-tap model first and explore swipes as an enhancement later?
