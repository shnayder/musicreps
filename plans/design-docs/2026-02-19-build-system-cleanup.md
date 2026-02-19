# Build system cleanup

**Date**: 2026-02-19
**Status**: Complete (both phases implemented)

## Problem

The build system had two forms of duplication:

1. **Template duplication** — `main.ts` and `build.ts` contained identical
   copies of the HTML template (~170 lines), source file list (~22 read calls),
   service worker, version number, and shared HTML fragments. Every change
   required editing both files in lockstep.

2. **Global namespace** — All ~100 functions and constants from 20 concatenated
   JS files lived in a flat scope. Dependencies were implicit (concatenation
   order) rather than explicit (imports).

## Phase 1: Template deduplication

### What changed

Created `src/build-template.ts` as the single source of truth for:

- **`VERSION`** — one place to bump the version number
- **`assembleHTML(css, js)`** — generates the complete index.html from the
  CSS and bundled JS
- **`HOME_SCREEN_HTML`** — home screen markup (shared with moments page)
- **`DISTANCE_TOGGLES`** — shared HTML fragment
- **`SERVICE_WORKER`** — service worker JS string

### Benefits

- **Version bumps**: 1 location instead of 2. Also fixed a bug where
  moments.html was on v6.6 while the app was on v6.7
- **Template changes**: edit once, both build paths get it

## Phase 2: esbuild module bundling

### What changed

Replaced the concatenation build with esbuild bundling:

1. **Added `import`/`export` to all 20 source files** — each file now
   explicitly declares its dependencies via ES module imports
2. **Replaced concatenation with esbuild** — `build.ts` uses
   `esbuild.buildSync()`, `main.ts` shells out to esbuild CLI
3. **Removed `SOURCE_MANIFEST`** — no longer needed; esbuild resolves the
   module graph from the entry point (`src/app.js`)
4. **Removed `readModule()` export-stripping** — esbuild handles module
   boundaries natively
5. **Removed `globalThis` hacks from tests** — tests import ES modules
   directly and no longer need to manually wire up globals

### Results

| Metric | Before | After |
|--------|--------|-------|
| main.ts | 70 lines | 70 lines |
| build.ts | 730 lines | 730 lines |
| Source file globals | ~100 | 0 (IIFE scope) |
| Test globalThis hacks | 2 | 0 |
| Build output size | 371 KB | 339 KB |
| Dependencies between files | Implicit (concat order) | Explicit (imports) |

### Benefits

- **Dependencies are explicit** — every file declares exactly what it needs
  via `import` statements. IDE go-to-definition, unused-import detection, and
  refactoring tools all work.
- **No global namespace pollution** — esbuild wraps everything in an IIFE.
  Name collisions are impossible.
- **Simpler tests** — tests import the same ES modules the app uses, with no
  globalThis hacks or environment setup needed.
- **Smaller output** — esbuild tree-shakes unused exports, producing ~9%
  smaller JS output.
- **Simpler "add a file" workflow** — create the file with proper imports,
  done. No manifest to update.

### Trade-off rationale

The user's key insight: "a day of work for me to do, 15 minutes for Claude.
If it's 'just work' to make things clean, we should pretty much always do so."
The migration was purely mechanical — adding ~80 import statements across 13
files and swapping the build pipeline — but the payoff in code clarity and
maintainability is permanent.
