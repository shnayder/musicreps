# Search Speed Test

## Problem / Context

The current motor baseline calibration highlights the target button green and
measures how fast the user taps it. This captures raw motor speed but not the
visual search cost of finding a button — which is a significant component of
real quiz response time.

The fix: instead of highlighting the target, show a text prompt ("Press F#")
and let the user find and press the button. Speed tap keeps the current
highlight behavior since its real task (fretboard taps) is different from
button-based calibration.

Chord spelling gets multi-press trials ("Press C G E") to match its sequential
answer format.

## Design

### New mode method: `getCalibrationTrialConfig(buttons)`

Each mode can optionally provide a `getCalibrationTrialConfig(buttons)` method
that returns trial configuration. If absent, falls back to current highlight
behavior (speed tap).

```javascript
// Return value:
{
  prompt: 'Press F#',           // text to show in feedback area
  targetButtons: [btn],         // which button(s) must be pressed (in order)
}
```

The engine derives highlight behavior from method presence: if the mode has
`getCalibrationTrialConfig`, don't highlight; if it doesn't, highlight (current
behavior).

**Note-button modes** (fretboard, note↔semitones, semitone math, interval math,
key sigs, scale degrees, diatonic chords):
- Pick a random button from `buttons`, weighted toward accidentals ~35% of the
  time (see accidental selection below)
- Read the button's label text for the prompt
- Return `{ prompt: 'Press F#', targetButtons: [btn] }`

**Interval-button mode** (interval↔semitones):
- Same as note-button modes but reads `data-interval` instead of `data-note`
- Interval buttons have no accidental/natural distinction — all buttons are
  equally likely
- Return `{ prompt: 'Press P5', targetButtons: [btn] }`

**Chord spelling**:
- Pick 2–4 random note buttons (matching realistic chord lengths)
- Return `{ prompt: 'Press C G E', targetButtons: [btn1, btn2, btn3] }`

**Speed tap** (no method defined → fallback):
- Engine highlights random button green, same as current behavior

### Shared helper: `pickCalibrationButton(buttons, prevBtn)`

Extract button selection into a shared helper in `quiz-engine.js` that modes
call from their `getCalibrationTrialConfig`. This avoids duplicating accidental
weighting across 8+ modes.

```javascript
function pickCalibrationButton(buttons, prevBtn) {
  // Separate sharps from naturals using button text content
  const sharpBtns = buttons.filter(b => {
    const note = b.dataset.note;
    return note && note.includes('#');
  });
  const naturalBtns = buttons.filter(b => {
    const note = b.dataset.note;
    return note && !note.includes('#');
  });

  // ~35% chance of sharp if available
  const useSharp = sharpBtns.length > 0 && Math.random() < 0.35;
  const pool = useSharp ? sharpBtns : (naturalBtns.length > 0 ? naturalBtns : buttons);

  let btn;
  do {
    btn = pool[Math.floor(Math.random() * pool.length)];
  } while (btn === prevBtn && pool.length > 1);
  return btn;
}
```

Note: accidental detection uses `note.includes('#')` only — the button data
attributes in `html-helpers.ts` use sharp names exclusively (C#, D#, F#, G#,
A#). There are no flat-named buttons. The `b` check is unnecessary.

For interval-semitones, buttons use `data-interval` (m2, M2, etc.) not
`data-note`, so the accidental filter doesn't apply. That mode picks uniformly
from all buttons (no sharp/natural distinction).

### Changes to `runCalibration()` in quiz-engine.js

Currently `runCalibration()` picks a random button, highlights it green, and
waits for the user to click/type it. The new version:

1. Accepts an optional `getTrialConfig` function parameter
2. Each trial calls `getTrialConfig(buttons, prevBtn)` if available
3. If config is returned:
   - Sets `els.feedback.textContent` to `config.prompt`
   - Does NOT highlight any button
   - For multi-target trials, tracks sequential progress
   - Records per-press times (not per-trial) for baseline calculation
4. If no `getTrialConfig`, falls back to current highlight behavior

**Key change to `startTrial()`**: Calls `getTrialConfig` if available, otherwise
picks random button and highlights (existing logic).

**Multi-target handling**: For trials with multiple `targetButtons`:
- Each correct press records a time sample and advances to the next target
- The time for each press is measured from the previous press (or trial start
  for the first press)
- All per-press times are added to the `times` array
- This means a 3-note chord spelling trial contributes 3 time samples, not 1
- The trial counter still advances by 1 per sequence (user sees "3 / 10")
- Warmup skipping applies to the first 2 trials (all presses in warmup trials
  are skipped from the median calculation)

**Key change to `handleCalibrationClick` / `handleCalibrationKey`**: Checks
against `currentTarget` (which may advance through a sequence) instead of a
single `targetBtn`.

### State shape during calibration

Add to the closure in `runCalibration()`:
```javascript
let trialConfig = null;        // current trial's config from getTrialConfig
let targetIndex = 0;           // index within trialConfig.targetButtons
let pressStartTime = null;     // time of last press (for per-press timing)
```

### Intro text

`engineCalibrationIntro()` currently hardcodes the hint text. The new version
accepts an optional `hintOverride` parameter:

```javascript
export function engineCalibrationIntro(state, hintOverride) {
  return {
    ...state,
    phase: 'calibration-intro',
    // ...
    hintText: hintOverride || "We\u2019ll measure your tap speed ...",
  };
}
```

The engine determines the hint based on mode:
- If mode has `getCalibrationTrialConfig`: "We'll measure your response speed
  to set personalized targets. Press the button shown in the prompt — 10
  rounds total."
- If mode has `calibrationIntroHint` string: use that (for chord spelling:
  "...Press the notes shown in the prompt, in order — 10 rounds total.")
- Otherwise: current text (speed tap fallback)

### Prompt display during trials

For search trials, `els.feedback.textContent` is set to the trial prompt (e.g.,
"Press F#") at the start of each trial. The hint area shows "Find and press the
button" (set via `engineCalibrating()` hint text, which varies the same way as
intro text).

For multi-press chord spelling trials, the prompt shows all notes: "Press C G E".
No progress tracking within the prompt — the user knows what they've pressed
because they just pressed it.

### Accidental keyboard support

For search trials, the user sees "Press F#" and should be able to type `F`
then `#` via keyboard. The calibration key handler needs to support this
two-key sequence.

**Approach**: Add a pending-key mechanism to `handleCalibrationKey`, similar to
the one in `createNoteKeyHandler` / `createAdaptiveKeyHandler`:

- When user presses a note letter (C–G, A, B), start a 400ms window
- If `#` or `b` follows within the window, combine into a full note name
- Check the combined name against the current target button's `data-note`
- If the window expires, check the natural letter alone

This mechanism only activates when `getTrialConfig` exists (search mode). For
highlight mode (speed tap), the existing single-key `getKeyForButton()` logic
continues unchanged.

For interval-semitones buttons (`data-interval`), keyboard shortcuts during
calibration are limited to single-key matches (digits for single-digit
intervals). Multi-character interval names (m2, M3, etc.) are not feasible as
keyboard shortcuts during timed calibration. Click is the primary input for
interval buttons during calibration.

**Dual listener safety**: During calibration, two `document` keydown listeners
are active — the engine's main handler (which returns `'ignore'` for all keys
except Escape during calibration phases) and the calibration handler. This is
safe: the engine handler ignores calibration-phase keys, and the calibration
handler processes them. The pending-key mechanism adds no new conflict since
both `F` and `#` keydown events reach both listeners and only the calibration
handler acts on them.

### Wrong press behavior in multi-target trials

Wrong presses (button click or keyboard) are silently ignored. The user stays
on the current target in the sequence. No visual or audio feedback for wrong
presses during calibration — this matches the existing behavior where clicking
the wrong button during highlight calibration does nothing.

## Implementation Steps

1. **Add `pickCalibrationButton()` helper** to `quiz-engine.js`. Exported so
   modes can call it from their `getCalibrationTrialConfig`.

2. **Add `getCalibrationTrialConfig()` to all note-button modes** (fretboard,
   note↔semitones, semitone math, interval math, key sigs, scale degrees,
   diatonic chords). Each calls `pickCalibrationButton()` and formats a prompt
   from the button's label.

3. **Add `getCalibrationTrialConfig()` to interval↔semitones**. Uses uniform
   random selection (no accidental weighting). Prompt reads `data-interval`.

4. **Add `getCalibrationTrialConfig()` to chord spelling**. Picks 2–4 random
   note buttons, formats multi-note prompt.

5. **Modify `runCalibration()`**: Accept optional `getTrialConfig` param. Call
   it per trial if available. Handle multi-target sequences with per-press
   timing. Fall back to highlight behavior when absent.

6. **Add accidental keyboard support** to `handleCalibrationKey` — pending-key
   mechanism with 400ms window, only active in search mode.

7. **Update `engineCalibrationIntro(state, hintOverride)`** — accept optional
   hint text parameter.

8. **Update `engineCalibrating()` hint text** — use mode-appropriate hint.

9. **Update `beginCalibrationTrials()`** — pass mode's
   `getCalibrationTrialConfig` to `runCalibration()`.

10. **Add `calibrationIntroHint` to chord spelling mode** for its custom intro.

11. **Update tests** — state transitions with hint override, key routing
    unchanged.

12. **Version bump** in main.ts and build.ts.

## Files Modified

| File | Changes |
|------|---------|
| `src/quiz-engine.js` | Add `pickCalibrationButton()`. Modify `runCalibration()` for search prompts, multi-target, per-press timing, accidental keys. Update `beginCalibrationTrials()`. |
| `src/quiz-engine-state.js` | `engineCalibrationIntro(state, hintOverride)` — accept optional hint. |
| `src/quiz-fretboard.js` | Add `getCalibrationTrialConfig()` |
| `src/quiz-note-semitones.js` | Add `getCalibrationTrialConfig()` |
| `src/quiz-interval-semitones.js` | Add `getCalibrationTrialConfig()` (interval-specific) |
| `src/quiz-semitone-math.js` | Add `getCalibrationTrialConfig()` |
| `src/quiz-interval-math.js` | Add `getCalibrationTrialConfig()` |
| `src/quiz-key-signatures.js` | Add `getCalibrationTrialConfig()` |
| `src/quiz-scale-degrees.js` | Add `getCalibrationTrialConfig()` |
| `src/quiz-diatonic-chords.js` | Add `getCalibrationTrialConfig()` |
| `src/quiz-chord-spelling.js` | Add `getCalibrationTrialConfig()` (multi-target), `calibrationIntroHint` |
| `src/quiz-engine-state_test.ts` | Test `engineCalibrationIntro` with hint override |
| `main.ts` | Version bump |
| `build.ts` | Version bump |

## Testing

- Unit test `pickCalibrationButton()` accidental weighting (mock Math.random)
- Unit test `engineCalibrationIntro` with and without hint override
- Manual testing: run calibration in each mode, verify prompt appears,
  buttons are NOT highlighted, correct button press advances trial
- Manual testing: chord spelling calibration with multi-press sequences,
  verify per-press timing produces reasonable baseline
- Manual testing: speed tap still uses highlight behavior
- Manual testing: keyboard input with accidentals (F then #) works during
  search trials
- Manual testing: interval↔semitones shows "Press P5" style prompts
- Manual testing: wrong presses silently ignored during both single and
  multi-target trials

## Version

Bump minor version (check current and increment).
