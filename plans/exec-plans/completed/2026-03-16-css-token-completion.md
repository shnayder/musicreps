# CSS Token Completion + File Organization

Mechanical cleanup: tokenize remaining hardcoded values in `src/styles.css` and
add section organization. No visual changes — every token replacement must be
value-identical to the original.

Source: items 4 and 5 from
[design system review](../design-docs/2026-03-16-design-system-review.md).

## Problem / Context

`styles.css` has 95%+ token coverage for colors, typography, spacing, and
border-radius. The remaining 5% — shadows, transitions, opacities, z-index,
font-weights, and a handful of raw px/rem values — are hardcoded inline. The
file also lacks a navigable structure (no TOC, inconsistent section headers).

This is purely infrastructure work. It unblocks the recipe system (design review
item 1) by giving recipes concrete token names to reference.

## Design

### New tokens in `:root`

Add after the existing `--size-content-inset` line (line 89):

```css
/* Elevation (box-shadow) */
--shadow-sm: 0 1px 4px rgba(0, 0, 0, 0.1);
--shadow-md: 0 2px 8px rgba(0, 0, 0, 0.12);
--shadow-lg: 0 4px 12px rgba(0, 0, 0, 0.12);
--shadow-hover: 0 3px 12px rgba(0, 0, 0, 0.18);

/* Transition timing */
--duration-fast: 0.1s;
--duration-base: 0.15s;
--duration-slow: 0.3s;
--duration-linear: 0.2s;

/* Opacity states */
--opacity-disabled: 0.5;
--opacity-dimmed: 0.4;
--opacity-pressed: 0.8;
--opacity-subtle: 0.3;

/* Z-index scale */
--z-raised: 1;
--z-popover: 100;

/* Font weights */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;

/* Touch target minimum (WCAG AA) */
--size-touch-target: 44px;
```

### Replacement rules

Each replacement is value-identical. No visual diff.

#### Shadows (6 replacements)

| Line | Selector | Old | New |
|------|----------|-----|-----|
| 978 | `.group-skip-menu` | `box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12)` | `box-shadow: var(--shadow-lg)` |
| 1110 | `.start-btn` | `box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12)` | `box-shadow: var(--shadow-md)` |
| 1116 | `.start-btn:hover` | `box-shadow: 0 3px 12px rgba(0, 0, 0, 0.18)` | `box-shadow: var(--shadow-hover)` |
| 1120 | `.start-btn:active` | `box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1)` | `box-shadow: var(--shadow-sm)` |
| 2087 | `.start-btn:focus-visible` | `box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12), ...` | `box-shadow: var(--shadow-md), 0 0 0 4px rgba(209, 147, 27, 0.3)` |

**Do NOT tokenize** these special-purpose shadows:
- Line 1503 `.split-note-pending` — ring outline, not elevation
- Line 1662 `.calibration-target` — green glow, semantically different
- Line 1844 `.kb-match` — ring outline, not elevation
- Lines 1126, 1132 — `box-shadow: none` (already correct)

#### Transitions (19 replacements)

Replace duration literals with `var(--duration-*)`. The `transition` shorthand
includes both duration and easing, so the token covers only the duration; the
easing function (`ease` or `linear`) stays literal since CSS `transition`
shorthand doesn't support variable substitution for the timing function alone.

Pattern: `transition: background 0.15s ease` → `transition: background var(--duration-base) ease`

Apply to all 19 transition declarations:
- 14 instances using `0.15s ease` → `var(--duration-base) ease`
- 2 instances using `0.1s ease` → `var(--duration-fast) ease`
- 1 instance using `0.3s ease` → `var(--duration-slow) ease`
- 1 instance using `0.2s linear` → `var(--duration-linear) linear`
- 1 mixed `.start-btn`: `0.15s ease` for bg/shadow, `0.1s ease` for transform

Full list with line numbers:

| Line | Selector | Duration to replace |
|------|----------|-------------------|
| 172 | `.home-tab` | `0.15s` → `var(--duration-base)` |
| 608 | `.settings-toggle-btn` | `0.15s ease` → `var(--duration-base) ease` |
| 676 | `.mode-tab` | `0.15s ease` → `var(--duration-base) ease` |
| 840 | `.distance-toggle` | `0.15s ease` → `var(--duration-base) ease` |
| 875 | `.string-toggle` | `0.15s ease` → `var(--duration-base) ease` |
| 902 | `.string-toggle:active` | `0.15s ease` → `var(--duration-base) ease` |
| 1022 | `.string-toggle.active` | `0.15s ease` → `var(--duration-base) ease` |
| 1068 | `.fretboard svg` | `0.15s` → `var(--duration-base)` |
| 1111 | `.start-btn` | `0.15s ease` + `0.1s ease` → `var(--duration-base) ease` + `var(--duration-fast) ease` |
| 1157 | `.quiz-countdown-fill` | `0.2s linear` → `var(--duration-linear) linear` |
| 1210 | `.quiz-header-close` | `0.15s ease` → `var(--duration-base) ease` |
| 1236 | `.progress-fill` | `0.3s ease` → `var(--duration-slow) ease` |
| 1409 | `.note-btn` | `0.15s ease` + `0.1s ease` → `var(--duration-base) ease` + `var(--duration-fast) ease` |
| 1464 | `.split-note-row-accidentals` | `0.15s ease` → `var(--duration-base) ease` |
| 1483 | `.split-note-btn` | `0.1s` + `0.15s` → `var(--duration-fast)` + `var(--duration-base)` |
| 1552 | `.split-note-pending` | `0.15s` → `var(--duration-base)` |
| 1603 | `.answer-btn` | `0.15s ease` + `0.1s ease` → `var(--duration-base) ease` + `var(--duration-fast) ease` |
| 1680 | `.calibration-action-btn` | `0.15s ease` → `var(--duration-base) ease` |
| 2037 | `.seq-slot` | `0.15s ease` → `var(--duration-base) ease` |

#### Opacities (10 replacements)

Only replace semantic states. Leave `opacity: 1` and `opacity: 1 !important`
alone — those are overrides to restore full opacity, not states.

| Line | Selector | Old | New |
|------|----------|-----|-----|
| 263 | `.track-accordion-header:active` | `0.8` | `var(--opacity-pressed)` |
| 621 | `.settings-toggle-btn:active` | `0.8` | `var(--opacity-pressed)` |
| 930 | `.distance-toggle.skipped` | `0.4` | `var(--opacity-dimmed)` |
| 941 | `.group-progress-bar.skipped` | `0.3` | `var(--opacity-subtle)` |
| 1436 | `.note-btn:disabled` | `0.5` | `var(--opacity-disabled)` |
| 1467 | `.split-note-acc-hidden` | `0.3` | `var(--opacity-subtle)` |
| 1492 | `.split-note-btn:disabled` | `0.4` | `var(--opacity-dimmed)` |
| 1506 | `.split-note-dimmed` | `0.4` | `var(--opacity-dimmed)` |
| 1624 | `.answer-btn:disabled` | `0.5` | `var(--opacity-disabled)` |
| 1847 | `.kb-dimmed` | `0.4` | `var(--opacity-dimmed)` |

**Decision: normalize split-note disabled?** `.split-note-btn:disabled` uses
`0.4` while other disabled buttons use `0.5`. This maps to `--opacity-dimmed`
vs `--opacity-disabled`. Keep the distinction for now — split-note buttons are
smaller and need less dimming to remain legible. The token names make the
intentional difference visible.

**Do NOT tokenize:**
- `opacity: 0.9` at line 1771 (`.page-action-btn:hover`) — this is a hover
  micro-interaction, not a semantic state
- `opacity: 1` / `1 !important` lines — these are override resets

#### Z-index (2 replacements)

| Line | Selector | Old | New |
|------|----------|-----|-----|
| 299 | `.skill-card-star` | `z-index: 1` | `z-index: var(--z-raised)` |
| 974 | `.group-skip-menu` | `z-index: 100` | `z-index: var(--z-popover)` |

#### Font weights (57 replacements)

Replace all numeric `font-weight` values:

- `font-weight: 400` → `font-weight: var(--font-normal)` (3 instances)
- `font-weight: 500` → `font-weight: var(--font-medium)` (13 instances)
- `font-weight: 600` → `font-weight: var(--font-semibold)` (34 instances)
- `font-weight: 700` → `font-weight: var(--font-bold)` (6 instances)
- `font-weight: bold` → `font-weight: var(--font-bold)` (1 instance, line 1093)

Use `replace_all` for each value since the mapping is unambiguous.

#### Hardcoded border-radius (1 replacement)

| Line | Selector | Old | New |
|------|----------|-----|-----|
| 936 | `.group-progress-bar` | `border-radius: 4px` | `border-radius: var(--radius-sm)` |

Leave `border-radius: 999px` (pill) and `border-radius: 0` (rectangular) as-is.

#### Hardcoded font-size (1 replacement)

| Line | Selector | Old | New |
|------|----------|-----|-----|
| 955 | `.group-skip-btn` | `font-size: 14px` | `font-size: var(--text-sm)` |

Leave these as-is:
- Line 2176 mobile `.quiz-prompt` `1.6rem` — between `--text-xl` (1.5rem) and
  `--text-2xl` (2rem). Intentional mobile size. Acceptable exception.
- Line 2192 `input, button` `16px` — iOS zoom prevention hack. Must stay literal.

#### Touch target sizing (7 replacements)

Replace all `44px` min-height/min-width values:

| Line | Selector | Property | New |
|------|----------|----------|-----|
| 443 | `.text-link` | `min-height: 44px` | `min-height: var(--size-touch-target)` |
| 480 | `.mode-close-btn` | `min-width: 44px` | `min-width: var(--size-touch-target)` |
| 481 | `.mode-close-btn` | `min-height: 44px` | `min-height: var(--size-touch-target)` |
| 558 | `.settings-close-btn` | `min-width: 44px` | `min-width: var(--size-touch-target)` |
| 559 | `.settings-close-btn` | `min-height: 44px` | `min-height: var(--size-touch-target)` |
| 1201 | `.quiz-header-close` | `min-width: 44px` | `min-width: var(--size-touch-target)` |
| 1202 | `.quiz-header-close` | `min-height: 44px` | `min-height: var(--size-touch-target)` |

### CSS file organization

Add a table of contents comment block at the very top of the file (before
`:root`), and normalize existing section headers to a consistent format.

**Table of contents:**

```css
/*
 * Music Reps — Stylesheet
 *
 * Table of contents:
 *
 *   1. TOKENS ................. Custom properties (:root)
 *   2. BASE ................... Body, reset, scrollbar
 *   3. HOME SCREEN ........... Title, tabs, skill cards, tracks, footer
 *   4. MODE CHROME ........... Top bar, close buttons, tabs, settings
 *   5. PRACTICE CARD ......... Status, scope, suggestion, action zone
 *   6. PROGRESS TAB .......... Baseline info, group progress toggles
 *   7. FRETBOARD ............. SVG, note filter toggles
 *   8. QUIZ SESSION .......... Countdown bar, session info, quiz area
 *   9. QUIZ CONTENT .......... Prompt, round complete, feedback display
 *  10. ANSWER BUTTONS ........ Notes, split-notes, numbers, intervals, etc.
 *  11. BUTTON FEEDBACK ....... Correct/wrong/reveal, keyboard narrowing
 *  12. CALIBRATION ........... Speed check highlight, action buttons
 *  13. TEXT ROLES ............ Type hierarchy recipe classes
 *  14. UTILITIES ............. SR-only, focus-visible, keyboard hint
 *  15. PAGE ACTIONS .......... Next, keep going, stop (shared base)
 *  16. STATS ................. Tables, grids, heatmap legend
 *  17. SEQUENTIAL SLOTS ...... Chord spelling multi-input
 *  18. REDUCED MOTION ........ prefers-reduced-motion overrides
 *  19. MOBILE LAYOUT ......... max-width: 599px overrides
 */
```

**Section header format** — normalize all existing headers to:
```css
/* ==========================================================================
   7. FRETBOARD
   ========================================================================== */
```

This is a formatting change only. Do not reorder rules — keep them in their
current positions. Just add the TOC at the top and upgrade existing
`/* --- Foo --- */` headers to the numbered format. Group adjacent
sub-headers under the same section number (e.g., "Note buttons", "Split note
buttons", and "Answer buttons grid" all fall under section 10).

## Implementation Steps

1. **Add TOC and section headers.** Format-only change. Verify `deno task build`
   produces identical output (ignoring comments, since CSS is inlined and
   comments are stripped by esbuild).

2. **Add new tokens to `:root`.** Insert after line 89. No other changes.
   Verify `deno task ok`.

3. **Replace shadows.** 6 replacements. Verify `deno task ok`.

4. **Replace transitions.** 19 replacements. Verify `deno task ok`.

5. **Replace opacities.** 10 replacements. Verify `deno task ok`.

6. **Replace z-index, border-radius, font-size, touch targets.** 11
   replacements. Verify `deno task ok`.

7. **Replace font-weights.** 57 replacements (use `replace_all` per value).
   Verify `deno task ok`.

8. **Update `guides/design/visual-design.md`.** Add new token categories:
   Elevation, Transitions, Opacity States, Z-Index, Font Weights, Touch Target.

Steps 1-7 can be one commit each or batched. Step 8 is a separate docs commit.

## Files Modified

| File | Changes |
|------|---------|
| `src/styles.css` | Add TOC, section headers, new tokens, replace ~103 hardcoded values |
| `guides/design/visual-design.md` | Document new token categories |

## Testing

- `deno task ok` after each step (lint, format, type-check, test, build)
- Visual spot-check: `deno task dev`, navigate through 2-3 modes, confirm no
  visual differences. The replacements are value-identical so this is a sanity
  check, not a detailed review.
- `deno task iterate capture` before and after for pixel-identical confirmation
  (if an iterate session exists for relevant states)

## Implementation Notes (added after completion)

- All steps completed in a single pass. `deno task ok` passes (242 tests, build
  succeeds).
- The formatter (`deno fmt`) automatically broke long transition lines into
  multi-line format — this is expected and correct.
- Two opacity values not in the plan were tokenized during implementation:
  `.answer-input:disabled` → `var(--opacity-disabled)` and
  `.page-action-btn:active` → `var(--opacity-pressed)`.
- The `font-size: 14px` → `var(--text-sm)` replacement at `.group-skip-btn` is
  not value-identical (14px vs 0.85rem ≈ 13.6px at default root size), but the
  plan explicitly called for it. The difference is sub-pixel and imperceptible.
- Section 5 in the plan listed 6 shadow replacements but there were actually 5
  unique shadow values to replace (the focus-visible one was a partial replace,
  keeping the ring portion literal).
