# Answer Feedback — Implementation Plan (v2: Feedback Banner) [SUPERSEDED]

> **Superseded 2026-03-08**: Iterated back to button-based feedback. The text
> banner is replaced by highlighting answer buttons directly: green bg for
> correct, red bg for wrong press, green border to reveal the correct answer.
> FeedbackBanner remains only for Chord Spelling mode.

## Problem / Context

The v1 button-highlighting approach doesn't work well on mobile:
- The user's finger obscures both the pressed button and nearby ones during the
  1s feedback window.
- Two buttons lighting up at once (correct + wrong) is visually distracting.

**New approach**: a text feedback banner between the question prompt and the
answer buttons — well above the finger zone.

- **Correct**: show the answer in green (e.g., "C").
- **Wrong**: show "No, {answer}" in red (e.g., "No, D").

## Branch

Stay on `claude/ux-answer-feedback-iK1Xl` — this is the same feature, iterated.
The button-flash commit gets superseded, not reverted.

## Design

### Data flow

1. **`EngineState` gains `feedbackDisplayAnswer: string | null`** — the
   display-formatted correct answer (e.g., "B♭"). Set from the existing
   `correctAnswer` parameter in `engineSubmitAnswer`.

2. **Remove button-feedback fields** — `feedbackCorrectValue` and
   `feedbackUserValue` are no longer needed. Remove them from `EngineState`,
   `engineSubmitAnswer` params, and `engineNextQuestion`/`engineRoundComplete`
   clears.

3. **Remove `correctValue` from `CheckAnswerResult`** — only existed for
   button-to-value matching. Remove from type and all mode `checkAnswer`
   returns.

4. **`FeedbackBanner` component** — new component in `src/ui/quiz-ui.tsx`.
   Props: `correct: boolean | null`, `answer: string | null`. Renders:
   - `null` when `correct` is null (not yet answered)
   - Answer text in green when correct
   - "No, {answer}" in red when wrong
   - Screen reader: existing sr-only `FeedbackDisplay` continues to handle
     `aria-live`.

5. **Each mode renders `<FeedbackBanner>` as a child of `QuizArea`**, placed
   just above the buttons. This lets fretboard modes keep the SVG above the
   banner (SVG → banner → piano buttons).

6. **Button components lose feedback props** — remove `FeedbackProps` type,
   `feedbackClass()` helper, and all `correctValue`/`wrongValue` props.

7. **Chord Spelling** — remove per-step button flash (`stepFlash` state and
   timer). ChordSlots already colors each slot. After full chord entry, the
   banner shows the same `feedbackDisplayAnswer` as other modes.

8. **Speed Tap** — unchanged. Its SVG-based feedback (circle fills) is
   independent of buttons.

### Banner placement (DOM order within QuizArea)

```
quiz-area
  quiz-last-question
  quiz-prompt-row
    quiz-prompt              ← question text
  [fretboard SVG]            ← fretboard modes only
  feedback-banner            ← NEW: between prompt/SVG and buttons
  answer-buttons / note-buttons
  feedback (sr-only)
  hint
  round-complete
```

### CSS

New `.feedback-banner` class:
- Text centered, sized prominently but smaller than the prompt
- Uses existing `--color-success-text` / `--color-error-text` color tokens
- Fixed `min-height` to prevent layout shift between answered/unanswered states
- Visible only during the `answered` window (same 1s as before)

Remove `.btn-correct` and `.btn-wrong` from both `.answer-btn` and `.note-btn`.

## Implementation Steps

### Step 1: Engine state changes

- `src/types.ts`: Add `feedbackDisplayAnswer: string | null` to `EngineState`.
  Remove `feedbackCorrectValue` and `feedbackUserValue`. Remove `correctValue`
  from `CheckAnswerResult`.
- `src/quiz-engine-state.ts`: Remove `userValue`/`correctValue` params from
  `engineSubmitAnswer`. Store `correctAnswer` as `feedbackDisplayAnswer`. Clear
  it in `initialEngineState`, `engineNextQuestion`, `engineRoundComplete`.
- `src/quiz-engine-state_test.ts`: Update tests for changed fields.

### Step 2: Hook plumbing

- `src/hooks/use-quiz-engine.ts`: Simplify `submitAnswer` — remove
  `tryCanonicalizeNote(input)` and `result.correctValue` arguments. Can remove
  `tryCanonicalizeNote` helper and `noteToCanonical` import.

### Step 3: FeedbackBanner component

- `src/ui/quiz-ui.tsx`: Add `FeedbackBanner` component. Props:
  `{ correct: boolean | null, answer: string | null }`.

### Step 4: Banner CSS

- `src/styles.css`: Add `.feedback-banner`, `.feedback-banner-correct`,
  `.feedback-banner-wrong`. Remove `.btn-correct` / `.btn-wrong` from both
  `.answer-btn` and `.note-btn`.

### Step 5: Button components — remove feedback props

- `src/ui/buttons.tsx`: Remove `FeedbackProps` type, `feedbackClass()` helper,
  and `correctValue`/`wrongValue` from all 7 button components.

### Step 6: Mode logic — remove correctValue

- Remove `correctValue` from `checkAnswer` return in:
  `note-semitones`, `interval-semitones`, `semitone-math`, `interval-math`,
  `key-signatures`, `scale-degrees`, `diatonic-chords` logic.ts files.
- Remove `correctValue` from `checkFretboardAnswer` in
  `quiz-fretboard-state.ts`.

### Step 7: Mode components — add banner, remove button feedback

- All 10 mode `.tsx` files: remove `correctValue`/`wrongValue` threading to
  buttons. Add `<FeedbackBanner>` as a child before buttons.
- Chord spelling: also remove `stepFlash` state, `stepFlashTimer`, and related
  logic.

### Step 8: Version bump + build

- `src/build-template.ts`: bump version.
- Run `deno task ok`.

### Step 9: Update design spec

- Update this plan file (already done by writing it).

## Files Modified

| File | Changes |
|------|---------|
| `src/types.ts` | Add `feedbackDisplayAnswer`, remove `feedbackCorrectValue`/`feedbackUserValue`/`correctValue` |
| `src/quiz-engine-state.ts` | Simplify `engineSubmitAnswer`, add `feedbackDisplayAnswer` |
| `src/quiz-engine-state_test.ts` | Update tests |
| `src/hooks/use-quiz-engine.ts` | Remove canonicalization, simplify submitAnswer call |
| `src/ui/quiz-ui.tsx` | Add `FeedbackBanner` component |
| `src/ui/buttons.tsx` | Remove all feedback props and helpers |
| `src/styles.css` | Add `.feedback-banner`, remove `.btn-correct`/`.btn-wrong` |
| `src/modes/*/logic.ts` (7 files) | Remove `correctValue` from returns |
| `src/quiz-fretboard-state.ts` | Remove `correctValue` from return |
| `src/modes/*/*.tsx` (10 files) | Add banner, remove button feedback threading |
| `src/build-template.ts` | Version bump |

## Testing

- Engine state tests: `feedbackDisplayAnswer` set/cleared correctly.
- Manual: all 10 modes show feedback banner on answer.
- Manual: chord spelling shows banner after full chord, per-step slots still work.
- Manual: mobile — banner visible above finger zone.
- Manual: screen reader still announces feedback via sr-only div.
