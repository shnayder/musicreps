# Interaction & Accessibility

Interactive states and accessibility standards.

## Interaction Patterns

### Hover (Desktop)

Darken background slightly. No layout shift.

```css
transition: background var(--duration-base) ease, border-color var(--duration-base) ease;
```

### Active / Pressed

`--color-surface-pressed` background, subtle `scale(0.97)` on buttons.

### Focus Visible (Keyboard)

```css
:focus-visible {
  outline: 2px solid var(--color-brand);
  outline-offset: 2px;
}
```

Mouse/touch users see no outline (`:focus:not(:focus-visible)` removes it).

### Transitions

- Color changes: `var(--duration-base)` ease
- Layout/size: `var(--duration-fast)` ease (transform scale)
- Progress bar: `var(--duration-slow)` ease (width)
- Countdown bar: `var(--duration-linear)` linear

## Accessibility Standards

- **WCAG AA contrast:** 4.5:1 for normal text, 3:1 for large text
- **No red/green as sole differentiator:** Heatmap uses terracotta-to-sage
- **44px minimum touch targets:** All answer/note buttons are 48px tall
- **`@media (prefers-reduced-motion: reduce)`:** Disables all transitions and
  animations
- **`:focus-visible`** on all interactive elements
- **Semantic color separation:** Feedback always green/red; brand never for
  correct/wrong
