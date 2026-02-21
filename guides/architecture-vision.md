# Architecture Vision

Target architecture for Music Reps. Describes where we're heading — the current
codebase is partway there, with a migration path outlined at the end.

For what the product does and who it's for, see [vision.md](vision.md). For how
the code works today, see [architecture.md](architecture.md).

## What we're building

A set of practice topics (modes) the user works through — fretboard notes,
interval math, chord structure, etc. Each topic has items to learn (e.g. "m6 ↔ 8
semitones"). The system tracks what the user knows, how well, and guides them on
what to practice next.

**Design goals for the architecture:**

- **Lego-like composition.** Assemble new topics from existing components. e.g.
  if we want to add staff-reading as a response type for fretboard mode, wire in
  a `<StaffNoteInput>` component — nothing else changes.
- **Work on components independently.** Iterate on a fretboard, a stats table,
  or a settings toggle in isolation. Mock the data, see the result.
- **Pure logic, separate from UI.** All question generation, answer checking,
  item filtering — pure functions, fully testable with no DOM.
- **Clean seams for future evolution.** Today the learner model is per-mode. The
  interfaces should allow unifying it across modes later (cross-topic inference)
  without rewriting mode code.

## Layers

```
┌─────────────────────────────────────────────────────┐
│  App Shell                                          │
│  Router, home screen, mode registry                 │
├─────────────────────────────────────────────────────┤
│  Mode Components  (one per topic, ~30-50 lines)     │
│  Compose shared UI + services with mode logic       │
├──────────────┬──────────────────────────────────────┤
│  Shared UI   │  Shared Services                     │
│  Components  │                                      │
│              │  useQuizEngine(logic, learner)        │
│  ModeScreen  │  useLearnerModel(namespace)          │
│  TabbedIdle  │  useScopeState(default)              │
│  QuizSession │                                      │
│  TextPrompt  │                                      │
│  NoteButtons │                                      │
│  GroupToggles│                                      │
│  StatsGrid   │                                      │
│  etc.        │                                      │
├──────────────┴──────────────────────────────────────┤
│  Mode Logic  (pure, per topic)                      │
│  Items, questions, answers, scope filtering          │
│  No DOM, no components — just data + functions      │
├─────────────────────────────────────────────────────┤
│  Learner Model                                      │
│  AdaptiveSelector, forgetting curves,               │
│  recommendations                                    │
├─────────────────────────────────────────────────────┤
│  Music Domain                                       │
│  Notes, intervals, keys, chords, instruments        │
├─────────────────────────────────────────────────────┤
│  Storage                                            │
│  Persistence of learner state (localStorage today)  │
└─────────────────────────────────────────────────────┘
```

**Dependency rule:** each layer imports only from layers below it. Mode
Components import Shared UI, Shared Services, and Mode Logic. Shared UI and
Shared Services import Learner Model and Music Domain. Nothing in Mode Logic or
below knows about the DOM.

### App Shell

Navigation between modes, home screen showing status across topics, mode
registry. Thin — mostly routing and layout.

### Mode Components

The heart of the app's extensibility. Each mode is a Preact component that
composes shared pieces with mode-specific logic. A mode component:

- Creates its mode logic (pure)
- Gets a learner model instance for its namespace
- Creates a quiz engine wired to its logic + learner model
- Composes shared UI components, passing them the data they need

A mode component is short — 30-50 lines of composition, no business logic, no
direct DOM manipulation. Adding a new mode means writing its logic and composing
existing components. If a mode needs a new response type (e.g. staff-note
input), build that component once and use it wherever.

### Shared UI Components

Reusable building blocks, each independently renderable with mock data. Two
categories:

**Layout / structure:**

- `ModeScreen` — top-level mode wrapper, handles phase visibility
- `TabbedIdle` — practice / progress tabs
- `QuizSession` — quiz header (timer, count, close) + content area

**UI pieces:**

- `ProgressSummary` — overall status ("12 of 78 items fluent")
- `Recommendation` — suggestion text + "Use suggestion" button
- `GroupToggles` — group selection (distance groups, key groups, etc.)
- `StringToggles` — fretboard string selection
- `NoteFilter` — natural / sharps & flats / all
- `StartButton` — with item count + session summary
- `NoteButtons` — piano-layout answer buttons
- `NumberButtons` — 0-11 number answer buttons
- `TextPrompt` — text question display
- `FretboardPrompt` — SVG fretboard with highlighted position
- `StatsGrid` — note × column heatmap
- `StatsTable` — forward/reverse two-column table
- `FretboardHeatmap` — SVG heatmap overlay for fretboard

No component knows about specific modes. They take data via props.

### Shared Services

Hooks / context that manage stateful shared concerns:

- **`useQuizEngine(logic, learner)`** — timer, round lifecycle, item selection,
  answer recording, calibration, feedback state. Exposes reactive state (phase,
  currentQuestion, feedback, roundStats, timeRemaining) and actions (start,
  stop, submitAnswer, nextQuestion). Does not render anything.
- **`useLearnerModel(namespace)`** — wraps AdaptiveSelector creation + storage.
  Returns the selector instance for the given mode namespace.
- **`useScopeState(default)`** — scope selection with localStorage persistence.

### Mode Logic

Pure functions and data, one set per mode. No DOM, no components, no imports
from UI layers. Provides what the mode component and engine need:

```typescript
// Common vocabulary (not a required interface — each mode provides what
// it needs, and the mode component knows what to ask for):
{
  namespace: string;
  allItemIds: string[];
  getQuestion(itemId: string): TQuestion;
  checkAnswer(itemId: string, input: string): CheckAnswerResult;
  getEnabledItems(scope): string[];
}

// Some modes also provide:
itemGroups?: GroupDef[];            // for group-based modes
getPromptText?(question): string;  // for text-prompt modes
gridSpec?: { ... };                 // for grid-stats modes
instrument?: Instrument;           // for fretboard modes
```

There is no single `ModeLogic` interface that all modes must conform to. Guitar
logic has instrument data and string-based filtering. Semitone math logic has
distance groups. They're different shapes — the mode component knows what it's
working with.

**The engine's contract is minimal.** The quiz engine needs only:

```typescript
type QuizLogic = {
  getEnabledItems(): string[];
  checkAnswer(itemId: string, input: string): CheckAnswerResult;
  getExpectedResponseCount?(itemId: string): number;
};
```

Everything else (how to display the question, how to collect the answer, what
stats to show) is handled by the component tree, not the engine.

### Learner Model

AdaptiveSelector — weighted random selection, EWMA tracking, forgetting curves,
recall estimation, automaticity scoring. Plus the consolidate-before- expanding
recommendation algorithm.

**Today:** one selector instance per mode, with a per-mode storage namespace.
Modes interact with the selector through a clean interface (getStats,
selectNext, recordResponse, getRecall, getAutomaticity, etc.).

**Seam for the future:** the AdaptiveSelector interface is already
mode-agnostic. A future unified learner model could implement the same interface
with cross-mode awareness behind it — e.g. inferring that someone who knows
interval math probably doesn't need to drill all semitone math combinations.
Mode code wouldn't change.

### Music Domain

Pure data and pure functions. Notes, intervals, major keys, chord types,
instrument configs, accidental naming rules. No state, no side effects.

### Storage

localStorage via StorageAdapter interface. Per-mode namespaces today. The
interface is already injected (for testability), so swapping in a different
backend (IndexedDB, server sync) or unifying across modes is straightforward.

## Example: two modes side by side

### Guitar Fretboard

```tsx
function GuitarFretboardMode() {
  const logic = useGuitarFretboardLogic();
  const learner = useLearnerModel(logic.namespace);
  const engine = useQuizEngine(logic, learner);
  const [scope, setScope] = useScopeState(logic.defaultScope);

  return (
    <ModeScreen name='Guitar Fretboard' phase={engine.phase}>
      <TabbedIdle>
        <PracticeTab>
          <ProgressSummary
            items={logic.getEnabledItems(scope)}
            learner={learner}
          />
          <Recommendation
            groups={logic.stringGroups}
            learner={learner}
          />
          <StringToggles
            instrument={GUITAR}
            value={scope.enabledStrings}
            onChange={(strings) =>
              setScope({ ...scope, enabledStrings: strings })}
          />
          <NoteFilter
            value={scope.noteFilter}
            onChange={(nf) => setScope({ ...scope, noteFilter: nf })}
          />
          <StartButton
            itemCount={logic.getEnabledItems(scope).length}
            onClick={() => engine.start()}
          />
        </PracticeTab>
        <ProgressTab>
          <FretboardHeatmap instrument={GUITAR} learner={learner} />
        </ProgressTab>
      </TabbedIdle>
      <QuizSession engine={engine}>
        <FretboardPrompt question={engine.currentQuestion} />
        <NoteButtons onAnswer={engine.submitAnswer} />
      </QuizSession>
    </ModeScreen>
  );
}
```

### Semitone Math

```tsx
function SemitoneMathMode() {
  const logic = useSemitoneMathLogic();
  const learner = useLearnerModel(logic.namespace);
  const engine = useQuizEngine(logic, learner);
  const [scope, setScope] = useScopeState(logic.defaultScope);

  return (
    <ModeScreen name='Semitone Math' phase={engine.phase}>
      <TabbedIdle>
        <PracticeTab>
          <ProgressSummary
            items={logic.getEnabledItems(scope)}
            learner={learner}
          />
          <Recommendation
            groups={logic.distanceGroups}
            learner={learner}
          />
          <GroupToggles
            groups={logic.distanceGroups}
            value={scope.enabledGroups}
            onChange={(g) => setScope({ ...scope, enabledGroups: g })}
          />
          <StartButton
            itemCount={logic.getEnabledItems(scope).length}
            onClick={() => engine.start()}
          />
        </PracticeTab>
        <ProgressTab>
          <StatsGrid
            cols={logic.colLabels}
            getItemId={logic.getGridItemId}
            learner={learner}
          />
        </ProgressTab>
      </TabbedIdle>
      <QuizSession engine={engine}>
        <TextPrompt text={logic.getPromptText(engine.currentQuestion)} />
        <NoteButtons onAnswer={engine.submitAnswer} />
      </QuizSession>
    </ModeScreen>
  );
}
```

**What's shared:** ModeScreen, TabbedIdle, PracticeTab, ProgressTab,
ProgressSummary, Recommendation, StartButton, QuizSession, NoteButtons.

**What's different:** scope controls (StringToggles + NoteFilter vs
GroupToggles), stats display (FretboardHeatmap vs StatsGrid), prompt
(FretboardPrompt vs TextPrompt).

Adding a new mode that uses text prompts, note buttons, and group toggles (like
Interval Math) is a copy of Semitone Math with different logic wired in.

## Principles

**Composition over configuration.** Modes compose shared components — they don't
describe themselves to a controller. No mega-interfaces, no discriminated unions
enumerating all possible scope/prompt/response/stats types. Just use the
component you need.

**Pure logic is a separate layer.** All question generation, answer checking,
item filtering, scope computation — pure functions. Testable with no DOM, no
component rendering. This is the most important testability guarantee.

**Shared components are independently renderable.** Any component can be
rendered with mock data for visual testing or development iteration. No mode
context required.

**The engine manages state, not rendering.** The quiz engine is a state machine
that exposes reactive state (phase, currentQuestion, feedback, etc.) and actions
(start, submitAnswer, etc.). Components read the state and render however they
want. The engine never calls into presentation code.

**Small interfaces at layer boundaries.** The engine needs `getEnabledItems` and
`checkAnswer`. Components take simple props. The learner model has a clean query
API. No layer has a 15-field interface to satisfy.

## Current state and migration

### Where we are (as of the mode-definition refactor)

The current architecture uses `ModeDefinition` (a declarative spec describing a
mode's items, questions, prompt type, response type, stats type, scope type)
interpreted by a shared `ModeController`. This replaced the earlier pattern of
duplicated lifecycle code in each `createXxxMode()` factory.

ModeDefinition/ModeController is a vanilla-JS approximation of component
composition. The discriminated unions (`ScopeSpec`, `PromptSpec`,
`ResponseSpec`, `StatsSpec`) are a poor man's component vocabulary — they
describe what to render, and the controller pattern-matches to render it. This
works, but it's rigid: adding a new prompt type or scope control means extending
a union and adding a case to the controller.

### Migration path

1. **Finish the current refactor** (phases 5-7 of mode-definition plan).
   Extracts mode logic from DOM code, which is valuable regardless of UI
   framework. The pure logic extracted in this phase becomes the Mode Logic
   layer directly.

2. **Introduce Preact.** Add Preact to the build. Start with leaf components
   (StatsGrid, NoteButtons, GroupToggles) — render them with Preact inside the
   existing DOM containers. No big-bang rewrite.

3. **Migrate mode by mode.** Replace one ModeDefinition + ModeController pair
   with a Preact mode component. The mode logic stays unchanged. Old and new
   modes can coexist during migration.

4. **Extract shared services.** Once multiple modes are Preact components,
   extract `useQuizEngine`, `useLearnerModel`, `useScopeState` as proper hooks.
   The quiz engine's core logic (state machine in `quiz-engine-state.ts`) is
   already pure — wrapping it in a hook is straightforward.

5. **Remove ModeController.** When all modes are migrated, the shared controller
   and its discriminated-union machinery can be deleted. Each mode component
   owns its own composition.

## Future directions (not designed in detail)

- **Unified learner model.** Cross-mode inference — if you know interval math,
  infer semitone math knowledge. Requires a shared item/skill graph above the
  per-mode level. The AdaptiveSelector interface is the seam.
- **Multiple representations per skill.** Same underlying skill surfaced as note
  name, staff position, fretboard tap, interval from reference, etc. The
  component model makes this natural — swap `<NoteButtons>` for
  `<StaffNoteInput>` in the component tree.
- **Goal-based paths.** "I want to improvise in folk guitar" → the system
  selects and sequences relevant topics. Requires curriculum layer above
  individual modes.
- **User-created or AI-generated content.** Structured mode definitions that
  plug into the component/logic framework. The separation of pure logic from UI
  makes this feasible.
