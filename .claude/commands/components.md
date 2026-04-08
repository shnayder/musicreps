Component pattern guidance for designing new UI and reviewing changes.

## Reference

Read `$DOCS_VAULT/guides/design/components.md` for the full system: button
variant taxonomy, info hierarchy pattern, ActionButton vs raw button decision
framework.

## Mode

Parse `$ARGUMENTS`:

- **Empty, or a feature/screen name** → design mode
- **"review"** or a commit range → review mode

## Design mode

When the user is adding new interactive elements or components:

1. Identify each interactive element and classify it using the 8-variant button
   taxonomy (primary action, secondary action, small action, answer, toggle,
   tab, text link, close).
2. Verify **no style reuse across roles** — each variant has a distinct visual
   treatment.
3. Apply the **ActionButton rule**: `<ActionButton>` for flow actions (start,
   stop, continue, done). Raw `<button>` with specific class for everything
   else.
4. For metric displays, apply the **info hierarchy pattern**: label + value +
   explanation, encoded with `<Text>` roles.
5. Check the preview page's Buttons tab for current variant styling.
6. Present the mapping as a table: element → variant → component/class.

## Review mode

When reviewing component changes on a branch or diff:

1. Identify what changed (new component, variant change, or pattern deviation).
2. Run the checklist:
   - **Taxonomy compliance**: Every interactive element maps to one of the 8
     variants?
   - **No cross-role styling**: Variants maintain distinct visual treatments?
   - **ActionButton rule**: Flow actions use `<ActionButton>`, others don't?
   - **Info hierarchy**: Metric displays use the label/value/explanation pattern
     with correct Text roles?
   - **Preview page**: Are new components or variants shown in the Buttons or
     Screen Structure tabs?
3. Report findings organized as: correct, warnings, issues.
