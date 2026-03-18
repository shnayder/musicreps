# Solfège Display & Global Settings — Design Spec

## Overview

Add a fixed-do solfège naming option that replaces letter-name notes (C, D, E)
with solfège syllables (Do, Re, Mi) throughout the entire app. The setting lives
in a new global settings modal, accessed via a gear icon in the top bar.

## Solfège naming system

### Fixed-do mapping

| Letter | Solfège | With sharp | With flat |
| ------ | ------- | ---------- | --------- |
| C      | Do      | Do#        | Do♭       |
| D      | Re      | Re#        | Re♭       |
| E      | Mi      | Mi#        | Mi♭       |
| F      | Fa      | Fa#        | Fa♭       |
| G      | Sol     | Sol#       | Sol♭      |
| A      | La      | La#        | La♭       |
| B      | Si      | Si#        | Si♭       |

- Uses **Si** (Romance/Italian tradition), not Ti.
- Accidentals append **#** or **♭** to the base syllable (not chromatic solfège
  variants like Di, Ri, etc.).
- Display is capitalized: Do, Re, Mi.

### Where solfège names appear

When the solfège setting is active, note names are replaced **everywhere**:

- **Answer buttons** — "Do", "Re#/Mi♭", etc. instead of "C", "C#/Db"
- **Question prompts** — "Do + 3 = ?", "What note is fret 5 on string 3?"
  answer: "La" instead of "A"
- **Feedback text** — "Correct! The answer is Sol" instead of "G"
- **Fretboard labels** — neck dots show solfège syllables
- **Key names** — "Do major", "La minor" etc. wherever key names appear

### Modes unaffected

**Interval ↔ Semitones** does not use note names (only interval names like m2,
M3, P5 and semitone counts), so the solfège setting has no effect there.

### Keyboard input

In solfège mode, keyboard shortcuts change to **solfège abbreviations**:

- Type the syllable: `do`, `re`, `mi`, `fa`, `sol`, `la`, `si`
- Case-insensitive — `Do`, `DO`, `do` all work.
- For accidentals: syllable + `#` or `b` (e.g., `fa#`, `si b`)
- The original letter keys (C, D, E...) are **inactive** in solfège mode.

All syllables are unambiguous after two characters (do, re, mi, fa, so→sol, la,
si), so auto-submit after the second character is possible for most, with sol
needing the third.

## Global settings modal

### Access

- **Gear icon** in the top bar, right side (to the right of the version number).
- Tapping the gear opens a modal overlay.
- **Hidden during active quiz** — gear icon is not visible when a quiz or
  calibration is in progress.

### Modal contents

1. **Note naming** — toggle between two options:
   - **A B C** (letter names — current default)
   - **Do Re Mi** (fixed-do solfège)

   Persisted in localStorage. Default: A B C.

2. **Close** — "×" button in top-right corner, or tap the overlay backdrop.

### Layout

The modal is a centered card over a dimmed backdrop (reuse the existing
`--color-overlay` for backdrop). Compact — just the notation setting with a
clear label.

### Screen states

- **Modal closed (default)**: gear icon visible in top bar (when idle),
  everything else unchanged.
- **Modal open**: dimmed overlay, settings card centered.

## Calibration stays per-mode

The "Redo speed check" button stays in each mode's idle screen. Different modes
can have different calibration baselines, so per-mode placement makes sense.

## Resolved decisions

- **Si vs Ti**: Si — Romance/Italian tradition.
- **Capitalization**: Do, Re, Mi (capitalized). Consistent with how letter names
  are capitalized (C, D, E).
- **Scope of substitution**: everywhere (fretboard labels, questions, answers,
  feedback) — full immersion, not partial.
- **Keyboard in solfège mode**: solfège abbreviations only; letter keys
  disabled. Case-insensitive input. Keeps the mental model consistent with
  what's on screen.
- **Accidental style**: base syllable + # or ♭ symbol (Do#, Mi♭), not chromatic
  solfège (Di, Me, etc.). Simpler to learn, direct parallel to the letter-name
  system.
- **Settings gear visibility**: hidden during active quiz/calibration. No
  mid-quiz setting changes.
- **Calibration**: stays per-mode (not moved to settings modal).
- **Version number**: stays in header, to the left of the settings gear.
