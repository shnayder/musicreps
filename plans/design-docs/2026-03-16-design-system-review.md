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
- CSS file reorganized with numbered 19-section TOC and consistent section
  delimiters (section 13 added for text role classes).
- Replacements value-identical except `14px` → `var(--text-sm)` on
  `.group-skip-btn` (sub-pixel difference, imperceptible).

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

### Visual Design Recipes — Documentation (was item 1)

**Done.** Added to `visual-design.md`:
- Type Hierarchy table with all text roles
- Structural Components section (ActionButton, Text)
- Button Variant Taxonomy table (all 8 categories)
- Info Hierarchy Pattern as a standalone recipe
- Elevation scale documented in Elevation (Shadows) section

---

## Remaining: Process Layer

### 1. Visual Design Spec Template (High Impact)

**Done.** Created `guides/visual-design-spec.md` with process guidance and
template. Referenced from `guides/feature-process.md` in the "When to Write
What" section.

### 2. Design Review Gate (Medium Impact)

**Done.** Review checklist restructured by change type (Core, Visual Design,
Architecture, Algorithm, Quiz Mode). Structural component checks added:
Text roles, ActionButton usage, elevation tokens, info hierarchy pattern.


### 3. Complete Recipe Documentation (Low Impact)

**Done.** All three items added to `visual-design.md`:
- Button Variant Taxonomy table (8 categories)
- Elevation (Shadows) section with semantic levels and tokens
- Info Hierarchy Pattern as a standalone section

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
