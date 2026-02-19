# Architecture Review: UI Component Model & Build System

**Date:** 2026-02-16 **Status:** Review complete — recommendations folded into
layout-IA plan

## Context

Review of two architectural concerns: (1) the UI component model for
showing/hiding elements and managing screen flows, and (2) the single-file
concatenated build. Informed by reading all core source files, existing design
docs, and the last ~40 commits including 3 rounds of review-caught bugs.

---

## 1. UI Component Model

### What works well

The **State + Render** pattern in the engine is sound. Pure state transitions in
`quiz-engine-state.js` (35 tests), a single `render()` function in
`quiz-engine.js:684-809` that maps state to DOM. The phase-class CSS system
(`phase-idle`, `phase-active`, `phase-calibration`, `phase-round-complete`) is
the right direction — bulk visibility via CSS rules, single class swap in JS.

The **mode plugin interface** is clean. `init`/`activate`/`deactivate` lifecycle
plus `getEnabledItems`/`presentQuestion`/`checkAnswer`/`handleKey` gives good
separation. Adding a new mode follows a mechanical checklist.

### The actual problems

**Problem A: Three competing visibility mechanisms coexist.**

1. **Phase-class CSS** (`styles.css`):
   `.phase-active .stats-section { display: none }`
2. **Inline `style.display` in JS** (`navigation.js:43,49`,
   `quiz-engine.js:762,765,797,799`): `el.style.display = 'none'`
3. **Inline `style="display:none"` in HTML** (`html-helpers.ts` round-complete
   overlay, mastery message)

These fight each other. Inline styles have higher specificity than class rules,
so a CSS phase rule can't override a JS-set `style.display`. The `!important` on
calibration sub-phase rules is a symptom of this conflict.

Evidence from recent bugs:

- **Calibration prompt invisible** (commit `c802f79`): `.quiz-prompt` was in the
  phase-calibration CSS hide list, but the engine renders calibration text into
  `.quiz-prompt`. CSS hid what JS was trying to show. Fix: remove from CSS hide
  list.
- **Round-complete overlay** uses `style.display = 'block'/'none'` in JS
  (`quiz-engine.js:797,799`) while also having CSS rules for
  `.phase-round-complete`. Both mechanisms running in parallel.
- **Mastery message** uses `style.display` (`quiz-engine.js:762`) — can't be
  controlled by phase CSS.

**Problem B: Navigation mode-switching uses inline styles, not classes.**

`navigation.js:43` sets `currentScreen.style.display = 'none'` and line 49 sets
`newScreen.style.display = ''`. Line 97-98 hides all screens on init with
`style.display = 'none'`. This means mode-screen visibility is **outside the CSS
system entirely**. If you inspect a hidden mode-screen, it has
`style="display: none"` that no CSS class can override without `!important`.

**Problem C: The render() function is long and has mixed concerns.**

`render()` at 125 lines handles: phase class management, gear button visibility,
calibration button marking, calibration sub-phase classes, header title text,
quiz-area active class, calibration-vs-quiz prompt routing, feedback text, time
display, hint, mastery message, recalibrate button, session stats, progress bar,
answer button enabled state, round-complete overlay, and calibration content
creation. This is the single function that reviewers have to understand to
verify any UI change.

**Problem D: Mode-specific visibility patterns are inconsistent.**

- `quiz-speed-tap.js` uses `fretboardWrapper.style.display = ''/'none'` in
  `onStart()`/`onStop()` — direct inline style, outside the engine's render.
- `quiz-fretboard.js` uses `statsControls.hide()`/`.show()` — a custom
  abstraction.
- `quiz-note-semitones.js` uses `.answer-group-hidden` CSS class — the cleanest
  pattern.
- These three approaches exist simultaneously for the same kind of operation
  (showing/hiding mode-specific elements during quiz lifecycle).

### Severity assessment

This is **not urgent**. The current system works. The phase-class CSS is already
partially implemented (it was added in the time-pressure rework, commit
`9a9b473`). The bugs that surfaced were caught in review and fixed in follow-up
commits — the system is maintainable with discipline.

But the **layout-IA plan** (`2026-02-14-layout-ia-fixes.md`) Phase 4 explicitly
calls for finishing the migration to state-driven CSS. That plan is the right
vehicle for this work.

**Additions to the layout-IA plan (see updated Phase 3-4):**

- **Navigation class-based visibility.** `.mode-screen { display: none }` +
  `.mode-screen.mode-active { display: block }` replaces inline style toggles.
- **Mode-specific visibility standardization.** All modes use CSS class toggles
  (e.g. `.answer-group-hidden`) instead of `style.display`. The
  `quiz-note-semitones.js` pattern is the model.
- **render() decomposition** into named sub-sections or small helper functions.

### Trigger to act

**When implementing layout-IA Phase 3-4.** The navigation and mode-specific
changes are folded into those phases. Don't do this separately — the partial
phase-class system is stable enough for current feature work.

---

## 2. Single-File Concatenated Build

### What works well

- **Zero toolchain complexity.** No webpack, no bundler config, no node_modules
  for the build. `readModule()` is 1 line of regex.
- **Full code visibility.** Open `docs/index.html` and you see everything. No
  source maps needed for debugging.
- **Fast builds.** File concatenation is near-instant.
- **Test story is clean.** Source files use `export`, tests import them directly
  via Node.js ES modules. The `readModule()` regex strips exports for browser.
  Factory pattern (`createFretboardHelpers(musicData)`) solves dependency
  injection without imports.

### The actual problems

**Problem A: Dual build scripts (`main.ts` + `build.ts`) must stay in sync.**

Every template change, file addition, or version bump must be made in both
files. The `html-helpers.ts` extraction (Feb 13) solved the worst of this — the
700-line HTML template is now shared. But the file reading/concatenation lists,
version numbers, and any remaining per-file customization still need manual
sync.

**Problem B: Dependency order is implicit and fragile.**

The concatenation order in `main.ts` defines the dependency graph. Nothing
enforces it. Moving a file out of order produces a runtime error only when that
code path executes — no build-time check.

No bugs from this in recent history. The factory pattern (passing globals as
constructor args) mitigates it for the modules that use it.

**Problem C: Global namespace pollution.**

After export stripping, every exported function and const becomes a global. Name
collisions would be silent. Currently ~60 exported symbols from 7 modules.

No collisions in practice. The naming convention (`createXxxMode`, `engineXxx`,
`computeXxx`) provides namespace separation by convention.

**Problem D: `displayNote()` used as implicit global.**

Some functions like `displayNote()` (from `music-data.js`) are called directly
by mode files without being passed as a parameter. This works in the browser
(concatenation puts it in scope) but tests must set up globals manually.

The solfege plan (`2026-02-15`) adds `displayNote()` calls to 10+ more files,
deepening this coupling.

**Problem E: The export-stripping regex is minimal.**

`/^export /gm` only handles `export function` and `export const` at line start.
It wouldn't handle `export { named }`, `export default`, or `export` with
leading whitespace. This works because all source files follow the convention.

### Severity assessment

This is **not urgent and may never be.** The concatenation approach is a good
fit for the app's current size (~3,000 lines of JS across 21 files, 10 quiz
modes). The pain points are real but manageable:

- Dual build sync: mitigated by `html-helpers.ts` extraction, caught by review
- Dependency order: mitigated by convention and architecture docs
- Globals: mitigated by naming convention
- `displayNote()`: a smell, but fixing it would mean threading it through every
  mode's factory — high churn for low benefit

**When would a bundler become worth it?**

- **20+ JS files or 8,000+ lines**: the concatenation list and dependency order
  become hard to reason about manually
- **Third-party dependencies**: if you ever need an npm package in the client
  code (not just build scripts)
- **Code splitting need**: if you want to lazy-load modes (unlikely for this
  app's size)
- **TypeScript in source files**: if you want `.ts` source files (not just `.js`
  with JSDoc), you'd need a compile step — at that point, use a bundler

None of these seem imminent. The app could grow to 15 modes without hitting
these limits.

**If you did migrate**, the lowest-friction option would be **esbuild** (or
Deno's built-in bundler): ES modules with real `import`/`export`, eliminates
dual build scripts, near-instant builds, incremental adoption.

### Trigger to re-evaluate

**When adding a feature that requires a new build capability** — TypeScript
source files, an npm client dependency, or dynamic imports. Or if the dual build
sync becomes a frequent source of bugs (it hasn't been recently).

---

## 3. Bug Patterns from Recent History

### What review caught (last ~10 commits)

| Commit    | Bug                                                               | Root cause                                                            |
| --------- | ----------------------------------------------------------------- | --------------------------------------------------------------------- |
| `c802f79` | Calibration prompt invisible                                      | CSS hide list included element that engine writes to                  |
| `c802f79` | Timer display blank for 200ms                                     | `startRoundTimer()` didn't init display before first interval tick    |
| `0d8d446` | Duplicate `quizHeaderTitle` key in els, conflicting render blocks | Engine refactor left two code paths setting same element              |
| `0d8d446` | Dead `questionCountEl` references                                 | Element removed from template but JS still referenced it              |
| `0d8d446` | Immediate round transition skipping feedback                      | Timer expiry during answered state didn't wait 600ms                  |
| `5863222` | Dead `rc` variable                                                | Leftover from deadline tracker removal                                |
| `5863222` | Escape race with 600ms feedback timeout                           | setTimeout not guarded against user pressing Escape                   |
| `5863222` | `.time-display` visible in round-complete                         | Missing from CSS hide list                                            |
| `d0aacf8` | Double warmup skip in calibration                                 | Warmup filter applied twice — once in recordPress, once in completion |
| `d7da70b` | Missing `.quiz-prompt` in fretboard modes                         | Template lacked element; engine silently wrote to null                |

### Patterns

1. **CSS hide list / JS render conflicts** (3 bugs): The most common class. CSS
   hides an element, but JS needs to write to it, or vice versa. Root cause: two
   systems controlling the same visibility without coordination. _Addressed by:
   completing the phase-class migration (layout-IA Phase 4)._

2. **Template / code drift** (2 bugs): Element removed from or missing in
   template, JS still references it. Silent failure (writes to null).
   _Mitigation: `render()` already null-checks (`if (els.foo) ...`). Could add a
   dev-mode warning when an expected element is missing._

3. **Timer/async edge cases** (2 bugs): setTimeout races with user input
   (Escape, double-submit). State captured in closure can be stale. _Mitigation:
   guard timeouts with state checks (already done in fixes)._

4. **Refactoring leftovers** (2 bugs): Dead variables, duplicate code paths from
   a feature rewrite that didn't fully clean up. _Mitigation: review checklist,
   `/review` command._

5. **Duplicated logic** (1 bug): Warmup filter in two places. _Mitigation:
   single-responsibility functions, tested independently._

### What's notable

- **All 10 bugs were caught in review, not by users.** The `/review` process and
  code-review workflow is effective.
- **No bugs from the state+render pattern itself.** The pure state transitions
  are well-tested and haven't produced incorrect states.
- **No bugs from the concatenation build.** No dependency ordering issues, no
  export stripping failures, no version sync bugs in this period.
- The bug-prone area is the **boundary between CSS visibility rules and JS
  render logic** — exactly what the layout-IA plan targets.

---

## 4. Summary: Issues, Opportunities, Triggers

### Issues (ordered by impact)

| # | Issue                                                                     | Severity | Status                                                |
| - | ------------------------------------------------------------------------- | -------- | ----------------------------------------------------- |
| 1 | Three competing visibility mechanisms (phase CSS, JS inline, HTML inline) | Medium   | Partially migrated; layout-IA Phase 4 finishes it     |
| 2 | Navigation uses inline `style.display` for mode switching                 | Low      | Should fold into layout-IA Phase 3-4                  |
| 3 | Mode-specific show/hide patterns inconsistent across modes                | Low      | Standardize when touching each mode                   |
| 4 | `render()` function is 125 lines with mixed concerns                      | Low      | Decompose into named helpers opportunistically        |
| 5 | `displayNote()` is an implicit global dependency                          | Low      | Accept for now; would be fixed by a bundler migration |
| 6 | Dual build script sync                                                    | Low      | Mitigated by `html-helpers.ts`; no recent bugs        |

### Opportunities

1. **Complete the phase-class CSS migration** (layout-IA Phase 4). This is the
   single highest-leverage architectural improvement. It eliminates the #1 bug
   source and simplifies every future UI change. It's already designed and
   planned.

2. **Navigation class-based visibility.** Small change, big win for consistency.
   Fold into layout-IA.

3. **JSDoc types** (architecture review Phase 5). `checkJs: true` in tsconfig
   would catch some of the "write to null element" bugs at edit time.
   Low-effort, no build change.

### Triggers to re-evaluate

| Trigger                         | What to reconsider                                                        |
| ------------------------------- | ------------------------------------------------------------------------- |
| Starting layout-IA Phase 3-4    | Finish phase-class migration, fix navigation, standardize mode visibility |
| Adding 5+ more quiz modes       | Whether concatenation order and dual build sync is still manageable       |
| Wanting TypeScript source files | Whether to adopt a bundler (esbuild)                                      |
| Adding an npm client dependency | Bundler becomes necessary                                                 |
| `render()` exceeding ~200 lines | Decompose into sub-renderers                                              |

### What NOT to do

- Don't adopt a framework (React, Svelte, etc.) — the app is too small and the
  state+render pattern gives the same benefits without the overhead.
- Don't adopt a bundler preemptively — the concatenation approach has no active
  bugs and the migration cost is real.
- Don't refactor `displayNote()` into a passed parameter everywhere — high
  churn, low benefit, would be mooted by a future bundler migration anyway.
- Don't split `render()` into separate files — it's one function in one file,
  readability is fine with internal structure/comments.
