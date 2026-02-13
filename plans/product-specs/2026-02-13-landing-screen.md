# Landing Screen: Requirements & UX Design

## Context

The current hamburger menu presents 10 quiz modes as a flat list in a slide-out
drawer. This hides the app's structure — there's a natural learning progression
and categorical grouping that users can't see. The goal is to replace this with
a full-screen "what do you want to work on?" landing page that communicates
structure, sequencing, and progress at a glance.

**Chosen direction:** Recommended card at top + grouped list below (Direction C).
**Gating:** Always open — all modes tappable, sequence is suggestive only.
**Progress detail:** Minimal — colored dot or ring per mode, no fractions.

---

## Mode Grouping

| Category | Modes | What it builds |
|----------|-------|----------------|
| **Fretboard** | Fretboard, Speed Tap | Physical instrument knowledge |
| **Building Blocks** | Note ↔ Semitones, Interval ↔ Semitones | Name ↔ number lookup |
| **Navigation** | Semitone Math, Interval Math | Computing notes from distances |
| **Keys & Harmony** | Key Signatures, Scale Degrees, Diatonic Chords, Chord Spelling | Key-based theory |

---

## Requirements

### Must Have
- R1: Full-screen landing with all modes visible (replaces hamburger drawer)
- R2: Categorical grouping with labeled sections
- R3: Colored progress dot per mode (not started / in progress / strong)
- R4: Top-to-bottom ordering suggests the learning path
- R5: All modes always tappable (no locking/gating)
- R6: One-tap to enter any mode
- R7: Landing screen shown on app launch
- R8: Easy return to landing from within a mode (back arrow or home button)

### Should Have
- R9: "Recommended" card at top — the single best mode to work on next
- R10: "Continue" shortcut for last-used mode (if different from recommended)
- R11: Brief subtitle per mode (what it practices)

### Could Have
- R12: Overall progress indicator across all modes
- R13: Animated transitions entering/leaving modes

---

## Refined Mockup

### State 1: First Launch (nothing started)

```
┌──────────────────────────────────┐
│                            v3.6  │
│  What do you want to work on?    │
│                                  │
│  GET STARTED                     │
│  ╔══════════════════════════════╗ │
│  ║ Fretboard                   ║ │
│  ║ Find notes on the neck      ║ │
│  ║                         ▶   ║ │
│  ╚══════════════════════════════╝ │
│                                  │
│                                  │
│  FRETBOARD                       │
│  ┌─ ○  Fretboard ─────────────┐  │
│  │     Find notes on the neck │  │
│  ├─ ○  Speed Tap ─────────────┤  │
│  │     Quick note recognition │  │
│  └────────────────────────────┘  │
│         ↓                        │
│  BUILDING BLOCKS                 │
│  ┌─ ○  Note ↔ Semitones ─────┐  │
│  │     Notes and their numbers│  │
│  ├─ ○  Interval ↔ Semitones ─┤  │
│  │     Intervals and numbers  │  │
│  └────────────────────────────┘  │
│         ↓                        │
│  NAVIGATION                      │
│  ┌─ ○  Semitone Math ────────┐  │
│  │     Note + semitones = ?   │  │
│  ├─ ○  Interval Math ────────┤  │
│  │     Note + interval = ?    │  │
│  └────────────────────────────┘  │
│         ↓                        │
│  KEYS & HARMONY                  │
│  ┌─ ○  Key Signatures ───────┐  │
│  │     Keys and accidentals   │  │
│  ├─ ○  Scale Degrees ────────┤  │
│  │     Degrees within keys    │  │
│  ├─ ○  Diatonic Chords ──────┤  │
│  │     Chords within keys     │  │
│  ├─ ○  Chord Spelling ───────┤  │
│  │     Spell chord tones      │  │
│  └────────────────────────────┘  │
│                                  │
└──────────────────────────────────┘

  ○ = not started (grey)
```

### State 2: Returning User (some progress)

```
┌──────────────────────────────────┐
│                            v3.6  │
│  What do you want to work on?    │
│                                  │
│  RECOMMENDED                     │
│  ╔══════════════════════════════╗ │
│  ║ Interval ↔ Semitones    ◑  ║ │
│  ║ Intervals and their numbers ║ │
│  ║                         ▶   ║ │
│  ╚══════════════════════════════╝ │
│                                  │
│  ┌──────────────────────────────┐ │
│  │ ▸ Continue: Fretboard    ◐  │ │
│  └──────────────────────────────┘ │
│                                  │
│  FRETBOARD                       │
│  ┌─ ◐  Fretboard ────────────┐  │
│  ├─ ○  Speed Tap ────────────┤  │
│  └────────────────────────────┘  │
│         ↓                        │
│  BUILDING BLOCKS                 │
│  ┌─ ●  Note ↔ Semitones ────┐  │
│  ├─ ◑  Interval ↔ Semitones ┤  │
│  └────────────────────────────┘  │
│         ↓                        │
│  NAVIGATION                      │
│  ┌─ ◔  Semitone Math ───────┐  │
│  ├─ ○  Interval Math ───────┤  │
│  └────────────────────────────┘  │
│         ↓                        │
│  KEYS & HARMONY                  │
│  ┌─ ○  Key Signatures ──────┐  │
│  ├─ ○  Scale Degrees ───────┤  │
│  ├─ ○  Diatonic Chords ─────┤  │
│  ├─ ○  Chord Spelling ──────┤  │
│  └────────────────────────────┘  │
│                                  │
└──────────────────────────────────┘

  ○ grey    = not started
  ◔ red     = started, weak (<25% mastered)
  ◑ yellow  = making progress (25–75%)
  ◐ green   = strong (75–99%)
  ● bright  = mastered (100%)
```

### State 3: Inside a Mode (how to get back)

```
┌──────────────────────────────────┐
│ ←  Fretboard              v3.6  │
│                                  │
│  ┌──────────────────────────┐    │
│  │                          │    │
│  │     [fretboard SVG]      │    │
│  │                          │    │
│  └──────────────────────────┘    │
│                                  │
│  [A] [Bb] [B] [C] [C#] ...      │
│                                  │
│  Find: E on string 3             │
│                                  │
└──────────────────────────────────┘

  ← arrow replaces ☰ hamburger.
  Tapping it returns to the landing screen.
```

---

## Progress Dot Semantics

The dot represents **what fraction of the mode's items are "mastered"** where
mastered = recall ≥ 0.5 (the existing `recallThreshold`). For modes with
subsets (strings, distance groups), only count items in currently-enabled
subsets — this matches what the user is actually working on.

| State | Visual | Meaning |
|-------|--------|---------|
| Not started | ○ grey | No items seen yet |
| Weak | ◔ red/orange | <25% of items mastered |
| In progress | ◑ yellow | 25–75% mastered |
| Strong | ◐ green | 75–99% mastered |
| Mastered | ● bright green | 100% mastered |

These map directly to the existing automaticity color scale in `stats-display.js`.

---

## Recommendation Logic (Cross-Mode)

The "Recommended" card needs to pick one mode. Possible heuristics:

1. **Consolidate-before-expanding** (extend existing pattern):
   - Among started modes: pick the one with the most items due for review
   - Only suggest an unstarted mode when started modes are consolidated
   - Follow the category ordering for tie-breaking (Fretboard before Keys)

2. **First unfinished in sequence**: Simply walk the 10-mode list top to bottom,
   pick the first one that isn't mastered. Simple, predictable.

3. **Spaced repetition priority**: Pick the mode with the most items whose
   recall has decayed below threshold. Maximizes retention.

These can be refined during implementation. The key UX requirement is: the
recommendation should feel helpful, not prescriptive. The user can always
ignore it and tap anything else.

---

## "Continue" vs "Recommended"

These are distinct concepts:

- **Continue** = last-used mode (from `localStorage`). Shown as a compact
  one-line shortcut below the recommended card. Hidden if last-used mode
  equals the recommended mode (no duplication).
- **Recommended** = algorithmically suggested next mode. Shown as a prominent
  card with description and progress dot.

On first launch, there's no "continue" (nothing used yet), so only the
recommended card appears (suggesting Fretboard as the starting point).

---

## Navigation Changes

| Before | After |
|--------|-------|
| ☰ hamburger button | ← back arrow (inside modes) |
| Slide-out nav drawer | Full-screen landing page |
| Auto-load last mode on launch | Show landing screen on launch |
| `#mode-title` in top bar | Mode name next to ← arrow |
| Nav overlay | Not needed |

---

## Open Design Questions

1. **Category names** — "Fretboard," "Building Blocks," "Navigation,"
   "Keys & Harmony" — are these clear? Alternatives:
   - "The Neck" / "Fundamentals" / "Interval Arithmetic" / "Keys & Chords"
   - Or just use the learning-path arrows without labels?

2. **Subtitles** — should the compact list (State 2) show subtitles, or
   only the first-launch version (State 1)? Subtitles add height but help
   discoverability.

3. **Recommended card content** — the mockup shows mode name + subtitle +
   progress dot. Should it also show a motivational line? ("You're halfway
   there!", "Time for review", "Ready to start?") Or keep it minimal?

4. **Scroll position** — on return to landing, should it scroll to the
   category containing the mode they just left? Or always scroll to top?
