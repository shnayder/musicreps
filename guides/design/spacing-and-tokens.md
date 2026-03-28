# Spacing, Elevation & Other Tokens

Non-color, non-typography design tokens. All defined as CSS custom properties in
`src/styles.css` `:root`.

**Live reference:** The preview page's **Design System** tab shows all token
values with visual examples. The CSS is the single source of truth — this guide
describes the system structure and usage principles.

## Spacing: Three-Layer Architecture

Parallels the color and typography systems: **palette** (raw values) →
**semantic** (what the space does) → **component** (where it's used).

### Layer 1: Palette

7 raw tokens. Change here when the entire scale needs to shift.

| Token | Value |
|-------|-------|
| `--space-1` | 0.125rem (2px) |
| `--space-2` | 0.25rem (4px) |
| `--space-3` | 0.5rem (8px) |
| `--space-4` | 0.75rem (12px) |
| `--space-5` | 1rem (16px) |
| `--space-6` | 1.5rem (24px) |
| `--space-7` | 2rem (32px) |

### Layer 2: Semantic tokens

6 tokens that name **what the space is doing**. `gap-` = space between things.
`pad-` = space inside things. Change here to shift breathing room globally.

| Token | Default | Meaning |
|-------|---------|---------|
| `--gap-micro` | space-1 | Sub-element coupling: icon+label, toggle rows |
| `--gap-related` | space-2 | Related siblings: buttons in group, label+value |
| `--gap-group` | space-4 | Distinct groups within container: heading→content |
| `--pad-component` | space-5 | Internal padding of controls/cards/wells |
| `--pad-region` | space-6 | Layout region padding, major section breaks |
| `--gap-section` | space-7 | Page-level group separators |

**Always reference semantic tokens in component CSS.** Never use `--space-N`
directly in component rules — those are for Layer 2 definitions only.

### Layer 3: Component tokens

`--size-content-inset` is the one Layer 3 layout token — the horizontal inset
for `LayoutMain`. It references `--pad-region` by default and flips to
`--gap-micro` on mobile. Future component tokens follow the same `--_` prefix
pattern as colors, added only when a component needs compact/comfortable
variants.

### Adjusting breathing room

To give the whole app more (or less) space, shift the 4 "spacious" semantic
tokens. Micro and related gaps stay tight intentionally.

```css
--gap-group:     var(--space-4);  /* ← bump to space-5 for more room */
--pad-component: var(--space-5);
--pad-region:    var(--space-6);
--gap-section:   var(--space-7);
```

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
