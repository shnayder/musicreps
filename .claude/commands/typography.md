Typography guidance for designing new UI and reviewing changes.

## Reference

Read `guides/design/typography.md` for the full system: three-layer
architecture, 5-tier scale, 20 roles, intensity tiers, design principles.

## Mode

Parse `$ARGUMENTS`:

- **Empty, or a feature/screen name** → design mode
- **"review"** or a commit range → review mode

## Design mode

When the user is building new UI or adding text elements:

1. Identify each text element and its semantic function.
2. Assign a role from the existing 20 roles (see guide).
3. Verify **max 3 size tiers** on the screen (display / large / standard / small
   / tiny — pick at most 3).
4. Check **intensity tiers** — elements at the same tier should have matched
   visual weight.
5. If no existing role fits, propose a new one:
   - Which group? (display, heading, body, label, quiz, etc.)
   - Which size tier? (must be one of the 5 existing tiers)
   - Which intensity tier?
   - Define all 4 properties (size, weight, leading, color)
6. Present the mapping as a table: element → role → size tier.

## Review mode

When reviewing typography changes on a branch or diff:

1. Identify what changed (new text element, role recipe change, or component
   reassignment).
2. Run the checklist:
   - **Layer check**: Is the change at the right layer? Role recipe wrong →
     Layer 2. Wrong role → Layer 3. Whole scale off → Layer 1.
   - **Size tier check**: Uses one of 5 tiers? No new sizes introduced?
   - **3-per-screen check**: Affected screens show ≤3 font sizes in the main
     content area?
   - **Intensity match**: Adjacent elements at the right tier? Nothing jumping
     out unexpectedly?
   - **Override check**: Bespoke CSS uses `--type-*` role properties for all 4
     properties? No palette tokens leaking through?
   - **Build template parity**: If the element appears in build-time HTML
     (`html-helpers.ts`), does the bespoke CSS carry the full 4-property role
     recipe?
3. Report findings organized as: correct, warnings, issues.
