# Standardize Chord Spelling into GenericMode

## Problem

Chord Spelling is one of two hand-written Preact components (alongside Speed
Tap). It reimplements ~200 lines of hook composition and rendering that
GenericMode already handles for 9 other modes. The reason it's hand-written:
**sequential multi-note answers with deferred feedback** — a pattern GenericMode
doesn't support.

Future modes need this same pattern (e.g., "read chord from fretboard" →
identify notes, "spell scale" → enter notes in order). Keeping it as a
one-off blocks reuse.

## Goal

Extend GenericMode to support sequential/multi-note response modes, then convert
Chord Spelling to a declarative `ModeDefinition`. The result: future multi-note
modes are ~30 lines of definition, just like single-answer modes today.

---

## Key Design Decisions

### 1. Where does sequential state live?

**Options:**

- **(A) In GenericMode itself** — GenericMode manages `SequentialState`, calls
  mode-provided pure functions (`initState`, `handleInput`, `evaluate`). The
  mode definition is pure data + pure logic, like today's single-answer modes.

- **(B) In a `useController` hook** — Mode provides a controller that manages
  sequential state internally, renders ChordSlots, handles input, and submits
  the final `__correct__`/`__wrong__` sentinel to the engine.

- **(C) In a new `useSequentialEngine` hook** — Extracted from ChordSpellingMode
  as a shared hook, composed by GenericMode when it detects a sequential mode.

**Recommendation: (A) — GenericMode manages sequential state.**

Rationale: The whole point of GenericMode is that mode definitions are pure
data. If we push state into controllers (B), we're just relocating the
hand-written component. A dedicated hook (C) is viable but fragments the
engine; GenericMode already composes all the other hooks.

### 2. How does the type system express "this mode uses sequential answers"?

**Options:**

- **(A) Discriminated union on ModeDefinition** — Add a `responseKind` field:
  `'single'` (default, current behavior) vs `'sequential'`. Sequential modes
  provide additional fields (`initSequentialState`, `handleInput`,
  `evaluateSequential`). Single-answer modes are unchanged.

- **(B) Separate type `SequentialModeDefinition<Q>`** — A sibling type to
  `ModeDefinition<Q>` with its own field set. GenericMode accepts
  `ModeDefinition | SequentialModeDefinition`.

- **(C) Optional fields on ModeDefinition** — Add `sequential?:
  SequentialConfig<Q>` as a single optional field containing all the sequential
  logic. GenericMode checks `if (def.sequential)` to branch.

**Recommendation: (C) — Optional `sequential` field.**

Rationale: (A) requires a discriminated union which complicates the type — every
consumer needs to narrow. (B) duplicates shared fields. (C) is additive: one
optional field, minimal type disruption. GenericMode already branches on
`def.scope.kind`, `def.buttons.kind`, `def.getDirection` — branching on
`def.sequential` is the same pattern.

### 3. What does the sequential config contain?

**Core principle:** As far as the mode is concerned, it asks for N notes and
checks whether the entered ones are correct. *Getting those notes from the
user is the system's job.* The mode definition should be minimal — declare
what you need, not how to collect it.

```typescript
type SequentialDef<Q> = {
  /** How many inputs this question expects. */
  expectedCount: (q: Q) => number;

  /** Check all collected inputs at once. Called after the system has
   *  gathered exactly `expectedCount` inputs from the user. */
  evaluate: (q: Q, inputs: string[]) => {
    correct: boolean;
    correctAnswer: string;
    perEntry: { display: string; correct: boolean }[];
  };

  /** Parse batch text input into individual answers (optional — enables
   *  keyboard entry). If omitted, only tap/button input is available. */
  parseBatchInput?: (text: string) => string[];

  /** Placeholder for batch text input field. */
  batchPlaceholder?: string | ((q: Q) => string);
};
```

Key choices:

- **Only two required functions** — `expectedCount` and `evaluate`. The mode
  says "I need 4 notes" and "here's how to grade them." Everything else
  (slot rendering, collection, display transforms, input routing) is
  GenericMode's job.
- **No `collectInput`** — Display transforms (e.g., `Gb` → `G♭`) are a UI
  concern. GenericMode applies `displayNote()` when rendering slots. If a
  future mode needs a different transform, that's an extension point to add
  then, not now.
- **`evaluate` returns per-entry results** — Needed for the slot UI
  (green/red per note). The system renders these; the mode just supplies the
  truth table.
- **`parseBatchInput` is optional** — Not all sequential modes need keyboard
  batch entry. Chord spelling does; a fretboard-tap mode wouldn't.
- **No buttons field here** — Sequential modes use the top-level
  `ModeDefinition.buttons` field, same as single-answer modes. GenericMode
  knows to render them in sequential/chain-submit mode when `sequential` is
  present. This avoids a confusing split between two button locations.

### 4. How does GenericMode render sequential UI?

**Options:**

- **(A) Built-in ChordSlots** — GenericMode renders the slot progress UI
  directly when `def.sequential` is present. ChordSlots becomes a shared
  component in `src/ui/`.

- **(B) Controller renderPrompt** — Sequential modes provide a controller that
  renders slots via `renderPrompt`. GenericMode just manages the state.

- **(C) New `renderSequential` on ModeController** — A dedicated render slot
  for sequential feedback, separate from prompt.

**Recommendation: (A) — Built-in slot rendering.**

Rationale: The slot UI (progress indicators with deferred per-entry feedback) is
the universal visual pattern for sequential modes. It's not mode-specific — it's
*what makes a sequential mode sequential*. Building it into GenericMode means
future modes get it for free. If a future mode needs truly custom rendering, the
controller `renderPrompt` escape hatch still works.

Move `ChordSlots` → `src/ui/sequential-slots.tsx` as a shared component.

### 5. What happens to `checkAnswer` and the sentinel pattern?

Today, Chord Spelling uses `__correct__`/`__wrong__` sentinel values because the
quiz engine's `checkAnswer` expects a single string input, but the real
evaluation already happened in the component.

**Options:**

- **(A) Keep sentinels** — GenericMode internally submits `__correct__` or
  `__wrong__` after `evaluate()` runs. The mode's `checkAnswer` recognizes the
  sentinel. Works today, zero engine changes.

- **(B) Add `submitResult` to engine** — New engine method that takes a
  pre-computed `{correct, correctAnswer}` directly, bypassing `checkAnswer`.
  Cleaner than sentinels but requires engine changes.

- **(C) GenericMode bypasses checkAnswer** — For sequential modes, GenericMode
  calls `engine.submitAnswer` with the sentinel internally and provides a
  trivial `checkAnswer` that just reads it. The mode definition doesn't need
  `checkAnswer` at all for sequential modes.

**Recommendation: (C) — GenericMode handles it internally.**

Rationale: Sequential mode definitions shouldn't need to know about sentinels.
GenericMode can synthesize a trivial `checkAnswer` that recognizes `__correct__`
internally, and supply it to the engine config. The mode definition only
provides `evaluate()`. This is the cleanest API for mode authors.

This means: for sequential modes, `ModeDefinition.checkAnswer` becomes
optional (or GenericMode overrides it internally). The mode author only writes
`sequential.evaluate`.

### 6. What about the text input field?

Today, Chord Spelling has its own `ChordTextInput` component with:
- Count validation (rejects if wrong number of notes)
- `parseChordInput` for space-separated note parsing
- Shake on invalid input

**Recommendation:** GenericMode renders a batch text input when
`sequential.parseBatchInput` is defined. The existing `AnswerInput` component
can be reused with minor adaptation:
- On Enter, call `parseBatchInput(text)` → validate count matches
  `expectedCount` → if valid, run through `evaluate` → submit
- Shake on count mismatch or unparseable input

The `parseBatchInput` function in the mode definition handles mode-specific
parsing (e.g., `parseChordInput` for chord spelling, or something else for a
future mode).

### 7. What about SplitNoteButtons?

`SplitNoteButtons` is currently the only button component that supports
sequential/chain-submit mode. For chord spelling, it's exactly right.

**Recommendation:** Sequential modes declare their buttons via the normal
top-level `buttons` field (e.g., `{ kind: 'piano-note' }`). GenericMode
detects `def.sequential` and renders them in sequential/chain-submit mode
automatically — passing `sequential={true}` and routing each tap through the
collection pipeline instead of directly to `submitAnswer`.

Future sequential modes that need different button types (degree buttons, etc.)
can extend the button components to support sequential mode incrementally.
That's a button-level concern, not a mode-definition concern.

### 8. What happens to the hand-written component files?

After conversion:
- `chord-spelling-mode.tsx` → **deleted** (replaced by GenericMode + definition)
- `logic.ts` → **kept**, with `checkAnswer` simplified (remove sentinel logic).
  Add exports for new sequential config functions.
- `definition.ts` → **new**, ~40-50 lines of `ModeDefinition` with
  `sequential` field
- `logic_test.ts` → **kept**, tests updated to match any API changes

---

## Summary of Recommendations

| Decision | Choice | Rationale |
|---|---|---|
| Sequential state ownership | GenericMode manages it | Pure-data definitions |
| Type system expression | Optional `sequential` field | Additive, minimal disruption |
| Sequential config shape | `expectedCount` + `evaluate` (2 required fns) | Mode says what, system handles how |
| Sequential UI rendering | Built-in slot component | Universal pattern, free for future modes |
| Sentinel/checkAnswer | GenericMode synthesizes internally | Mode authors don't see sentinels |
| Text input | Reuse AnswerInput + parseBatchInput | Consistent with existing pattern |
| Button type | Top-level `buttons` field, sequential mode automatic | Same field as single-answer modes |
| File changes | Delete component, keep logic, add definition | Standard mode structure |

## Non-Goals

- Converting Speed Tap (the other hand-written mode) — different problem
  (timing-only, no quiz answers)
- Building new multi-note modes — this plan just creates the infrastructure
- Changing the quiz engine's core answer flow — we work within the existing
  `submitAnswer` API

## Risks

- **Slot rendering flexibility** — If a future sequential mode needs radically
  different feedback UI (not slots), the built-in rendering won't fit. Mitigated
  by controller `renderPrompt` escape hatch.
- **Button type limitation** — Starting with note buttons only. If the next
  sequential mode needs degree buttons in sequential mode, we'd need to add
  sequential support to those button types.
