# Accidental Naming Conventions

Standard music-theory rules for choosing between enharmonic spellings
(e.g., C# vs Db). When multiple rules apply, they are listed in priority
order — higher-priority rules override lower ones.

## Rules (highest priority first)

### 1. Harmonic / Chordal Context
Spell accidentals according to the chord or interval structure.
In a D major chord the third is **F#**, not Gb, because it is the
letter-name third above D.

*Applies to:* Chord Spelling, Diatonic Chords, Scale Degrees.

### 2. Key-Signature Consistency
Match the prevailing key signature. Flat keys (e.g., Eb major) use flats
for chromatic notes; sharp keys (e.g., A major) use sharps.

*Applies to:* Scale Degrees, Diatonic Chords, Key Signatures.

### 3. Leading-Tone Exception
Sharps are used for a raised leading tone even in a flat key.
(Currently no quiz mode exercises this independently; it is already
handled by `getScaleDegreeNote()` letter-name arithmetic.)

### 4. Directional Convention
Ascending chromatic movement uses sharps: G → **G#** → A.
Descending chromatic movement uses flats: A → **Ab** → G.

*Applies to:* Semitone Math, Interval Math.

### 5. Random Enharmonic Training
When no harmonic, key, or directional context applies, randomly show either
enharmonic spelling per question to train recognition of both. The user
should be able to deal with either form.

*Applies to:* Note ↔ Semitones (questions, correct answer feedback),
Speed Tap (prompts).

*Mechanism:* `pickRandomAccidental(displayName)` — 50/50 sharp or flat per
question presentation.

### 6. Sharp Default for Reference Displays
Stats tables, heatmap row labels, answer button default labels, and other
reference/static displays always use the sharp form for consistency and
scannability. These are not quiz interactions, so training both forms is
not relevant.

*Applies to:* all stats grids (`renderStatsGrid` row labels), stats tables,
Speed Tap stats headers, answer button idle labels (`refreshNoteButtonLabels`),
HTML template button labels.

*Mechanism:* `displayNote(note.name)` — the canonical `name` field uses sharps.

### 7. Visual Readability
Choose the simplest, most legible spelling. Avoid double-sharps (##) and
double-flats (bb) unless the harmonic context requires them.

*Applies to:* all modes (already satisfied — no mode produces double
accidentals for the standard 12-note chromatic set).

## How each mode implements the rules

| Mode | Rule(s) | Mechanism |
|------|---------|-----------|
| **Fretboard** | Sharp default (rule 6) | `displayNote()` on canonical name; accepts both sharp and flat input |
| **Note ↔ Semitones** | Random (rule 5) | `pickRandomAccidental()` in questions and correct answers; accepts both |
| **Interval ↔ Semitones** | — (no notes involved) | N/A |
| **Semitone Math** | Directional (rule 4) | `useFlats = (op === '-')` — sharps ascending, flats descending |
| **Interval Math** | Directional (rule 4) | Same as Semitone Math |
| **Key Signatures** | Key consistency (rule 2) | `MAJOR_KEYS` stores canonical root spellings |
| **Scale Degrees** | Harmonic + key (rules 1–2) | `getScaleDegreeNote()` letter-name arithmetic |
| **Diatonic Chords** | Harmonic + key (rules 1–2) | `getScaleDegreeNote()` letter-name arithmetic |
| **Chord Spelling** | Harmonic (rule 1) | `getChordTones()` letter-name arithmetic |
| **Speed Tap** | Random (rule 5) | `pickRandomAccidental()` in prompts |
| **All stats/buttons** | Sharp default (rule 6) | `displayNote(note.name)` for labels and buttons |

## Why directional convention works for math modes

For the 5 enharmonic pairs in standard tuning (C#/Db, D#/Eb, F#/Gb,
G#/Ab, A#/Bb), the directional convention always produces the same result
as letter-name interval arithmetic:

- **Ascending** starts from the sharp form of the note, and semitone
  addition to a sharp-form note naturally lands on sharp-form results.
- **Descending** starts from the flat form, and subtraction naturally
  lands on flat-form results.

The directional convention also avoids producing "enharmonic naturals"
(Cb, B#, E#, Fb) or double accidentals, which would not map to any
answer button in the UI.
