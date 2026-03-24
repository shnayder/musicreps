# CLAUDE.md

Interactive music training app — fretboard note identification, interval math,
and more. Multiple quiz modes accessed from the home screen.

## MANDATORY: Use td for Task Management

Run td usage --new-session at conversation start (or after /clear). This tells
you what to work on next.

Sessions are automatic (based on terminal/agent context). Optional:

- td session "name" to label the current session
- td session --new to force a new session in the same context

Use td usage -q after first read.

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
tests, and build in sequence — any failure stops the chain. Use `/pr` to create
PRs — it enforces the full sequence. Use `/check-ci` after pushing to verify CI
passes before declaring success (CI also runs E2E tests via Playwright). Run
`deno task prepush` locally if Playwright is available — it adds E2E tests.

If you hit `UnknownIssuer` TLS errors or npm resolution failures, see the **Web
sandbox** section in
[guides/development.md](guides/development.md#web-sandbox-is_sandboxyes).

**Run `deno task iterate capture` after UI changes.** When a `deno task iterate`
session is active, capture a new version after every round of UI changes so the
user can visually review diffs. Create a new session
(`deno task iterate new <name> <states...>`) at the start of a UI task if none
exists for the relevant states.

**Every new UI component must appear in the component preview page**
(`/preview`, source in `src/ui/preview-tab-*.tsx`). The preview renders real
components with mock data — it is the design system source of truth. No copies
or approximations.

**The HTML template lives in `src/build-template.ts`** — the single source of
truth for the page structure. **Version is derived from git at build time** (see
`getVersion()` in `main.ts`) — no manual bumps needed. `main.ts` handles both
building (with `--build`) and dev serving. Mode-specific content is passed as
arguments to `modeScreen()` in `src/html-helpers.ts`.

## Structure

```
main.ts                  # Build + dev server + moments generation (Deno)
src/
  app.ts                 # Entry point: registers Preact modes, starts navigation
  build-template.ts      # HTML template (build-time)
  html-helpers.ts        # Build-time HTML: mode scaffold, fretboard SVG
  fretboard.ts           # Build-time SVG: fret/string/note generation
  adaptive.ts            # Adaptive question selector
  music-data.ts          # Shared music theory data + input validators
  mode-utils.ts          # Shared ID parsing/building, stats row helpers
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
  declarative/
    types.ts             # ModeDefinition, ButtonsDef, ScopeDef, StatsDef, MultiTapDef
    generic-mode.tsx     # GenericMode: interprets ModeDefinition → full UI
    use-sequential-input.ts  # Sequential (multi-note) collection hook
    use-multi-tap-input.ts   # Multi-tap (spatial set) collection hook
  modes/
    {name}/
      logic.ts            # Pure mode logic: questions, answers, items, groups
      logic_test.ts        # Tests for mode logic
      definition.ts        # Declarative mode definition (11 modes)
  ui/
    mode-screen.tsx       # Structural layout components (ModeScreen, QuizArea, etc.)
    buttons.tsx           # Answer button components (NoteButtons, NumberButtons, etc.)
    scope.tsx             # Scope control components (GroupToggles, NoteFilter, etc.)
    stats.tsx             # Stats table/grid/legend components
  hooks/
    use-quiz-engine.ts    # Quiz engine lifecycle hook
    use-scope-state.ts    # Scope persistence hook
    use-learner-model.ts  # Adaptive selector + storage hook
    use-group-scope.ts    # Group-based scope + recommendations (6 modes)
    use-mode-lifecycle.ts # Navigation activate/deactivate registration
    use-key-handler.ts    # Keyboard event hook
    use-phase-class.ts    # Phase-to-CSS-class sync hook
    use-round-summary.ts  # Round-complete derived state hook
scripts/take-screenshots.ts  # Playwright screenshots
guides/                  # Detailed developer guides (see below)
plans/                   # Design docs, product specs, execution plans
  design-docs/           #   Architectural explorations and design reviews
  product-specs/         #   What to build and why (active/ and completed/)
  exec-plans/            #   Implementation plans (active/ and completed/)
  generated/             #   Generated artifacts
  references/            #   Reference material
backlogs/                # Per-workstream backlogs (product, design, engineering, process)
static/                  # Static assets copied to docs/ at build time
docs/                    # Built output (gitignored, created by deno task build)
  design/                #   Design reference pages (copied from guides/design/)
.github/workflows/       # CI: preview deploys for claude/* branches
```

## Architecture

Single-page app using Preact for UI components. Source files are ES modules
bundled by esbuild (with automatic JSX transform) into a single IIFE `<script>`
at build time. Key patterns:

- **Declarative Modes** — All 11 modes use `ModeDefinition<Q>` (20-100 lines of
  data) interpreted by `GenericMode`, which handles all hook composition,
  rendering, and keyboard input. Three answer variants: single (`answer`),
  sequential (`sequential`, e.g., chord spelling), and multi-tap (`multiTap`,
  e.g., Speed Tap). Modes needing custom rendering (e.g., fretboard SVG) provide
  a `useController` hook.
- **Shared Hooks** — `useQuizEngine` (engine lifecycle), `useLearnerModel`
  (adaptive selector + storage), `useGroupScope` (group scope + recommendations
  for 6 modes), `useModeLifecycle` (navigation activate/deactivate for all
  modes), `useScopeState` (low-level scope persistence), `useKeyHandler`
  (keyboard events). GenericMode composes these automatically.
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
- **Recommendation Pipeline (v4)** — shared `computeRecommendations()` computes
  per-level status (speed/freshness) and emits prioritized recs (review →
  practice → expand → automate) with an expansion gate.
- **CSS Custom Properties** — color palette, heatmap scale, and semantic tokens
  defined as `--color-*` and `--heatmap-*` variables in `:root`. JS reads
  heatmap colors via `getComputedStyle` with hardcoded fallbacks for tests.
- **Build System** — esbuild bundles `src/app.ts` (entry point) into a single
  IIFE. The HTML template is shared via `assembleHTML()` in `build-template.ts`.
- **Function Length** — max 100 lines per function
  (`scripts/lint-function-length.ts`). Prefer small, clear, obviously correct
  functions that do one thing and can be tested independently. Extract helpers,
  sub-components, and custom hooks rather than writing giant monolithic
  functions. When a function grows past the limit, look for: standalone pure
  helpers, sub-components for JSX branches, custom hooks for related state, and
  standalone callbacks that close over refs.

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
| Scale Degrees        | 144 (12 keys x 6 degrees x 2 dirs) | Note or degree          | `D:5:fwd`, `C:7:rev`   |
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
| [brand.md](guides/brand.md)   | Core positioning, promise, messaging, visual tone        |

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
| [visual-design.md](guides/design/visual-design.md)            | Index to color, typography, spacing, components, patterns docs                 |
| [typography.md](guides/design/typography.md)                  | Type system: 5-tier scale, 20 roles, intensity tiers, design principles        |
| [color-system.md](guides/design/color-system.md)              | Color architecture, palette model, semantic families, heatmap                  |
| [coding-style.md](guides/coding-style.md)                     | Naming, file structure, DOM rules, testing patterns                            |
| [accidental-conventions.md](guides/accidental-conventions.md) | Sharp/flat naming rules by mode, rule priority                                 |
| [terminology.md](guides/terminology.md)                       | User-facing terms and their internal equivalents                               |

**Process** — how to work on the codebase:

| Guide                                                         | Contents                                                                   |
| ------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [development.md](guides/development.md)                       | Commands, testing, versioning, branching, deployment, GitHub API           |
| [feature-process.md](guides/feature-process.md)               | When/how to write plans, design spec + implementation plan templates       |
| [visual-design-spec.md](guides/visual-design-spec.md)         | Template for visual design work (layout, styling, design system alignment) |
| [tech-debt-tracker.md](plans/exec-plans/tech-debt-tracker.md) | Technical debt tracking                                                    |

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

**Dev servers** — other worktrees may be running dev servers. Never kill
processes you didn't start. `main.ts --port=N` tries port N, then N+1, etc.
until it finds an open one. Scripts request port 8002 and discover the actual
port from the server's `Listening on` stderr output.

**Versioning**: derived from git at build time — no manual bumps needed.

**Backlogs**: each workstream has its own in `backlogs/`. The old monolithic
`backlog.md` is archived at `backlogs/legacy.md`.

## GitHub API Access

`gh` CLI is not authenticated in the web environment. Use `curl` through the
egress proxy instead — see
[development.md](guides/development.md#github-api-access-web-environment) for
the pattern.

**Claude Code sandbox note:** `gh` CLI commands that hit the GitHub API (e.g.
`gh pr create`, `gh pr view`) fail with TLS certificate errors inside the
sandbox. Always run `gh` API commands with the sandbox disabled.

## PR Requirements

All PRs that change code (not just docs/plans) follow this sequence:

1. Run `/review` until approved — don't wait for the user to ask.
2. Push the branch.
3. Create a PR with `gh pr create` (summary + test plan).
