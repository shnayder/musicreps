# Fretboard Stats Page UX Refactor — Execution Plan

## Context

The fretboard mode idle screen mixed too many concerns on one screen: progress
visualization, analysis mode switching (Recall/Speed), practice configuration
(string toggles, naturals-only), session launching, and calibration. This
violated several UX principles: no single dominant user task, weak action
hierarchy, encoding complexity exceeding perceptual simplicity, and missing
narrative flow.

This plan covers:

1. Establishing design principles for the whole app
2. Creating wireframe-level IA documentation
3. Refactoring fretboard modes (guitar + ukulele) as the first implementation

## Design Principles Added

Seven new principles merged into `guides/design/layout-and-ia.md`:

| #  | Principle                          | Key idea                                                   |
| -- | ---------------------------------- | ---------------------------------------------------------- |
| 11 | One screen = one primary intention | Separate observe/configure/run behind tabs or disclosure   |
| 12 | Visualize, don't decode            | Direct labels > legend lookup; 3–4 color states max        |
| 13 | Action gravity                     | Primary CTA visually obvious; config leads to action       |
| 14 | One interaction grammar            | Tabs ≠ pills ≠ toggles ≠ buttons; distinct styles per role |
| 15 | Data abstraction before detail     | Summary → group breakdown → item detail                    |
| 16 | State should explain itself        | Every highlight answers "why this?" inline                 |
| 17 | Spatial rhythm                     | Consistent section spacing, no dense→empty jumps           |

Open questions flagged for later review:

- Whether math grids need 5-level heatmaps or simplified 3-level at distance
- Whether string toggles should become chips and Recall/Speed a segmented tab

## Wireframe IA Documentation

Created `guides/design/wireframes/` folder with `fretboard.md` as the first
entry. Documents the Practice/Progress tab structure, phase visibility matrix,
and design decision rationale. Other modes to be added later as they're
refactored.

## Implementation: Fretboard Tab Refactor

### New HTML scaffold (`src/html-helpers.ts`)

Added `idleHTML` option to `modeScreen()`. When provided, it replaces the
standard `stats-section` + `quiz-config` with custom idle-phase content.
Non-fretboard modes are unaffected — they still use the standard scaffold.

Added `fretboardIdleHTML()` helper that generates:

```
mode-tabs (Practice | Progress)
tab-practice
  ├── practice-summary
  │    ├── practice-status (label + detail)
  │    ├── practice-recommendation (text + "Use recommendation" button)
  │    └── practice-string-chips (colored per-string mastery)
  ├── practice-scope
  │    ├── string toggles
  │    └── naturals-only checkbox
  ├── practice-start
  │    ├── session-summary-text ("3 strings · natural notes · 60s")
  │    ├── mastery-message
  │    └── start-btn (primary CTA)
  └── practice-advanced (<details>, collapsed)
       └── recalibrate-btn
tab-progress
  ├── stats-controls (Recall/Speed toggle)
  └── stats-container (legend, rendered dynamically)
```

### Fretboard SVG placement

The fretboard SVG lives **outside** the tab content divs (via `beforeQuizArea`)
because it serves dual purpose:

- **Progress tab (idle):** shows heatmap colors
- **Active quiz:** shows highlighted question position

Visibility is managed via the existing `fretboard-hidden` class:

- Practice tab active → SVG hidden
- Progress tab active → SVG visible with heatmap
- Active quiz → SVG visible (shows question)
- Calibration/round-complete → SVG hidden (existing CSS rules)

### CSS additions (`src/styles.css`)

Phase-driven visibility for tabs:

```css
.phase-active .mode-tabs, .phase-active .tab-content {
  display: none;
}
.phase-calibration .mode-tabs, .phase-calibration .tab-content {
  display: none;
}
.phase-round-complete .mode-tabs, .phase-round-complete .tab-content {
  display: none;
}
```

New component styles: `.mode-tabs`, `.mode-tab`, `.tab-content`,
`.practice-summary`, `.practice-status`, `.practice-recommendation`,
`.practice-rec-btn`, `.practice-string-chips`, `.string-chip`,
`.practice-scope`, `.practice-start`, `.session-summary-text`,
`.practice-advanced`.

### JS refactor (`src/quiz-fretboard.js`)

Key additions to `createFrettedInstrumentMode()`:

- **Tab state + switching:** `activeTab` variable, `switchTab(tabName)` toggles
  `.active` classes on tabs and content, shows/hides fretboard, triggers heatmap
  render or practice summary as appropriate.

- **Practice summary rendering:** `renderPracticeSummary()` computes:
  - Overall status label (Ready to start / Getting started / Building / Solid /
    Strong) based on % of all positions fluent
  - Fluent count across all positions (not just enabled)
  - Recommendation text from `computeRecommendations()` with string names
  - Per-string mastery chips colored by average automaticity

- **Session summary:** `renderSessionSummary()` shows "N strings · natural/all
  notes · 60s"

- **Recommendation action:** "Use recommendation" button calls
  `applyRecommendations()` then `refreshUI()`

- **Fretboard visibility management:** `showFretboard()` / `hideFretboard()`
  manage the `fretboard-hidden` class. Called from tab switching, `onStart()`,
  and `onStop()`.

- **`onStart()`:** Now calls `showFretboard()` so the SVG is visible during quiz
  even if the user was on the practice tab.

- **`onStop()`:** Restores tab-appropriate state — shows fretboard + heatmap if
  on progress tab, hides it if on practice tab.

- **`init()`:** Starts on practice tab (fretboard hidden), renders initial
  summary and session text.

### Engine compatibility

The quiz engine queries DOM elements by class name within the mode container.
All required elements (`.start-btn`, `.mastery-message`, `.recalibrate-btn`,
`.stats-container`, `.stats-toggle-btn`, `.stats`, etc.) exist in the new HTML
structure at the same nesting level the engine expects. No engine changes were
needed.

`createStatsControls()` still works because `.stats-container` and
`.stats-toggle-btn` elements exist in the progress tab. The controls render the
heatmap + legend into `.stats-container` regardless of tab visibility.

### What was NOT changed

- **Other quiz modes:** All non-fretboard modes use the standard
  `stats-section` + `quiz-config` scaffold unchanged.
- **No new functionality:** Everything tagged "(future)" in the wireframe spec
  was excluded. This is a reorganization of existing features.
- **Quiz engine:** No changes to `quiz-engine.js` or `quiz-engine-state.js`.
- **Adaptive/recommendations:** Algorithm unchanged; only the UI for displaying
  recommendations changed.
- **Tests:** All 438 existing tests pass. No new tests needed — the changes are
  DOM structure and JS wiring, not new pure logic.

## Build & version

- Version bumped v4.4 → v4.5 in both `main.ts` and `build.ts`
- Both build scripts updated identically (imports + fretboard mode calls)
- Build succeeds, all tests pass

## Follow-up work

- [ ] Visual polish: refine spacing, typography, component styling for tabs and
      summary card after seeing it in the browser
- [ ] Other modes: apply similar tab-based organization if appropriate
- [ ] String chips: consider making them interactive (tap to toggle that string)
- [ ] Address open questions in design principles (heatmap levels, component
      grammar for toggles vs chips)
- [ ] Consider adding per-string fluent counts to the chips tooltip
