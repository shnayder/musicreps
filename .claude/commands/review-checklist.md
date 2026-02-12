# Fretboard Trainer — Review Checklist

Use this checklist when reviewing changes. Evaluate every item as Pass, Fail,
or N/A. Do not skip items — mark N/A explicitly if a category does not apply.

---

## Build system consistency
<!-- Full explanation: guides/architecture.md § Build System -->

- [ ] New source files registered in **both** `main.ts` and `build.ts`
- [ ] Files with `export` keywords read via `readModule()` (strips exports);
      files without `export` read via `readFile()` / `read()`
- [ ] Concatenation order correct: modules that export come before modules that
      consume them (e.g., `music-data.js` before quiz modes)
- [ ] Version number in `<div class="version">` bumped in both `main.ts` and
      `build.ts`
- [ ] If HTML template changed: updated in **both** build files

## Architecture patterns
<!-- Full explanation: guides/architecture.md § Key Patterns -->

- [ ] Pure functions separated from DOM — logic in `*-state.js`, DOM interaction
      in the main module (e.g., `quiz-engine-state.js` vs `quiz-engine.js`)
- [ ] Factory pattern used for dependency injection where needed
      (`createXHelpers({ notes, intervals, ... })`)
- [ ] State transitions are immutable: `{ ...state, field: newValue }`, not
      `state.field = newValue`
- [ ] Quiz mode interface respected: `getEnabledItems()`, `presentQuestion()`,
      `checkAnswer()`, `handleKey()`, plus `onStart`/`onStop`/`onActivate`/`onDeactivate` hooks
- [ ] New behavior integrates with existing abstractions (state machine phases,
      declarative `render()`) rather than introducing parallel mechanisms
      (shadow booleans, imperative DOM overrides)
- [ ] No over-engineering: minimal changes for the task, no speculative
      abstractions or unused configurability

## Adaptive learning system
<!-- Full explanation: guides/architecture.md § Algorithms -->

- [ ] Timing config changes preserve ratio-to-baseline scaling via
      `deriveScaledConfig(baseline)` in `adaptive.js`
- [ ] Storage keys namespaced per mode (`motorBaseline_{namespace}`,
      `{namespace}_enabledGroups`, etc.)
- [ ] EWMA update logic unchanged or correctly extended (exponential weighted
      moving average of response times)
- [ ] Forgetting model math preserved: `P(recall) = 2^(-t / stability)`,
      stability growth/decay factors, floor at `initialStability`
- [ ] Self-correction logic intact: fast answer after long gap boosts stability
      to at least `elapsedHours * 1.5`
- [ ] `unseenBoost` weighting: unseen items get fixed boost, no extra
      low-sample multiplier (that was a bug — see commit history)

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
- [ ] Dependencies injected in tests: storage (Map), RNG (seeded/fixed),
      dates (injected timestamps) — no global state pollution
- [ ] Edge cases covered: empty arrays, null/undefined inputs, boundary values,
      single-element collections
- [ ] Tests actually run: `npx tsx --test src/*_test.ts` passes

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

## Code quality
<!-- Full explanation: guides/coding-style.md -->

- [ ] No DOM manipulation in pure modules (`adaptive.js`, `music-data.js`,
      `recommendations.js`, `*-state.js`, `stats-display.js`)
- [ ] localStorage access wrapped in try/catch with silent fallback defaults
- [ ] Configuration-driven: magic numbers extracted to `DEFAULT_CONFIG` or
      derived via helper functions
- [ ] Comments present on complex math (spaced repetition formulas, weight
      computations, threshold derivations)
- [ ] No security issues: no `innerHTML` with user input, no `eval`
- [ ] No unused code left behind (no `_unusedVar` renames, no `// removed`
      comments — just delete it)

## Documentation
<!-- Full explanation: guides/feature-process.md -->

- [ ] Implementation plan exists in `plans/exec-plans/` for non-trivial changes
- [ ] Plan updated after completion if implementation deviated
- [ ] CLAUDE.md updated if architecture, modes, or conventions changed
- [ ] New quiz mode: item ID format, item count, and answer type documented in
      CLAUDE.md "Quiz Modes" table
