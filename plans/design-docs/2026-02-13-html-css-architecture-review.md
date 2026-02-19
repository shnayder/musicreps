# HTML + CSS Architecture Review

**Date:** 2026-02-13 **Status:** Partially implemented — 4 of 7 issues resolved

## Overall Assessment

The current setup is reasonable for what it is — a ~765-line CSS file driving 10
quiz modes with a consistent visual language. The JS-side architecture
(state+render, mode plugins, container scoping) is significantly ahead of the
HTML/CSS in terms of design discipline. The CSS works, but it's at the point
where adding the next few features will compound maintenance friction rather
than being free.

**Verdict:** Sound but beginning to strain. At the inflection point — the next
2-3 features will start exposing these seams.

**Update:** The three highest-leverage items have been implemented, along with
heatmap consolidation. Net result: **-769 lines** across the codebase, all 323
tests passing. Template drift between main.ts and build.ts is now structurally
impossible, colors are defined once in CSS `:root`, and the heatmap scale is a
single source of truth.

---

## Issues (by impact)

### 1. ~~\~700-line HTML template duplicated in main.ts and build.ts~~ RESOLVED

Both files contained identical 696-line HTML templates. Any change required
updating both. CLAUDE.md warned about it but that was a manual check — no
mechanism to verify sync.

**Severity:** High — already a tax on every feature.

**Resolution:** Created `src/html-helpers.ts` with shared build-time helpers
(`modeScreen()`, `noteAnswerButtons()`, `numberButtons()`,
`intervalAnswerButtons()`, `keysigAnswerButtons()`, `degreeAnswerButtons()`,
`numeralAnswerButtons()`, `countdownAndPrompt()`, `feedbackBlock()`). Both
`main.ts` and `build.ts` now import and call the same functions. Template drift
is structurally impossible. `main.ts` reduced from ~770 to ~345 lines.

### 2. ~~Per-mode HTML boilerplate: \~25 lines × 10 modes~~ RESOLVED

Every mode repeated an identical scaffold (stats controls, quiz controls,
mastery message, start/stop/recalibrate buttons, quiz header, session stats,
progress bar). That was ~250 lines of identical structure. The
`answer-buttons-notes` 12-button block was repeated 7 times.

**Severity:** Medium-high. Main source of error-prone feature work.

**Resolution:** The `modeScreen(id, opts)` function in `src/html-helpers.ts`
generates the full shared scaffold. Each mode now specifies only what's unique
(settings HTML, quiz-area content, optional before-quiz-area block, session
unit). Adding a new shared element requires one edit in `modeScreen()` instead
of 10 edits in 2 files.

### 3. ~~No CSS custom properties for the color palette~~ RESOLVED

The codebase used a consistent but entirely hardcoded color system across CSS
and JS. Four distinct "greens" and three distinct "reds" made the UI cohesive by
accident rather than design.

**Severity:** Medium.

**Resolution:** Added 30+ CSS custom properties to `:root` in `src/styles.css`:

```css
:root {
  --color-success: #4CAF50;
  --color-success-dark: #388E3C;
  --color-success-bg: #e8f5e9;
  --color-success-text: #2e7d32;
  --color-error: #f44336;
  --color-error-bg: #ffebee;
  --color-error-text: #c62828;
  --color-focus: #2196F3;
  --color-focus-bg: #e3f2fd;
  --color-recommended: #FF9800;
  --color-highlight: #FFD700;
  --color-text: #333;
  --color-text-muted: #666;
  --color-text-light: #999;
  --color-bg: #fff;
  --color-surface: #f5f5f5;
  --color-surface-hover: #f0f0f0;
  --color-surface-alt: #eee;
  --color-surface-pressed: #d0d0d0;
  --color-border: #999;
  --color-border-light: #ccc;
  --color-border-lighter: #ddd;
  --heatmap-none: #ddd;
  --heatmap-1 through --heatmap-5: hsl(0-120, 60%, 65%);
}
```

All CSS rules reference `var(--color-*)`. JS reads colors via `getComputedStyle`
with hardcoded fallbacks for Node.js test environments. Created
`guides/design/colors.html` as a live color reference page that reads the actual
CSS variables at page load.

### 4. Inline `style="display: none"` as the visibility mechanism

~60 `.style.display` assignments across JS control element visibility
imperatively. The display value varies (`''`, `'block'`, `'flex'`, `'inline'`,
`'grid'`) — each element must know its own "visible" display type. Initial
`style="display: none"` in HTML can't be overridden by classes without
`!important`.

The centralized `renderState()` in quiz-engine keeps this manageable, but it's a
recurring papercut when adding new UI elements.

**Severity:** Low-medium. **Status: Open.**

### 5. ~~Heatmap color scale duplicated 3-4 times~~ RESOLVED

The 5-level HSL scale appeared in:

1. `stats-display.js` getAutomaticityColor() function
2. `stats-display.js` retention legend HTML
3. `stats-display.js` speed legend HTML
4. `quiz-speed-tap.js` speed tap legend HTML

**Severity:** Low-medium.

**Resolution:** Consolidated into `heatmapColors()` cached singleton in
`stats-display.js` that reads CSS `--heatmap-*` variables with hardcoded
fallbacks for test environments. Added `buildStatsLegend(statsMode, baseline)`
shared function used by both stats-display and quiz-speed-tap. A `cssVar(name)`
helper uses try/catch for Node.js compatibility. The speed tap legend went from
8 hardcoded lines to a single `buildStatsLegend()` call.

### 6. Speed Tap has its own parallel renderState()

~70 lines of `.style.display` assignments in showIdle/startSession/stopSession
that parallel but don't use quiz-engine's renderState().

**Severity:** Low. **Status: Open.**

### 7. No spacing scale

Gap values in active use: 2px, 0.2rem, 0.25rem, 0.3rem, 0.4rem, 0.5rem, 0.75rem,
1rem, 1.5rem. Some are intentional; others look like drift.

**Severity:** Low. **Status: Open.**

---

## Recommendations (prioritized)

### Done (high leverage)

**1. ~~Extract the shared mode scaffold into a build-time helper.~~** DONE.
`src/html-helpers.ts` provides `modeScreen()` and reusable button block helpers.

**2. ~~Introduce CSS custom properties for the core palette.~~** DONE. 30+
variables in `:root`, all CSS rules updated, JS reads via `getComputedStyle`.

**3. ~~Consolidate the heatmap color scale.~~** DONE. Single `heatmapColors()`
source of truth, shared `buildStatsLegend()`.

### Do when convenient (medium leverage)

**4. Move to class-based visibility** for shared scaffold elements. A
`.hidden { display: none !important }` utility class or `data-visible-when`
pattern would eliminate most `.style.display` assignments. (Issue 4)

**5. ~~Normalize the green/red families.~~** DONE (via CSS custom properties).
The `--color-success-*` and `--color-error-*` families are now explicit semantic
tokens. The former "chord-slot blue" is `--color-focus` / `--color-focus-bg`.

### Not yet needed

**6. Formal spacing scale, design tokens, component abstractions.** The app is
small enough that these would be overhead. Revisit if CSS passes ~1200 lines or
a genuinely new UI pattern is added (settings panel, user accounts, etc.).
(Issues 6, 7)

---

## New artifacts created

| File                        | Purpose                                           |
| --------------------------- | ------------------------------------------------- |
| `src/html-helpers.ts`       | Build-time HTML scaffold and button block helpers |
| `guides/design/colors.html` | Live color system reference (reads CSS variables) |

---

## Bottom Line

The three highest-leverage items are done. Template duplication is eliminated,
colors are defined once, and the heatmap scale is consolidated. The remaining
open items (class-based visibility, Speed Tap renderState, spacing scale) are
low-severity and can be addressed opportunistically. The codebase is now well
positioned for adding new modes and features without the previous 20-edit-per-
change friction.
