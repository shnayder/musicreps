# Visual Design Spec

Template for visual design work — redesigning a feature's appearance, cleaning
up layout, aligning with the design system, or making significant style changes.

## When to Write One

- Redesigning or polishing a feature's visual appearance
- Layout cleanup affecting multiple elements
- Aligning an existing feature with the design system
- Any visual change that touches 3+ elements or crosses component boundaries

Skip for single-property CSS tweaks, token value adjustments, or changes where
the correct treatment is obvious from the type hierarchy.

## How to Use

Before writing CSS, derive the design from the existing system:

1. List every element in the feature, per state
2. For each element, assign a content role from the
   [type hierarchy](design/visual-design.md#type-hierarchy)
3. Pick the correct structural component or CSS class
4. Note any intentional deviations with rationale
5. Then implement — the spec tells you exactly what to build

The goal is one principled pass, not iterative tweaking.

## Template

```markdown
# {Feature} — Visual Design

## Current State

What it looks like now. Reference screenshots or describe the issues.

## Content Hierarchy

For each screen state, list elements in interaction-priority order.

### {State name} (e.g., Idle, Active, Results)

| Element | Content role | Component / class | Notes |
|---------|-------------|-------------------|-------|
| Section title | heading-section | `<Text role='heading-section'>` | |
| Status label | label | `<Text role='label'>` | |
| Measured value | metric-primary | `<Text role='metric-primary'>` | |
| Explanation | supporting | `<Text role='supporting'>` | |
| Primary CTA | — | `<ActionButton variant='primary'>` | |
| Cancel | — | `<ActionButton variant='secondary'>` | |

### Spacing

Describe the vertical rhythm between elements:
- Section gaps: `--space-5` or `--space-6`
- Within-group gaps: `--space-3` or `--space-4`
- Tight/related elements: `--space-2`

## Component Composition

Which existing patterns are composed:
- ActionButton variant (primary / secondary)
- Text roles (section-header / label / caption / metric / etc.)
- Container type (card with `--radius-md` / surface section / inline)
- Info hierarchy (label: value / explanation — value dominant)
- Elevation level (flat / card `--shadow-md` / popover `--shadow-lg`)

## Deviations from Recipes

Any intentional departures from standard recipes, with rationale.

Example: "Suggestion card header uses subsection-header sizing but
`--color-notice` instead of `--color-text-muted` — branded emphasis."

## Resolved Decisions

- **Decision**: chosen option — rationale
```

## Reference

- [Type hierarchy](design/visual-design.md#type-hierarchy) — content role → size
  + weight + color
- [Structural components](design/visual-design.md#structural-components) —
  ActionButton and Text
- [Elevation](design/visual-design.md#elevation-shadows) — shadow tokens
- [Spacing scale](design/visual-design.md#spacing-scale) — `--space-1` through
  `--space-6`
- [Layout & IA principles](design/layout-and-ia.md) — screen structure, content
  priority, grouping
- [Design principles](design-principles.md) — product, visual, and UX values
