# Coding Style

Conventions extracted from the existing codebase. Follow these for consistency.
The review checklist (`.claude/commands/review-checklist.md`) verifies these
rules — this guide explains them.

## File Naming

| Pattern                             | Example                        | When                                  |
| ----------------------------------- | ------------------------------ | ------------------------------------- |
| `src/ui/modes/{mode}-mode.tsx`      | `semitone-math-mode.tsx`       | Preact mode component                 |
| `src/ui/{component}.tsx`            | `buttons.tsx`, `stats.tsx`     | Shared Preact UI components           |
| `src/hooks/use-{hook}.ts`          | `use-quiz-engine.ts`           | Preact hooks                          |
| `src/{module}-state.ts`             | `quiz-engine-state.ts`         | Pure state/logic (no DOM)             |
| `src/{module}.ts`                   | `adaptive.ts`, `navigation.ts` | Shared modules                       |
| `src/{module}_test.ts`              | `adaptive_test.ts`             | Test file (underscore, TypeScript)    |
| `plans/YYYY-MM-DD-{description}.md` | `2026-02-10-add-quiz-stats.md` | Plans                                |

## Module Patterns

All source files are standard ES modules (`.ts` and `.tsx`) with
`import`/`export` statements. esbuild bundles them with automatic JSX transform
into a single IIFE at build time. Tests import the same modules directly via
`node:test`.

- Use `export` on any function or constant that other files need
- Use `import { ... } from './module.ts'` for dependencies
- Entry point is `src/app.ts` — it imports all Preact mode components and
  registers them with navigation
- `.tsx` files use Preact JSX (automatic transform via `jsxImportSource`)
- Pure logic stays in `.ts` files; `.tsx` is only for files that return JSX

## Naming Conventions

| Category           | Convention                       | Examples                                                             |
| ------------------ | -------------------------------- | -------------------------------------------------------------------- |
| Mode components    | `XxxMode`                        | `SemitoneMathMode`, `FretboardMode`, `SpeedTapMode`                  |
| UI components      | `PascalCase`                     | `NoteButtons`, `GroupToggles`, `StatsTable`, `ModeScreen`            |
| Hooks              | `useXxx`                         | `useQuizEngine`, `useScopeState`, `useLearnerModel`                  |
| Factory functions  | `createXxx()`                    | `createFretboardHelpers()`, `createNavigation()`                     |
| State transitions  | `engineXxx()` / `fretboardXxx()` | `engineStart()`, `engineStop()`, `engineNextQuestion()`              |
| Constants          | `UPPER_SNAKE_CASE`               | `NOTES`, `INTERVALS`, `ALL_ITEMS`, `KEY_GROUPS`                      |
| Config objects     | `UPPER_SNAKE_CASE`               | `DEFAULT_CONFIG`, `SPEED_TAP_BASE_CONFIG`                            |
| Local state        | `camelCase`                      | `enabledGroups`, `currentItem`, `recommendedGroups`                  |
| localStorage keys  | `namespace_keyName`              | `semitoneMath_enabledGroups`, `motorBaseline_button`                 |
| Mode IDs           | `camelCase`                      | `fretboard`, `semitoneMath`, `keySignatures`                         |

## Dead Code

Remove dead code immediately — don't comment it out, don't leave unused
parameters "for compatibility", don't keep functions "in case we need them
later". Dead code misleads readers into thinking it matters, and git history
preserves anything you might need to recover.

**What counts as dead code:**

- Unused function parameters (remove from signature and all callsites)
- Unreachable branches or conditions
- Commented-out code blocks
- Functions/variables with no remaining callers
- Imports that nothing uses

**Not dead code:**

- Optional interface methods that callers check for (`mode.onStart?.()`)
- Parameters required by a callback contract even if one implementation ignores
  them (e.g., event handler `(e)` where `e` isn't used)

## DOM Interaction Rules

1. **Preact owns the DOM.** Mode components render via JSX. Avoid direct DOM
   manipulation except for imperative escape hatches (fretboard SVG
   highlighting, hover cards) — use `useEffect` with refs for those.

2. **Use `dangerouslySetInnerHTML` sparingly.** Only for build-time generated
   HTML (fretboard SVG, stats legends). Add `// deno-lint-ignore react-no-danger`
   comment.

3. **Use data attributes for button identity** — `data-note="C"`,
   `data-mode="fretboard"`, `data-group="0"`. Not positional logic.

4. **Phase classes via `useEffect`.** Phase transitions (`phase-idle`,
   `phase-active`, `phase-round-complete`) are set imperatively on the
   container element via `useEffect` keyed on engine phase.

5. **Toggle CSS classes for state** — `.active`, `.recommended`, `.correct`,
   `.incorrect`. Compute class strings from props/state in JSX.

## State Management

- **Immutable transitions**: pure state functions in `*-state.ts` files return
  new objects via `{ ...state, field: newValue }`. Never mutate state in place.
- **Preact hooks for reactivity**: mode-local state lives in `useState`,
  `useRef`, and `useMemo` calls within mode components and shared hooks.
  `useQuizEngine` wraps engine state transitions; `useScopeState` wraps
  scope persistence; `useLearnerModel` wraps the adaptive selector.
- **localStorage for persistence**: loaded by hooks on mount, saved on change.
  Always namespace keys to the mode.

## Error Handling

- `try/catch` around `JSON.parse` of localStorage (user data may be corrupted).
  Fall back to defaults silently.
- No `throw` — the app should degrade gracefully, not crash.

## Comments

- **File headers**: purpose and key constraints. See `quiz-engine-state.ts` for
  the gold standard:
  ```
  // Pure state transitions for the quiz engine.
  // No DOM, no timers, no side effects — just data in, data out.
  ```
- **JSDoc** on exported functions — prose explaining _why_ or edge cases. Omit
  `@param`/`@returns` tags that merely restate the TypeScript types.
- **Inline comments** only for non-obvious logic (math formulas, threshold
  derivations, enharmonic edge cases). Self-documenting code is preferred.

## TypeScript Conventions

1. **Keep it simple.** No conditional types, mapped types, template literal
   types, or `infer`. If the type system needs something elaborate, rearchitect
   the code so the type is obvious.

2. **Parameter types required.** Every function parameter gets an explicit type.
   Return types inferred unless the function is exported and the inference is
   unclear.

3. **No `any`.** DOM `querySelector` results get `as HTMLElement`. Parsed JSON
   from localStorage gets `as T`. Nothing else uses `any`. Use `unknown` +
   narrowing if the shape is genuinely uncertain.

4. **Interfaces for shared shapes, inline for local ones.** Shared types live in
   `src/types.ts`. A type used in only one file stays inline.

5. **Non-null assertions (`!`) for build-time DOM.** Elements generated by
   `html-helpers.ts` or the build template are known to exist. Use `!` after
   `getElementById` for those. Inside Preact components, use `useRef<T>(null)`
   and check `ref.current` before use.

6. **`querySelectorAll<T>` for typed iteration.** Prefer
   `querySelectorAll<HTMLButtonElement>('.btn')` over casting inside callbacks.

7. **Union types for string enums.** `type Phase = 'idle' | 'active' | ...`
   rather than runtime `enum`.

8. **Replace `@param`/`@returns` JSDoc with types.** Keep prose JSDoc that
   explains _why_ or _edge cases_. Delete JSDoc that only restates types.

9. **Minimal interfaces at boundaries.** When a function only needs one method
   from a large interface, accept a minimal interface
   (`{ getStats(id: string): ItemStats | null }`) rather than the full type.
   This keeps tests simple and decouples modules.

## Testing Patterns

- Import directly from ES module source files
- Inject dependencies: `Map` for storage, imported music data, seeded RNG
- Test pure logic in `*-state.ts` files — data in, data out
- Render-to-string tests for Preact components: render with fixture data,
  assert on HTML structure and content via `preact-render-to-string`
- Each test creates its own selector/helpers (no shared mutable state)
- Edge cases: empty arrays, null/undefined, boundary values, single-element

## CSS Conventions

- **BEM-lite naming**: `.quiz-controls`, `.string-toggle`, `.stats-toggle-btn`
- **Functional classes**: `.active`, `.recommended`, `.correct`, `.incorrect`
- **Mobile-first responsive**: base styles for mobile, media queries for larger
- **HSL for computed colors**: heatmap colors use `hsl()` for smooth gradients
- **No inline styles** — use CSS classes. Visibility controlled by conditional
  rendering (`{show && <Component />}`) or CSS class toggling in JSX
