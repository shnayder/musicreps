# Component Patterns

Reusable component patterns and their design conventions.

## Button Variant Taxonomy

Every interactive element falls into one of these categories. Each has a
distinct visual treatment — don't reuse styles across roles. See
[layout-and-ia.md](layout-and-ia.md#one-interaction-grammar) (principle #14).

| Variant | Role | Visual treatment | Class / component |
|---------|------|-----------------|-------------------|
| **Primary action** | Initiate flow (Practice, Keep Going, Start, Done) | Filled brand green, white text, `--font-semibold` | `<ActionButton variant='primary'>` |
| **Secondary action** | Cancel / alternative (Stop) | Outlined, `--color-border`, muted text, `--font-normal` | `<ActionButton variant='secondary'>` |
| **Small action** | Tertiary / utility (Redo speed check, Accept suggestion) | Outlined, smaller font, lighter border — visually quieter than secondary | `.baseline-rerun-btn`, `.suggestion-card-accept` |
| **Answer** | Quiz response | White bg, 2px `--color-text-muted` border, equal visual weight across all options | `.answer-btn`, `.note-btn` |
| **Toggle** | Multi-select filter (strings, groups, notes) | `--color-surface` inactive → `--color-toggle-active` active, 36px min size | `.string-toggle`, `.distance-toggle` |
| **Tab** | View switching | Underline active, `--color-brand` indicator, no fill | `.mode-tab`, `.home-tab` |
| **Text link** | Tertiary navigation | Muted text, underline on hover, no background | `.text-link` |
| **Close** | Dismiss / navigate back | × icon, `--color-text-light`, `--size-touch-target` min size | `.mode-close-btn`, `.quiz-header-close` |

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
{label}         {value}         ← Text role: label + metric-primary
{explanation}                   ← Text role: supporting
[action]                        ← Small action button (optional)
```

This pattern appears in:
- **BaselineInfo** — "Response time: 0.5s / Timing thresholds are based on..."
- **Round complete stats** — "This round: 8/10 correct"
- **Practice status** — "Status: Building..."

Use `<Text role='label'>`, `<Text role='metric-primary'>`, and
`<Text role='supporting'>` to encode the hierarchy structurally.
