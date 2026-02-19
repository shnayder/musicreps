# Phase 6 Handoff: Test File Type Annotations

**Date:** 2026-02-19 **Plan:**
`plans/exec-plans/active/2026-02-19-ts-type-annotations.md` **Current version:**
v6.15

## What's Done (Phases 0–5)

All production source files are fully type-annotated and pass `deno check`:

| Phase | Scope                                                                                                               | Status |
| ----- | ------------------------------------------------------------------------------------------------------------------- | ------ |
| 0     | Infrastructure (`deno.json` compilerOptions)                                                                        | Done   |
| 1     | Shared types (`src/types.ts` — 296 lines)                                                                           | Done   |
| 2     | Pure foundation (6 files: music-data, adaptive, quiz-engine-state, recommendations, deadline, quiz-fretboard-state) | Done   |
| 3     | Engine + stats (quiz-engine.ts, stats-display.ts)                                                                   | Done   |
| 4     | Quiz modes (all 10 mode files)                                                                                      | Done   |
| 5     | Navigation + app (navigation.ts, settings.ts, app.ts)                                                               | Done   |

**Commits on this branch:**

- `fc00020` — Phases 4–5 (quiz modes, navigation, settings, app)
- Phases 0–3 were merged to main via PRs #87 and earlier

**All 92 tests pass (448 steps). Lint and fmt are clean.**

## What Remains

### Phase 6: Test Files (~80 errors across 8 files)

Files to annotate:

| File                           | Lines | Key patterns                                                | Estimated effort |
| ------------------------------ | ----- | ----------------------------------------------------------- | ---------------- |
| `adaptive_test.ts`             | ~560  | Inline `ItemStats` objects, mock storage adapters           | Medium           |
| `deadline_test.ts`             | ~280  | `DeadlineConfig` partials, mock storage                     | Medium           |
| `music-data_test.ts`           | ~980  | Helper functions with untyped params, 2 existing `as any`   | Medium           |
| `recommendations_test.ts`      | ~200  | Mock selector objects, 2 existing `as any`                  | Small            |
| `stats-display_test.ts`        | ~200  | Mock selector/storage, 1 existing `as any`                  | Small            |
| `quiz-engine-state_test.ts`    | ~310  | `EngineState` spreads                                       | Small            |
| `quiz-engine_test.ts`          | ~330  | `makeBtn` helper, keyboard event mocks, 1 existing `as any` | Medium           |
| `quiz-fretboard-state_test.ts` | ~370  | Config objects for `createFretboardHelpers`                 | Small            |

**Common patterns across test files:**

1. **Inline test data objects** — Object literals for `ItemStats`,
   `EngineState`, config objects, etc. Should be typed with the interfaces from
   `src/types.ts`.
2. **Mock storage/selector objects** — Partial implementations of
   `StorageAdapter` and `AdaptiveSelector`. Use `as any` or create typed mocks.
3. **Keyboard event mocks** — `{ key: 'c', preventDefault() {} } as any` is the
   accepted pattern per the plan.
4. **Helper function params** — Functions like `makeBtn()`, `mockSelector()`,
   `letterArithmetic()` need parameter types.
5. **Callback params** — Arrow functions passed to factories need explicit
   parameter types.

**Plan guidance:** "`as any` acceptable for partial keyboard event mocks."

### Phase 7: CI Gate

After Phase 6:

- Add `deno check src/**/*.ts` to both CI workflows
- Must resolve the `npm:@types/node` issue first (see below)

## Known Issue: `npm:@types/node` Resolution

`deno check` currently exits with an error (exit code 1) even though all
individual files type-check successfully:

```
error: Could not find a matching package for 'npm:@types/node'
in the node_modules directory.
```

This happens because test files import `node:test` and `node:assert/strict`,
which triggers Deno's type checker to look for `@types/node`. Running
`deno install` fails in this environment due to npm registry SSL errors.

**Impact:** `deno check` reports success for each file individually (all 34
"Check" lines appear) but the overall command fails. Tests themselves run fine
with `--no-check` (which is what `deno task test` uses).

**Fix options for Phase 7:**

1. Add `@types/node` to `deno.json` imports or `nodeModulesDir: "auto"`
2. Exclude test files from `deno check` and check them separately
3. Add a `/// <reference types="..." />` directive in test files

## PR Strategy

Per the plan, Phases 5–7 were slated for a single PR (#4 in the series). The
current branch `claude/type-quiz-navigation-U4yvL` has Phase 4–5 work on top of
main. Options:

- **Continue on this branch:** Add Phase 6 commits, then Phase 7, then PR
- **New branch from main:** Merge this branch first, then start Phase 6 fresh

The Phase 4–5 commit (`fc00020`) needs to be PRed and merged to main before or
alongside Phase 6 work.

## Version

Current version is v6.15. Phase 6 should bump to v6.16 (one bump for all test
annotations). Phase 7 (CI gate) is config-only and may or may not warrant a
bump.
