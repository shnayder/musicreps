# Answer Feedback — Implementation Plan

## Problem / Context

Feedback for correct/incorrect answers is a text line below the buttons ("Correct!"
/ "Incorrect — B"). This feels disconnected — the user has to shift attention from
the button grid to the text below. The spec calls for button-level visual feedback:
flash the tapped button green (correct) or red (wrong) + highlight the correct
button green simultaneously. See `plans/product-specs/active/2026-02-23-answer-feedback-spec.md`.

## Design

### Data flow

1. **`CheckAnswerResult` gains `correctValue`** — the raw value matching a button's
   `data-*` attribute (e.g., `"C#"` for NoteButtons, `"5"` for NumberButtons).
   Each mode's `checkAnswer` already knows this; making it explicit is one line per mode.

2. **`EngineState` gains three fields** — `feedbackCorrect` (boolean), `feedbackUserValue`
   (user's raw input), `feedbackCorrectValue` (the correct button value).
   Set in `engineSubmitAnswer`, cleared in `engineNextQuestion`.

3. **`engineSubmitAnswer` takes two extra params** — `userValue` and `correctValue`.
   The hook's `submitAnswer` passes `input` and `result.correctValue`.

4. **Button components gain `correctValue` / `wrongValue` props** — when a button's
   value matches `correctValue`, it gets `.btn-correct`; when it matches `wrongValue`,
   `.btn-wrong`. Only set when `engine.state.answered`.

5. **Each mode passes feedback values to its button component(s)** — derived from
   `engine.state.feedbackCorrectValue` and `engine.state.feedbackUserValue`. Only
   the visible button group (for bidirectional modes) gets the values.

6. **FeedbackDisplay becomes sr-only** — the `<div class={className}>` text becomes
   visually hidden but announced via `aria-live="polite"`. Time and hint displays
   remain visible.

### Button value mapping per mode

| Mode | Button(s) | correctValue source |
|------|-----------|-------------------|
| Fretboard (guitar/ukulele) | PianoNoteButtons | `currentNote` (NOTES[].name) |
| Note ↔ Semitones (fwd) | NumberButtons | `String(q.noteNum)` |
| Note ↔ Semitones (rev) | NoteButtons | `q.noteName` |
| Interval ↔ Semitones (fwd) | NumberButtons | `String(q.num)` |
| Interval ↔ Semitones (rev) | IntervalButtons | `q.abbrev` |
| Semitone Math | NoteButtons | `q.answer.name` |
| Interval Math | NoteButtons | `q.answer.name` |
| Key Signatures (fwd) | KeysigButtons | `keySignatureLabel(key)` |
| Key Signatures (rev) | NoteButtons | `noteToCanonical(q.root)` |
| Scale Degrees (fwd) | NoteButtons | `noteToCanonical(q.noteName)` |
| Scale Degrees (rev) | DegreeButtons | `String(q.degree)` |
| Diatonic Chords (fwd) | NoteButtons | `noteToCanonical(q.rootNote)` |
| Diatonic Chords (rev) | NumeralButtons | `q.chord.numeral` |
| Chord Spelling | NoteButtons | per-step (mode-level, not engine) |
| Speed Tap | SVG circles | per-position (mode-level, not engine) |

**`noteToCanonical(spelledName)`** — new helper in music-data.ts. Maps any spelled
note (e.g., "Bb", "F#") to its NOTES[].name equivalent (e.g., "A#", "F#"). Uses
`spelledNoteSemitone` for the lookup.

### Chord spelling per-step flash

ChordSlots already colors per step. For buttons, the mode tracks `stepFlash` state:
`{ correctValue, wrongValue } | null`. Set on each sequential input, cleared after
300ms or when next step activates.

### Speed tap correct position highlight

On wrong tap, find the correct position(s) on the same string. Flash the closest
one green (800ms, same timer as the red flash). Uses existing `setCircleFill` helper.

## Implementation Steps

### Step 1: Types and engine state (independently testable)

- `src/types.ts`: Add `correctValue?: string` to `CheckAnswerResult`.
  Add `feedbackCorrect`, `feedbackUserValue`, `feedbackCorrectValue` to `EngineState`.
- `src/quiz-engine-state.ts`: Update `engineSubmitAnswer` signature. Update
  `engineNextQuestion` and `initialEngineState` to clear new fields.
- `src/quiz-engine-state_test.ts`: Add tests for new fields.

### Step 2: Hook plumbing

- `src/hooks/use-quiz-engine.ts`: Pass `input` and `result.correctValue` through
  to `engineSubmitAnswer`.

### Step 3: CSS

- `src/styles.css`: Add `.btn-correct` and `.btn-wrong` classes for `.answer-btn`
  and `.note-btn`. Use existing `--color-success-*` / `--color-error-*` variables.

### Step 4: Button components

- `src/ui/buttons.tsx`: Add `correctValue` and `wrongValue` optional props to all
  7 button components. Apply `.btn-correct` / `.btn-wrong` CSS classes when values
  match.

### Step 5: FeedbackDisplay becomes sr-only

- `src/ui/quiz-ui.tsx`: Wrap the feedback text div in a visually-hidden `aria-live`
  region. Remove visible feedback text. Keep time and hint visible.
- `src/styles.css`: Add `.sr-only` utility class.

### Step 6: Mode checkAnswer updates (all 8 standard modes with logic.ts)

- `src/modes/note-semitones/logic.ts`: Return `correctValue`.
- `src/modes/interval-semitones/logic.ts`: Return `correctValue`.
- `src/modes/semitone-math/logic.ts`: Return `correctValue`.
- `src/modes/interval-math/logic.ts`: Return `correctValue`.
- `src/modes/key-signatures/logic.ts`: Return `correctValue`.
- `src/modes/scale-degrees/logic.ts`: Return `correctValue`.
- `src/modes/diatonic-chords/logic.ts`: Return `correctValue`.
- `src/quiz-fretboard-state.ts`: Return `correctValue` from `checkFretboardAnswer`.
- `src/music-data.ts`: Add `noteToCanonical()` helper.

### Step 7: Mode render updates (pass flash props to buttons)

- All 9 standard mode .tsx files: pass `correctValue`/`wrongValue` from engine
  state to the appropriate button component(s).

### Step 8: Chord spelling per-step button flash

- `src/modes/chord-spelling/chord-spelling-mode.tsx`: Add `stepFlash` state.
  Flash buttons on each sequential input, clear after brief delay.

### Step 9: Speed tap correct position highlight

- `src/modes/speed-tap/speed-tap-mode.tsx`: On wrong tap, find closest correct
  position on the same string and flash it green.

### Step 10: Version bump

- `src/build-template.ts`: v8.16 → v8.17.

## Files Modified

| File | Changes |
|------|---------|
| `src/types.ts` | Add fields to EngineState, CheckAnswerResult |
| `src/quiz-engine-state.ts` | Update engineSubmitAnswer, engineNextQuestion, initialEngineState |
| `src/quiz-engine-state_test.ts` | Tests for new fields |
| `src/hooks/use-quiz-engine.ts` | Pass feedback values through |
| `src/styles.css` | .btn-correct, .btn-wrong, .sr-only |
| `src/ui/buttons.tsx` | correctValue/wrongValue props on all button types |
| `src/ui/quiz-ui.tsx` | FeedbackDisplay sr-only conversion |
| `src/music-data.ts` | noteToCanonical() helper |
| `src/quiz-fretboard-state.ts` | correctValue in checkFretboardAnswer |
| `src/modes/*/logic.ts` (7 files) | correctValue in checkAnswer |
| `src/modes/*/*.tsx` (11 files) | Pass flash props to buttons |
| `src/build-template.ts` | Version bump |

## Testing

- Engine state tests: `engineSubmitAnswer` sets new fields, `engineNextQuestion` clears them.
- `noteToCanonical` unit test: verify Bb→A#, C→C, F#→F#, Db→C# etc.
- Manual: verify all 10 modes show green/red button flash on answer.
- Manual: verify chord spelling flashes per step.
- Manual: verify speed tap shows correct position on wrong tap.
- Manual: verify screen reader announces feedback text.

## Version

v8.16 → v8.17.
