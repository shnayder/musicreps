# Interaction & Accessibility

Interactive state patterns and accessibility standards.

## Interaction Patterns

### Hover (Desktop)

Darken background slightly. No layout shift. Transition color and border
smoothly using duration tokens.

### Active / Pressed

Pressed surface color, subtle scale-down on buttons.

### Focus Visible (Keyboard)

Visible focus ring using `--color-brand` on `:focus-visible`. Mouse/touch users
see no outline (`:focus:not(:focus-visible)` removes it).

### Transitions

Apply transitions strategically — not everything should animate:

| Category | Speed | Easing | Examples |
|----------|-------|--------|----------|
| Color changes | Quick | ease | Background, border on hover |
| Layout/size | Fast | ease | Transform scale on press |
| Progress bar | Gradual | ease | Width depletion |
| Countdown bar | Steady | linear | Time-based pacing |

Duration tokens are defined in `src/styles.css`. Easing functions stay literal
because CSS `transition` shorthand doesn't support variable substitution for the
timing function alone.

**Live reference:** The preview page's **Design System** tab shows spacing and
token values including duration tokens.

## Accessibility Standards

- **WCAG AA contrast:** 4.5:1 for normal text, 3:1 for large text
- **No red/green as sole differentiator:** Heatmap uses terracotta-to-sage
- **44px minimum touch targets:** All answer/note buttons meet or exceed this
- **`@media (prefers-reduced-motion: reduce)`:** Disables all transitions and
  animations
- **`:focus-visible`** on all interactive elements
- **Semantic color separation:** Feedback always green/red; brand never for
  correct/wrong
