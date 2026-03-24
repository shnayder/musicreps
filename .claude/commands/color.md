Color system guidance for designing new UI and reviewing changes.

## Reference

Read `guides/design/color-system.md` for the full system: three-layer token
architecture, palette model, semantic families, color design principles.

## Mode

Parse `$ARGUMENTS`:

- **Empty, or a feature/screen name** → design mode
- **"review"** or a commit range → review mode

## Design mode

When the user is adding new colored elements or defining component states:

1. Identify each colored element and its semantic purpose.
2. Find the appropriate semantic token — never hardcode hex/HSL values.
3. Check the **three-layer rule**: component CSS should reference Layer 3 (`--_`
   tokens) or Layer 2 (semantic tokens), never Layer 1 (primitives).
4. Verify the **palette model** — only green (brand/success), gold (attention),
   and red (error) carry meaning. Everything else is neutral chrome.
5. If no existing token fits, propose a new one:
   - Which family? (brand, error, notice, accent, text, surface, border)
   - Follow the accent + variants pattern (base, -bg, -border, -text)
   - Does it need a component token (`--_` prefix)?
6. Present the mapping as a table: element → token → family.

## Review mode

When reviewing color changes on a branch or diff:

1. Identify what changed (new color token, semantic mapping, or component token
   override).
2. Run the checklist:
   - **Layer check**: Is the change at the right layer? Wrong semantic mapping →
     Layer 2. Wrong component token → Layer 3. Whole palette off → Layer 1.
   - **No hardcoded values**: All colors reference CSS custom properties?
   - **Palette discipline**: Only green/gold/red carry meaning? No new hues
     introduced without justification?
   - **Family pattern**: New tokens follow the accent + variants pattern?
   - **Contrast check**: Text on colored backgrounds meets WCAG AA (4.5:1)?
   - **Heatmap integrity**: If touching heatmap tokens, monotonic lightness
     preserved? Grayscale readability intact?
   - **Preview page**: Are new tokens visible in the Colors tab?
3. Report findings organized as: correct, warnings, issues.
