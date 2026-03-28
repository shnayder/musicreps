# Typography

Three-layer system paralleling colors: **palette** (raw tokens) →
**semantic roles** (what the text IS) → **component mapping** (where it's
used). See `plans/design-docs/2026-03-21-typography-system-redesign.md` for
the original design rationale.

## Three-Layer Architecture

```
Layer 1: Palette tokens (raw ingredients)
  --text-xs, --font-semibold, --leading-tight, --color-text, etc.
  Change here when the entire scale needs to shift.

Layer 2: Semantic role properties (what the text IS)
  --type-heading-page-size: var(--text-lg);
  4 custom properties per role, in :root.
  Change here when a role's recipe is wrong for its purpose.

Layer 3: Component mapping (where it's used)
  .mode-title { font-size: var(--type-heading-page-size); ... }
  Both bespoke and .text-* classes reference Layer 2, never Layer 1.
  Change here when a component uses the wrong role.
```

Most fixes are Layer 2 (one line in `:root` cascades everywhere). Layer 3
is for wrong role assignment. Layer 1 is rare — only for shifting the
whole scale (e.g., bumping the base font size for mobile readability).

## The 5-Tier Scale

Every role maps to one of 5 size tiers. The `html` base is 17px
(`font-size: 106.25%`), aligning with Apple HIG body size.

| Tier | Token | Roles |
|------|-------|-------|
| Display | `--text-2xl` | display-brand, quiz-prompt |
| Large | `--text-lg` | heading-page, quiz-response, quiz-feedback |
| Standard | `--text-base` | body, heading-section, heading-subsection, label, control, quiz-instruction, answer, action, metric-primary, metric-info, metric-effort |
| Small | `--text-sm` | body-secondary, status |
| Tiny | `--text-xs` | supporting, label-tag |

`--text-3xl` exists for metric-hero only (round-complete count).
`--text-md` and `--text-xl` are defined but not referenced by any role.
Current computed values are shown in the [design system preview](/preview).

**Rule: max 3 sizes per screen.** Differentiate with weight and color,
not more sizes. If a new element needs a size between tiers, resist adding
a new tier — ask whether weight or color can create the needed hierarchy
within an existing tier.

## Intensity Tiers

Roles at the same intensity tier should have matched visual weight. Like
`color.error` and `color.info` at the same saturation — different hues,
same intensity.

| Tier | Roles | Characteristic |
|------|-------|----------------|
| Hero | `display-brand`, `metric-hero` | Largest, highest emphasis |
| Primary | `heading-page`, `quiz-prompt`, `quiz-feedback` | Screen-level focal points |
| Section | `heading-section`, `heading-subsection`, `metric-primary` | Organizes content |
| Content | `body`, `body-secondary`, `label`, `control`, `quiz-instruction`, `metric-info`, `metric-effort`, `status`, `answer`, `action` | Same visual weight, differentiated by weight/color |
| Tertiary | `supporting`, `label-tag` | Smallest, lowest emphasis |

When adding or adjusting a role, check that it sits at the right tier.
Roles in the same tier should feel equally prominent when placed side by
side — if one jumps out, its recipe is at the wrong tier.

## Role Reference

20 roles (17 content + 3 interactive) with their current computed properties
are shown in the **Typography — Role Reference** section of the
[design system preview](/preview). The token recipes (which palette tokens
each role uses) live in `src/styles.css` under the Layer 2 `:root` block.

Role groups: Display, Heading, Body, Label, Quiz, Supporting, Metric, Status,
Interactive (action, answer, control).

Variants: `.action-secondary` (normal weight, muted color),
`.control-selected` (semibold weight, text color),
`.status-success`, `.status-error`, `.status-notice`, `.status-empty` (italic).

## Layer 1: Palette

| Category | Tokens |
|---|---|
| Sizes | `--text-xs` through `--text-3xl` |
| Weights | `--font-normal`, `--font-medium`, `--font-semibold`, `--font-bold` |
| Line heights | `--leading-none`, `--leading-tight`, `--leading-snug`, `--leading-normal` |
| Families | `--font-body` (Plus Jakarta Sans, embedded), `--font-display` (Gabarito, embedded) |

Current values are shown in the [design system preview](/preview) under
**Type Scale** and **Typography — Palette**.

## Design Principles

1. **Differentiate with weight and color, not more sizes.** The 5-tier
   scale is sufficient. Two elements at the same size can feel completely
   different via semibold vs normal weight and text vs muted color.

2. **No typography overrides.** Every bespoke CSS class references
   `--type-*` role properties for all 4 properties (size, weight, leading,
   color). Never reference palette tokens (`--text-sm`, `--font-medium`)
   directly in component CSS.

3. **Build template parity.** The `<Text>` component isn't available at
   build time. Bespoke CSS classes that appear in `html-helpers.ts` must
   carry the full 4-property role recipe — they can't rely on a `.text-*`
   class being added by Preact.

4. **When to change each layer:**
   - The whole scale feels too small → Layer 1 (html font-size)
   - A role looks wrong everywhere → Layer 2 (role property in `:root`)
   - One component looks wrong → Layer 3 (wrong role assignment)

5. **`font-variant-numeric: tabular-nums`** on all metric classes. This
   is added directly in the `.text-metric-*` CSS classes, not as a role
   property (it's a display concern, not a recipe property).

## Adding New Roles

Before creating a new role, answer these questions:

1. **Does an existing role fit?** Check the 20 roles in the
   [design system preview](/preview). Often the element maps to an
   existing role with no changes needed.

2. **Does it need a new size tier?** If it would introduce a 6th size
   on any screen, the answer is no. Find a way to use weight/color
   within an existing tier.

3. **Which group does it belong to?** Display, heading, body, label,
   quiz, supporting, metric, status, or a new interactive group?

4. **Which intensity tier?** Place it alongside roles of similar visual
   weight. Test by rendering it next to its tier peers — does it match?

5. **Define all 4 properties.** Size, weight, leading, color — all
   referencing palette tokens. Add to `:root`, create `.text-{role}`
   class, add to `TextRole` type.

## Structural Components

### ActionButton

```tsx
<ActionButton variant='primary' onClick={start}>Practice</ActionButton>
<ActionButton variant='secondary' onClick={stop}>Stop</ActionButton>
```

`.page-action-btn` with variant class. For flow-initiating/stopping buttons.

### Text

```tsx
<Text role='heading-page' as='h1'>Guitar Fretboard</Text>
<Text role='heading-subsection' as='div'>Speed check</Text>
<Text role='label'>Response time</Text>
<Text role='metric-primary'>{value}</Text>
<Text role='supporting'>Explanation text</Text>
<Text role='quiz-prompt'>C#</Text>
```

Maps content role to typography recipe. For all non-interactive content text.
