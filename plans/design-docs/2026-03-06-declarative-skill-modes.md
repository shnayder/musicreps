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
3. Sets up the correct keyboard handler based on `answer` type
4. Renders the standard phase-conditional UI
5. Renders the correct buttons based on `answer` and current direction

```
GenericMode({ def, container, navigateHome, onMount })
  └── ~150 lines of hook composition + rendering
      replaces ~250 lines per mode
```

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

## Keyboard handler strategy

The most complex part of the boilerplate is keyboard handling. The patterns are:

1. **Note handler** — `createAdaptiveKeyHandler()` with narrowing. Used by 7+ modes.
2. **Digit buffer** — multi-digit numbers with timeout auto-submit. Used by
   note-semitones (0-11), interval-semitones (1-12).
3. **Direct digit** — 1-7 immediate submit. Used by scale-degrees, diatonic-chords.
4. **Key signature** — digit + #/b combination. Used by key-signatures.

The GenericMode component would have a keyboard handler factory that maps
`ResponseDef` → keyboard handler:

```typescript
function keyboardHandlerForResponse(
  resp: ResponseDef,
  submitAnswer: (input: string) => void,
): KeyHandler {
  switch (resp.kind) {
    case 'note':
    case 'piano-note':
      return createAdaptiveKeyHandler(submitAnswer, () => true, setPendingNote);
    case 'number':
      return createDigitBufferHandler(resp.start, resp.end, submitAnswer);
    case 'degree':
    case 'numeral':
      return createDirectDigitHandler(1, 7, submitAnswer, resp.kind === 'numeral');
    case 'keysig':
      return createKeysigHandler(submitAnswer);
    case 'interval':
      return { handleKey: () => false, reset: () => {} };  // no keyboard
  }
}
```

For bidirectional modes, the GenericMode component switches the active handler
based on current question direction.

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

## Prototype

This document is accompanied by a working prototype:
- `src/declarative/types.ts` — ModeDefinition type + response types
- `src/declarative/generic-mode.tsx` — GenericMode component
- `src/declarative/keyboard-handlers.ts` — handler factories for each response type
- `src/modes/semitone-math/definition.ts` — semitone-math as declarative def
- `src/modes/note-semitones/definition.ts` — note-semitones as declarative def

The prototype proves the concept works for both unidirectional (note-only) and
bidirectional (note + number) modes without losing any functionality.
