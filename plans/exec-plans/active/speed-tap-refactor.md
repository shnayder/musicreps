# Speed Tap → Declarative Mode Refactor

## Context

Speed Tap is the only hand-written Preact mode (618-line component). It needs to
become a normal declarative mode to: (1) reduce maintenance cost, and (2)
establish reusable abstractions for future "tap things on a fretboard" modes
(chord memorization, scale patterns, etc.).

---

## User-facing behavior

### Quiz flow (per question)

1. **Prompt**: "Find all C" (with the note displayed, random accidental variant)
2. **Collection phase**: User taps positions on the fretboard one at a time.
   Each tapped position gets a neutral highlight (e.g., yellow/blue) to show
   it's been selected. Tapping an already-selected position is a no-op.
   A progress counter shows "3 / 8" (tapped / expected).
3. **Auto-evaluate**: When the user has tapped exactly N positions (N = number
   of positions where that note appears), the answer is submitted automatically.
4. **Feedback phase**: The fretboard shows results — correct taps turn green,
   wrong taps turn red, missed positions are revealed. Standard engine feedback
   text appears (correct/wrong, speed score). Space/Enter advances to next
   question.

This is the same "enter your full answer, then get feedback" pattern as chord
spelling. No per-tap correctness feedback during collection.

### Scope

Two groups replacing the old NoteFilter dropdown:
- **Natural notes**: C, D, E, F, G, A, B
- **Sharps & flats**: C#, D#, F#, G#, A#

Uses standard toggle switches (like other grouped modes). Gets recommendation
engine support (consolidate-before-expanding: master naturals before adding
accidentals).

### Stats

12-column heatmap showing speed scores per note (same data as today, displayed
via the standard stats infrastructure or controller `renderStats`).

### What changes from current Speed Tap

| Aspect | Current | New |
|--------|---------|-----|
| Per-tap feedback | Immediate green/red per tap | None during collection; all at once after |
| Wrong tap flash | 800ms red flash, auto-clears | N/A — wrong taps just fill a slot |
| Scope UI | NoteFilter dropdown | Group toggle switches |
| Recommendations | None | Consolidate-before-expanding |
| Code | 618-line hand-written component | ~50-line definition + ~80-line controller |

---

## Design

### How multiTap relates to sequential

This is very close to the `sequential` pattern (chord spelling). Key parallels:
- Collect N inputs, then evaluate all at once
- Auto-submit sentinel when count reached
- Per-entry results shown after evaluation

Key differences from sequential:
- **Input mechanism**: fretboard taps (position keys like "2-5") instead of
  buttons/text
- **Set semantics**: order doesn't matter; duplicates rejected
- **Visual display**: tapped positions shown on fretboard instead of text slots
- **Expected count**: derived from targets (how many positions the note has)

These differences are significant enough to warrant a third variant (`multiTap`)
rather than shoehorning into `sequential`, but the implementation follows the
same pattern closely.

### New answer variant: `multiTap`

Third variant in the `ModeDefinition` discriminated union:

```typescript
export type MultiTapDef<Q> = {
  /** All target IDs that must be found (unordered set). */
  getTargets: (q: Q) => string[];
  /** Display answer for feedback after evaluation. */
  getDisplayAnswer: (q: Q) => string;
};
```

Semantics: collect taps into a set (rejecting duplicates). When
`tapped.size === targets.length`, evaluate and auto-submit sentinel
(`__correct__:answer` or `__wrong__:answer`).

### `buttons: { kind: 'none' }`

The fretboard is rendered by the controller, not the button system. Add
`{ kind: 'none' }` to `ButtonsDef`. `ResponseButtons` returns `null`.

### `engineSubmitRef` on ModeController

```typescript
engineSubmitRef?: { current: (input: string) => void };
```

GenericMode wires `ctrl.engineSubmitRef.current = engine.submitAnswer` after
engine creation. Needed for controllers that submit programmatically (multiTap
auto-submit). Also formalizes the existing hack in the fretboard controller.

### Shared reusable abstractions

**`useMultiTapInput` hook** (`src/declarative/use-multi-tap-input.ts`):
Parallel to `useSequentialInput`. Manages:
- Tapped position set (no duplicates)
- Progress text ("3 / 8")
- Evaluate-and-submit when count reached
- Reset on question change
- Takes `submitRef` param (same wiring pattern as `useSequentialInput`)

**`InteractiveFretboard` component** (`src/ui/interactive-fretboard.tsx`):
Reusable component for tappable fretboard. Takes:
- `onTap(positionKey)` callback
- `tappedPositions: ReadonlySet<string>` — highlighted during collection
- `evaluatedResults` — per-position correct/wrong/missed after evaluation
- Progress text display
- Renders SVG via `dangerouslySetInnerHTML`, uses imperative circle coloring

### `getExpectedResponseCount` fix

`QuizEngineConfig.getExpectedResponseCount` is dead code — never read by any
engine hook. The actual response-count scaling goes through `useLearnerModel`'s
`responseCountFn` (4th argument).

Add `getExpectedResponseCount` to `ModeDefinitionBase<Q>`. Wire through
GenericMode into `useLearnerModel`. Fixes a pre-existing gap for chord spelling
too.

### GenericMode changes (minimal)

1. `checkGenericAnswer`: add multiTap sentinel branch
2. `useGenericEngine`: wire `ctrl.engineSubmitRef`, create multiTap input hook
3. `buildGenericEngineConfig`: handle multiTap `checkAnswer`
4. `GenericModeBody`: add `MultiTapQuizArea` rendering branch
5. `QuizStage`: handle null `response` prop

### Speed Tap definition sketch

```typescript
export const SPEED_TAP_DEF: ModeDefinition<Question> = {
  id: 'speedTap',
  name: 'Speed Tap',
  namespace: 'speedTap',
  motorTaskType: 'fretboard-tap',
  // ...identity fields...
  allItems: ALL_ITEMS,  // 12 chromatic notes
  getQuestion: parseItem,
  getPromptText: (q) => 'Tap all ' + displayNote(q.displayName),
  quizInstruction: 'Find all positions',
  multiTap: {
    getTargets: (q) => q.positions.map(p => p.string + '-' + p.fret),
    getDisplayAnswer: (q) => displayNote(q.note),
  },
  getExpectedResponseCount: (itemId) => getPositionsForNote(itemId).length,
  buttons: { kind: 'none' },
  scope: { kind: 'groups', groups: NOTE_GROUPS, /* ... */ },
  stats: { kind: 'none' },  // controller provides renderStats
  useController: (enabledGroups) => useSpeedTapController(enabledGroups),
};
```

The controller uses `useMultiTapInput` state + `InteractiveFretboard` for
rendering. `renderPrompt` shows the interactive fretboard with prompt text and
progress. `renderStats` provides the 12-note heatmap.

## Critical files

| File | Change |
|------|--------|
| `src/declarative/types.ts` | `MultiTapDef`, `{ kind: 'none' }` button, `engineSubmitRef`, `getExpectedResponseCount` |
| `src/declarative/generic-mode.tsx` | multiTap sentinel, engineSubmitRef wiring, MultiTapQuizArea, responseCountFn |
| `src/declarative/use-multi-tap-input.ts` | **New** — shared multi-tap input hook (parallel to use-sequential-input) |
| `src/ui/interactive-fretboard.tsx` | **New** — reusable tappable fretboard component |
| `src/ui/screen-layout.tsx` | QuizStage: handle null response |
| `src/modes/speed-tap/definition.ts` | **New** — declarative definition + controller |
| `src/modes/speed-tap/logic.ts` | Keep (pure helpers), add `Question` type + `parseItem` |
| `src/modes/speed-tap/speed-tap-mode.tsx` | **Delete** |
| `src/app.ts` | Switch to `registerDeclarativeMode` |

## Implementation order

### Phase 1: Foundation (no behavioral changes)
1. Add `getExpectedResponseCount` to `ModeDefinitionBase<Q>`
2. Wire through GenericMode → `useLearnerModel` as `responseCountFn`
3. Add `{ kind: 'none' }` to `ButtonsDef` with no-op in `ResponseButtons`
4. Add `engineSubmitRef` to `ModeController`, wire in `useGenericEngine`
5. Verify: `deno task ok`

### Phase 2: MultiTap type system + GenericMode integration
6. Add `MultiTapDef<Q>` type, extend `ModeDefinition` union
7. Add multiTap branch in `checkGenericAnswer`
8. Add `MultiTapQuizArea` + rendering branch in `GenericModeBody`
9. Modify `QuizStage` for null response
10. Verify: type-check + existing tests pass

### Phase 3: Shared abstractions
11. Create `src/declarative/use-multi-tap-input.ts`
12. Create `src/ui/interactive-fretboard.tsx`
13. Tests for multi-tap input logic

### Phase 4: Speed Tap migration
14. Extend `logic.ts` with `Question` type and `parseItem`
15. Create `src/modes/speed-tap/definition.ts` with definition + controller
16. Update `src/app.ts`, delete `speed-tap-mode.tsx`
17. Verify: `deno task ok`, visual comparison

### Phase 5: Cleanup
18. Clean up fretboard controller's `engineSubmitRef` hack (optional)
19. Remove dead `getExpectedResponseCount` from `QuizEngineConfig`

## Verification

1. `deno task ok` (lint, fmt, type-check, tests, build)
2. `deno task prepush` (includes E2E)
3. Manual: quiz flow, tap collection, post-tap feedback, progress, round
   complete, stats, scope toggles
