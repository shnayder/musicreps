# Plan: Separate State/Render, Reduce Mode Duplication

## Strategy

**Rip out, iterate, add back.** Keep 3 representative modes that span the
variation axes. Build the shared infrastructure around them. Re-enable modes one
at a time once the abstractions are solid.

**Modes to keep during iteration:**

| Mode             | Prompt     | Response              | Stats       | Scope           |
| ---------------- | ---------- | --------------------- | ----------- | --------------- |
| Guitar Fretboard | SVG + text | Note buttons          | SVG heatmap | Strings + notes |
| Semitone Math    | Text       | Note buttons          | Grid        | Groups          |
| Note Semitones   | Text       | Mixed (bidirectional) | Table       | None            |

These three cover every structural pattern:

- SVG vs text prompt
- Fixed vs bidirectional response
- Heatmap vs grid vs table stats
- String scope vs group scope vs no scope
- With vs without recommendations

**Modes to temporarily disable (comment out in `app.ts`):** Ukulele, Speed Tap,
Interval Semitones, Interval Math, Key Signatures, Scale Degrees, Diatonic
Chords, Chord Spelling.

---

## Core Types

### 1. ModeDefinition — what a mode author provides

The central interface. Everything mode-specific lives here. Everything NOT here
is owned by shared infrastructure.

```typescript
/**
 * Complete specification of a quiz mode. Provides data and pure logic;
 * the shared ModeController handles DOM, lifecycle, and engine wiring.
 *
 * Generic TQuestion captures the mode's per-question data shape
 * (e.g., { string: number; fret: number; note: string } for fretboard).
 */
interface ModeDefinition<TQuestion = unknown> {
  // --- Identity ---
  id: string;
  name: string;
  storageNamespace: string;

  // --- Item domain ---

  /** All possible item IDs. Used for storage preload and "all items" stats. */
  allItemIds: string[];

  /** Which items are eligible given the current scope selection. */
  getEnabledItems(scope: ScopeState): string[];

  // --- Scope (what the user has selected to practice) ---
  scopeSpec: ScopeSpec;

  // --- Question / answer (pure logic, no DOM) ---

  /** Derive question data from an item ID. Pure. */
  getQuestion(itemId: string): TQuestion;

  /** Check if user input is correct. Pure. */
  checkAnswer(itemId: string, input: string): CheckAnswerResult;

  // --- Presentation (how questions appear) ---
  prompt: PromptSpec<TQuestion>;

  // --- Response (how answers are collected) ---
  response: ResponseSpec;

  // --- Stats visualization ---
  stats: StatsSpec;

  // --- Labels ---

  /** Human-readable label for what's being practiced ("e, B strings"). */
  getPracticingLabel(scope: ScopeState): string;

  /** Session summary line ("3 strings · natural notes · 60s"). */
  getSessionSummary(scope: ScopeState): string;

  // --- Optional ---

  /** Calibration provider key (shared across modes using same button layout). */
  calibrationProvider?: string;

  /** Custom calibration trial config (search-mode calibration). */
  calibrationSpec?: CalibrationSpec;

  /** For multi-entry modes (chord spelling): expected response count per item. */
  getExpectedResponseCount?(itemId: string): number;
}
```

### 2. ScopeSpec + ScopeState — what controls appear and what's selected

Scope answers: "what subset of items is the user practicing?" The spec describes
the available controls; the state captures the user's selections.

```typescript
/** Build-time configuration: what scope controls to render. */
type ScopeSpec =
  | { kind: 'none' }
  | {
    kind: 'groups';
    groups: GroupDef[];
    defaultEnabled: number[];
    storageKey: string;
    /** Sort function for recommending which unstarted group to expand next. */
    sortUnstarted?: (a: GroupRec, b: GroupRec) => number;
  }
  | {
    kind: 'fretboard';
    instrument: Instrument;
  }
  | {
    kind: 'note-filter';
    storageKey: string;
  };

type GroupDef = {
  index: number;
  label: string;
  /** Item IDs belonging to this group. Precomputed at mode creation. */
  itemIds: string[];
};

/** Runtime state: what the user has currently selected. */
type ScopeState =
  | { kind: 'none' }
  | { kind: 'groups'; enabledGroups: ReadonlySet<number> }
  | {
    kind: 'fretboard';
    enabledStrings: ReadonlySet<number>;
    noteFilter: NoteFilter;
  }
  | { kind: 'note-filter'; noteFilter: NoteFilter };

type NoteFilter = 'natural' | 'sharps-flats' | 'all';
```

**Design rationale:** The discriminated union means each scope kind carries
exactly the state it needs. The shared infrastructure pattern-matches on `kind`
and renders the appropriate controls. Modes never touch scope DOM.

### 3. PromptSpec — how questions appear

```typescript
/**
 * How the mode presents a question. Two options:
 *
 * - 'text': the infrastructure sets .quiz-prompt textContent.
 *   Covers 8 of 10 modes. Zero DOM code in the mode.
 *
 * - 'custom': the mode gets a callback for full control.
 *   Used by fretboard (SVG highlight) and speed tap (multi-position).
 */
type PromptSpec<TQuestion> =
  | {
    kind: 'text';
    /** Pure: derive prompt string from question data. */
    getText(question: TQuestion): string;
  }
  | {
    kind: 'custom';
    /** Render the question into the quiz area. Called by infrastructure. */
    render(question: TQuestion, els: QuizAreaEls): void;
    /** Clear the previous question. Called before render and on stop. */
    clear(els: QuizAreaEls): void;
    /** Optional: visual feedback after answer (e.g., green/red circle). */
    onAnswer?(
      question: TQuestion,
      result: CheckAnswerResult,
      els: QuizAreaEls,
    ): void;
  };
```

**Why not always custom?** Because 8 of 10 modes do exactly the same thing: set
`promptEl.textContent = someString`. Making that the default path means 8 modes
need zero DOM code for prompts. Custom is the escape hatch.

### 4. ResponseSpec — how answers are collected

```typescript
/**
 * What answer buttons exist and how keyboard input maps to answers.
 *
 * The shared infrastructure owns:
 *   - wiring click handlers on .answer-btn / .note-btn elements
 *   - attaching/detaching key handlers
 *   - disabling buttons during feedback
 *
 * The mode specifies:
 *   - what HTML to generate at build time (via answerButtonsHTML)
 *   - what keyboard handler to use
 *   - for bidirectional modes: which button group is active per question
 */
type ResponseSpec =
  | {
    kind: 'buttons';
    /** Build-time HTML for the answer button area. */
    answerButtonsHTML: string;
    /** Create a keyboard handler. Infrastructure calls this once at init. */
    createKeyHandler: KeyHandlerFactory;
    /**
     * Extract the answer string from a clicked button.
     * e.g., btn.dataset.note, btn.dataset.num, btn.dataset.sig
     */
    getButtonAnswer(btn: HTMLElement): string | null;
  }
  | {
    kind: 'bidirectional';
    /**
     * Two or more button groups, shown/hidden per question.
     * Build-time HTML includes all groups; CSS hides inactive ones.
     */
    groups: AnswerGroup[];
    /** Which group ID to show for a given question. */
    getActiveGroup(question: unknown): string;
    /** Create a keyboard handler that adapts to the active group. */
    createKeyHandler: KeyHandlerFactory;
  }
  | {
    kind: 'sequential';
    /** Build-time HTML (note buttons). */
    answerButtonsHTML: string;
    createKeyHandler: KeyHandlerFactory;
    /**
     * Called by infrastructure with each individual input.
     * Returns 'continue' (need more input) or 'complete' with final result.
     */
    handleInput(
      itemId: string,
      input: string,
      state: SequentialState,
    ): SequentialInputResult;
    /** Initial state for a new question. */
    initSequentialState(itemId: string): SequentialState;
    /** Render the sequential entry UI (slots, etc.). */
    renderProgress(state: SequentialState, els: QuizAreaEls): void;
  }
  | {
    kind: 'spatial';
    /** For fretboard-tap or similar spatial response modes. */
    handleTap(
      target: HTMLElement,
      itemId: string,
    ): CheckAnswerResult | null;
    createKeyHandler?: KeyHandlerFactory;
  };

type AnswerGroup = {
  id: string;
  html: string;
  getButtonAnswer(btn: HTMLElement): string | null;
};

type KeyHandlerFactory = (
  submitAnswer: (input: string) => void,
  getScope: () => ScopeState,
) => NoteKeyHandler;

type SequentialState = {
  expectedCount: number;
  entries: { input: string; display: string; correct: boolean }[];
};

type SequentialInputResult =
  | { status: 'continue'; state: SequentialState }
  | { status: 'complete'; correct: boolean; correctAnswer: string };
```

**Why a discriminated union?** Because these are genuinely different interaction
patterns. `buttons` (8 modes) is the common case. `bidirectional` handles
note-semitones / interval-semitones / key-sigs / scale-degrees / diatonic-chords
where the response type flips per question. `sequential` handles chord spelling.
`spatial` handles speed tap.

### 5. StatsSpec — how progress is visualized

```typescript
/**
 * How stats appear on the Progress tab. Three shapes:
 *
 * - 'table': bidirectional lookup modes (2-column: forward + reverse)
 * - 'grid': matrix modes (notes × distances/degrees/intervals)
 * - 'custom': fretboard SVG heatmap, or anything else
 */
type StatsSpec =
  | {
    kind: 'table';
    getRows(): StatsTableRow[];
    fwdHeader: string;
    revHeader: string;
  }
  | {
    kind: 'grid';
    colLabels: string[];
    getItemId(noteName: string, colIndex: number): string | string[];
    notes?: { name: string; displayName: string }[];
  }
  | {
    kind: 'custom';
    render(
      statsMode: string,
      container: HTMLElement,
      selector: AdaptiveSelector,
      baseline: number | null,
    ): void;
  };
```

### 6. CalibrationSpec — optional calibration customization

```typescript
type CalibrationSpec = {
  /** Custom intro hint text. */
  introHint?: string;
  /** Which buttons to use for calibration (default: all visible). */
  getButtons?(container: HTMLElement): HTMLElement[];
  /** Custom trial config for search-mode calibration. */
  getTrialConfig?(
    buttons: HTMLElement[],
    prevBtn: HTMLElement | null,
  ): CalibrationTrialConfig;
};
```

### 7. ModeUIState — the mode-level state object (for State+Render)

```typescript
/**
 * Complete UI state for a mode's idle screen. Computed by the shared
 * infrastructure from the mode definition + selector data. Rendered
 * declaratively — no scattered updates, no ordering bugs.
 */
type ModeUIState = {
  // Tab
  activeTab: 'practice' | 'progress';

  // Scope
  scope: ScopeState;

  // Practice summary (derived from scope + selector)
  practice: PracticeSummaryState;

  // Stats (progress tab)
  statsMode: 'retention' | 'speed' | null;

  // Recommendations
  recommendation: RecommendationResult | null;
};

type PracticeSummaryState = {
  /** "Overall: Solid", "Ready to start", etc. */
  statusLabel: string;
  /** "12 of 78 positions fluent" */
  statusDetail: string;
  /** "Suggestion: solidify E string — 8 slow items, start A string" */
  recommendationText: string;
  showRecommendationButton: boolean;
  /** "3 strings · natural notes · 60s" */
  sessionSummary: string;
  /** "Looks like you've got this!" */
  masteryText: string;
  showMastery: boolean;
  /** Item count for start button area. */
  enabledItemCount: number;
};

/**
 * Compute PracticeSummaryState from mode definition + selector data.
 * Pure function — testable, no DOM.
 */
function computePracticeSummary(
  def: ModeDefinition,
  scope: ScopeState,
  selector: AdaptiveSelector,
  recommendation: RecommendationResult | null,
): PracticeSummaryState;
```

**This is the key separation.** Today, `renderPracticeSummary()` in each mode
does computation AND DOM mutation in one tangled function. In the new
architecture, `computePracticeSummary` is pure (testable), and `render` is a
thin DOM assignment (trivial).

### 8. QuizAreaEls — stable DOM references for mode callbacks

```typescript
/**
 * Stable DOM element references for the quiz area. Created once at init,
 * passed to mode callbacks. Eliminates querySelector in mode code.
 */
type QuizAreaEls = {
  promptEl: HTMLElement;
  quizArea: HTMLElement;
  /** Fretboard SVG wrapper (present only in fretboard modes). */
  fretboardWrapper?: HTMLElement;
  /** Fretboard SVG wrapper in progress tab (for heatmap). */
  progressFretboardWrapper?: HTMLElement;
};
```

### 9. ModeController — the shared infrastructure

```typescript
/**
 * Created by the shared infrastructure for each registered mode.
 * Owns the entire lifecycle: DOM wiring, engine creation, state management,
 * and rendering. The mode definition provides data and logic; the controller
 * handles everything else.
 */
interface ModeController {
  init(): void;
  activate(): void;
  deactivate(): void;
}

/**
 * Factory: takes a ModeDefinition, returns a ModeController.
 * This replaces the 10 createXxxMode() factories with one shared function.
 */
function createModeController(def: ModeDefinition): ModeController;
```

**What `createModeController` owns (things modes never do):**

- Create QuizEngine
- Query and cache all DOM elements
- Tab switching
- Practice summary rendering (calls `computePracticeSummary`)
- Session summary rendering
- Stats toggle wiring + legend rendering
- Scope control rendering (group toggles, string toggles, note filter)
- Scope state management (load/save localStorage)
- Recommendation computation and display
- Start button wiring
- "Use suggestion" button wiring
- Activate/deactivate lifecycle
- Notation change handling
- Preloading storage
- Heatmap rendering for 'table' and 'grid' stats (delegates to existing
  `renderStatsTable` / `renderStatsGrid`)

---

## What a mode looks like after refactoring

Example: Semitone Math (currently 433 lines → ~100 lines):

```typescript
// src/modes/semitone-math.ts

export function semitoneMathDefinition(): ModeDefinition<SemitoneMathQuestion> {
  const GROUPS = buildDistanceGroups(); // pure
  const ALL_ITEMS = buildAllItems(); // pure

  return {
    id: 'semitoneMath',
    name: 'Semitone Math',
    storageNamespace: 'semitoneMath',

    allItemIds: ALL_ITEMS,

    getEnabledItems(scope) {
      if (scope.kind !== 'groups') return ALL_ITEMS;
      return ALL_ITEMS.filter((id) => {
        const d = parseDistance(id);
        return groupContainsDistance(GROUPS, scope.enabledGroups, d);
      });
    },

    scopeSpec: {
      kind: 'groups',
      groups: GROUPS.map((g, i) => ({
        index: i,
        label: g.label,
        itemIds: g.itemIds,
      })),
      defaultEnabled: [0],
      storageKey: 'semitoneMath_enabledGroups',
      sortUnstarted: (a, b) => a.string - b.string,
    },

    getQuestion(itemId) {
      return parseSemitoneMathItem(itemId); // pure
    },

    checkAnswer(itemId, input) {
      const q = this.getQuestion(itemId);
      return checkSemitoneMathAnswer(q, input); // pure
    },

    prompt: {
      kind: 'text',
      getText(q) {
        return q.questionText;
      }, // e.g. "C + 3 = ?"
    },

    response: {
      kind: 'buttons',
      answerButtonsHTML: pianoNoteButtons(),
      createKeyHandler: (submit, getScope) =>
        createAdaptiveKeyHandler(submit, () => {
          // accidentals always enabled in math modes
          return true;
        }),
      getButtonAnswer: (btn) => btn.dataset.note ?? null,
    },

    stats: {
      kind: 'grid',
      colLabels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'],
      getItemId: (noteName, colIndex) => [
        noteName + '+' + (colIndex + 1),
        noteName + '-' + (colIndex + 1),
      ],
    },

    getPracticingLabel(scope) {
      if (scope.kind !== 'groups') return 'all distances';
      return groupsLabel(GROUPS, scope.enabledGroups);
    },

    getSessionSummary(scope) {
      const count = this.getEnabledItems(scope).length;
      return count + ' items · 60s';
    },

    calibrationSpec: {
      getTrialConfig: (buttons, prevBtn) => {
        const btn = pickCalibrationButton(buttons, prevBtn);
        return { prompt: 'Press ' + btn.textContent, targetButtons: [btn] };
      },
    },
  };
}
```

Compare to today's 433-line closure with duplicated tab switching, practice
summary rendering, group toggle management, stats controls wiring, etc.

---

## Execution Phases

### Phase 0: Preparation — COMPLETE

- [x] Disable 8 modes in `app.ts` (comment out imports + registrations)
- [x] Keep: Guitar Fretboard, Semitone Math, Note Semitones
- [x] Bump version
- [x] Tests still pass, app still builds and runs with 3 modes

### Phase 1: Define types — COMPLETE

- [x] Add all types from this plan to `src/types.ts`
- [x] `ModeDefinition`, `ScopeSpec`, `ScopeState`, `PromptSpec`, `ResponseSpec`,
      `StatsSpec`, `CalibrationSpec`, `ModeUIState`, `PracticeSummaryState`,
      `QuizAreaEls`
- [x] These are type-only — zero runtime impact

### Phase 2: Pure computation functions — COMPLETE

- [x] `computePracticeSummary()` — pure function in `src/mode-ui-state.ts`
- [x] `computePracticeSummaryForMode()` — wrapper that uses ModeDefinition
- [x] Helper functions: `countFluent`, `statusLabelFromPct`,
      `buildRecommendationText`
- [x] 16 unit tests in `src/mode-ui-state_test.ts`
- Note: `computeScopeState()` was not extracted as a separate function; scope
  state loading is handled inline in `mode-controller.ts`

### Phase 3: createModeController — COMPLETE

- [x] New file: `src/mode-controller.ts` (903 lines)
- [x] Implements `createModeController(def: ModeDefinition): ModeController`
- [x] Handles: engine creation, DOM wiring, tabs, practice summary, session
      summary, scope controls, recommendations, stats toggle + legend, start
      button, activate/deactivate, notation changes
- [x] The `QuizMode` interface passed to `createQuizEngine` is assembled from
      the `ModeDefinition` fields (thin adapter)
- Note: ModeUIState is not used as a formal intermediate data structure;
  mode-controller computes and renders practice summary directly via
  `computePracticeSummaryForMode()`. The render() pattern is implicit.

### Phase 4: Refactor the 3 retained modes — COMPLETE

- [x] Write `ModeDefinition` for each in `src/modes/<mode>.ts`
  - `src/modes/fretboard.ts` (265 lines) — was 750 in quiz-fretboard.ts
  - `src/modes/semitone-math.ts` (205 lines) — was 465 in quiz-semitone-math.ts
  - `src/modes/note-semitones.ts` (198 lines) — was 322 in
    quiz-note-semitones.ts
- [x] Update `app.ts` to use `createModeController(xxxDefinition())`
- [x] Tests pass (96/96), app builds successfully (v6.18)
- Note: Pure logic was NOT separated into `*-logic.ts` files. Question
  generation and answer checking live directly in the ModeDefinition factory
  closures. This is simpler for now — separate logic files can be extracted
  later if testing or reuse demands it.
- Note: Old `src/quiz-*.ts` files for these 3 modes are NOT yet deleted
  (deferred to Phase 7 cleanup)

### Phase 5: Iterate on abstractions

- [ ] Use the 3 modes to stress-test the type boundaries
- [ ] Adjust types as needed (especially PromptSpec, ResponseSpec)
- [ ] Ensure fretboard hover card, heatmap, bidirectional button switching all
      work cleanly within the interfaces

### Phase 6: Re-enable modes one at a time

- [ ] Ukulele (trivial — same ModeDefinition as Guitar with different
      Instrument)
- [ ] Interval Math (nearly identical to Semitone Math)
- [ ] Interval Semitones (nearly identical to Note Semitones)
- [ ] Key Signatures, Scale Degrees, Diatonic Chords (group modes)
- [ ] Speed Tap (spatial response — may need ResponseSpec refinement)
- [ ] Chord Spelling (sequential response — may need ResponseSpec refinement)

### Phase 7: Cleanup

- [ ] Delete old quiz files that are fully replaced
- [ ] Update CLAUDE.md, architecture.md, coding-style.md
- [ ] Update build-template.ts if HTML structure changed
- [ ] Full test pass, lint, fmt

---

## Key design decisions

**Q: Why discriminated unions instead of callback-only?** Because most modes are
simple. 8 of 10 modes use `{ kind: 'text' }` prompts. 6 of 10 use
`{ kind: 'buttons' }` responses. The union ensures the common case has zero
boilerplate while the escape hatch (`custom`, `sequential`, `spatial`) handles
the outliers.

**Q: Why does ModeDefinition have `getQuestion` returning typed data?**
Testability. If `presentQuestion` mutates the DOM directly (as today), you can't
test it without a DOM. With `getQuestion` returning pure data and
`prompt.getText(q)` converting to a string, the entire question→answer flow is
testable with no DOM.

**Q: Why does the infrastructure own scope state instead of the mode?** Because
scope management (load/save localStorage, render toggles, handle clicks, compute
recommendations) is 100% identical across modes. The mode defines WHAT controls
exist (`ScopeSpec`); the infrastructure does everything else. This is where the
biggest duplication reduction happens.

**Q: Why keep QuizEngine mostly unchanged?** It's already well-factored — pure
state transitions in engine-state.ts, thin render in engine.ts. The `QuizMode`
interface it consumes is close to what we need. `createModeController`
constructs a `QuizMode` object from the `ModeDefinition` fields and passes it to
the engine. No engine rewrite needed.

**Q: What about Speed Tap and Chord Spelling?** These are the modes most likely
to require ResponseSpec adjustments. Speed Tap has spatial tapping (no buttons).
Chord Spelling has sequential multi-entry. Both are intentionally deferred to
Phase 6 so we can get the core right first. The `spatial` and `sequential`
response variants are placeholders that may evolve.

**Q: What about the fretboard hover card?** It's a
`PromptSpec: { kind: 'custom' }` concern. The `QuizAreaEls` type includes
`fretboardWrapper` and `progressFretboardWrapper` so the mode's custom render
callback has stable references. The hover card setup moves into the mode's
custom prompt renderer or into a shared fretboard utility that both Guitar and
Ukulele use.

---

## Handoff Notes for Next Phase Agent

### Current Status (as of commit 6b2d7aa, v6.18)

Phases 0–4 are complete. The 3 retained modes (Guitar Fretboard, Semitone Math,
Note Semitones) run entirely through the new ModeDefinition +
createModeController infrastructure. All 96 tests pass, build succeeds.

The old `src/quiz-*.ts` files for these 3 modes still exist but are no longer
imported — they are dead code awaiting deletion in Phase 7.

### Key Files

| File                          | Lines | Role                                                          |
| ----------------------------- | ----- | ------------------------------------------------------------- |
| `src/types.ts`                | 578   | All shared types including ModeDefinition, ScopeSpec, etc.    |
| `src/mode-controller.ts`      | 903   | Shared controller: DOM, engine, tabs, scope, stats, lifecycle |
| `src/mode-ui-state.ts`        | 168   | Pure practice summary computation + helpers                   |
| `src/mode-ui-state_test.ts`   | ~180  | 16 unit tests for practice summary                            |
| `src/modes/fretboard.ts`      | 265   | Guitar Fretboard ModeDefinition                               |
| `src/modes/semitone-math.ts`  | 205   | Semitone Math ModeDefinition                                  |
| `src/modes/note-semitones.ts` | 198   | Note Semitones ModeDefinition                                 |

### Deviations from Original Plan

1. **No separate `*-logic.ts` files.** The plan called for splitting each mode
   into `modes/<mode>.ts` (definition) + `modes/<mode>-logic.ts` (pure logic).
   In practice, the pure logic (getQuestion, checkAnswer) is simple enough to
   live directly in the ModeDefinition factory closure. Extract later if testing
   or cross-mode reuse demands it.

2. **No formal ModeUIState render cycle.** The plan envisioned a `ModeUIState`
   object computed then rendered declaratively. The implementation computes and
   renders practice summary via `computePracticeSummaryForMode()` but doesn't
   materialize a full ModeUIState object. The separation is still clean — pure
   computation happens in `mode-ui-state.ts`, DOM assignment in
   `mode-controller.ts`.

3. **`computeScopeState()` not extracted.** Scope state loading (from
   localStorage + defaults) is done inline in mode-controller's `wireScope`
   function rather than in a standalone pure function.

4. **Semitone Math uses `prompt.kind: 'custom'` not `'text'`.** The plan example
   showed Semitone Math using `{ kind: 'text', getText(q) {...} }`. The actual
   implementation uses `{ kind: 'custom' }` because the mode needs to relabel
   answer buttons (sharps vs flats) per-question. This couldn't be done with a
   text-only prompt.

5. **`getRecommendationContext` added to ModeDefinition.** Not in the original
   plan. Fretboard mode needs to provide extra recommendation text ("naturals
   first" / "add sharps & flats") and a noteFilter override for the "Use
   suggestion" button. This optional method was added to keep that
   fretboard-specific logic in the mode definition rather than hardcoding it in
   the shared controller.

6. **`container` added to QuizAreaEls.** Needed for `refreshNoteButtonLabels`
   and per-question button relabeling.

### What Phase 5 Should Focus On

**Stress-test the abstractions with manual testing.** The 3 modes compile and
pass tests, but thorough manual testing is needed:

- Fretboard: SVG highlight, green/red feedback, hover card on progress tab,
  heatmap colors, string toggles, note filter, recommendation "Use suggestion"
  applying string + noteFilter
- Semitone Math: Button label flipping (sharps for +, flats for −), group
  toggles dynamic creation, recommendation flow, grid stats
- Note Semitones: Bidirectional button group switching (notes vs numbers),
  digit-buffering keyboard handler, table stats

**Watch for these known risk areas:**

- **Bidirectional button switching**: mode-controller toggles
  `.answer-buttons-{groupId}` CSS classes. Verify the build-template HTML
  actually uses these class names, or adjust.
- **Dynamic group toggle generation**: `wireScope` for `kind: 'groups'` creates
  toggle buttons from `spec.groups`. Verify the generated HTML matches the CSS
  expectations (`.group-toggle-btn`, `.active` class).
- **Scope persistence**: Groups scope saves to localStorage via
  `spec.storageKey`. Verify load/save round-trips correctly.
- **Stats rendering**: `mode-controller.ts` dispatches to `renderStatsTable`,
  `renderStatsGrid`, or the custom render callback. Verify all 3 paths produce
  correct output.
- **Hover card**: `setupHoverCard` was enhanced with string-fret detail and
  automaticity color bar. Verify it renders correctly on fretboard progress tab.

### What Phase 6 Should Do

Re-enable disabled modes one at a time. For each:

1. Read the old `src/quiz-*.ts` file to understand its question/answer logic
2. Create `src/modes/<mode>.ts` with a ModeDefinition factory
3. Import and register in `app.ts` via `createModeController(xxxDefinition())`
4. Run `deno task ok` to verify
5. Manual-test the mode

**Easy wins (structurally identical to existing modes):**

- **Ukulele**: `fretboardDefinition(UKULELE)` — literally a one-line change,
  just needs UKULELE instrument data
- **Interval Math**: Nearly identical to Semitone Math (same groups pattern,
  same button response, same grid stats)
- **Interval Semitones**: Nearly identical to Note Semitones (same bidirectional
  pattern, same table stats)

**Medium complexity (group scope + bidirectional or custom):**

- **Key Signatures**: Bidirectional, group scope
- **Scale Degrees**: Bidirectional, group scope
- **Diatonic Chords**: Bidirectional, group scope

**May need ResponseSpec changes:**

- **Speed Tap**: Spatial response (no standard buttons). May need the
  `kind: 'spatial'` ResponseSpec variant to be implemented in mode-controller.ts
  (currently only `buttons` and `bidirectional` are handled).
- **Chord Spelling**: Sequential multi-entry. May need the
  `kind:
  'sequential'` ResponseSpec variant to be implemented.

### What Phase 7 Should Do

1. Delete old files that are fully replaced:
   - `src/quiz-fretboard.ts` (750 lines)
   - `src/quiz-note-semitones.ts` (322 lines)
   - `src/quiz-semitone-math.ts` (465 lines)
   - Plus any other `src/quiz-*.ts` files migrated in Phase 6
2. Update `CLAUDE.md` architecture section to reflect `src/modes/` pattern
3. Update `guides/architecture.md` with new module dependency graph
4. Update `guides/coding-style.md` with ModeDefinition conventions
5. Bump version, full `deno task ok` pass
