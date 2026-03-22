# Check CI status for the current branch

Poll GitHub Actions until the latest run completes, then report the result.

## Steps

1. Get the current branch name.

2. Run `gh run list --branch <branch> --limit 1` to find the latest run.

3. If the run is still `in_progress` or `queued`, wait 30 seconds and check
   again. Repeat until it completes (max 10 minutes).

4. When completed:
   - If **success**: report "CI passed" with the run URL.
   - If **failure**: run `gh run view <run-id> --log-failed` to get the failure
     details. Report which step failed and the error message. Do NOT declare
     success.

## Important

- The `gh` CLI requires sandbox to be disabled.
- Do NOT declare CI is green without actually checking. "I pushed, it should be
  fine" is not acceptable.
- If CI fails, investigate the root cause before pushing a fix. Read the actual
  error output.
