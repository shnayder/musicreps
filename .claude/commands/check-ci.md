# Check CI status for the current branch

Poll GitHub Actions and Copilot code review until both complete, then report.

## Steps

1. Get the current branch name and PR number (if any).

2. **Run `scripts/poll-ci.sh`** — this is a whitelisted helper that polls both
   GitHub Actions and (if a PR is given) the Copilot review, printing results
   as structured output:

   ```bash
   # Poll CI only
   scripts/poll-ci.sh

   # Poll CI + Copilot review for an open PR
   scripts/poll-ci.sh --pr <number>
   ```

   The script polls every 30s up to 10 minutes. It prints the CI conclusion
   (`success` / `failure` / etc.) and, on failure, the last 40 lines of
   `gh run view --log-failed`. For Copilot it prints the review body and
   any inline comments in `[path:line] body` format.

   **After the script finishes, check the conclusion.** Do not assume success
   — read the actual `CI:` line in the output. CI includes E2E tests that may
   catch regressions not covered by `deno task ok` (e.g., removed CSS classes
   used as Playwright selectors).

3. **Report results**:
   - **CI**: If success, report "CI passed" with the run ID. If failure, the
     script already printed the failed step logs — report which step failed.
   - **Copilot review**: Summarize any comments. If there are actionable
     suggestions, address them (fix code, push, and re-check). If comments are
     cosmetic or incorrect, note why they can be skipped.

## Important

- `scripts/poll-ci.sh` is whitelisted in session permissions, so it will not
  trigger a permission prompt. Prefer it over running `gh` commands directly.
- Do NOT declare CI is green without actually checking. "I pushed, it should be
  fine" is not acceptable.
- If CI fails, investigate the root cause before pushing a fix. The script
  prints the failed step logs; read the actual error output rather than
  guessing.
- CI runs E2E tests via Playwright that are NOT covered by `deno task ok`. A
  common failure mode: renaming or removing a CSS class that E2E tests use as a
  selector. Run `deno task prepush` locally if Playwright is available — it
  includes E2E tests. Always check CI after pushing, not just local unit tests.
- If you push a fix, you must re-poll until the NEW run completes and confirm it
  passes. Do not declare CI green based on a prior run.
- Address Copilot review comments before declaring the PR ready — they often
  catch real bugs (missing state handling, encoding issues, doc/code drift).
