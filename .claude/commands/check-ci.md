# Check CI status for the current branch

Poll GitHub Actions and Copilot code review until both complete, then report.

## Steps

1. Get the current branch name and PR number (if any).

2. **GitHub Actions**: Run `gh run list --branch <branch> --limit 1` to find the
   latest run. If still `in_progress` or `queued`, wait 30 seconds and check
   again. Repeat until it completes (max 10 minutes).

3. **Copilot code review** (claude/* branches only): If there is an open PR,
   check for Copilot review:
   ```
   gh pr view <number> --json reviews --jq '.reviews[] | select(.author.login == "copilot") | {state: .state, body: .body}'
   ```
   If no Copilot review yet, wait 30 seconds and check again (max 10 minutes).
   When it arrives, read the inline comments:
   ```
   gh api repos/<owner>/<repo>/pulls/<number>/comments --jq '.[] | select(.user.login == "github-actions[bot]" or .user.login == "copilot") | .body'
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
- If CI fails, investigate the root cause before pushing a fix. Read the actual
  error output.
- Address Copilot review comments before declaring the PR ready — they often
  catch real bugs (missing state handling, encoding issues, doc/code drift).
