Review the current branch's changes by delegating to the **code-reviewer** subagent.

## How to determine the scope

Parse `$ARGUMENTS`:
- **Empty or "diff"** → tell the subagent to review the current working tree diff
- **A number (e.g. "42")** → tell it to review PR #42
- **Contains ".." (e.g. "main..HEAD")** → tell it to review that commit range

## Steps

1. Delegate the review to the `code-reviewer` agent, passing the scope.
2. Present the subagent's findings to the user.
3. If the verdict is **Request changes**, offer to fix the critical issues.
   - Fix them, then re-delegate to `code-reviewer` for another pass.
   - Repeat until it approves or 3 rounds have passed.
4. If the verdict is **Approve** (or 3 rounds exhausted), stop and summarize.
