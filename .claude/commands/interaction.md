Interaction and accessibility guidance for designing new UI and reviewing
changes.

## Reference

Read `guides/design/interaction.md` for the full system: hover, active, focus
states, transition strategy, and accessibility standards.

## Mode

Parse `$ARGUMENTS`:

- **Empty, or a feature/screen name** → design mode
- **"review"** or a commit range → review mode

## Design mode

When the user is adding interactive states or new interactive elements:

1. Identify each interactive element and its required states (hover, active,
   focus, disabled).
2. Check **hover**: background darkens slightly, no layout shift, smooth
   transition.
3. Check **active/pressed**: pressed surface color, subtle scale-down on
   buttons.
4. Check **focus visible**: visible focus ring on keyboard navigation, invisible
   on mouse/touch.
5. Check **transitions**: correct duration category (quick for color, fast for
   layout, gradual for progress, steady for countdown).
6. Run the **accessibility checklist**:
   - WCAG AA contrast (4.5:1 normal text, 3:1 large text)
   - No red/green as sole differentiator
   - 44px minimum touch targets
   - `prefers-reduced-motion` disables animations
   - `:focus-visible` on all interactive elements
   - Semantic color separation (green=correct, red=wrong, never brand for
     feedback)
7. Present findings as a table: element → states → accessibility status.

## Review mode

When reviewing interaction or accessibility changes on a branch or diff:

1. Identify what changed (new interactive state, transition change, or
   accessibility impact).
2. Run the checklist:
   - **State completeness**: All interactive elements have hover, active, focus
     states?
   - **No layout shift**: Hover/active transitions don't move surrounding
     elements?
   - **Focus visible**: Keyboard users see focus rings, mouse users don't?
   - **Transition strategy**: Correct duration category for the property type?
   - **Reduced motion**: `prefers-reduced-motion` respected?
   - **Contrast**: Text on all backgrounds meets WCAG AA?
   - **Touch targets**: All interactive elements >= 44px?
   - **Color semantics**: Feedback uses green/red, brand never for right/wrong?
3. Report findings organized as: correct, warnings, issues.
