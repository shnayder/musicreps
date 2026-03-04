# Tailwind Migration Evaluation

**Date:** 2026-03-04 **Status:** Decision — not pursuing now

## Context

`styles.css` is 1,703 lines and growing. Question: move styling into components
via Tailwind, keeping shared design-system variables (colors, spacing, font
sizes) as CSS custom properties mapped to Tailwind config.

## Current State

- **Single monolithic CSS file** — 85% component-scoped selectors, 15%
  utilities
- **Well-defined design system** — ~60 CSS custom properties (colors, heatmap,
  typography, spacing, border-radius) in `:root`
- **Hardcoded class strings in TSX** — `'answer-btn answer-btn-note'` style,
  with string concatenation for conditionals
- **Dual rendering** — build-time HTML (`html-helpers.ts`) and Preact components
  emit identical class names for style parity
- **Runtime color reading** — `getComputedStyle()` reads heatmap CSS vars for
  dynamic cell coloring in stats displays
- **CSS inlined** — esbuild bundles JS; CSS is read and dropped into a `<style>`
  tag. No external stylesheets.

## Pros of Tailwind

1. **Co-location** — styles live next to the markup that uses them. No jumping
   between `.tsx` and a 1,700-line CSS file to understand what a component looks
   like.

2. **Dead CSS elimination** — Tailwind only emits classes actually used. Today
   there's no easy way to know which selectors in `styles.css` are still
   referenced.

3. **Design system enforcement** — Tailwind config becomes the single source of
   truth for the token palette. Deviations (magic numbers, one-off colors) are
   immediately visible as `[arbitrary values]` in the markup.

4. **Smaller mental surface** — contributors don't need to learn the project's
   BEM-ish naming conventions. Tailwind classes are a shared vocabulary.

5. **Responsive / state variants for free** — `hover:`, `focus:`, `sm:`, etc.
   without writing new selectors. Currently each hover/focus state is a
   hand-written rule.

6. **Stops CSS growth** — new components don't add CSS lines. The file stops
   growing.

## Cons of Tailwind

1. **Dual rendering is the hard part** — `html-helpers.ts` and `fretboard.ts`
   generate static HTML at build time with class names that must match the Preact
   components. Both sides need to emit the same Tailwind utility strings. Any
   drift = visual bugs. This is the single biggest risk.

2. **Verbose markup** — `class="flex items-center gap-2 px-4 py-2 rounded-md
   bg-surface text-sm text-text-muted hover:bg-surface-hover"` in every
   component. Readability tradeoff, especially for the complex piano-key grid
   layout (nth-child selectors spanning 50+ lines).

3. **Runtime heatmap colors** — `stats-display.ts` reads `--heatmap-*` via
   `getComputedStyle()`. Tailwind config isn't accessible to JS at runtime.
   Needs a workaround: keep those vars as CSS custom properties (easy, just means
   a small `:root` block survives) or export them from a shared JS module.

4. **Build pipeline change** — need Tailwind CLI or PostCSS integration in the
   Deno + esbuild pipeline. Deno ecosystem support for Tailwind exists but is
   less battle-tested than Node. Adds a build dependency.

5. **Big migration surface** — 10 modes × 3 tabs × 2 rendering paths (static +
   Preact) + shared UI components + SVG fretboard styling. High regression risk.
   No visual regression testing in place today.

6. **Complex CSS is still complex** — the piano-key grid (nth-child selectors
   for 14-column accidental layout), SVG fretboard styling, phase-switching
   display logic, and hover-card positioning would all need `@apply` blocks or
   remain as plain CSS. These don't benefit from utility classes.

7. **Class string concatenation gets worse** — today: `'answer-btn' + (match ?
   ' kb-match' : ' kb-dimmed')`. With Tailwind: longer strings, more
   concatenation, or a `clsx()`-style helper everywhere.

## Recommendation

**Not now.** The costs outweigh the benefits at this stage:

- The dual-rendering constraint (build-time HTML ↔ Preact) makes migration
  uniquely risky here. Most Tailwind migrations don't have this problem.
- The CSS is long but well-structured and the design system variables are clean.
  The pain is "I have to scroll" not "I can't find anything."
- No visual regression testing means we'd be flying blind across 10 modes.

## Better Near-Term Moves

1. **Split `styles.css` into sections or files** — e.g. `base.css` (vars +
   resets), `components.css` (mode-screen, buttons, etc.), `stats.css` (heatmap,
   grids). Concatenate at build time. Same result, easier navigation.
2. **Add a CSS linter** (Stylelint) to catch dead selectors and enforce variable
   usage.
3. **Revisit Tailwind if/when** the build-time HTML generation is retired in
   favor of full Preact rendering — that removes the dual-rendering constraint
   and cuts migration risk in half.
