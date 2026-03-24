# Spacing, Elevation & Other Tokens

Non-color, non-typography design tokens. All defined as CSS custom properties in
`src/styles.css` `:root`.

**Live reference:** The preview page's **Design System** tab shows all token
values with visual examples. The CSS is the single source of truth — this guide
describes the system structure and usage principles.

## Spacing Scale

6 tokens (`--space-1` through `--space-6`) consolidating 9+ gap/padding values
into a consistent scale. Use these tokens for all spacing — don't introduce
one-off pixel values.

| Token | Usage |
|-------|-------|
| `--space-1` | Toggle gaps |
| `--space-2` | Button grid gaps, tight padding |
| `--space-3` | Standard gap, small padding |
| `--space-4` | Section gaps, nav padding |
| `--space-5` | Body padding, section spacing |
| `--space-6` | Large section gaps |

## Elevation (Shadows)

4 elevation tokens for box-shadow. Use for physical-feeling depth, not for
outlines or glows (those stay literal).

| Token | Usage |
|-------|-------|
| `--shadow-sm` | Pressed/active state |
| `--shadow-md` | Default elevation (CTA, cards) |
| `--shadow-lg` | Popover, skip menu |
| `--shadow-hover` | Hover lift |

## Transitions

Duration tokens for transition timing. Easing functions (`ease`, `linear`) stay
literal because CSS `transition` shorthand doesn't support variable substitution
for the timing function alone.

| Token | Usage |
|-------|-------|
| `--duration-fast` | Transform scale, quick micro-feedback |
| `--duration-base` | Color/background/border changes |
| `--duration-slow` | Progress bar width |
| `--duration-linear` | Countdown bar (linear easing) |

## Opacity States

Semantic opacity tokens for interactive states. `opacity: 1` resets and hover
micro-interactions stay literal.

| Token | Usage |
|-------|-------|
| `--opacity-disabled` | Disabled buttons (note, answer) |
| `--opacity-dimmed` | Skipped toggles, dimmed split-notes |
| `--opacity-pressed` | Active/pressed state |
| `--opacity-subtle` | Skipped progress bars, hidden accidentals |

## Z-Index Scale

| Token | Usage |
|-------|-------|
| `--z-raised` | Stacking above siblings |
| `--z-popover` | Skip menu, floating panels |

## Touch Target

| Token | Usage |
|-------|-------|
| `--size-touch-target` | WCAG AA minimum (44px) for close/nav buttons |

## Border Radius

| Token | Usage |
|-------|-------|
| `--radius-sm` | Toggles, cells, bars, small buttons |
| `--radius-md` | Cards, answer buttons, CTAs |
| `--radius-lg` | Settings modal |
