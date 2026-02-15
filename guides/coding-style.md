# Coding Style

Conventions extracted from the existing codebase. Follow these for consistency.
The review checklist (`.claude/commands/review-checklist.md`) verifies these
rules — this guide explains them.

## File Naming

| Pattern | Example | When |
|---------|---------|------|
| `src/quiz-{mode}.js` | `quiz-fretboard.js` | Quiz mode implementation |
| `src/{module}-state.js` | `quiz-engine-state.js` | Pure state/logic (no DOM) |
| `src/{module}.js` | `adaptive.js`, `navigation.js` | Shared modules |
| `src/{module}_test.ts` | `adaptive_test.ts` | Test file (underscore, TypeScript) |
| `plans/YYYY-MM-DD-{description}.md` | `2026-02-10-add-quiz-stats.md` | Plans |

## Module Patterns

### ES module files (built with `readModule`)

Files that need to be **both** imported by tests **and** used in the browser.
Use `export` on functions and constants; `readModule()` strips `export` at
build time so they become globals in the concatenated script.

Current ES module files:
`adaptive.js`, `music-data.js`, `quiz-engine-state.js`, `quiz-engine.js`,
`quiz-fretboard-state.js`, `stats-display.js`, `recommendations.js`

### Plain script files (built with `read`)

Files that only run in browser context. Use function declarations or IIFEs.
No `export` keywords.

Current plain files: all `quiz-*.js` mode files (except state modules),
`navigation.js`, `app.js`

### Choosing between them

New file has pure logic that tests need to import? → ES module with `export`.
New file is browser-only glue (DOM, event wiring)? → Plain script.

## Naming Conventions

| Category | Convention | Examples |
|----------|-----------|----------|
| Factory functions | `createXxx()` | `createQuizEngine()`, `createFretboardHelpers()`, `createNavigation()` |
| State transitions | `engineXxx()` / `fretboardXxx()` | `engineStart()`, `engineStop()`, `engineNextQuestion()` |
| Constants | `UPPER_SNAKE_CASE` | `NOTES`, `INTERVALS`, `ALL_ITEMS`, `KEY_GROUPS` |
| Config objects | `UPPER_SNAKE_CASE` | `DEFAULT_CONFIG`, `SPEED_TAP_BASE_CONFIG` |
| Local state | `camelCase` | `enabledGroups`, `currentItem`, `recommendedGroups` |
| localStorage keys | `namespace_keyName` | `semitoneMath_enabledGroups`, `motorBaseline_button` |
| Mode IDs | `camelCase` | `fretboard`, `semitoneMath`, `keySignatures` |

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

1. **Cache DOM queries in `init()`** — store in closure variables or an `els`
   object. Never query the DOM in hot paths (presentQuestion, checkAnswer).

2. **Prefer declarative `render(state)`** over imperative DOM manipulation.
   State changes should flow through: mutate state → call render() → DOM
   updates. This eliminates ordering bugs and stale UI.

3. **Use data attributes for button identity** — `data-note="C"`,
   `data-mode="fretboard"`, `data-group="0"`. Not positional logic.

4. **Container-scoped queries** — `container.querySelector('.feedback')`, not
   `document.querySelector('.feedback')`. Each mode operates within its own
   `.mode-screen` container.

5. **Toggle CSS classes for state** — `.active`, `.recommended`, `.correct`,
   `.incorrect`, `.calibrating`. Use `classList.toggle()` or `classList.add/remove()`.

## State Management

- **Immutable transitions**: state functions return new objects via
  `{ ...state, field: newValue }`. Never mutate state in place.
- **Closure variables** for mode-local state (`currentItem`, `enabledStrings`).
  These live inside `createXxxMode()` closures.
- **localStorage for persistence**: loaded in `init()`, saved on change. Always
  namespace keys to the mode.

## Error Handling

- `try/catch` around `JSON.parse` of localStorage (user data may be corrupted).
  Fall back to defaults silently.
- Defensive null checks on DOM elements: `if (els.foo) els.foo.textContent = ...`
- No `throw` — the app should degrade gracefully, not crash.

## Comments

- **File headers**: purpose, dependencies, build treatment. See
  `quiz-engine-state.js` for the gold standard:
  ```
  // Pure state transitions for the quiz engine.
  // No DOM, no timers, no side effects — just data in, data out.
  // ES module — exports stripped for browser inlining.
  ```
- **JSDoc** on exported functions with `@param` and `@returns`.
- **Inline comments** only for non-obvious logic (math formulas, threshold
  derivations, enharmonic edge cases). Self-documenting code is preferred.

## Testing Patterns

- Import directly from ES module source files
- Inject dependencies: `Map` for storage, imported music data, seeded RNG
- Test pure logic only — render functions tested visually
- Each test creates its own selector/helpers (no shared mutable state)
- Edge cases: empty arrays, null/undefined, boundary values, single-element

## CSS Conventions

- **BEM-lite naming**: `.quiz-controls`, `.string-toggle`, `.stats-toggle-btn`
- **Functional classes**: `.active`, `.recommended`, `.correct`, `.incorrect`
- **Mobile-first responsive**: base styles for mobile, media queries for larger
- **HSL for computed colors**: heatmap colors use `hsl()` for smooth gradients
- **No inline styles** except `display` toggling in render functions
