# CLAUDE.md

Interactive music training app — fretboard note identification, interval math,
and more. Multiple quiz modes accessed via hamburger menu.

## Quick Start

```bash
deno run --allow-net --allow-read main.ts          # Dev server
deno run --allow-write --allow-read main.ts --build # Build (Deno)
npx tsx build.ts                                    # Build (Node)
npx tsx --test src/*_test.ts                        # Run tests
```

**Both `main.ts` and `build.ts` contain the HTML template — update both.**

## Structure

```
main.ts / build.ts       # Dual build scripts (Deno + Node), must stay in sync
src/
  adaptive.js            # Adaptive question selector (ES module)
  music-data.js          # Shared music theory data (ES module)
  quiz-engine-state.js   # Pure engine state transitions (ES module)
  quiz-engine.js         # Shared quiz lifecycle (ES module)
  stats-display.js       # Stats color functions, rendering (ES module)
  recommendations.js     # Consolidate-before-expanding algorithm (ES module)
  quiz-fretboard-state.js  # Pure fretboard helpers (ES module)
  quiz-fretboard.js      # Fretboard mode
  quiz-speed-tap.js      # Speed Tap mode
  quiz-note-semitones.js .. quiz-chord-spelling.js  # 8 more quiz modes
  navigation.js          # Hamburger menu, mode switching
  app.js                 # Init: registers all modes (loaded last)
  styles.css             # Inlined CSS
  *_test.ts              # Tests (node:test)
scripts/take-screenshots.ts  # Playwright screenshots
guides/                  # Detailed developer guides (see below)
plans/                   # Design docs, product specs, execution plans
  design-docs/           #   Architectural explorations and design reviews
  product-specs/         #   What to build and why (user-facing specs)
  exec-plans/            #   Implementation plans (active/ and completed/)
  generated/             #   Generated artifacts
  references/            #   Reference material
docs/                    # Built output for GitHub Pages
```

## Architecture

Single-page vanilla JS app. All source files concatenated into one `<script>`
at build time — no framework, no bundler. Key patterns:

- **State + Render** — pure state transitions in `*-state.js` files, thin
  declarative `render()` in main files. Eliminates ordering and stale-UI bugs.
- **Mode Plugin Interface** — each mode is a `createXxxMode()` factory
  providing `getEnabledItems`, `presentQuestion`, `checkAnswer`, `handleKey`,
  `onStart`/`onStop`, plus `init`/`activate`/`deactivate` lifecycle hooks.
- **QuizEngine** — shared lifecycle (adaptive selection, timing, countdown,
  feedback, keyboard/tap). Each mode gets its own engine instance.
- **Factory Pattern** — `createFretboardHelpers(musicData)` injects globals
  for testability without ES imports in concatenated code.
- **Adaptive Selector** — weighted random selection (unseen boost + EWMA).
  Injected storage for testability. Per-item forgetting model with half-life
  spaced repetition.
- **Motor Baseline** — per-provider calibration measuring physical response
  time. All timing thresholds scale proportionally (1x–9x baseline).
- **Consolidate Before Expanding** — shared `computeRecommendations()` gates
  progression to new item groups behind mastery of existing ones.
- **Build System** — `readModule()` strips `export` for browser; `read()` for
  plain scripts. Concatenation order = dependency order.

See [guides/architecture.md](guides/architecture.md) for module dependency
graph, algorithm details, and step-by-step "adding a new quiz mode" checklist.

## Quiz Modes

| Mode | Items | Answer type | Item ID format |
|------|-------|-------------|----------------|
| Fretboard | 78 (6 strings x 13 frets) | Note name | `0-5` (string-fret) |
| Note ↔ Semitones | 24 (12 notes x 2 dirs) | Note or number 0-11 | `C:fwd`, `C:rev` |
| Interval ↔ Semitones | 24 (12 intervals x 2 dirs) | Interval or number 1-12 | `m2:fwd`, `m2:rev` |
| Semitone Math | 264 (12 notes x 11 x 2 dirs) | Note name | `C+3`, `C-3` |
| Interval Math | 264 (12 notes x 11 x 2 dirs) | Note name | `C+m3`, `C-P4` |
| Key Signatures | 24 (12 keys x 2 dirs) | Sig label or note | `D:fwd`, `D:rev` |
| Scale Degrees | 168 (12 keys x 7 degrees x 2 dirs) | Note or degree | `D:5:fwd`, `D:A:rev` |
| Diatonic Chords | 168 (12 keys x 7 degrees x 2 dirs) | Note or numeral | `Bb:IV:fwd`, `C:D:rev` |
| Chord Spelling | ~132 (12 roots x chord types) | Sequential notes | `C:major`, `F#:dim` |

Bidirectional modes track each direction as a separate item.

## Keyboard Shortcuts

- `C D E F G A B` — natural note
- Letter + `#` / `b` — sharp/flat
- `0-9` — number (semitone modes)
- `Space` / `Enter` — next question
- `Escape` — stop quiz

## Guides

| Guide | Contents |
|-------|----------|
| [architecture.md](guides/architecture.md) | Module graph, build system, patterns, algorithms, adding new modes |
| [coding-style.md](guides/coding-style.md) | Naming, file structure, DOM rules, testing patterns |
| [development.md](guides/development.md) | Commands, testing, versioning, branching, deployment, GitHub API |
| [feature-process.md](guides/feature-process.md) | When/how to write plans, design spec + implementation plan templates |
| [vision.md](guides/vision.md) | Product vision, design principles, roadmap |
| [tech-debt-tracker.md](plans/exec-plans/tech-debt-tracker.md) | Technical debt tracking |

The review checklist (`.claude/commands/review-checklist.md`) verifies these
conventions — use `/review` to run it.
