# HTML + CSS Architecture Review

**Date:** 2026-02-13
**Status:** Review / recommendations

## Overall Assessment

The current setup is reasonable for what it is — a ~765-line CSS file driving 10
quiz modes with a consistent visual language. The JS-side architecture
(state+render, mode plugins, container scoping) is significantly ahead of the
HTML/CSS in terms of design discipline. The CSS works, but it's at the point
where adding the next few features will compound maintenance friction rather than
being free.

**Verdict:** Sound but beginning to strain. At the inflection point — the next
2-3 features will start exposing these seams.

---

## Issues (by impact)

### 1. ~700-line HTML template duplicated in main.ts and build.ts

Both files contain identical 696-line HTML templates. Any change requires
updating both. CLAUDE.md warns about it but that's a manual check — no
mechanism to verify sync.

**Severity:** High — already a tax on every feature.

### 2. Per-mode HTML boilerplate: ~25 lines × 10 modes

Every mode repeats an identical scaffold (stats controls, quiz controls,
mastery message, start/stop/recalibrate buttons, quiz header, session stats,
progress bar). That's ~250 lines of identical structure. The
`answer-buttons-notes` 12-button block is repeated 7 times.

Adding a new shared element (streak indicator, session timer, etc.) requires
10 edits in 2 files = 20 changes.

**Severity:** Medium-high. Main source of error-prone feature work.

### 3. No CSS custom properties for the color palette

The codebase uses a consistent but entirely hardcoded color system:

| Role | Values in use |
|------|---------------|
| Success green | `#4CAF50`, `#388E3C`, `#2e7d32`, `green` (keyword) |
| Error red | `#f44336`, `#c62828`, `red` (keyword) |
| Highlight | `#FFD700` |
| Recommended | `#FF9800` |
| Text | `#333`, `#666`, `#999`, `#aaa` |
| Surfaces | `#fff`, `#f5f5f5`, `#f9f9f9`, `#f0f0f0`, `#eee` |
| Borders | `#999`, `#ccc`, `#ddd` |
| Heatmap | `hsl(0-120, 60%, 65%)` — 5 levels, repeated in 3-4 places |
| Chord-slot blue | `#2196F3`, `#e3f2fd` |

Four distinct "greens" and three distinct "reds" make the UI cohesive by
accident rather than design. Theme changes (or even just normalizing) require
grep-and-pray across CSS and JS.

**Severity:** Medium.

### 4. Inline `style="display: none"` as the visibility mechanism

~60 `.style.display` assignments across JS control element visibility
imperatively. The display value varies (`''`, `'block'`, `'flex'`, `'inline'`,
`'grid'`) — each element must know its own "visible" display type. Initial
`style="display: none"` in HTML can't be overridden by classes without
`!important`.

The centralized `renderState()` in quiz-engine keeps this manageable, but it's a
recurring papercut when adding new UI elements.

**Severity:** Low-medium.

### 5. Heatmap color scale duplicated 3-4 times

The 5-level HSL scale appears in:
1. `stats-display.js` getAutomaticityColor() function
2. `stats-display.js` retention legend HTML
3. `stats-display.js` speed legend HTML
4. `quiz-speed-tap.js` speed tap legend HTML

Functions and legends use the same colors but aren't connected.

**Severity:** Low-medium.

### 6. Speed Tap has its own parallel renderState()

~70 lines of `.style.display` assignments in showIdle/startSession/stopSession
that parallel but don't use quiz-engine's renderState().

**Severity:** Low.

### 7. No spacing scale

Gap values in active use: 2px, 0.2rem, 0.25rem, 0.3rem, 0.4rem, 0.5rem,
0.75rem, 1rem, 1.5rem. Some are intentional; others look like drift.

**Severity:** Low.

---

## Recommendations (prioritized)

### Do soon (high leverage, low risk)

**1. Extract the shared mode scaffold into a build-time helper.**

Something like `modeBlock(id, settingsHTML, quizAreaHTML)` that generates the
common wrapper — same pattern already used for `fretLines()` etc. Reduces
per-mode boilerplate from ~60 lines to ~5, makes it impossible for the 10
copies to drift.

**2. Introduce CSS custom properties for the core palette.**

```css
:root {
  --color-success: #4CAF50;
  --color-success-dark: #388E3C;
  --color-success-bg: #e8f5e9;
  --color-success-text: #2e7d32;
  --color-error: #f44336;
  --color-error-bg: #ffebee;
  --color-error-text: #c62828;
  --color-highlight: #FFD700;
  --color-recommended: #FF9800;
  --color-active: #2196F3;      /* chord-slot focus blue */
  --color-active-bg: #e3f2fd;
  --color-text: #333;
  --color-text-muted: #666;
  --color-text-light: #999;
  --color-border: #ccc;
  --color-border-heavy: #999;
  --color-surface: #f5f5f5;
  --color-surface-alt: #eee;
}
```

Reference in CSS; pass to JS via `getComputedStyle` where needed. Mechanical
refactor, no behavior changes.

**3. Consolidate the heatmap color scale** into a single array constant that
both the color functions and legend builders read from.

### Do when convenient (medium leverage)

**4. Move to class-based visibility** for shared scaffold elements. A
`.hidden { display: none !important }` utility class or `data-visible-when`
pattern would eliminate most `.style.display` assignments.

**5. Normalize the green/red families.** Pick two greens (bg + text) and two
reds, use consistently through variables.

### Not yet needed

**6. Formal spacing scale, design tokens, component abstractions.** The app is
small enough that these would be overhead. Revisit if CSS passes ~1200 lines or
a genuinely new UI pattern is added (settings panel, user accounts, etc.).

---

## Bottom Line

The app doesn't need a CSS framework, design system, or component library. It
needs its existing implicit patterns (the color palette, the mode scaffold, the
visibility mechanism) made explicit so they can be maintained as the number of
modes and features grows. Items 1-3 are low-risk mechanical refactors that would
make the next 5 features land cleanly instead of each being a slightly risky
20-edit change.
