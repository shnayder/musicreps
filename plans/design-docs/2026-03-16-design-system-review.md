# Design System Review: Top Improvement Opportunities

## Context

Music Reps has excellent design foundations — mature IA principles (17 of them),
well-documented visual design guide, 95%+ CSS token coverage, a declarative
component architecture, and solid iteration tooling. But there's a gap between
the principles layer (which is great) and the implementation layer (which is
good but ad-hoc). The result: features like Speed Check end up as "an
inconsistent mess" that gets cleaned up through dozens of incremental tweaks
("bigger... no, too big... more blue") rather than being derived correctly in
one principled pass.

The root cause isn't missing CSS variables — it's that there's no systematic
bridge from **brand/product promises → design principles → visual recipes →
implementation**. The principles say "content hierarchy follows interaction
priority" but don't tell you what font-size a subsection header gets. The design
guide catalogs individual tokens but doesn't compose them into reusable patterns.
The review checklist checks "did you use tokens?" but not "is the visual
hierarchy correct?"

This plan addresses the problem at three levels: process, system, and
infrastructure.

---

## Completed

### CSS Token Completion + File Organization (was items 4-5)

**Done.** See
[exec plan](../exec-plans/active/2026-03-16-css-token-completion.md).

- ~103 hardcoded values replaced with tokens: shadows (`--shadow-sm/md/lg/hover`),
  transitions (`--duration-fast/base/slow/linear`), opacities
  (`--opacity-disabled/dimmed/pressed/subtle`), z-index (`--z-raised/popover`),
  font weights (`--font-normal/medium/semibold/bold`), touch target
  (`--size-touch-target`), plus one-off border-radius and font-size fixes.
- CSS file reorganized with numbered 18-section TOC and consistent section
  delimiters.
- All replacements value-identical — zero visual changes.

### Structural Recipe Components (was item 8)

**Done.** See
[exec plan](../exec-plans/active/2026-03-16-structural-recipe-components.md).

- **`ActionButton`** component (`src/ui/action-button.tsx`) with
  `variant: 'primary' | 'secondary'`. Migrated: RoundCompleteActions,
  SpeedCheckIntro, SpeedCheckResults, FeedbackDisplay next button.
- **`Text`** component (`src/ui/text.tsx`) with 6 roles: section-header,
  subsection-header, label, secondary, caption, metric. Migrated ~15 call sites.
- 6 `.text-*` CSS classes encoding the type hierarchy recipes.
- Type hierarchy table and Structural Components section added to
  `visual-design.md`.

**Deviations from original plan:**
- `suggestion-card-header` NOT migrated — uses `--color-recommended` instead of
  muted; `<Text role='subsection-header'>` would override the branded color.
- `suggestion-card-accept`, `baseline-rerun-btn` NOT migrated to ActionButton —
  intentionally different styling (gold-themed / deliberately small).
- `MetricDisplay` deferred — only 1-2 use sites, not enough leverage yet.

### Visual Design Recipes — Documentation (was item 1, partial)

**Partially done.** The Type Hierarchy table is now in `visual-design.md`
alongside the Structural Components section. What remains:

- Button variant taxonomy documentation (the table exists in this review but
  hasn't been added to `visual-design.md`)
- Elevation scale documentation (tokens exist, docs don't describe the semantic
  levels)
- Info hierarchy pattern elevated to a standalone recipe (currently described
  only under Baseline Info)

---

## Remaining: Process Layer

### 1. Visual Design Spec Template (High Impact)

**Status: TODO**

`feature-process.md` has templates for product specs and implementation plans
but no template for **visual design work**. When redesigning a feature's
appearance, there's no step that says "derive the correct design from principles
before touching code."

**Solution:** Create `guides/visual-design-spec.md` — a standalone template with
process guidance. Reference it from `feature-process.md` in the "When to Write
What" section (alongside design spec, implementation plan, bug fix plan).

The template should cover:
- When to write one (redesigning appearance, layout cleanup, design system
  alignment)
- Content hierarchy derivation (list elements → assign text roles → derive
  spacing)
- Component composition (which ActionButton variants, Text roles, container
  types)
- Deviations from recipes (intentional departures with rationale)
- Per-state layouts (principle #1: each state is a distinct design)

**Files:** new `guides/visual-design-spec.md`, update `guides/feature-process.md`
to reference it

### 2. Design Review Gate (Medium Impact)

**Status: TODO**

The review checklist checks "did you use tokens?" but not "is the visual
hierarchy correct?" Now that structural components exist, the review gate should
check whether they were used rather than checking raw CSS values.

**Solution:** Add to the review checklist's Visual Design section:

- [ ] **Text roles via structural component.** Text elements use `<Text>` or
      `.text-*` classes for their content role. No ad-hoc font-size/weight/color
      combinations for standard roles (subsection-header, label, caption, metric).
- [ ] **Action buttons via ActionButton.** Primary/secondary flow actions use
      `<ActionButton>` component, not manual class composition.
- [ ] **Elevation tokens used.** Shadows use `--shadow-sm/md/lg/hover`, not
      hardcoded rgba values.
- [ ] **Info hierarchy pattern applied.** Metric displays use value dominant,
      label quiet, explanation smallest (via Text roles).
- [ ] **Spacing follows rhythm.** Section gaps use `--space-5` or `--space-6`.

The current review checklist is a single monolithic list that applies to every
change. As the design system matures, it makes sense to **split by change
type** — a CSS-only visual change doesn't need the adaptive learning system
checks, and a pure algorithm change doesn't need visual design checks. Proposed
structure:

| Checklist | Applies when | Covers |
|-----------|-------------|--------|
| **Core** (always) | Every change | Build, tests, code quality, docs |
| **Visual design** | CSS or UI component changes | Tokens, text roles, button variants, elevation, spacing |
| **Architecture** | New modules or pattern changes | State machine, DI, mode interface, build system |
| **Algorithm** | Adaptive, recommendation, timing | EWMA, forgetting model, consolidate-before-expanding |
| **Quiz mode** | New or modified mode | Item IDs, keyboard, localStorage, calibration |

The reviewer picks which sections apply based on the diff. "N/A" disappears
because you only run relevant sections.

**Files:** `.claude/commands/review-checklist.md` (restructure)


### 3. Complete Recipe Documentation (Low Impact)

**Status: TODO**

Finish the documentary layer in `visual-design.md`:

- **Button variant taxonomy** — role → visual treatment → class/component
  mapping. Currently in this review doc but not in the guide.
- **Elevation scale** — semantic levels (flat/raised/card/popover) →
  `--shadow-*` tokens → usage. Tokens exist, docs don't.
- **Info hierarchy pattern** — elevate from Baseline Info subsection to a
  standalone reusable recipe.

**Files:** `guides/design/visual-design.md`

---

## Remaining: Code Quality

### 4. Component Deduplication (Lower Impact)

**Status: TODO**

Two DRY violations:

**a)** `StatsSelector` type defined identically in `src/declarative/types.ts`
and `src/ui/stats.tsx`. Define once, import everywhere.

**b)** Recommendation card JSX duplicated inside `PracticeCard` and as
standalone `Recommendation` component in `src/ui/mode-screen.tsx`. Compose.

**Files:** `src/ui/mode-screen.tsx`, `src/declarative/types.ts`, `src/ui/stats.tsx`

---

## Remaining: Tooling

### 5. Visual Regression Diffing (Lower Impact)

**Status: Defer this until visual design is more baked.**

`ui-iterate` captures multi-version screenshots but has no pixel diff. Adding
`pixelmatch` to compute diff images between versions would turn "capture and
review" into "capture, diff, and review."

**Files:** `scripts/ui-iterate.ts`


---

## Remaining: Future Structural Components

These were evaluated for item 8 but deferred. Revisit when more use sites exist.

### MetricDisplay

Composes `<Text>` to encode the "label: value / explanation" info hierarchy
pattern. Currently only 1-2 use sites (BaselineInfo, possibly round-complete
stats). When a third site appears, extract the pattern.

### Branded Text Variants

`.suggestion-card-header` and `.skill-rec-header` use the subsection-header
recipe but with `--color-recommended` instead of `--color-text-muted`. If more
branded-color text roles emerge, consider adding a `color` override prop to
`<Text>` or a `branded` variant.

---

## Recommended Sequencing (remaining items)

| Phase | Items | What it achieves |
|-------|-------|------------------|
| **A** | 1 (Spec template) + 2 (Review gate) + 3 (Recipe docs) | Process layer — closes the loop on principled design passes |
| **B** | 4 (Component dedup) | Code quality |

Phase A is pure documentation — no code changes. B and C are independent.

---

## Concrete Example: Speed Check Redesign (Using This System)

With the current system (post-completions), fixing Speed Check would go:

1. **Write visual design spec** (template from remaining item 1):
   - Content hierarchy: baseline header (subsection) → metric (label + value) →
     explanation (caption) → action (secondary button)
   - Each element uses `<Text role='...'>` and `<ActionButton variant='...'>`
   - Component composition: info hierarchy pattern for metric display

2. **Implement in one pass** — structural components enforce the recipes. No
   ambiguity about font-size, weight, color, or spacing.

3. **Review against checklist** (remaining item 2): reviewer verifies structural
   components were used. Disagreements are about "is this element a subsection
   header or a label?" (a meaningful design question), not "should this be 14px
   or 13.6px?" (a tweaking question).
