Screen and layout pattern guidance for designing new UI and reviewing changes.

## Reference

Read `guides/design/screen-patterns.md` for the full system: screen patterns
(home, mode top bar, practice card, quiz, round complete) and layout techniques
(vertical centering, stat cards, two-row answers, viewport queries).

## Mode

Parse `$ARGUMENTS`:

- **Empty, or a feature/screen name** → design mode
- **"review"** or a commit range → review mode

## Design mode

When the user is designing a new screen or modifying layout:

1. Identify which screen pattern applies (home, mode, quiz, round complete).
2. Verify the structural hierarchy matches the established pattern for that
   screen type.
3. Check **layout rules**:
   - Quiz content centers vertically (no top-stacking on large screens)
   - Summary blocks use card surface containment
   - 12-answer chromatic layouts use the two-row piano arrangement
   - Component sizing uses max-width, not viewport queries
   - Viewport queries reserved for structural layout and typography scaling
4. Check the preview page's Screen Structure and Full Flow tabs for current
   patterns.
5. Present the layout as: screen → pattern → structural elements.

## Review mode

When reviewing screen or layout changes on a branch or diff:

1. Identify what changed (new screen, layout modification, or pattern
   deviation).
2. Run the checklist:
   - **Pattern compliance**: Screen follows the established structural pattern?
   - **Vertical centering**: Quiz content centered, not top-stacked?
   - **Card containment**: Summary/stat blocks inside card surfaces?
   - **Viewport query rule**: `@media` queries only for structural layout and
     typography, not component internals?
   - **Component sizing**: No viewport-conditional component sizing?
   - **Preview page**: Are layout changes reflected in the Screen Structure tab?
3. Report findings organized as: correct, warnings, issues.
