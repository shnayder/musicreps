# Create a PR after full verification

Run all checks before pushing and creating a PR. Do NOT skip any step.

## Steps

1. **Run `deno task ok`** (lint + fmt + check + unit tests + build).
   - This MUST pass before proceeding. If it fails, fix the issue and re-run.
   - Do NOT push or create a PR if it fails.

2. **Push the branch** with `git push -u origin <branch>`.

3. **Create the PR** with `gh pr create` following the PR format in CLAUDE.md.

4. **Wait for CI** — run `/check-ci` to verify the CI run passes. CI runs E2E
   tests that can't run in the web sandbox (Playwright). Do NOT declare success
   until CI is green.
   - If CI fails, investigate, fix, re-run `deno task ok`, and push again.
   - Re-run `/check-ci` after the fix.

## Important

- The web sandbox does not have Playwright, so E2E tests only run in CI. This
  makes step 4 (checking CI) critical — it's the only place E2E tests run.
- If you changed UI selectors, CSS classes, or component structure, E2E tests
  are especially likely to break.
- The sandbox must be disabled for `gh` commands.
