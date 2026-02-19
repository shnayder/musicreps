# Visual Design: Review, Standards, and Improvement Plan

**Date:** 2026-02-13 **Status:** Implemented (2026-02-14)

## Context

The app is functional but looks like a developer prototype — white background,
system fonts, neutral grays, no visual personality. The backlog explicitly calls
out "CSS smell, UI components, visual standards" and "Colors, sizes, fonts.
Brand." The CSS variable system and shared scaffold are solid foundations, but
there's no documented visual standard, no design review checklist, and several
accessibility issues (red/green heatmap, no focus-visible styles).

**Goal:** Create a design guide with principles and standards, document all
visual issues, plan phased improvements.

**Target quality bar:** Distinctive & polished — a real product feel, not a
wireframe.

## Resumption Context

This plan was developed from a thorough visual design review that included:

- Complete reading of `src/styles.css` (30+ CSS custom properties, ~765 lines)
- Screenshot review of all 10 quiz modes (idle and active states)
- Review of all existing design docs
  (`plans/design-docs/html-css-architecture-review.md`, `guides/vision.md`,
  `guides/coding-style.md`, `guides/design/colors.html`)
- Review of `ideas.md` and `backlog.md` for user-noted design concerns
- Analysis of quiz mode UI implementations across 7+ JS files

Key findings from the review:

- **CSS custom properties system is solid** — 30+ variables in `:root`, all CSS
  rules reference `var(--color-*)`. Pattern established, just needs expanding.
- **Shared scaffold via `html-helpers.ts`** — `modeScreen()` generates all 10
  mode screens. Visual changes to scaffold propagate automatically.
- **Heatmap colors loaded at runtime** via `heatmapColors()` singleton in
  `stats-display.js` with `getComputedStyle` reads and hardcoded fallbacks.
- **15 distinct font sizes, 9+ gap values** in the CSS — drift, not intentional
  scale. Consolidation needed.
- **`fretboard.ts` has 4 hardcoded `#333` values** in SVG generation.
- **`.note-btn.accidental` has hardcoded `#e8e8e8`**, overlay uses
  `rgba(0,0,0,0.3)`.
- **No `:focus-visible` or `:hover` styles** on most interactive elements.
- **Red/green heatmap** — user noted "Don't use red/green scales" in ideas.md.

---

## Deliverables (in dependency order)

### 1. `guides/design/visual-design.md` — Design Guide

The main reference document. Sections:

**Design Principles** (aligned with product vision):

- Drill-first aesthetic — nothing distracts from drilling
- Warmth over sterility — inviting, like a good practice space
- Feedback clarity — correct/wrong instantly recognizable
- Information density — stats scannable, not decorative
- Mobile-primary — thumb-friendly, no hover-dependent interactions

**Color System:**

- **Brand direction: warm amber/gold** — musically evocative (brass, stage
  lighting), distinct from feedback colors, works on light and dark backgrounds.
  Proposed brand token: `--color-brand: hsl(38, 90%, 55%)`.
- **Dark top bar** for instant visual identity:
  `--color-topbar-bg: hsl(220, 15%, 18%)`
- **Warm neutrals** instead of pure grays — shift text/surface colors slightly
  warm for a cohesive premium feel
- **Accessible heatmap: blue-to-amber** sequential scale replacing red/green.
  Cool (needs work) to warm (mastered), with brand amber as the goal color.
  Proposed scale:
  ```css
  --heatmap-none: hsl(30, 5%, 85%);
  --heatmap-1: hsl(215, 45%, 60%); /* steel blue — needs work */
  --heatmap-2: hsl(200, 40%, 65%); /* lighter blue — fading */
  --heatmap-3: hsl(50, 50%, 65%); /* warm yellow — getting there */
  --heatmap-4: hsl(42, 70%, 58%); /* gold — solid */
  --heatmap-5: hsl(38, 85%, 55%); /* amber — automatic (brand!) */
  ```
- Document when to use brand color (CTAs, identity) vs semantic colors (feedback
  always uses success/error green/red)
- Document all existing CSS variables with usage guidance

**Typography Scale** — consolidate 15 sizes into 7 tokens:

| Token         | Size     | Maps to                                    |
| ------------- | -------- | ------------------------------------------ |
| `--text-xs`   | 0.75rem  | Legend labels, tiny stats                  |
| `--text-sm`   | 0.85rem  | Session stats, settings, table text        |
| `--text-base` | 1rem     | Body, buttons, nav items                   |
| `--text-md`   | 1.125rem | Answer buttons (consolidates 1.1/1.15/1.2) |
| `--text-lg`   | 1.3rem   | Mode title                                 |
| `--text-xl`   | 1.5rem   | Hamburger, feedback                        |
| `--text-2xl`  | 2rem     | Quiz prompts                               |

Weights: 400 (normal), 500 (medium — buttons/labels), 600 (semibold — headings).

**Spacing Scale** — consolidate 9+ values into 6 tokens:

| Token       | Value          | Usage                           |
| ----------- | -------------- | ------------------------------- |
| `--space-1` | 0.125rem (2px) | Toggle gaps, pixel-level        |
| `--space-2` | 0.25rem (4px)  | Button grid gaps, tight padding |
| `--space-3` | 0.5rem (8px)   | Standard gap, small padding     |
| `--space-4` | 0.75rem (12px) | Section gaps, nav padding       |
| `--space-5` | 1rem (16px)    | Body padding, section spacing   |
| `--space-6` | 1.5rem (24px)  | Large section gaps              |

**Component Patterns:**

- Primary button (Start Quiz): brand amber bg, white text, subtle shadow
- Answer buttons: white bg, 2px muted border, hover/active/focus states
- Toggle buttons: same as today + documented states
- Secondary actions (Stop, Recalibrate): outlined, not filled
- Quiz area: subtle card container with rounded corners + light surface bg
- Navigation: grouped by mode category, brand accent left-border for active
- Feedback: same green/red semantic colors (unchanged)

**Interaction Patterns:**

- Hover on desktop (darken bg slightly, no layout shift)
- Active/pressed (surface-pressed bg, subtle scale-down)
- Focus-visible (2px accent outline, 2px offset)
- Transitions: 150ms for color, 200ms for layout, ease-out

**Accessibility Standards:**

- WCAG AA contrast (4.5:1 text, 3:1 large text)
- No red/green as sole differentiator
- 44px minimum touch targets (already met)
- `@media (prefers-reduced-motion: reduce)` support
- `:focus-visible` on all interactive elements

---

### 2. `plans/design-docs/visual-design-issues.md` — Prioritized Issues

14 issues identified, grouped by severity:

**P1 (accessibility / usability):**

- Red/green heatmap — replace with blue-to-amber scale (S effort)
- No `:focus-visible` styles — keyboard nav invisible (S effort)

**P2 (undermines product feel):**

- No visual identity — looks like a wireframe (M effort)
- Buttons lack visual weight — flat, uninviting (S effort)
- Hard-coded colors in SVG and CSS — 4x `#333` in fretboard.ts, `#e8e8e8`,
  `rgba()` values not using CSS vars (S effort)
- Quiz area lacks containment — floating question/buttons (S effort)
- Top bar is bare — no visual weight or identity (S effort)
- Start button same style as all buttons — no CTA prominence (S effort)

**P3 (inconsistency / cosmetic):**

- Inconsistent spacing — 9+ gap values (M effort)
- Typography scale drift — 15 font sizes (M effort)
- Plain navigation menu — no grouping or icons (S effort)
- No hover states on desktop (S effort)
- Stats tables dense — tiny cells, hard to scan (M effort)
- Fretboard SVG basic — no depth/refinement (S-L effort)

Each issue to be documented with: current state, desired state, effort, files.

---

### 3. Implementation Phases (separate exec plans)

**Phase 1: Accessibility + Quick Wins** (1-2 sessions)

- Replace red/green heatmap with blue-to-amber scale
- Add `:focus-visible` styles to all interactive elements
- Add `@media (prefers-reduced-motion: reduce)`
- Migrate remaining hard-coded colors to CSS vars
- Add hover states for all buttons

**Phase 2: Visual Identity** (2-3 sessions)

- Introduce brand color palette (amber/gold tokens)
- Restyle top bar (dark bg, brand accent)
- Restyle Start Quiz as primary CTA (brand bg)
- Add quiz area containment (subtle card)
- Restyle navigation drawer (grouped, brand active indicator)

**Phase 3: Polish + Consistency** (2-3 sessions)

- Introduce spacing scale CSS properties, audit all values
- Introduce typography scale CSS properties, audit all values
- Improve stats tables (larger cells, rounded, more padding)
- Add subtle transitions to buttons/toggles
- Migrate SVG fretboard colors to CSS

**Phase 4: Refinement** (ongoing, low priority)

- Dark mode support
- Fretboard SVG visual refinement (depth, inlays)
- Micro-interactions (tap scale, fade-in feedback)

---

### 4. Review Checklist Additions (`.claude/commands/review-checklist.md`)

New `## Visual design consistency` section:

```markdown
- [ ] No new hard-coded colors — all via `var(--color-*)` or `var(--heatmap-*)`
- [ ] No new font-size values — use type scale tokens or justify exception
- [ ] No new spacing values — use spacing scale tokens or justify exception
- [ ] All new interactive elements have `:focus-visible` and `:hover` styles
- [ ] All new buttons have `:active` pressed state
- [ ] Touch targets >= 44x44px
- [ ] Brand color only for CTAs/identity, never for feedback
- [ ] Heatmap uses `--heatmap-*` scale, not hardcoded HSL
```

---

## Critical Files

| File                                   | Role                                               |
| -------------------------------------- | -------------------------------------------------- |
| `src/styles.css`                       | Central CSS — all visual standards live here       |
| `src/fretboard.ts`                     | SVG generation with 4 hardcoded `#333` values      |
| `src/stats-display.js`                 | Heatmap color fallbacks in `heatmapColors()`       |
| `src/html-helpers.ts`                  | Shared mode scaffold — structural HTML changes     |
| `main.ts` / `build.ts`                 | Nav drawer HTML, top bar markup (must stay synced) |
| `guides/design/colors.html`            | Live color reference (update with new palette)     |
| `.claude/commands/review-checklist.md` | Review checklist to extend                         |

## Existing Patterns to Reuse

- `heatmapColors()` singleton in `stats-display.js` — update fallback values
- `cssVar(name)` helper in `stats-display.js` — reuse for any new runtime reads
- `modeScreen(id, opts)` in `html-helpers.ts` — quiz area containment changes
  propagate to all 10 modes automatically
- `:root` CSS custom properties pattern — extend with new tokens

## Verification

- Visual: run dev server (`deno run --allow-net --allow-read main.ts`), check
  mobile + desktop
- Screenshots: `npx tsx scripts/take-screenshots.ts` for before/after
- Tests: `npx tsx --test src/*_test.ts` must still pass
- Accessibility: colorblind simulator for heatmap, keyboard-only navigation test
- Review: run `/review` on each implementation PR
