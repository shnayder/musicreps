# CLAUDE.md

Interactive music training app — fretboard note identification, interval math,
and more. Multiple quiz skills accessed from the home screen.

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

If you hit `UnknownIssuer` TLS errors or npm resolution failures in the web
sandbox: run `npm install` (npm routes through the proxy correctly). A
session-start hook runs this automatically when `IS_SANDBOX=yes`.

**Run `deno task iterate capture` after UI changes.** When a `deno task iterate`
session is active, capture a new version after every round of UI changes so the
user can visually review diffs. Create a new session
(`deno task iterate new <name> <states...>`) at the start of a UI task if none
exists for the relevant states.

**Every new UI component must appear in the component preview page**
(`/preview`, source in `src/ui/preview-tab-*.tsx`). The preview renders real
components with mock data — it is the design system source of truth. No copies
or approximations.

**The HTML template lives in `src/build-template.ts`** — it assembles the HTML
shell with empty container divs for each mode (derived from `TRACKS` in
`skill-catalog.ts`). **Version is derived from git at build time** (see
`getVersion()` in `main.ts`) — no manual bumps needed. `main.ts` handles both
building (with `--build`) and dev serving. Preact renders all UI at runtime.

## Structure

```
main.ts                  # Build + dev server + moments generation (Deno)
src/
  app.ts                 # Entry point: registers Preact skills, starts navigation
  build-template.ts      # HTML template: shell + empty skill containers
  fretboard.ts           # SVG fretboard generation (shared by build + runtime)
  adaptive.ts            # Adaptive question selector
  music-data.ts          # Shared music theory data + input validators
  skill-utils.ts          # Shared ID parsing/building, stats row helpers
  quiz-engine-state.ts   # Pure engine state transitions
  quiz-engine.ts         # Keyboard handlers, calibration utilities
  stats-display.ts       # Heatmap color functions, legend builder
  recommendations.ts     # Consolidate-before-expanding algorithm
  quiz-fretboard-state.ts  # Pure fretboard helpers (factory pattern)
  skill-ui-state.ts       # Pure practice summary computation
  navigation.ts          # Hamburger menu, skill switching
  settings.ts            # Settings modal
  storage.ts             # localStorage abstraction (web + Capacitor)
  types.ts               # Shared type definitions
  styles.css             # Inlined CSS
  *_test.ts              # Tests (node:test)
  declarative/
    types.ts             # SkillDefinition, ButtonsDef, ScopeDef, StatsDef, MultiTapDef
    answer-utils.ts      # Pure answer-checking and input utilities
    generic-skill.tsx     # GenericSkill: top-level orchestrator
    generic-skill-hooks.ts  # Internal hooks + builder functions
    quiz-areas.tsx       # Quiz area components (active quiz UI)
    practice-views.tsx   # Idle/practice tab components
    use-sequential-input.ts  # Sequential (multi-note) collection hook
    use-multi-tap-input.ts   # Multi-tap (spatial set) collection hook
  skills/
    {name}/
      logic.ts            # Pure skill logic: questions, answers, items, groups
      logic_test.ts        # Tests for skill logic
      definition.ts        # Declarative skill definition (11 skills)
  ui/
    skill-screen.tsx       # Structural layout components (SkillScreen, QuizArea, etc.)
    buttons.tsx           # Answer button components (NoteButtons, NumberButtons, etc.)
    scope.tsx             # Scope control components (LevelToggles, NoteFilter, etc.)
    stats.tsx             # Stats table/grid/legend components
  hooks/
    use-quiz-engine.ts    # Quiz engine lifecycle hook
    use-scope-state.ts    # Scope persistence hook
    use-learner-model.ts  # Adaptive selector + storage hook
    use-level-scope.ts    # Level-based scope + recommendations (6 modes)
    use-skill-lifecycle.ts # Navigation activate/deactivate registration
    use-key-handler.ts    # Keyboard event hook
    use-phase-class.ts    # Phase-to-CSS-class sync hook
    use-round-summary.ts  # Round-complete derived state hook
scripts/take-screenshots.ts  # Playwright screenshots
static/                  # Static assets copied to docs/ at build time
docs/                    # Built output (gitignored, created by deno task build)
.github/workflows/       # CI: preview deploys for claude/* branches
```

## Architecture

Single-page app using Preact for UI components. Source files are ES modules
bundled by esbuild (with automatic JSX transform) into a single IIFE `<script>`
at build time. Key patterns:

- **Declarative Skills** — All 11 skills use `SkillDefinition<Q>` (20-100 lines
  of data) interpreted by `GenericSkill`, which handles all hook composition,
  rendering, and keyboard input. Three answer variants: single (`answer`),
  sequential (`sequential`, e.g., chord spelling), and multi-tap (`multiTap`,
  e.g., Speed Tap). Skills needing custom rendering (e.g., fretboard SVG)
  provide a `useController` hook.
- **Shared Hooks** — `useQuizEngine` (engine lifecycle), `useLearnerModel`
  (adaptive selector + storage), `useLevelScope` (level scope + recommendations
  for 6 skills), `useSkillLifecycle` (navigation activate/deactivate for all
  modes), `useScopeState` (low-level scope persistence), `useKeyHandler`
  (keyboard events). GenericSkill composes these automatically.
- **Shared UI Components** — `SkillScreen`, `QuizArea`, `PracticeCard`,
  `StatsTable`/`StatsGrid`, `NoteButtons`, `LevelToggles`, etc.
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
  IIFE. `build-template.ts` assembles the HTML shell with empty skill
  containers.
- **Function Length** — max 100 lines per function
  (`scripts/lint-function-length.ts`). Prefer small, clear, obviously correct
  functions that do one thing and can be tested independently. Extract helpers,
  sub-components, and custom hooks rather than writing giant monolithic
  functions. When a function grows past the limit, look for: standalone pure
  helpers, sub-components for JSX branches, custom hooks for related state, and
  standalone callbacks that close over refs.
- **File Size** — Keep files under ~300 lines. Prefer one primary exported
  component per `.tsx` file; groups of small related components in one file is
  fine. Extract sub-components, helpers, and hooks into separate files rather
  than growing a single file. When touching a file that's over ~300 lines,
  suggest extracting related pieces into their own files as part of the change
  (or as a follow-up). Don't refactor everything at once — split incrementally
  alongside feature work.

See the architecture guide in the docs vault for module dependency graph,
algorithm details, and step-by-step "adding a new quiz skill" checklist.

## Quiz Modes

| Mode                 | Items                              | Answer type             | Item ID format         |
| -------------------- | ---------------------------------- | ----------------------- | ---------------------- |
| Guitar Fretboard     | 78 (6 strings x 13 frets)          | Note name               | `0-5` (string-fret)    |
| Ukulele Fretboard    | 52 (4 strings x 13 frets)          | Note name               | `0-3` (string-fret)    |
| Note ↔ Semitones     | 24 (12 notes x 2 dirs)             | Note or number 0-11     | `C:fwd`, `C:rev`       |
| Interval ↔ Semitones | 24 (12 intervals x 2 dirs)         | Interval or number 1-12 | `m2:fwd`, `m2:rev`     |
| Semitone Math        | 264 (12 notes x 11 x 2 dirs)       | Note name               | `C+3`, `C-3`           |
| Interval Math        | 264 (12 notes x 11 x 2 dirs)       | Note name               | `C+m3`, `C-P4`         |
| Key Signatures       | 48 (24 keys x 2 dirs)              | Sig label or note       | `D:fwd`, `Am:rev`      |
| Scale Degrees        | 144 (12 keys x 6 degrees x 2 dirs) | Note or degree          | `D:5:fwd`, `C:7:rev`   |
| Diatonic Chords      | 168 (12 keys x 7 degrees x 2 dirs) | Note or numeral         | `Bb:IV:fwd`, `C:D:rev` |
| Chord Spelling       | ~132 (12 roots x chord types)      | Sequential notes        | `C:major`, `F#:dim`    |
| Guitar Chord Shapes  | 29 (maj, min, dom7, m7, sus)       | Multi-tap fretboard     | `C:major`, `D:sus4`    |
| Ukulele Chord Shapes | 26 (maj, min, dom7, m7, sus)       | Multi-tap fretboard     | `C:major`, `A:m7`      |

Bidirectional modes track each direction as a separate item.

## Keyboard Shortcuts

- `C D E F G A B` — natural note (letter mode)
- `do re mi fa so la si` — natural note (solfège mode, case-insensitive)
- Letter/syllable + `#` / `b` — sharp/flat (`s` also works for sharp in letter
  mode)
- `0-9` — number (semitone modes)
- `Space` / `Enter` — next question
- `Escape` — stop quiz / return to home screen

## Docs Vault

Project knowledge base lives in a separate Obsidian vault. The path is set via
the `DOCS_VAULT` env var (configured in `.claude/settings.json`). It contains
guides, plans, backlogs, decisions, conventions, and more.

**Before starting work**, check the docs vault for relevant conventions and
recent decisions in your area:

- `conventions/` — ongoing patterns ("always do it this way")
- `decisions/` — one-time choices with rationale
- `guides/` — architecture, coding style, design system, development process

**After making a non-obvious decision**, write a note to the vault using the
`vault-note` tool (path via `TRELLIS_ROOT` env var):

```bash
cd "$TRELLIS_ROOT" && deno task vault-note add <type> <title> [--area=X] [--body=text]
```

Types: `decision`, `convention`, `debt`, `question`, `observation`, `session`

At session end, write a brief session log:

```bash
cd "$TRELLIS_ROOT" && deno task vault-note add session "<summary>"
```

The review checklist (`.claude/commands/review-checklist.md`) verifies
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

**Backlogs**: each workstream has its own in the docs vault under `backlogs/`.

## GitHub API Access

`gh` CLI is not authenticated in the web environment. Use `curl` through the
egress proxy instead — see the development guide in the docs vault for the
pattern.

**Claude Code sandbox note:** `gh` CLI commands that hit the GitHub API (e.g.
`gh pr create`, `gh pr view`) fail with TLS certificate errors inside the
sandbox. Always run `gh` API commands with the sandbox disabled.

## PR Requirements

All PRs that change code (not just docs/plans) follow this sequence:

1. Run `/review` until approved — don't wait for the user to ask.
2. Push the branch.
3. Create a PR with `gh pr create` (summary + test plan).
