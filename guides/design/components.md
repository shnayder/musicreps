# Component Patterns

Reusable component patterns and their design conventions.

**Live reference:** The preview page's **Buttons** and **Screen Structure** tabs
show all component variants with current styling. The CSS is the single source
of truth — this guide describes the taxonomy and usage rules.

## Button Variant Taxonomy

Every interactive element falls into one of these categories. Each has a
distinct visual treatment — don't reuse styles across roles. See
[layout-and-ia.md](layout-and-ia.md#one-interaction-grammar) (principle #14).

| Variant | Role | Component |
|---------|------|-----------|
| **Primary action** | Initiate flow (Practice, Keep Going, Start, Done) | `<ActionButton variant='primary'>` |
| **Secondary action** | Cancel / alternative (Stop) | `<ActionButton variant='secondary'>` |
| **Small action** | Tertiary / utility (Redo speed check, Accept suggestion) | `.baseline-rerun-btn`, `.suggestion-card-accept` |
| **Answer** | Quiz response — equal visual weight, 4-column grid | `.answer-btn` in `.answer-grid` |
| **Toggle** | Multi-select filter (strings, groups, notes) | `.string-toggle`, `.distance-toggle` |
| **Tab** | View switching | `.mode-tab`, `.home-tab` |
| **Text link** | Tertiary navigation — muted, no background | `.text-link` |
| **Close** | Dismiss / navigate back | `.mode-close-btn`, `.quiz-header-close` |

**When to use ActionButton vs raw button:** Use `<ActionButton>` for
primary/secondary flow actions (start, stop, continue, done). Use raw `<button>`
with a specific class for everything else — answer buttons have feedback
semantics, toggles have pressed state, tabs have ARIA roles, and small actions
have intentionally quieter styling.

## Info Hierarchy Pattern

When displaying a metric with context, use the **label: value / explanation**
pattern. The value is visually dominant; the label is quieter; the explanation
is smallest.

```
{label}         {value}         <- Text role: label + metric-primary
{explanation}                   <- Text role: supporting
[action]                        <- Small action button (optional)
```

This pattern appears in:
- **BaselineInfo** — "Response time: 0.5s / Timing thresholds are based on..."
- **Round complete stats** — "This round: 8/10 correct"
- **Practice status** — "Status: Building..."

Use `<Text role='label'>`, `<Text role='metric-primary'>`, and
`<Text role='supporting'>` to encode the hierarchy structurally.
