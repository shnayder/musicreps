# CLAUDE.md

Interactive music training app — fretboard note identification, interval math,
and more. Multiple quiz modes accessed via hamburger menu.

## Quick Start

```bash
deno task dev                                    # Dev server
deno task build                                  # Build to docs/
deno task test                                   # Run tests
deno task lint                                   # Lint check
deno task fmt                                    # Format check
deno task check                                  # Type-check all TS
deno task ok                                     # All checks + build
```

**Run `deno task ok` before pushing.** It runs lint, format check, type check,
tests, and build in sequence — any failure stops the chain. Don't push broken
code by accident.

**Always bump the version** (`VERSION` in `src/build-template.ts`) with every
change — even tiny fixes. Bump by 1 for normal changes (v3.13 → v3.14 → v3.15).
Bump the major version for large overhauls (v3.x → v4.0).

**The HTML template lives in `src/build-template.ts`** — the single source of
truth for the page structure and version number. `main.ts` handles both building
(with `--build`) and dev serving. Mode-specific content is passed as arguments
to `modeScreen()` in `src/html-helpers.ts`.

## Structure

```
main.ts                  # Build + dev server + moments generation (Deno)
src/
  app.ts                 # Entry point: registers Preact modes, starts navigation
  build-template.ts      # HTML template, version number (build-time)
  html-helpers.ts        # Build-time HTML: mode scaffold, fretboard SVG
  fretboard.ts           # Build-time SVG: fret/string/note generation
  adaptive.ts            # Adaptive question selector
  music-data.ts          # Shared music theory data
  quiz-engine-state.ts   # Pure engine state transitions
  quiz-engine.ts         # Keyboard handlers, calibration utilities
  stats-display.ts       # Heatmap color functions, legend builder
  recommendations.ts     # Consolidate-before-expanding algorithm
  quiz-fretboard-state.ts  # Pure fretboard helpers (factory pattern)
  mode-ui-state.ts       # Pure practice summary computation
  navigation.ts          # Hamburger menu, mode switching
  settings.ts            # Settings modal
  types.ts               # Shared type definitions
  styles.css             # Inlined CSS
  *_test.ts              # Tests (node:test)
  ui/
    mode-screen.tsx       # Structural layout components (ModeScreen, QuizArea, etc.)
    buttons.tsx           # Answer button components (NoteButtons, NumberButtons, etc.)
    scope.tsx             # Scope control components (GroupToggles, NoteFilter, etc.)
    stats.tsx             # Stats table/grid/legend components
    modes/
      note-semitones-mode.tsx .. speed-tap-mode.tsx  # 11 Preact mode components
  hooks/
    use-quiz-engine.ts    # Quiz engine lifecycle hook
    use-scope-state.ts    # Scope persistence hook
    use-learner-model.ts  # Adaptive selector + storage hook
    use-key-handler.ts    # Keyboard event hook
scripts/take-screenshots.ts  # Playwright screenshots
guides/                  # Detailed developer guides (see below)
plans/                   # Design docs, product specs, execution plans
  design-docs/           #   Architectural explorations and design reviews
  product-specs/         #   What to build and why (active/ and completed/)
  exec-plans/            #   Implementation plans (active/ and completed/)
  generated/             #   Generated artifacts
  references/            #   Reference material
backlogs/                # Per-workstream backlogs (product, design, engineering, process)
docs/                    # Built output for GitHub Pages
  design/                #   Design reference pages (copied from guides/design/)
.github/workflows/       # CI: preview deploys for claude/* branches
```

## Architecture

Single-page app using Preact for UI components. Source files are ES modules
bundled by esbuild (with automatic JSX transform) into a single IIFE `<script>`
at build time. Key patterns:

- **Preact Mode Components** — each quiz mode is a single `.tsx` file (~100-300
  lines) composing shared UI components with mode-specific logic. Registered
  with navigation via `{ init, activate, deactivate }` interface.
- **Shared Hooks** — `useQuizEngine` (engine lifecycle), `useScopeState` (scope
  persistence), `useLearnerModel` (adaptive selector + storage),
  `useKeyHandler` (keyboard events). Each mode composes these hooks.
- **Shared UI Components** — `ModeScreen`, `QuizArea`, `PracticeCard`,
  `StatsTable`/`StatsGrid`, `NoteButtons`, `GroupToggles`, etc. Emit the same
  CSS class names as the build-time HTML for style parity.
- **Pure State Transitions** — `quiz-engine-state.ts` contains pure functions
  for engine state. The `useQuizEngine` hook wraps them with Preact reactivity.
- **Adaptive Selector** — weighted random selection (unseen boost + EWMA).
  Injected storage for testability. Per-item forgetting model with half-life
  spaced repetition.
- **Motor Baseline** — per-provider calibration measuring physical response
  time. All timing thresholds scale proportionally (1x–9x baseline).
- **Consolidate Before Expanding** — shared `computeRecommendations()` gates
  progression to new item groups behind mastery of existing ones.
- **CSS Custom Properties** — color palette, heatmap scale, and semantic tokens
  defined as `--color-*` and `--heatmap-*` variables in `:root`. JS reads
  heatmap colors via `getComputedStyle` with hardcoded fallbacks for tests.
- **Build System** — esbuild bundles `src/app.ts` (entry point) into a single
  IIFE. The HTML template is shared via `assembleHTML()` in `build-template.ts`.

See [guides/architecture.md](guides/architecture.md) for module dependency
graph, algorithm details, and step-by-step "adding a new quiz mode" checklist.

## Quiz Modes

| Mode                 | Items                              | Answer type             | Item ID format         |
| -------------------- | ---------------------------------- | ----------------------- | ---------------------- |
| Guitar Fretboard     | 78 (6 strings x 13 frets)          | Note name               | `0-5` (string-fret)    |
| Ukulele Fretboard    | 52 (4 strings x 13 frets)          | Note name               | `0-3` (string-fret)    |
| Note ↔ Semitones     | 24 (12 notes x 2 dirs)             | Note or number 0-11     | `C:fwd`, `C:rev`       |
| Interval ↔ Semitones | 24 (12 intervals x 2 dirs)         | Interval or number 1-12 | `m2:fwd`, `m2:rev`     |
| Semitone Math        | 264 (12 notes x 11 x 2 dirs)       | Note name               | `C+3`, `C-3`           |
| Interval Math        | 264 (12 notes x 11 x 2 dirs)       | Note name               | `C+m3`, `C-P4`         |
| Key Signatures       | 24 (12 keys x 2 dirs)              | Sig label or note       | `D:fwd`, `D:rev`       |
| Scale Degrees        | 168 (12 keys x 7 degrees x 2 dirs) | Note or degree          | `D:5:fwd`, `D:A:rev`   |
| Diatonic Chords      | 168 (12 keys x 7 degrees x 2 dirs) | Note or numeral         | `Bb:IV:fwd`, `C:D:rev` |
| Chord Spelling       | ~132 (12 roots x chord types)      | Sequential notes        | `C:major`, `F#:dim`    |

Bidirectional modes track each direction as a separate item.

## Keyboard Shortcuts

- `C D E F G A B` — natural note (letter mode)
- `do re mi fa so la si` — natural note (solfège mode, case-insensitive)
- Letter/syllable + `#` / `b` — sharp/flat (`s` also works for sharp in letter
  mode)
- `0-9` — number (semitone modes)
- `Space` / `Enter` — next question
- `Escape` — stop quiz / return to home screen

## Guides

**Aspirational** — where the product is headed:

| Guide                         | Contents                                                 |
| ----------------------------- | -------------------------------------------------------- |
| [vision.md](guides/vision.md) | Who it's for, what we're building, tone, skill lifecycle |

**Enduring** — design values that should outlast any implementation:

| Guide                                                 | Contents                                                         |
| ----------------------------------------------------- | ---------------------------------------------------------------- |
| [design-principles.md](guides/design-principles.md)   | Product, visual, and UX design principles                        |
| [layout-and-ia.md](guides/design/layout-and-ia.md)    | Screen structure principles: states, hierarchy, grouping, labels |
| [process-principles.md](guides/process-principles.md) | Development process values and improvement goals                 |

**Current reference** — how things work today:

| Guide                                                         | Contents                                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [architecture.md](guides/architecture.md)                     | Module graph, build system, patterns, algorithms, DOM layout, adding new modes |
| [visual-design.md](guides/design/visual-design.md)            | Color system, typography, spacing, component patterns                          |
| [coding-style.md](guides/coding-style.md)                     | Naming, file structure, DOM rules, testing patterns                            |
| [accidental-conventions.md](guides/accidental-conventions.md) | Sharp/flat naming rules by mode, rule priority                                 |
| [terminology.md](guides/terminology.md)                       | User-facing terms and their internal equivalents                               |

**Process** — how to work on the codebase:

| Guide                                                         | Contents                                                             |
| ------------------------------------------------------------- | -------------------------------------------------------------------- |
| [development.md](guides/development.md)                       | Commands, testing, versioning, branching, deployment, GitHub API     |
| [feature-process.md](guides/feature-process.md)               | When/how to write plans, design spec + implementation plan templates |
| [tech-debt-tracker.md](plans/exec-plans/tech-debt-tracker.md) | Technical debt tracking                                              |

The review checklist (`.claude/commands/review-checklist.md`) verifies these
conventions — use `/review` to run it.

## Workstreams

Four parallel worktrees with long-lived branches. Single user — separation is
about focus, not access control. Regular rebase from main keeps them in sync.

| Workstream  | Branch                 | Focus                                              |
| ----------- | ---------------------- | -------------------------------------------------- |
| Product     | workstream/product     | Specs, vision, backlog, feedback (docs only)       |
| Design      | workstream/design      | HTML/CSS layers, visual design, component patterns |
| Engineering | workstream/engineering | JS behavior, state, algorithms, build system       |
| Process     | workstream/process     | CI, Claude tooling, review commands, process docs  |

**Overlap zones** — `main.ts` and quiz render functions are touched by both
design and engineering. Rebase often; keep HTML/CSS and JS behavior cleanly
separated.

**Version bumps**: only engineering bumps the version number.

**Backlogs**: each workstream has its own in `backlogs/`. The old monolithic
`backlog.md` is archived at `backlogs/legacy.md`.

## GitHub API Access

`gh` CLI is not authenticated in the web environment. Use `curl` through the
egress proxy instead — see
[development.md](guides/development.md#github-api-access-web-environment) for
the pattern.

## PR Requirements

All PRs that change code (not just docs/plans) follow this sequence:

1. Run `/review` until approved — don't wait for the user to ask.
2. Push the branch.
3. Create a PR with `gh pr create` (summary + test plan).
