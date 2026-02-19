# Music Reps — Review Checklist

Use this checklist when reviewing changes. Evaluate every item as Pass, Fail, or
N/A. Do not skip items — mark N/A explicitly if a category does not apply.

---

## Build system consistency

<!-- Full explanation: guides/architecture.md § Build System -->

- [ ] esbuild resolves the module graph from `src/app.ts` — new source files
      just need proper `import`/`export` statements
- [ ] Version number (`VERSION` in `src/build-template.ts`) bumped
- [ ] `deno task build` produces correct output

## Architecture patterns

<!-- Full explanation: guides/architecture.md § Key Patterns -->

- [ ] Pure functions separated from DOM — logic in `*-state.ts`, DOM interaction
      in the main module (e.g., `quiz-engine-state.ts` vs `quiz-engine.ts`)
- [ ] Factory pattern used for dependency injection where needed
      (`createXHelpers({ notes, intervals, ... })`)
- [ ] State transitions are immutable: `{ ...state, field: newValue }`, not
      `state.field = newValue`
- [ ] Quiz mode interface respected: `getEnabledItems()`, `presentQuestion()`,
      `checkAnswer()`, `handleKey()`, plus
      `onStart`/`onStop`/`onActivate`/`onDeactivate` hooks
- [ ] New behavior integrates with existing abstractions (state machine phases,
      declarative `render()`) rather than introducing parallel mechanisms
      (shadow booleans, imperative DOM overrides)
- [ ] No over-engineering: minimal changes for the task, no speculative
      abstractions or unused configurability

## Adaptive learning system

<!-- Full explanation: guides/architecture.md § Algorithms -->

- [ ] Timing config changes preserve ratio-to-baseline scaling via
      `deriveScaledConfig(baseline)` in `adaptive.ts`
- [ ] Storage keys namespaced per mode (`motorBaseline_{namespace}`,
      `{namespace}_enabledGroups`, etc.)
- [ ] EWMA update logic unchanged or correctly extended (exponential weighted
      moving average of response times)
- [ ] Forgetting model math preserved: `P(recall) = 2^(-t / stability)`,
      stability growth/decay factors, floor at `initialStability`
- [ ] Self-correction logic intact: fast answer after long gap boosts stability
      to at least `elapsedHours * 1.5`
- [ ] `unseenBoost` weighting: unseen items get fixed boost, no extra low-sample
      multiplier (that was a bug — see commit history)

## Recommendation algorithm

<!-- Full explanation: guides/architecture.md § Consolidate Before Expanding -->

- [ ] Consolidate-before-expanding pattern preserved: expansion to new
      strings/groups gated behind `consolidationRatio >= expansionThreshold`
- [ ] `expansionThreshold` default (0.7) not changed without justification
- [ ] Distance group progression: groups unlock sequentially by semitone count
      (group 0 = distances 1,2; group 1 = distances 3,4; etc.)
- [ ] `getStringRecommendations` / `getGroupRecommendations` return correct
      shape: `{ dueCount, unseenCount, masteredCount, totalCount }`

## Test coverage

<!-- Full explanation: guides/development.md § Testing, guides/coding-style.md § Testing Patterns -->

- [ ] Every new module with pure logic has a corresponding `_test.ts` file
- [ ] Tests use Node test runner (`node:test`) and `node:assert/strict`
- [ ] Dependencies injected in tests: storage (Map), RNG (seeded/fixed), dates
      (injected timestamps) — no global state pollution
- [ ] Edge cases covered: empty arrays, null/undefined inputs, boundary values,
      single-element collections
- [ ] Tests actually run: `deno task test` passes

## Quiz mode specifics

- [ ] Item ID format matches the documented pattern for the mode (see CLAUDE.md
      "Quiz Modes" table)
- [ ] Bidirectional modes (note↔semitone, key↔signature, etc.) track each
      direction as a separate item (`:fwd` / `:rev` suffix)
- [ ] Keyboard shortcuts do not conflict with existing bindings (C D E F G A B
      for notes, 0-9 for numbers, Space/Enter for next, Escape for stop)
- [ ] localStorage keys are namespaced to the mode to avoid collisions
- [ ] `handleKey()` returns `true` if key was handled, `false` otherwise
- [ ] Keyboard state reset in `onStart()`, `onStop()`, `onDeactivate()`
- [ ] Calibration matches mode interaction: modes with button-based answers
      define `getCalibrationTrialConfig()` (search prompt, no highlight); only
      speed tap uses the highlight fallback

## Code quality

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

## Layout & information architecture

<!-- Full explanation: guides/design/layout-and-ia.md -->

- [ ] Each screen state (idle, quizzing, calibrating) has a distinct layout —
      not just toggled visibility of a universal element list
- [ ] Top-to-bottom content order matches interaction priority for each state
      (during quiz: question → countdown → answers → feedback; during idle:
      stats → config → actions)
- [ ] Related controls are visually grouped (e.g., all "what to practice"
      settings together) with labels or headings
- [ ] All toggles, progress indicators, and data displays have text labels — no
      bare numbers or unlabeled button groups
- [ ] No redundant affordances for the same action (e.g., two different "stop
      quiz" controls)
- [ ] Quiz-configuration settings hidden during active quiz unless needed
      mid-quiz
- [ ] Visual containers (cards, sections) align with logical groupings — no
      partial containment splitting a logical group
- [ ] Stats heatmaps/grids have axis labels on both dimensions
- [ ] Stats legends are adjacent to their visualizations, not separated by
      unrelated elements
- [ ] Stats displays include an aggregate summary (e.g., "48 / 78 mastered")
      above detailed heatmaps
- [ ] Stats data scopes to the user's current configuration, or visually
      distinguishes enabled vs. disabled items

## Visual design consistency

<!-- Full explanation: guides/design/visual-design.md -->

- [ ] No new hard-coded colors — all via `var(--color-*)` or `var(--heatmap-*)`
- [ ] No new font-size values — use type scale tokens (`--text-xs` through
      `--text-2xl`) or justify exception
- [ ] No new spacing values — use spacing scale tokens (`--space-1` through
      `--space-6`) or justify exception
- [ ] All new interactive elements have `:focus-visible` and `:hover` styles
- [ ] All new buttons have `:active` pressed state
- [ ] Touch targets >= 44x44px
- [ ] Brand color (`--color-brand`) only for CTAs/identity, never for feedback
- [ ] Heatmap uses `--heatmap-*` scale, not hardcoded HSL

## Documentation & infrastructure

<!-- Full explanation: guides/feature-process.md, guides/development.md § Deployment -->

- [ ] Implementation plan exists in `plans/exec-plans/` for non-trivial changes
- [ ] Plan updated after completion if implementation deviated
- [ ] CLAUDE.md updated if architecture, modes, or conventions changed
- [ ] New quiz mode: item ID format, item count, and answer type documented in
      CLAUDE.md "Quiz Modes" table
- [ ] If build output changed (new files in `docs/`): `docs/` file list in
      `guides/development.md` § Deployment updated
- [ ] If new tech debt introduced: added to
      `plans/exec-plans/tech-debt-tracker.md`
- [ ] If existing tech debt fixed: moved to "Fixed" section in tracker
