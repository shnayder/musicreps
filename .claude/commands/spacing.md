Spacing and token guidance for designing new UI and reviewing changes.

## Reference

Read `../musicreps-docs/guides/design/spacing-and-tokens.md` for the full
system: spacing scale, elevation, transitions, opacity, z-index, touch targets,
border radius.

## Mode

Parse `$ARGUMENTS`:

- **Empty, or a feature/screen name** → design mode
- **"review"** or a commit range → review mode

## Design mode

When the user is laying out new UI or adjusting spacing:

1. Identify each gap, padding, and margin in the layout.
2. Map each to a spacing token (`--space-1` through `--space-6`) — never use
   one-off pixel values.
3. Check **elevation**: use shadow tokens for depth, not outlines/glows.
4. Check **transitions**: color changes get base duration, layout gets fast,
   progress gets slow. Easing functions stay literal.
5. Check **touch targets**: interactive elements meet 44px minimum.
6. Check **border radius**: uses one of the 3 radius tokens (sm, md, lg).
7. If no existing token fits, propose extending the scale — but resist adding
   tokens between existing steps.
8. Present the mapping as a table: element → token → purpose.

## Review mode

When reviewing spacing/token changes on a branch or diff:

1. Identify what changed (new token usage, token value change, or one-off values
   introduced).
2. Run the checklist:
   - **Token discipline**: All spacing uses `--space-*` tokens? No magic
     numbers?
   - **Scale integrity**: If modifying token values, does the scale still
     progress logically?
   - **Elevation usage**: Shadows used for depth, not borders/outlines?
   - **Touch targets**: Interactive elements >= 44px?
   - **Radius consistency**: Uses one of 3 radius tokens?
   - **Transition strategy**: Appropriate duration token for the property type?
   - **Preview page**: Are changed tokens visible in the Design System tab?
3. Report findings organized as: correct, warnings, issues.
