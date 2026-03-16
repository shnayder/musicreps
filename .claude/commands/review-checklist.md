# Music Reps — Review Checklist

Structured by change type. Run the **Core** section for every change, then add
the relevant specialized sections based on what the diff touches. Skip sections
that don't apply — no need to mark N/A on irrelevant items.

---

## Core (every change)

### Build & tests

- [ ] `deno task ok` passes — lint, format, type-check, tests, build
- [ ] Version displays correctly in built output (derived from git at build
      time)

### Code quality

<!-- Full explanation: guides/coding-style.md -->

- [ ] No DOM manipulation in pure modules (`adaptive.ts`, `music-data.ts`,
      `recommendations.ts`, `*-state.ts`, `stats-display.ts`)
- [ ] localStorage access wrapped in try/catch with silent fallback defaults
- [ ] Configuration-driven: magic numbers extracted to `DEFAULT_CONFIG` or
      derived via helper functions
- [ ] Comments present on complex math (spaced repetition formulas, weight
      computations, threshold derivations)
- [ ] No security issues: no `innerHTML` with user input, no `eval`
- [ ] No unused code left behind (no `_unusedVar` renames, no `// removed`
      comments — just delete it)
- [ ] No over-engineering: minimal changes for the task, no speculative
      abstractions or unused configurability

### Documentation

<!-- Full explanation: guides/feature-process.md -->

- [ ] Implementation plan exists in `plans/exec-plans/` for non-trivial changes
- [ ] Plan updated after completion if implementation deviated
- [ ] CLAUDE.md updated if architecture, modes, or conventions changed
- [ ] If new tech debt introduced: added to
      `plans/exec-plans/tech-debt-tracker.md`
- [ ] If existing tech debt fixed: moved to "Fixed" section in tracker

---

## Visual design

_Run when the diff touches CSS or UI components (`.tsx` files in `src/ui/`)._

<!-- Full explanation: guides/design/visual-design.md, guides/design/layout-and-ia.md -->

### Design system compliance

- [ ] No new hardcoded colors — all via `var(--color-*)` or `var(--heatmap-*)`
- [ ] No new font-size values — use type scale tokens (`--text-xs` through
      `--text-2xl`) or justify exception
- [ ] No new spacing values — use spacing scale tokens (`--space-1` through
      `--space-6`) or justify exception
- [ ] No new hardcoded shadows — use `--shadow-sm/md/lg/hover`
- [ ] No new hardcoded font-weights — use `--font-normal/medium/semibold/bold`
- [ ] No new hardcoded opacities for semantic states — use
      `--opacity-disabled/dimmed/pressed/subtle`
- [ ] No new hardcoded transition durations — use
      `--duration-fast/base/slow/linear`

### Structural components

- [ ] Text elements with standard roles use `<Text>` or `.text-*` classes — no
      ad-hoc font-size/weight/color for section-header, subsection-header,
      label, secondary, caption, or metric roles
- [ ] Primary/secondary flow actions use `<ActionButton>` — not manual class
      composition on raw `<button>` elements
- [ ] Elevation matches prominence: popovers use `--shadow-lg`, cards use
      `--shadow-md`, flat surfaces have no shadow

### Interaction & accessibility

- [ ] All new interactive elements have `:focus-visible` and `:hover` styles
- [ ] All new buttons have `:active` pressed state
- [ ] Touch targets >= `var(--size-touch-target)` (44px)
- [ ] Brand color (`--color-brand`) only for CTAs/identity, never for feedback
- [ ] Heatmap uses `--heatmap-*` scale, not hardcoded HSL

### Layout & IA

<!-- Full explanation: guides/design/layout-and-ia.md -->

- [ ] Each screen state (idle, quizzing, calibrating) has a distinct layout —
      not just toggled visibility of a universal element list
- [ ] Top-to-bottom content order matches interaction priority for each state
      (during quiz: question → countdown → answers → feedback; during idle:
      stats → config → actions)
- [ ] Related controls are visually grouped with labels or headings
- [ ] All toggles, progress indicators, and data displays have text labels
- [ ] Elements that cycle between visible/hidden use `visibility: hidden` — not
      conditional render — inside flex-centered containers, to avoid layout
      shift
- [ ] No redundant affordances for the same action
- [ ] Quiz-configuration settings hidden during active quiz
- [ ] Visual containers (cards, sections) align with logical groupings
- [ ] Stats heatmaps/grids have axis labels on both dimensions
- [ ] Stats displays include an aggregate summary above detailed heatmaps
- [ ] Stats data scopes to the user's current configuration

---

## Architecture

_Run when the diff adds new modules, changes patterns, or modifies the build._

<!-- Full explanation: guides/architecture.md -->

- [ ] esbuild resolves the module graph from `src/app.ts` — new source files
      just need proper `import`/`export` statements
- [ ] Pure functions separated from DOM — logic in `*-state.ts`, DOM interaction
      in the main module
- [ ] Factory pattern used for dependency injection where needed
- [ ] State transitions are immutable: `{ ...state, field: newValue }`
- [ ] Quiz mode interface respected: `getEnabledItems()`, `checkAnswer()`,
      `handleKey()`, plus lifecycle hooks
- [ ] New behavior integrates with existing abstractions (state machine phases,
      declarative render) rather than introducing parallel mechanisms

---

## Algorithm

_Run when the diff touches adaptive selection, recommendation, timing, or
forgetting model code._

<!-- Full explanation: guides/architecture.md § Algorithms -->

### Adaptive learning

- [ ] Timing config changes preserve ratio-to-baseline scaling via
      `deriveScaledConfig(baseline)`
- [ ] Storage keys namespaced per mode
- [ ] EWMA update logic unchanged or correctly extended
- [ ] Forgetting model math preserved: `P(recall) = 2^(-t / stability)`,
      stability growth/decay factors, floor at `initialStability`
- [ ] Self-correction logic intact: fast answer after long gap boosts stability
      to at least `elapsedHours * 1.5`
- [ ] `unseenBoost` weighting: unseen items get fixed boost, no extra low-sample
      multiplier

### Recommendation pipeline (v4)

- [ ] Per-level status classification (P10 speed/freshness) drives prioritized
      recs (review → practice → expand → automate)
- [ ] Expansion gate: all started levels ≥ Learned and none need review
- [ ] Distance group progression: groups unlock sequentially by semitone count
- [ ] `getStringRecommendations` returns correct shape

---

## Quiz mode

_Run when adding or modifying a quiz mode._

- [ ] Item ID format matches the documented pattern (see CLAUDE.md "Quiz Modes"
      table)
- [ ] Bidirectional modes track each direction as a separate item
      (`:fwd`/`:rev`)
- [ ] Keyboard shortcuts do not conflict with existing bindings
- [ ] localStorage keys namespaced to the mode
- [ ] `handleKey()` returns `true` if key was handled, `false` otherwise
- [ ] Keyboard state reset in `onStart()`, `onStop()`, `onDeactivate()`
- [ ] Calibration matches mode interaction
- [ ] New quiz mode documented in CLAUDE.md "Quiz Modes" table
- [ ] Every new module with pure logic has a corresponding `_test.ts` file
- [ ] Tests use Node test runner (`node:test`) and `node:assert/strict`
- [ ] Dependencies injected in tests: storage (Map), RNG (seeded/fixed), dates
- [ ] Edge cases covered: empty arrays, null/undefined, boundary values
