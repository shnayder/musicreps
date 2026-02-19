# Migration to All-Deno, All-TypeScript

**Date:** 2026-02-19 **Status:** Proposed **Depends on:**
[Linting strategy review](2026-02-19-linting-strategy.md)

## Goal

Single runtime (Deno), single language (TypeScript), single config file
(`deno.json`). Drop the Node build path, `tsx`, and the `typescript` package.
End state: `deno task build`, `deno task test`, `deno lint`, `deno fmt`,
`deno check` — nothing else needed.

## Current State

- 21 `.js` source files, 5 `.ts` files (build scripts + HTML helpers)
- 8 `_test.ts` test files (already TypeScript, use `node:test`)
- Two build scripts: `main.ts` (Deno, 70 lines) and `build.ts` (Node, 730 lines)
- CI uses Node path (`npx tsx build.ts`)
- 64 cross-file imports, all using `.js` extensions
- No `deno.json`, no `tsconfig.json`, no linter, no formatter
- devDependencies: esbuild, playwright, tsx, typescript

## Phases

### Phase 1: `deno.json` + lint + format

**What:** Establish Deno tooling alongside the existing Node build path. Nothing
breaks; this is purely additive.

**Steps:**

1. Create `deno.json` with:
   - `lint.rules`: `recommended` tag + `eqeqeq`, `no-var`, `no-console`
   - `fmt`: options matching current style (2-space indent, single quotes or
     double — check existing convention)
   - `tasks`: `"lint": "deno lint"`, `"fmt": "deno fmt"`
   - `exclude`: `["docs/", "node_modules/"]`
2. Set up Claude web environment for Deno:
   - SessionStart hook or `.claude/settings.json` to `npm install -g deno` and
     `export DENO_TLS_CA_STORE=system`
3. Run `deno lint` — fix all violations:
   - Unused param in `engineStop(state)` → `engineStop(_state)`
   - Empty catch blocks in `music-data.js` → add `// expected` comments
   - Any `var` → `const`/`let`
   - Any `==` → `===` (audit the `== null` cases)
4. Run `deno fmt --write` across all source files
   - This will be a large whitespace-only diff — land it as a single commit with
     no other changes so git blame stays useful (`git blame --ignore-rev`)
5. Add `deno lint` as a CI step (additive — runs alongside the existing Node
   build, doesn't replace it)

**Outcome:** Linting enforced, code formatted, Deno tooling works. Zero behavior
changes. Node build path still works.

**Risk:** Low. Lint fixes are minor. Formatting is mechanical.

---

### Phase 2: Rename `.js` → `.ts`

**What:** Rename all 21 source files from `.js` to `.ts`. No type annotations
yet — just the file extension change so TypeScript tooling can see them.

**Steps:**

1. Rename all `src/*.js` to `src/*.ts` (excluding `_test.ts` files, already TS)
2. Update all 64 import paths: `'./module.js'` → `'./module.ts'`
3. Update both esbuild entry points:
   - `build.ts`: `entryPoints: [join(__dirname, "src/app.ts")]`
   - `main.ts`: `resolve("./src/app.ts")`
4. Update import paths in all 8 test files (e.g., `from "./adaptive.js"` →
   `from "./adaptive.ts"`)
5. Update CLAUDE.md file references
6. Update `guides/architecture.md` module list
7. Run `deno lint` — verify clean
8. Run existing tests — verify nothing broke
9. Run build — verify output unchanged

**Outcome:** All source files are `.ts`. esbuild handles `.ts` natively — no
behavior change. Both Node and Deno build paths still work.

**Risk:** Low. Mechanical rename. esbuild bundles `.ts` identically to `.js`.
The diff is large but content-free — `git diff --diff-filter=R` shows pure
renames. Import path updates are find-and-replace.

---

### Phase 3: Consolidate build on Deno

**What:** Merge the Node build script into the Deno build script, switch CI to
Deno, drop Node-only dependencies. After this phase, there is one build path.

**Steps:**

1. Port moments page generation (~450 lines) from `build.ts` to `main.ts`:
   - Same logic, replace `node:fs` calls with `Deno.readTextFile` /
     `Deno.writeTextFile`
   - Replace `readdirSync` with `Deno.readDir`
   - Keep the `MomentOverrides` interface, `prepareMoment()`, etc.
2. Port design page copying from `build.ts` to `main.ts`
3. Add `deno task` definitions to `deno.json`:
   - `"build": "deno run --allow-read --allow-write --allow-run main.ts --build"`
   - `"dev": "deno run --allow-net --allow-read --allow-run main.ts"`
   - `"test": "deno test --no-check --allow-read"`
   - `"lint": "deno lint"`
   - `"fmt": "deno fmt"`
   - `"check": "deno check src/**/*.ts"`
4. Switch CI workflow (`deploy-preview.yml`):
   - Replace `actions/setup-node@v4` with `denoland/setup-deno@v2`
   - Replace `npm install` + `npx tsx build.ts` with `deno task build`
   - Add `DENO_TLS_CA_STORE: system` to env (if CI needs npm registry access;
     may not be needed on GitHub Actions)
5. Switch test runner in CLAUDE.md: `deno task test` replaces
   `npx tsx --test src/*_test.ts`
6. Delete `build.ts`
7. Remove `tsx` and `typescript` from `package.json` devDependencies
   - Keep `esbuild` (still used by `main.ts` via `npx esbuild`)
   - Keep `playwright` (screenshot tool)
8. Verify: `deno task build`, `deno task test`, `deno lint`, CI green

**Outcome:** Single build path. `package.json` has 2 devDependencies (down
from 4) plus Capacitor. `build.ts` is gone.

**Risk:** Medium. The moments generation port is the largest piece of work. CI
change needs careful testing. Rollback is straightforward (revert the CI change
and restore `build.ts`).

**Note on esbuild:** `main.ts` currently shells out to `npx esbuild`. This still
requires esbuild in `node_modules`. A future follow-up could switch to Deno's
npm specifier (`import * as esbuild from "npm:esbuild"`) to use esbuild's JS API
directly, eliminating the subprocess. Not blocking for this phase.

---

### Phase 4: Type annotations + `deno check`

**What:** Add TypeScript type annotations to all source files. Enable
`deno check` in CI to catch type errors at build time.

This is the largest phase by volume but can be done incrementally — one file or
module group per PR. The app works correctly at every step; types are additive.

**Order** (pure/foundational → dependent → UI):

1. **Core interfaces** — define shared types in a new `src/types.ts`:
   - `EngineState`, `EngineConfig`
   - `ModePlugin` interface (the `createXxxMode()` contract)
   - `AdaptiveConfig`, `ItemStats`
   - `Recommendation`, `StringRecommendation`
2. **Pure data** — `music-data.ts`: note/interval types, function signatures
3. **Pure state** — `quiz-engine-state.ts`, `quiz-fretboard-state.ts`: state
   transition function signatures, return types
4. **Algorithms** — `adaptive.ts`, `recommendations.ts`, `stats-display.ts`:
   selector, EWMA, recall model, speed score
5. **Shared engine** — `quiz-engine.ts`: key handlers, engine factory
6. **Quiz modes** (10 files) — each mode gets typed `init`, `activate`,
   `deactivate`, DOM element caches, localStorage access
7. **Navigation + settings** — `navigation.ts`, `settings.ts`
8. **Entry point** — `app.ts`: mostly already typed by inference from imports
9. **Build-time files** — `build-template.ts`, `html-helpers.ts`,
   `fretboard.ts`: already `.ts`, may need tightening
10. **Tests** — add type annotations to test helpers; fix any test type errors
    revealed by strict checking

**After each group:** run `deno check` on the annotated files to verify. Once
all files pass, add `deno check` to CI and to the `build` task.

**Typing strategy for DOM code:**

The quiz mode files interact with the DOM heavily. Rather than typing every
`querySelector` result, use a typed element cache pattern:

```typescript
interface Elements {
  container: HTMLElement;
  prompt: HTMLElement;
  feedback: HTMLElement;
  buttons: NodeListOf<HTMLButtonElement>;
}

function init(): Elements {
  const container = document.getElementById('mode-fretboard')!;
  return {
    container,
    prompt: container.querySelector('.quiz-prompt')!,
    // ...
  };
}
```

Non-null assertions (`!`) are acceptable here — the HTML is generated at build
time from `html-helpers.ts`, so these elements are guaranteed to exist.

**Outcome:** Fully typed codebase. `deno check` in CI catches type mismatches,
wrong argument counts, misspelled properties — the class of bug LLMs produce
most often.

**Risk:** Low per-file, but high total volume (~20 files). Each file can land
independently. No behavior changes.

---

## End State

```
deno.json          # lint, fmt, tasks, exclude — the only config file
main.ts            # Build + dev server + moments generation
src/*.ts           # All TypeScript, all typed
src/*_test.ts      # Tests (node:test, run via deno test)
package.json       # esbuild + playwright + capacitor only
```

Commands:

```bash
deno task build    # Build to docs/
deno task dev      # Dev server on :8001
deno task test     # Run all tests
deno task lint     # Lint check
deno task fmt      # Format check
deno check src/    # Type check
```

## What Doesn't Change

- App architecture (state + render, mode plugin, factory pattern)
- esbuild bundling (still bundles to single IIFE)
- `node:test` in test files (Deno supports it)
- Review checklist (still needed for architectural conventions)
- Capacitor iOS build path
- GitHub Pages deployment target
