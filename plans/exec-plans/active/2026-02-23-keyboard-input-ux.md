# Keyboard Input UX — Execution Plan

Implements the [keyboard input UX spec](../../product-specs/active/2026-02-23-keyboard-input-ux-spec.md):
Enter-to-commit, keyboard hints, and progressive narrowing.

## Architecture Decisions

### Enter-to-commit routing
Enter during answering already routes to `'delegate'` via `engineRouteKey` (the
same path as note/digit keys). Each handler checks for Enter and commits its
pending buffer. No changes to the routing layer.

### Pending state exposure
Add `onPendingChange?: (pendingNote: string | null) => void` parameter to
`createNoteKeyHandler`, `createSolfegeKeyHandler`, and
`createAdaptiveKeyHandler`. Called whenever `pendingNote` transitions. Mode
components pass `setPendingNote` (a Preact state setter) as the callback,
giving them reactive access to the buffer.

### Narrowing match derivation
For notes: `{note, note + '#'} ∩ NOTE_NAMES` — the natural and its adjacent
sharp (if one exists). `C` → `{C, C#}`, `E` → `{E}`, `B` → `{B}`.

For numbers: pending digit 1 in 0–11 → `{1, 10, 11}`. Pending digit 1 in
1–12 → `{1, 10, 11, 12}`. Digits 2–9 commit immediately (no narrowing).

### Keyboard hint
New `KeyboardHint` component in `quiz-ui.tsx`. CSS-only visibility via
`@media (pointer: fine)`. Rendered by each mode below the answer buttons,
hidden during feedback phase.

## File Changes

### Core handlers
- `src/quiz-engine.ts` — Enter handling + `onPendingChange` for all 3 handlers
- `src/types.ts` — Extend `NoteKeyHandler` with optional `onPendingChange`

### UI components
- `src/ui/quiz-ui.tsx` — Add `KeyboardHint` component
- `src/ui/buttons.tsx` — Add `narrowing` prop to `NoteButtons`,
  `PianoNoteButtons`, `NumberButtons`
- `src/styles.css` — `.keyboard-hint`, `.kb-match`, `.kb-dimmed`

### Mode components (9 files)
Each mode wires up `onPendingChange`, derives match set, passes `narrowing`
to buttons, and renders `KeyboardHint`.

| Mode | Note narrowing | Number narrowing | Keyboard hint |
|------|---------------|-----------------|---------------|
| Fretboard (x2) | PianoNoteButtons | — | note |
| Semitone Math | NoteButtons | — | note |
| Interval Math | NoteButtons | — | note |
| Chord Spelling | NoteButtons | — | note |
| Note↔Semitones | NoteButtons (rev) | NumberButtons (fwd) | note or number |
| Interval↔Semitones | — | NumberButtons (fwd) | number (fwd only) |
| Key Signatures | NoteButtons (rev) | — | note (rev only) |
| Scale Degrees | NoteButtons (fwd) | — | note (fwd only) |
| Diatonic Chords | NoteButtons (fwd) | — | note (fwd only) |

### Tests + build
- `src/quiz-engine_test.ts` — Enter-to-commit + pending change tests
- `src/build-template.ts` — Version bump (v8.12 → v8.13)

## Implementation Order

1. Enter-to-commit in handlers (pure, no UI)
2. `onPendingChange` callback plumbing
3. `KeyboardHint` component + CSS
4. Button narrowing prop + CSS
5. Wire modes (one at a time, test as we go)
6. Version bump + `deno task ok`
