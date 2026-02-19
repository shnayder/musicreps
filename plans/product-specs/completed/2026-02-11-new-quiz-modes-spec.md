# New Quiz Modes — User-Facing Spec

Four new modes forming a learning chain. Each builds on the previous.

---

## Mode 1: Key Signatures

### What you're memorizing

For each major key, how many sharps or flats it has (and vice versa).

### Question format

- **Forward**: "D major → ?" → **2 sharps**
- **Reverse**: "3 flats, major → ?" → **Eb major**

Forward answer: a count + type (e.g., "2#"). Needs dedicated answer buttons — a
grid of options like
`0, 1#, 2#, 3#, 4#, 5#, 6#, 7#, 1b, 2b, 3b, 4b, 5b, 6b, 7b`.

Reverse answer: a note name — reuses existing note buttons.

### Items

- 12 major keys × 2 directions = 24 items (C# and Cb are enharmonic with Db and
  B; handle as aliases)
- Item ID format: `D:fwd`, `Eb:rev` (reverse IDs use the key root; the signature
  label is derived at runtime)

### Grouping & sequencing

| Group | Keys (forward) / Counts (reverse) | Accidentals | Items |
| ----- | --------------------------------- | ----------- | ----- |
| 0     | C, G, F                           | 0–1         | 6     |
| 1     | D, Bb                             | 2           | 4     |
| 2     | A, Eb                             | 3           | 4     |
| 3     | E, Ab                             | 4           | 4     |
| 4     | B, Db, F#/Gb                      | 5–7         | 6     |

Small item counts per group — could bundle groups 0+1 on first launch.

### Minor keys

Defer to v2. Each minor key shares accidentals with its relative major (A minor
= C major = 0 accidentals), so the mapping is learnable from major keys +
knowledge of relative minor pairs.

---

## Mode 2: Scale Degrees

### What you're memorizing

Given a major key and a degree number, instantly name the note. This is the core
skill: thinking fluently in any key.

### Question format

- **Forward**: "5th of D major?" → **A**
- **Reverse**: "In D major, A is the ?" → **5th**

Forward answer: note name (existing buttons). Reverse answer: degree number 1–7
(7 buttons, similar to semitone modes).

### Items

- 12 keys × 7 degrees × 2 directions = 168 items
- Item ID format: `D:5:fwd`, `D:A:rev`

### Grouping & sequencing — by degree

Items grouped by which degree is being drilled, across all 12 keys. This means
you master one interval relationship at a time.

| Group | Degrees  | Rationale                                           | Items |
| ----- | -------- | --------------------------------------------------- | ----- |
| 0     | 1st, 5th | Root is trivial (warmup); 5th is most common        | 48    |
| 1     | 4th      | Completes I-IV-V triad of relationships             | 24    |
| 2     | 3rd, 7th | Define the major tonality (leading tone, major 3rd) | 48    |
| 3     | 2nd, 6th | Complete the scale                                  | 48    |

Default on first launch: Group 0 only. Consolidate-before-expanding gates
progression to the next group.

### Minor keys

Defer to v2. Natural minor has different degree-to-note mappings (b3, b6, b7)
which is useful but adds complexity. Could be a toggle or separate sub-mode.

---

## Mode 3: Diatonic Chords (Roman Numerals)

### What you're memorizing

Given a major key and a roman numeral, name the chord root. The roman numeral
encodes quality (I = major, ii = minor, vii° = dim), so the user learns quality
implicitly from the notation.

### Question format

- **Forward**: "IV in Bb major?" → **Eb** Feedback reinforces quality: "IV in Bb
  → Eb major ✓"
- **Reverse**: "Dm is what in C major?" → **ii** Question shows the chord with
  quality — this makes the question easier (minor implies ii/iii/vi) but still
  drills the key-to-numeral mapping.

Forward answer: note name (existing buttons). Root only; quality shown in
feedback. Reverse answer: roman numeral (7 buttons: I, ii, iii, IV, V, vi,
vii°).

### Items

- 12 keys × 7 degrees × 2 directions = 168 items
- Item ID format: `Bb:IV:fwd`, `C:D:rev`

### Grouping & sequencing — by degree importance

| Group | Degrees   | Rationale                                 | Items |
| ----- | --------- | ----------------------------------------- | ----- |
| 0     | I, IV, V  | Primary chords — foundation of most songs | 72    |
| 1     | ii, vi    | Most common secondary chords              | 48    |
| 2     | iii, vii° | Least common in pop/rock/folk             | 48    |

Default on first launch: Group 0 only.

### Minor keys

Defer to v2. Minor harmonization is complex (natural vs. harmonic vs. melodic
minor all yield different chord sets).

---

## Mode 4: Chord Spelling

### What you're memorizing

Given a chord name, spell out all its notes in root-up order.

### Question format

- "Cm7" → user enters **C, Eb, G, Bb** (in that order)
- "F#dim" → user enters **F#, A, C**

Display shows the chord name and blank slots matching the number of tones (3 for
triads, 4 for 7th chords): `Cm7: [_] [_] [_] [_]`

Slots fill in as the user enters each note. Auto-checks after all slots filled.

### Answer input (two parallel methods)

1. **Sequential taps**: note-name buttons (same 12-note grid as other modes).
   Tap notes one at a time; each tap fills the next slot.
2. **Keyboard**: type note names (C, Eb, F#, etc.). Each entry fills next slot.

**Order matters** — must be root, 3rd, 5th, (7th). This drills structured chord
knowledge, not just note membership.

### Enharmonic handling — strict, context-aware spelling

Chord tones must be spelled correctly relative to the root. The letter name is
determined by the interval relationship: the 3rd of any X chord is always the
letter 2 steps above X in the musical alphabet, the 5th is 4 steps above, etc.

Examples:

- 5th of C# major → **G#** (not Ab — the 5th of C must be a G-something)
- b3 of Eb minor → **Gb** (not F# — the 3rd of E must be a G-something)
- b7 of F#7 → **E** (7th of F must be an E-something)

This means the app needs **letter-name arithmetic**, not just semitone math.
Each chord tone has exactly one correct spelling. The existing
`noteMatchesInput` (which accepts both c# and db) is NOT sufficient — we need a
stricter check.

**Root naming**: each of the 12 chromatic pitches needs a canonical root name.
Some pitches have two common names:

| Semitone | Sharp name | Flat name | Preferred root for v1          |
| -------- | ---------- | --------- | ------------------------------ |
| 1        | C#         | Db        | Db (more common as chord root) |
| 3        | D#         | Eb        | Eb                             |
| 6        | F#         | Gb        | F#                             |
| 8        | G#         | Ab        | Ab                             |
| 10       | A#         | Bb        | Bb                             |

Could add the alternate spellings (C# major vs Db major) as a later expansion.

### Reverse direction

Defer to v2. "C, Eb, G → ?" requires a chord-symbol answer format (root +
quality selector) which is a new UI paradigm.

### Items

- Each chord = 1 item (you spell the whole thing)
- 12 roots × N chord types per group

### Grouping & sequencing — by chord type

| Group | Chord types                        | Formula                       | Notes to spell | Items |
| ----- | ---------------------------------- | ----------------------------- | -------------- | ----- |
| 0     | Major triads                       | R 3 5                         | 3              | 12    |
| 1     | Minor triads                       | R b3 5                        | 3              | 12    |
| 2     | Dominant 7th                       | R 3 5 b7                      | 4              | 12    |
| 3     | Major 7th                          | R 3 5 7                       | 4              | 12    |
| 4     | Minor 7th                          | R b3 5 b7                     | 4              | 12    |
| 5     | Dim triad, Aug triad, half-dim 7th | R b3 b5 / R 3 #5 / R b3 b5 b7 | 3–4            | 36    |
| 6     | Sus2, Sus4, 6th chords             | R 2 5 / R 4 5 / R 3 5 6       | 3–4            | 36    |

Total: ~132 items. Default on first launch: Group 0 only.

---

## Cross-cutting design notes

### Enharmonic display

Keys with flats (F, Bb, Eb, Ab, Db, Gb) should display with flat names in
questions, not the sharp equivalents from the NOTES array. This requires a
key-aware display layer (e.g., show "Bb major" not "A# major", show "Eb" not
"D#" when it's the answer in a flat key context).

### No cross-mode gating

All modes freely accessible from the hamburger menu (like current modes). The
recommended learning order (key sigs → scale degrees → diatonic chords → chord
spelling) is documented but not enforced.

### Adaptive system

All modes use the existing adaptive selector and forgetting model. Each mode has
its own localStorage namespace for stats.

### Minor keys (v2 roadmap)

All four modes start with major keys/chords only. Minor keys add significant
complexity (different degree mappings, multiple minor scale types, different
chord harmonizations). Planned as a future expansion — likely a toggle within
each mode rather than separate modes.

---

## Resolved decisions

- **Diatonic chords reverse**: show quality in question ("Dm is what in C
  major?")
- **Chord spelling**: include root in answer (full R-3-5-7 spelling)
- **Chord spelling**: keep 5th for all chords (complete spelling, adaptive
  handles speed)
- **Chord spelling enharmonics**: strict, context-aware — must use correct
  letter name
- **Scale degrees grouping**: by degree across all keys (not by key)
- **Chord spelling input**: sequential taps + keyboard, order matters (root-up)
- **Diatonic chords answer**: root note only, quality in feedback
- **Key signatures**: separate lightweight mode (not subsumed by scale degrees)
- **Minor keys**: defer to v2 for all modes
