# Check CI status for the current branch

Poll GitHub Actions and Copilot code review until both complete, then report.

## Steps

1. Get the current branch name and PR number (if any).

2. **GitHub Actions**: Poll until the latest run completes (max 10 minutes):
   ```bash
   for i in $(seq 1 20); do
     gh run list --branch <branch> --limit 1 \
       --json databaseId,status,conclusion \
       --jq '.[] | "\(.status) \(.conclusion) \(.databaseId)"'
     STATUS=$(gh run list --branch <branch> --limit 1 --json status --jq '.[0].status')
     if [ "$STATUS" = "completed" ]; then break; fi
     echo "Attempt $i: run still $STATUS, waiting 30s..."
     sleep 30
   done
   ```
   **After the run completes, check the conclusion.** Do not assume success —
   read the actual conclusion field. CI includes E2E tests that may catch
   regressions not covered by `deno task ok` (e.g., removed CSS classes used as
   Playwright selectors).

3. **Copilot code review** (claude/* branches only): If there is an open PR,
   poll for the Copilot review (it typically takes 3–7 minutes):
   ```bash
   for i in $(seq 1 20); do
     REVIEW=$(gh api repos/<owner>/<repo>/pulls/<number>/reviews \
       --jq '[.[] | select(.user.login | startswith("copilot-pull-request-reviewer"))] | length')
     if [ "$REVIEW" -gt 0 ]; then echo "Copilot review found"; break; fi
     echo "Attempt $i: no review yet, waiting 30s..."
     sleep 30
   done
   ```
   When it arrives, read the review body and inline comments:
   ```bash
   # Review summary
   gh api repos/<owner>/<repo>/pulls/<number>/reviews \
     --jq '.[] | select(.user.login | startswith("copilot-pull-request-reviewer")) | .body'
   # Inline comments
   gh api repos/<owner>/<repo>/pulls/<number>/comments \
     --jq '.[] | select(.user.login | test("copilot|github-actions")) | {path: .path, line: .line, body: .body}'
   ```

4. **Report results**:
   - **CI**: If success, report "CI passed" with the run URL. If failure, run
     `gh run view <run-id> --log-failed` and report which step failed.
   - **Copilot review**: Summarize any comments. If there are actionable
     suggestions, address them (fix code, push, and re-check). If comments are
     cosmetic or incorrect, note why they can be skipped.

## Important

- The `gh` CLI requires sandbox to be disabled.
- Do NOT declare CI is green without actually checking. "I pushed, it should be
  fine" is not acceptable.
- If CI fails, investigate the root cause before pushing a fix. Run
  `gh run view <run-id> --log-failed` and read the actual error output.
- CI runs E2E tests via Playwright that are NOT covered by `deno task ok`. A
  common failure mode: renaming or removing a CSS class that E2E tests use as a
  selector. Run `deno task prepush` locally if Playwright is available — it
  includes E2E tests. Always check CI after pushing, not just local unit tests.
- If you push a fix, you must re-poll until the NEW run completes and confirm it
  passes. Do not declare CI green based on a prior run.
- Address Copilot review comments before declaring the PR ready — they often
  catch real bugs (missing state handling, encoding issues, doc/code drift).
