# Declarative Skill Modes

**Date:** 2026-03-06
**Status:** Architecture exploration + prototype

## Problem

Mode components are 200–650 lines but ~80% is identical boilerplate:
- Hook composition (useLearnerModel → useGroupScope → useQuizEngine → usePhaseClass → useModeLifecycle → useRoundSummary → usePracticeSummary)
- Phase-conditional rendering (idle → PracticeTab, active → QuizSession + QuizArea, round-complete → RoundCompleteInfo, calibrating → SpeedCheck)
- Ref plumbing (currentQRef, engineSubmitRef, pendingNote state)
- Button answer handler callbacks

What actually varies across modes is small:
1. **Item space** — what items exist and how they're grouped
2. **Question logic** — parse an item ID → compute prompt text + correct answer
3. **Response type** — which buttons to show and how keyboard maps to them
4. **Stats display** — grid, table, or heatmap
5. **Scope UI** — group toggles, string/note toggles, or nothing

Adding a new mode today requires ~250 lines of tsx that's 80% copy-paste from
another mode. With a declarative system, it would be ~20–40 lines of data.

## Mode Taxonomy

Analyzing all 10 modes reveals these categories:

### Response types (what buttons + keyboard)

| Response type | Modes | Button component | Keyboard |
|---|---|---|---|
| `note` | SemitoneMath, IntervalMath | NoteButtons | noteHandler (letter + accidental narrowing) |
| `piano-note` | Fretboard | PianoNoteButtons | noteHandler |
| `number` | NoteSemitones fwd, IntervalSemitones fwd | NumberButtons(start,end) | digit buffering with timeout |
| `degree` | ScaleDegrees rev | DegreeButtons | 1-7 direct submit |
| `numeral` | DiatonicChords rev | NumeralButtons | 1-7 → roman numeral |
| `interval` | IntervalSemitones rev | IntervalButtons | none |
| `keysig` | KeySignatures fwd | KeysigButtons | digit + #/b combo |
| `sequential-note` | ChordSpelling | NoteButtons → seq state machine | noteHandler |

### Scope types (how user filters what to practice)

| Scope type | Modes | Component |
|---|---|---|
| none | NoteSemitones, IntervalSemitones | — |
| groups | 6 modes (semitone-math, interval-math, key-sig, scale-deg, diatonic, chord-spelling) | GroupToggles |
| fretboard | Fretboard, SpeedTap | StringToggles + NoteFilter |

### Stats display types

| Stats type | Modes | Component |
|---|---|---|
| grid | SemitoneMath, IntervalMath, ScaleDegrees, DiatonicChords, ChordSpelling | StatsGrid |
| table | NoteSemitones, IntervalSemitones, KeySignatures | StatsTable |
| fretboard-heatmap | Fretboard | SVG + hover cards |
| none | SpeedTap | — |

### Direction patterns

| Pattern | Modes |
|---|---|
| Unidirectional (always same response) | SemitoneMath, IntervalMath, ChordSpelling |
| Bidirectional (fwd/rev swap buttons) | NoteSemitones, IntervalSemitones, KeySig, ScaleDeg, DiatonicChords |
| No direction | Fretboard, SpeedTap |

## Proposed Design

### ModeDefinition type

```typescript
// What buttons to show + how keyboard routes to them
type ResponseDef =
  | { kind: 'note'; useFlats?: (q: any) => boolean }
  | { kind: 'piano-note'; hideAccidentals?: (q: any) => boolean }
  | { kind: 'number'; start: number; end: number }
  | { kind: 'degree' }
  | { kind: 'numeral' }
  | { kind: 'interval' }
  | { kind: 'keysig' };

// How the user answers: one response type, or direction-dependent pair
type AnswerDef =
  | ResponseDef
  | { kind: 'bidirectional'; fwd: ResponseDef; rev: ResponseDef };

// How the user scopes what to practice
type ScopeDef =
  | { kind: 'none' }
  | { kind: 'groups'; groups: Array<{ label: string }>; storageKey: string;
      getItemIdsForGroup: (i: number) => string[];
      allGroupIndices: number[]; scopeLabel: string;
      defaultEnabled: number[];
      formatLabel: (groups: ReadonlySet<number>) => string; }
  | { kind: 'fretboard'; instrument: Instrument };

// How stats are displayed
type StatsDef =
  | { kind: 'grid'; colLabels: string[]; getItemId: (...) => ...; notes?: ... }
  | { kind: 'table'; getRows: () => StatsTableRow[]; fwdHeader: string; revHeader: string }
  | { kind: 'none' };

// The full mode definition
interface ModeDefinition<Q = unknown> {
  // Identity
  id: string;
  name: string;
  namespace: string;  // localStorage namespace
  description: string;
  beforeAfter: string;
  itemNoun: string;   // 'items', 'positions', etc.

  // Item space
  allItems: string[];

  // Pure logic
  getQuestion: (itemId: string) => Q;
  getPromptText: (q: Q) => string;
  checkAnswer: (q: Q, input: string) => { correct: boolean; correctAnswer: string };
  getDirection?: (q: Q) => 'fwd' | 'rev';

  // UI configuration
  answer: AnswerDef;
  scope: ScopeDef;
  stats: StatsDef;
}
```

### GenericMode component

A single Preact component that:
1. Calls all shared hooks in the standard order
2. Builds the engine config from the definition
3. Renders a text input for keyboard answers (+ buttons for tap/click)
4. Renders the standard phase-conditional UI

```
GenericMode({ def, container, navigateHome, onMount })
  └── ~200 lines of hook composition + rendering
      replaces ~250-650 lines per mode
```

### Text input replaces keyboard handler factory

**Key simplification:** Instead of per-response-type keyboard handlers (note
handler with accidental narrowing, digit buffering with timeouts, key signature
digit+#/b combos, etc.), all keyboard input goes through a single `<input>`
element. User types their answer and hits Enter.

**Before:** 165 lines of keyboard handler factory code per response type
(createAdaptiveKeyHandler, digit buffering, timeout management, narrowing state,
direction-dependent routing).

**After:** 30 lines for an `<AnswerInput>` component — type, Enter, done.

Buttons remain for tap/click (important on mobile). The mode definition
specifies which buttons to show, but keyboard input is always just the
text field.

**Error handling:** An optional `validateInput(q, input) → boolean` on the mode
definition lets modes reject garbage input (show shake animation) instead of
scoring it as wrong. The existing `checkAnswer` functions already handle any
string gracefully (garbage → `false`, never crashes), so this is purely a UX
improvement.

**Trade-offs:**
- Slightly slower than single-keystroke answers for expert users (type "C#" +
  Enter vs just pressing C then #)
- No visual narrowing feedback on buttons as you type
- More forgiving of typos (you can see what you typed before committing)
- Much simpler to implement new response types (no custom keyboard handler
  needed)
- Uniform experience across all modes

### What this replaces

**Before (semitone-math-mode.tsx):** 307 lines
**After (declarative definition):** ~35 lines

```typescript
export const SEMITONE_MATH_DEF: ModeDefinition<Question> = {
  id: 'semitoneMath',
  name: 'Semitone Math',
  namespace: 'semitoneMath',
  description: MODE_DESCRIPTIONS.semitoneMath,
  beforeAfter: MODE_BEFORE_AFTER.semitoneMath,
  itemNoun: 'items',
  allItems: ALL_ITEMS,
  getQuestion,
  getPromptText: (q) => q.promptText,
  checkAnswer,
  answer: { kind: 'note', useFlats: (q) => q.useFlats },
  scope: {
    kind: 'groups',
    groups: DISTANCE_GROUPS,
    getItemIdsForGroup,
    allGroupIndices: ALL_GROUP_INDICES,
    storageKey: 'semitoneMath_enabledGroups',
    scopeLabel: 'Distances',
    defaultEnabled: [0],
    formatLabel: (groups) => {
      if (groups.size === DISTANCE_GROUPS.length) return 'all distances';
      const labels = [...groups].sort((a, b) => a - b)
        .map((g) => DISTANCE_GROUPS[g].label);
      return labels.join(', ') + ' semitones';
    },
  },
  stats: {
    kind: 'grid',
    colLabels: GRID_COL_LABELS,
    getItemId: getGridItemId,
  },
};
```

## What this does NOT cover (yet)

### Fretboard mode (outlier)

Fretboard has unique aspects that don't fit the simple model:
- **SVG visual prompt** — highlights a position on a fretboard diagram
- **SVG heatmap stats** — colors circles by automaticity
- **Imperative DOM effects** — hover cards, circle fill manipulation
- **Custom scope** — string toggles + note filter
- **Custom recommendations** — note prioritization within strings

Fretboard could be handled via a `promptComponent` and `statsComponent` extension
point, or simply left as a hand-written mode. The declarative system should be
designed so it doesn't prevent fretboard from existing alongside it.

### Chord spelling (sequential)

Chord spelling has a sequential state machine where the user enters notes one
at a time. This could be modeled as a special response type
(`{ kind: 'sequential-note', initState, handleInput }`) but it's the only mode
that works this way. Worth doing later if we get more sequential modes.

### Speed tap

Speed tap uses the fretboard as the response interface (tap a position). This
is the inverse of fretboard mode (fretboard is prompt vs. response). Could be
handled via a custom response component extension.

## Keyboard input: text field vs handler factory

**Decision: text field.** The first prototype had a keyboard handler factory
(~165 lines) that replicated each mode's custom keyboard handling. The second
iteration replaced it with a single `<AnswerInput>` text field (~30 lines).

The existing keyboard handlers have 4 distinct patterns (note with accidental
buffering, digit buffering with timeouts, direct digit, keysig digit+#/b).
Replicating all of them in a generic component is the most complex part of the
declarative system — and it's unnecessary if the user just types in a text field.

The `checkAnswer` functions already handle free-text input gracefully:
- `noteMatchesInput(note, input)` — case-insensitive, enharmonic equivalents
- `parseInt(input)` for numbers — NaN on garbage, safe equality check
- String comparison for roman numerals, key signatures, etc.
- No crashes on empty string, random text, or partial input

Optional `validateInput` on the mode definition can reject garbage (typos,
partial input) with a shake animation instead of scoring it wrong. Validators
use exact `Set` lookups derived from the source data arrays — never regex
approximations. For example, `isValidIntervalInput` checks membership in
`Set(['m2', 'M2', 'm3', ..., 'TT', 'A4', 'd5'])` built from `INTERVALS`.

## Impact analysis

### What can be converted immediately (8 of 10 modes)

| Mode | Category | Lines saved |
|---|---|---|
| Semitone Math | note + groups + grid | ~270 |
| Interval Math | note + groups + grid | ~270 |
| Scale Degrees | bidirectional note/degree + groups + grid | ~290 |
| Diatonic Chords | bidirectional note/numeral + groups + grid | ~290 |
| Key Signatures | bidirectional keysig/note + groups + table | ~350 |
| Note Semitones | bidirectional number/note + no-scope + table | ~310 |
| Interval Semitones | bidirectional number/interval + no-scope + table | ~280 |
| Chord Spelling | sequential-note + groups + grid | ~330 |

**Total: ~2,400 lines replaced by ~300 lines of definitions + ~200 lines of
GenericMode + ~50 lines of keyboard handler factories.**

### What stays hand-written (2 modes)

- Fretboard (~650 lines) — too much imperative SVG work
- Speed Tap (~similar) — fretboard-as-response

These could get extension points later but forcing them into a declarative
model would be worse than the current approach.

## Composability wins

Once GenericMode exists, new modes become trivial:

**Staff notation mode** (future): staff SVG as prompt + NoteButtons response
→ just add a `promptComponent: StaffSVG` to the definition, reuse everything.

**Fretboard ↔ Staff** (future): fretboard SVG as prompt + staff SVG as response
→ compose existing visual components with a new definition.

**Interval ear training** (future): audio prompt + IntervalButtons response
→ add `promptComponent: AudioPlayer`, rest is identical.

The key insight is that the **app is "show a prompt, get a response, measure
time and correctness"** — GenericMode encodes this directly, and new variations
only need to specify what's different.

## Migration strategy

1. Build GenericMode + ModeDefinition types (this prototype)
2. Convert the 2 simplest modes (semitone-math, interval-math) — they're
   nearly identical, validating the approach
3. Convert the 4 bidirectional-with-groups modes (scale-degrees, diatonic-chords,
   key-signatures)
4. Convert the 2 bidirectional-no-scope modes (note-semitones, interval-semitones)
5. Optionally convert chord-spelling (needs sequential extension)
6. Leave fretboard and speed-tap as-is

Each step can be done independently and verified with `deno task ok`.

## Implementation

The declarative system is live with 9 of 11 modes using `GenericMode`:

**Framework:**
- `src/declarative/types.ts` — ModeDefinition, ModeController, ButtonsDef, ScopeDef, StatsDef
- `src/declarative/generic-mode.tsx` — GenericMode + AnswerInput component

**Declarative modes (registered via `registerDeclarativeMode`):**
- Guitar Fretboard, Ukulele Fretboard — use `ModeController` for SVG rendering
- Note Semitones, Interval Semitones — bidirectional, no scope
- Semitone Math, Interval Math — unidirectional, group scope
- Key Signatures, Scale Degrees, Diatonic Chords — bidirectional, group scope

**Hand-written modes (registered via `registerPreactMode`):**
- Chord Spelling — sequential note entry state machine
- Speed Tap — fretboard-as-response interface

**Input validation:** Validators use exact `Set` lookups derived from the source
data arrays (`NOTES`, `INTERVALS`, `MAJOR_KEYS`, `DIATONIC_CHORDS`) rather than
regex approximations. This ensures the validator accepts exactly the strings
that `checkAnswer` can score correctly.
