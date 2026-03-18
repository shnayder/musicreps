# Speed Check Redesign — Implementation Plan

## Problem / Context

The current speed check measures visual reaction time ("tap the green button")
rather than motor entry time. This produces inaccurate baselines because it
conflates visual search with motor skill. Additionally, all modes share a single
baseline despite having different input methods.

Product spec:
`plans/product-specs/active/2026-03-16-speed-check-redesign-spec.md`

Phase 1 scope: note-button task type only (covers 8 of 10 declarative modes).

---

## Design

### Motor task type system

New union type representing motor task categories:

```ts
type MotorTaskType = 'note-button' | 'number' | 'chord-sequence' | 'keysig' | 'fretboard-tap';
```

Each `ModeDefinition<Q>` gains an optional `motorTaskType` field (default:
`'note-button'`). The storage key becomes `motorBaseline_{taskType}` (e.g.,
`motorBaseline_note-button`), so modes sharing the same input method share one
baseline.

### Trial interaction change

Instead of highlighting a button with `calibration-target`, the SpeedCheck
component shows a text prompt ("Press F#") and renders the normal note button
grid. The user presses the matching button. Wrong presses are ignored (same as
current). Timing starts when the prompt appears, ends on correct press.

### Answer generation

The SpeedCheck component generates random note names for trials (reusing
`pickCalibrationNote()` — a refactored version of `pickCalibrationButton()` that
returns a note name string instead of a DOM element). For Phase 1 this is
note-button only; future task types would supply their own answer generators.

### Provider → TaskType refactor

The `SpeedCheckProvider` interface is replaced by a `MotorTaskConfig` keyed by
task type:

```ts
interface MotorTaskConfig {
  taskType: MotorTaskType;
  introText: string;
  trialPrompt: (answer: string) => string; // e.g., note => `Press ${note}`
  generateAnswer: (prev: string | null, rng?: () => number) => string;
  label: string; // e.g., "note button entry"
}

const NOTE_BUTTON_CONFIG: MotorTaskConfig = {
  taskType: 'note-button',
  introText: "We'll show you the answer — enter it as fast as you can. ...",
  trialPrompt: (note) => `Press ${note}`,
  generateAnswer: pickCalibrationNote,
  label: 'note button entry',
};
```

### Results display update

`getCalibrationThresholds()` returns updated v4 labels and adds heatmap color
token names:

| Level     | Multiplier | Heatmap token   |
| --------- | ---------- | --------------- |
| Automatic | < 1.5x    | `--heatmap-5`   |
| Solid     | < 3.0x    | `--heatmap-4`   |
| Learning  | < 4.5x    | `--heatmap-3`   |
| Hesitant  | < 6.0x    | `--heatmap-2`   |
| Starting  | >= 6.0x   | `--heatmap-1`   |

Each row renders a color swatch filled from the CSS custom property.

### Engine phase cleanup

The three calibration phases (`calibration-intro`, `calibrating`,
`calibration-results`) are removed from the engine state machine. SpeedCheck
already manages its own internal phase (intro → running → results) via local
state. The engine just needs to know "speed check is open" (a boolean/overlay
approach) — no engine phase transitions needed.

Wait — checking current integration: GenericMode renders SpeedCheck when
`engine.calibrating` is true, which checks `isCalibrationPhase(phase)`. The
engine phases drive keyboard routing (Escape handling). We should simplify but
keep it working.

**Revised approach**: Keep a single `'calibrating'` engine phase (collapse the
three calibration sub-phases into one). SpeedCheck internally manages
intro/running/results. The engine just knows "calibration mode is active" for
keyboard routing (Escape cancels). This removes 2 phases from the engine state
machine and simplifies transitions.

### Keyboard handling

During calibration, SpeedCheck handles note key presses internally. The engine
routes Escape to cancel calibration. This is unchanged from current behavior
except SpeedCheck responds to the matching note key (not a highlighted button's
note).

### Close button

SpeedCheck shows a × close button in all internal phases. Clicking it calls
`onCancel`, which ends calibration without saving.

---

## Implementation Steps

### Step 1: Add MotorTaskType to type system

- Add `MotorTaskType` union to `src/types.ts`
- Add optional `motorTaskType?: MotorTaskType` to `ModeDefinition` in
  `src/declarative/types.ts` (default `'note-button'`)
- Add `MotorTaskConfig` interface to `src/ui/speed-check.tsx`
- Create `NOTE_BUTTON_CONFIG` replacing `BUTTON_PROVIDER`

**Verify**: Type check passes. No behavioral change yet.

### Step 2: Update storage key to per-task-type

- In `src/hooks/use-learner-model.ts`, change storage key from
  `motorBaseline_{provider.key}` to `motorBaseline_{taskType}`
- Accept `taskType` param (from mode definition) instead of provider key
- GenericMode passes `def.motorTaskType ?? 'note-button'` to learner model hook
- Speed Tap (hand-written) passes `'note-button'` explicitly for now (it will
  get `'fretboard-tap'` in Phase 3)

**Verify**: Baseline storage works with new key. Old key is abandoned (no
migration per spec).

### Step 3: Simplify engine calibration phases

- Collapse `'calibration-intro' | 'calibrating' | 'calibration-results'` into a
  single `'calibrating'` phase
- Remove `engineCalibrationIntro()`, `engineCalibrating()`,
  `engineCalibrationResults()` from `src/quiz-engine-state.ts`
- Add single `engineStartCalibration(state)` → phase `'calibrating'` and
  `engineEndCalibration(state)` → phase `'idle'`
- Update `isCalibrationPhase()` to check for single `'calibrating'` phase
- Update `engineRouteKey()` — Escape during `'calibrating'` stops engine
- Remove `EngineState.calibrationBaseline` field (SpeedCheck handles this
  internally now)
- Update `use-calibration-lifecycle.ts` accordingly
- Update `src/quiz-engine-state_test.ts` tests

**Verify**: Tests pass. Calibration can start and be cancelled.

### Step 4: Redesign SpeedCheck interaction model

- Replace button highlighting with text prompt display
- `useTrialLoop()` changes:
  - Instead of finding and highlighting a DOM button, call
    `config.generateAnswer(prevNote)` to get target answer string
  - Store target as string, not DOM element ref
  - Timing starts when prompt renders (after pause), ends on correct input
- `pickCalibrationNote()`: new pure function (extracted from
  `pickCalibrationButton`), returns a note name string. Same 65/35
  natural/sharp distribution, no consecutive repeats.
- Remove `pickCalibrationButton()` (no longer needed — was DOM-dependent)
- SpeedCheck renders answer buttons normally (no `calibration-target` class)
- Correct press = note matching the prompt. Wrong presses ignored.

**Verify**: Manual test — speed check shows "Press F#", user presses F#, trial
advances.

### Step 5: Update results display

- Update `getCalibrationThresholds()` in `src/quiz-engine.ts`:
  - Labels: Automatic, Solid, Learning, Hesitant, Starting (replace Good,
    Developing, Slow, Very slow)
  - Add `colorToken: string` field to each threshold (e.g., `'--heatmap-5'`)
  - Update meanings text
- `SpeedCheckResults` renders color swatches: small inline box with
  `background-color: var(--heatmap-N)`
- Add "Calibrating: note button entry" subtext to intro screen
- Add × close button to SpeedCheck (all phases)

**Verify**: Results screen shows correct v4 labels with colored swatches.

### Step 6: Update fixture injection, screenshots, and E2E tests

- Update `src/hooks/use-fixture-injection.ts`: the current phase mapping
  (`'intro' → 'calibration-intro'`, `'running' → 'calibrating'`,
  `'results' → 'calibration-results'`) must collapse to a single
  `'calibrating'` engine phase for all three fixture phases. SpeedCheck's
  internal phase is driven by the fixture's `phase` field, not the engine phase.
- Update `SpeedCheckFixture` in `src/types.ts`: `targetNote` no longer highlights
  a button — it becomes the prompt answer (used to generate "Press F#" text).
  Rename to `promptAnswer` or keep `targetNote` but update SpeedCheck to use it
  for prompt generation instead of DOM highlight.
- Update fixture builders in `src/fixtures/quiz-page.ts`:
  - `speedCheckIntro()`: unchanged (phase 'intro')
  - `speedCheckTesting()`: target becomes prompt text, no button highlighting
  - `speedCheckResults()`: unchanged (phase 'results', baseline value)
- Update `scripts/take-screenshots.ts`: change seeded storage key from
  `motorBaseline_button` to `motorBaseline_note-button`
- Update `tests/e2e/helpers/fixture-builders.ts`: `buildMotorBaseline()` default
  provider key changes from `'button'` to `'note-button'`
- Update `tests/e2e/persistence.test.ts`: storage key in assertions changes to
  `motorBaseline_note-button`
- Recapture screenshots — they will show the new text-prompt UI instead of
  green-highlighted button

**Verify**: `deno task test`, E2E tests pass, screenshots show new text-prompt
UI.

### Step 7: Update BaselineInfo component

- Show task type context: "Response time for note input" (or similar)
- Button label: "Run speed check" / "Redo speed check" (unchanged for Phase 1
  since only note-button exists)

**Verify**: Progress tab shows updated copy.

### Step 8: Remove progress/countdown bars from speed check

- Verify no quiz progress bar renders during calibration (it shouldn't since
  SpeedCheck replaces the QuizArea content)
- Ensure no countdown timer renders during trials
- Trial counter "3 / 10" is the only progress indicator

**Verify**: Visual inspection — no bars during speed check.

### Step 9: Set motorTaskType on all mode definitions

- Add `motorTaskType: 'note-button'` to the 8 note-answering modes
- Number-answering modes (Note Semitones fwd, Interval Semitones fwd): leave
  undefined (defaults to `'note-button'` for now — they'll get `'number'` in
  Phase 2)
- Chord Spelling: leave undefined (gets `'chord-sequence'` in Phase 2)
- Key Signatures fwd: leave undefined (gets `'keysig'` in Phase 2)
- Speed Tap: leave undefined (gets `'fretboard-tap'` in Phase 3)

Actually — per spec, "Phase 1: note-button only" and other types use default
1s baseline. Better: don't set the field on modes that don't use note-button
answers. The default for the field should be `'note-button'`, and modes that
answer differently will get correct task types in later phases.

**Verify**: All modes resolve to correct task type.

### Step 10: Clean up removed code

- Remove `BUTTON_PROVIDER` export and `SpeedCheckProvider` interface
- Remove `calibration-target` CSS class (if it exists in styles)
- Remove calibration sub-phase references from any remaining code
- Update `SpeedCheckFixture` type if needed

**Verify**: `deno task ok` passes.

---

## Files Modified

| File | Changes |
| --- | --- |
| `src/types.ts` | Add `MotorTaskType`, simplify `EnginePhase` (remove calibration sub-phases), update `SpeedCheckFixture` |
| `src/declarative/types.ts` | Add `motorTaskType?` to `ModeDefinition` |
| `src/ui/speed-check.tsx` | Replace provider with task config, text prompt instead of button highlight, updated results display with color swatches, close button, `pickCalibrationNote()` |
| `src/quiz-engine.ts` | Update `getCalibrationThresholds()` labels/colors, remove `pickCalibrationButton()` |
| `src/quiz-engine-state.ts` | Collapse calibration phases into single `'calibrating'`, remove sub-phase transitions |
| `src/hooks/use-learner-model.ts` | Storage key from task type, accept `taskType` param |
| `src/hooks/use-calibration-lifecycle.ts` | Simplify to single start/end transition |
| `src/declarative/generic-mode.tsx` | Pass task type to learner model, update SpeedCheck props |
| `src/ui/mode-screen.tsx` | Update BaselineInfo copy |
| `src/styles.css` | Remove `calibration-target` styles if present, add swatch styles |
| `src/modes/speed-tap/speed-tap-mode.tsx` | Pass task type to learner model (if it uses calibration) |
| Mode `definition.ts` files | Add `motorTaskType` where appropriate |
| `src/hooks/use-fixture-injection.ts` | Collapse calibration phase mapping to single `'calibrating'` phase |
| `src/fixtures/quiz-page.ts` | Update fixture builders — `targetNote` used for prompt, not highlight |
| `scripts/take-screenshots.ts` | Update storage key to `motorBaseline_note-button` |
| `tests/e2e/persistence.test.ts` | Update storage key assertions |
| `tests/e2e/helpers/fixture-builders.ts` | Update `buildMotorBaseline` default provider key |

---

## Testing

### Unit tests

- `pickCalibrationNote()`: distribution (naturals vs sharps), no consecutive
  repeats, RNG injection
- `getCalibrationThresholds()`: correct v4 labels, color tokens, multiplier
  values; `colorToken` values are valid `--heatmap-*` tokens
- Engine state: single `'calibrating'` phase transitions, key routing during
  calibration
- Storage key: `motorBaseline_note-button` read/write
- Trial answer matching: correct note accepted, wrong note ignored (pure
  function test — don't rely on manual verification for this since it's the core
  behavior change)
- `MotorTaskConfig.generateAnswer()`: never returns same note twice
  consecutively (contract test)

### Fixture / screenshot / E2E tests

These are tightly coupled to the calibration phases and storage keys, and will
break if not updated alongside the implementation:

- **Fixture injection** (`use-fixture-injection.ts`): all three fixture phases
  map to the single `'calibrating'` engine phase; SpeedCheck internal phase
  driven by fixture `phase` field
- **Screenshot pipeline** (`take-screenshots.ts`): seeded storage key updated to
  `motorBaseline_note-button`; recaptured screenshots show text prompt instead
  of green-highlighted button
- **E2E persistence** (`persistence.test.ts`): storage key in seeding and
  assertions updated to `motorBaseline_note-button`
- **E2E fixture builder** (`fixture-builders.ts`): `buildMotorBaseline` default
  key updated

### Manual verification

- Start speed check from a mode's progress tab
- Verify intro shows "Calibrating: note button entry" + explanation text
- Verify trials show "Press F#" (or similar) with normal button grid
- Verify trial counter shows "3 / 10" etc.
- Verify results show v4 labels with colored swatches matching heatmap colors
- Verify × close button cancels without saving baseline
- Verify Done saves baseline and returns to mode
- Verify baseline persists across modes sharing note-button task type
- Verify no progress bar or countdown bar during speed check

---

## Implementation Notes (added after completion)

### What was done

(To be filled in after implementation)

### Deviations from plan

(To be filled in after implementation)
