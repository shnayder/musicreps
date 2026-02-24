# Fix Screenshot Architecture: Reactive State Derivation

## Context

Screenshots still look wrong after the fixture system was implemented. The
fundamental issue: mode rendering depends on TWO separate state sources
(`engineState` from the hook + mode-local `currentQ` from an `onPresent`
callback), and the fixture system must reconstruct both via different
mechanisms with fragile timing. The user wants the architecture to be
"obviously correct" — one canonical path for putting the app into any state.

## Problems

### 1. Two parallel fixture constructors
`scripts/take-screenshots.ts` has inline `quizActiveFixture()`,
`quizCorrectFixture()`, `quizWrongFixture()`, `roundCompleteFixture()`
(~150 lines of handcrafted engine state). `src/fixtures/quiz-page.ts` has
separate implementations of the same thing. These can drift.

### 2. Imperative `onPresent` is a timing-fragile side channel
Normal quiz flow: `nextQuestion()` calls `setState(engineUpdate)` then
`onPresent(itemId)` synchronously — Preact batches both into one render.

Fixture flow: sets engine state, then calls `onPresent` via
`setTimeout(..., 0)` — a MACRO TASK. The `data-fixture-applied` marker
is set BEFORE `onPresent` fires. There's a 500ms grace period that usually
works, but the flow is fundamentally different from production.

### 3. Mode question state is duplicated, not derived
Each mode maintains `currentQ` as independent `useState`. This is set by
the `onPresent` callback but has no connection to `engine.state.currentItemId`.
If the two get out of sync (fixture timing, missed callback), the mode
renders the wrong question for its engine state.

## Solution: Derive question state from engine state

**Core insight**: `currentQ` is always derivable from `engine.state.currentItemId`
via the mode's `getQuestion(itemId)`. Make it a derived value instead of
independent state.

### The change

In every mode, replace:
```typescript
// BEFORE: independent state + imperative callback
const [currentQ, setCurrentQ] = useState<Question | null>(null);
const currentQRef = useRef<Question | null>(null);

const engineConfig = {
  onPresent: (itemId: string) => {
    const q = getQuestion(itemId);
    currentQRef.current = q;
    setCurrentQ(q);
  },
  // ...
};
```

With:
```typescript
// AFTER: derived from engine state
const currentQ = useMemo(() => {
  const id = engine.state.currentItemId;
  if (!id || engine.state.phase === 'idle') return null;
  return getQuestion(id);
}, [engine.state.currentItemId, engine.state.phase]);

const currentQRef = useRef(currentQ);
currentQRef.current = currentQ;
```

This means:
- **Question state is always in sync with engine state** (single source of truth)
- **Fixtures only set engine state** — mode rendering follows automatically
- **No `onPresent` callback needed** — no timing issues, no separate code path
- **No `presentItemId` in fixtures** — `currentItemId` in engine state suffices

For modes with imperative DOM side effects (fretboard SVG highlights), add
a `useEffect` triggered by `currentQ` changes:
```typescript
useEffect(() => {
  if (!currentQ || !quizFbRef.current) return;
  clearAll(quizFbRef.current);
  setCircleFill(quizFbRef.current, currentQ.currentString, currentQ.currentFret, FB_QUIZ_HL);
}, [currentQ]);
```

## File Changes

### 1. `src/hooks/use-quiz-engine.ts`
- Remove `onPresent` from `QuizEngineConfig` type
- Remove `onPresent` call from `nextQuestion()` (line ~247)
- Remove `presentItemId` handling from fixture injection (lines ~457-461)
- Keep `onStart` and `onStop` callbacks (still needed for keyboard reset etc.)

### 2. `src/fixtures/quiz-page.ts`
- Remove `presentItemId` from `FixtureDetail` type

### 3. All 10 mode components

**7 simple modes** (note-semitones, interval-semitones, semitone-math,
interval-math, key-signatures, scale-degrees, diatonic-chords):
- Replace `useState<Question>` + `onPresent` with `useMemo`
- Keep `currentQRef` (for keyboard handlers that read latest value)
- Remove `onPresent` from engine config

**chord-spelling-mode.tsx** — also has `seqState` initialized in `onPresent`:
- Derive `currentQ` via `useMemo`
- Derive `seqState` via `useMemo` from `currentQ` (call `initSequentialState`
  when `currentQ` changes)
- Remove `onPresent` from engine config

**fretboard-mode.tsx** — has imperative SVG manipulation in `onPresent`:
- Derive `currentQ` via `useMemo`
- Add `useEffect([currentQ])` for SVG highlight (clear + fill)
- Remove `onPresent` from engine config

**speed-tap-mode.tsx** — has extensive state setup + SVG manipulation:
- Derive display state via `useMemo` from the presented item
- Add `useEffect` for SVG circle reset
- Remove `onPresent` from engine config
- Note: speed-tap has unique interaction model; may need special attention

### 4. `scripts/take-screenshots.ts`
- **Delete** all inline fixture constructors (~150 lines):
  `quizActiveFixture()`, `quizCorrectFixture()`, `quizWrongFixture()`,
  `roundCompleteFixture()`, and the `FixtureDetail` type
- **Import** from `src/fixtures/quiz-page.ts` instead:
  `quizActive`, `quizCorrectFeedback`, `quizWrongFeedback`, `quizRoundComplete`
- Update manifest entries to use the imported functions
- Remove `presentItemId` from all fixture entries (no longer needed)

### 5. `src/fixtures/quiz-page.ts` (if needed)
- Verify the exported fixtures produce correct `engineState` for all modes
- Remove `presentItemId` from all fixture builder return values

## Testing

### Unit tests (no DOM, pure logic)

**Fixture-to-question round-trip** — a single test file
(`src/fixtures/fixtures_test.ts`) that validates the data pipeline:

1. **Item ID validity**: For every `(modeId, itemId)` pair in the screenshot
   manifest, call that mode's `getQuestion(itemId)` and assert it returns a
   non-null question with the expected shape.

2. **Engine state validity**: For each fixture builder (`quizActive`,
   `quizCorrectFeedback`, etc.), assert the returned `engineState` has correct
   `phase`, `currentItemId`, `answered`, and `feedbackCorrect` fields.

3. **Manifest completeness**: Assert every mode ID appears in the manifest
   at least once. Assert no duplicate screenshot names.

### Smoke test

Run `npx tsx scripts/take-screenshots.ts` and verify all screenshots captured.

## Implementation Order

1. Remove `onPresent` from `use-quiz-engine.ts` + `QuizEngineConfig`
2. Update all 10 mode components (useMemo + useEffect for SVG modes)
3. Delete inline fixtures from `take-screenshots.ts`, import from `src/fixtures/`
4. Remove `presentItemId` from `FixtureDetail`
5. Add `src/fixtures/fixtures_test.ts`
6. `deno task ok`
7. Run screenshots, verify visually
