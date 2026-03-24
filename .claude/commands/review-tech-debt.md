Audit the tech debt tracker against the current codebase.

## Steps

1. Read `plans/exec-plans/tech-debt-tracker.md` to get all active items.

2. For each active item, investigate the codebase to determine whether it has
   been fixed, partially addressed, or is still present. Use grep/glob/read as
   needed — don't just trust descriptions, verify against the actual code.

3. Check for new tech debt not yet tracked:
   - Scan recent commits on the current branch for TODO/FIXME/HACK comments.
   - Look for patterns that commonly indicate debt: duplicated code blocks,
     ad-hoc workarounds, hardcoded values that should be configurable.

4. Present findings as a table: | # | Item (summary) | Status | Evidence |
   - Status: **Fixed**, **Partially fixed**, **Still present**, or **New**
   - Evidence: file paths, line numbers, or brief explanation

5. After user confirms, update the tracker:
   - Move fixed items to the "Fixed" section with a brief note.
   - Add any confirmed new items to the active list with appropriate interest
     rate (LOW / MEDIUM / HIGH).
   - Update descriptions of partially-fixed items.
