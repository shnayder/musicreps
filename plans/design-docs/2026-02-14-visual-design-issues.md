# Visual Design Issues — Prioritized

**Date:** 2026-02-14 **Status:** All P1/P2/P3 issues addressed

---

## P1 (Accessibility / Usability) — DONE

### 1. Red/green heatmap

- **Was:** `--heatmap-1` through `--heatmap-5` used red-to-green HSL scale
- **Now:** Blue-to-amber sequential scale (`hsl(215,…)` → `hsl(38,…)`)
- **Files:** `src/styles.css` `:root`, `src/stats-display.js` fallbacks
- **Effort:** S

### 2. No `:focus-visible` styles

- **Was:** Keyboard navigation invisible — no outline on focused elements
- **Now:** `2px solid var(--color-brand)` outline with `2px` offset on all
  focusable elements. Mouse/touch users see no outline.
- **Files:** `src/styles.css` (focus-visible section)
- **Effort:** S

---

## P2 (Undermines Product Feel) — DONE

### 3. No visual identity

- **Was:** White background, system fonts, neutral grays — wireframe feel
- **Now:** Warm amber brand color, dark top bar, warm neutral grays, branded CTA
  buttons, quiz area card containment
- **Files:** `src/styles.css`, `main.ts`, `build.ts`
- **Effort:** M

### 4. Buttons lack visual weight

- **Was:** Flat buttons with no hover/active states, no shadow
- **Now:** All buttons have `:hover`, `:active`, and `transition` properties.
  CTA has shadow and brand color.
- **Files:** `src/styles.css`
- **Effort:** S

### 5. Hard-coded colors in SVG and CSS

- **Was:** `#333` × 4 in `fretboard.ts`, `#e8e8e8` in `.note-btn.accidental`,
  `rgba(0,0,0,0.3)` in `.nav-overlay`
- **Now:** SVG colors overridden via CSS (`.fretboard line`, `.note-circle`,
  `.note-text`) using `--color-fretboard-line`. Accidental button uses
  `--color-surface-accent`. Overlay uses `--color-overlay`.
- **Files:** `src/styles.css`, SVG inline attrs now serve as fallbacks only
- **Effort:** S

### 6. Quiz area lacks containment

- **Was:** Floating question and buttons with no visual grouping
- **Now:** `.quiz-area.active` gets `--color-surface` background, `12px`
  border-radius, `--space-5` padding
- **Files:** `src/styles.css`
- **Effort:** S

### 7. Top bar is bare

- **Was:** No background, blends into page, no visual weight
- **Now:** Dark `--color-topbar-bg` background, white text, negative margins to
  span full width
- **Files:** `src/styles.css`
- **Effort:** S

### 8. Start button same style as all buttons

- **Was:** Generic button styling, no CTA prominence
- **Now:** `.start-btn` gets brand amber bg, white text, shadow, hover/active
  states. `.stop-btn` and `.recalibrate-btn` get outlined secondary style.
- **Files:** `src/styles.css`
- **Effort:** S

---

## P3 (Inconsistency / Cosmetic) — DONE

### 9. Inconsistent spacing

- **Was:** 9+ ad-hoc gap/padding values
- **Now:** 6-step spacing scale (`--space-1` through `--space-6`) applied
  throughout
- **Files:** `src/styles.css`
- **Effort:** M

### 10. Typography scale drift

- **Was:** 15 distinct `font-size` values
- **Now:** 7-step type scale (`--text-xs` through `--text-2xl`) applied
  throughout
- **Files:** `src/styles.css`
- **Effort:** M

### 11. Plain navigation menu

- **Was:** Flat list of mode names, no grouping or visual hierarchy
- **Now:** Grouped by mode category with uppercase labels, brand amber
  left-border for active item
- **Files:** `src/styles.css`, `main.ts`, `build.ts`
- **Effort:** S

### 12. No hover states on desktop

- **Was:** No visual feedback on hover for most buttons/toggles
- **Now:** All buttons, toggles, and nav items have `:hover` styles with smooth
  transitions
- **Files:** `src/styles.css`
- **Effort:** S

### 13. Stats tables dense

- **Was:** `36×24px` cells, `0.3rem` padding, `2px` border-radius
- **Now:** `40×28px` cells, `0.4rem` padding, `4px` border-radius. Grid cells
  `30×24px` (up from `26×22px`).
- **Files:** `src/styles.css`
- **Effort:** S

### 14. Fretboard SVG basic

- **Was:** All lines `#333` hardcoded in SVG generation
- **Now:** CSS custom property `--color-fretboard-line` applied via CSS rules
  overriding inline presentation attributes. Warm neutral tone.
- **Files:** `src/styles.css`
- **Effort:** S

---

## P4 (Future / Low Priority)

### Dark mode support

Requires duplicating all color tokens under
`@media (prefers-color-scheme: dark)`.

### Fretboard SVG visual refinement

Depth, inlays, gradient effects. Cosmetic only.

### Micro-interactions

Tap scale, fade-in feedback. Enhancement only.

### ~~`prefers-reduced-motion`~~ DONE

Added `@media (prefers-reduced-motion: reduce)` that disables all transitions
and animations.
