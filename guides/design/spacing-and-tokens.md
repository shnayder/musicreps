# Spacing, Elevation & Other Tokens

Non-color, non-typography design tokens. All defined as CSS custom
properties in `src/styles.css` `:root`.

## Spacing Scale

6 tokens consolidating 9+ gap/padding values:

| Token       | Value          | Usage                           |
| ----------- | -------------- | ------------------------------- |
| `--space-1` | 0.125rem (2px) | Toggle gaps                     |
| `--space-2` | 0.25rem (4px)  | Button grid gaps, tight padding |
| `--space-3` | 0.5rem (8px)   | Standard gap, small padding     |
| `--space-4` | 0.75rem (12px) | Section gaps, nav padding       |
| `--space-5` | 1rem (16px)    | Body padding, section spacing   |
| `--space-6` | 1.5rem (24px)  | Large section gaps              |

## Elevation (Shadows)

4 elevation tokens for box-shadow. Use for physical-feeling depth, not for
outlines or glows (those stay literal).

| Token            | Value                              | Usage                          |
| ---------------- | ---------------------------------- | ------------------------------ |
| `--shadow-sm`    | `0 1px 4px rgba(0,0,0,0.1)`       | Pressed/active state           |
| `--shadow-md`    | `0 2px 8px rgba(0,0,0,0.12)`      | Default elevation (CTA, cards) |
| `--shadow-lg`    | `0 4px 12px rgba(0,0,0,0.12)`     | Popover, skip menu             |
| `--shadow-hover` | `0 3px 12px rgba(0,0,0,0.18)`     | Hover lift                     |

## Transitions

Duration tokens for transition timing. Easing functions (`ease`, `linear`) stay
literal because CSS `transition` shorthand doesn't support variable substitution
for the timing function alone.

| Token               | Value  | Usage                                 |
| ------------------- | ------ | ------------------------------------- |
| `--duration-fast`   | 0.1s   | Transform scale, quick micro-feedback |
| `--duration-base`   | 0.15s  | Color/background/border changes       |
| `--duration-slow`   | 0.3s   | Progress bar width                    |
| `--duration-linear` | 0.2s   | Countdown bar (linear easing)         |

## Opacity States

Semantic opacity tokens for interactive states. `opacity: 1` resets and hover
micro-interactions stay literal.

| Token                | Value | Usage                                |
| -------------------- | ----- | ------------------------------------ |
| `--opacity-disabled` | 0.5   | Disabled buttons (note, answer)      |
| `--opacity-dimmed`   | 0.4   | Skipped toggles, dimmed split-notes  |
| `--opacity-pressed`  | 0.8   | Active/pressed state                 |
| `--opacity-subtle`   | 0.3   | Skipped progress bars, hidden accidentals |

## Z-Index Scale

| Token          | Value | Usage                       |
| -------------- | ----- | --------------------------- |
| `--z-raised`   | 1     | Stacking above siblings     |
| `--z-popover`  | 100   | Skip menu, floating panels  |

## Touch Target

| Token                | Value | Usage                                      |
| -------------------- | ----- | ------------------------------------------ |
| `--size-touch-target` | 44px  | WCAG AA minimum for close/nav buttons      |

## Border Radius

| Token          | Value | Usage                               |
| -------------- | ----- | ----------------------------------- |
| `--radius-sm`  | 4px   | Toggles, cells, bars, small buttons |
| `--radius-md`  | 8px   | Cards, answer buttons, CTAs         |
| `--radius-lg`  | 12px  | Settings modal                      |
