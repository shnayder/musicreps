#!/usr/bin/env bash
# Poll GitHub Actions and Copilot code review for the current branch.
# Usage: scripts/poll-ci.sh [--pr NUMBER]
#
# Polls CI run status every 30s (max 10 min). If a PR number is given,
# also polls for Copilot code review. Prints results as structured output
# for easy parsing.

set -euo pipefail

# Use the remote tracking branch name if available (worktrees may push
# the local branch under a different remote name).
_REMOTE_REF=$(git rev-parse --abbrev-ref '@{upstream}' 2>/dev/null || true)
if [ -n "$_REMOTE_REF" ]; then
  BRANCH="${_REMOTE_REF#*/}"  # strip remote prefix (e.g. origin/)
else
  BRANCH=$(git rev-parse --abbrev-ref HEAD)
fi
PR_NUMBER=""
MAX_ATTEMPTS=20
INTERVAL=30

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pr) PR_NUMBER="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)

# --- Poll CI ---
# Get the HEAD sha so we only look at runs for the current commit.
HEAD_SHA=$(git rev-parse HEAD)
echo "Polling CI for branch $BRANCH (${HEAD_SHA:0:8})..."
for i in $(seq 1 $MAX_ATTEMPTS); do
  # Fetch ALL runs for this branch+commit (not just the latest one).
  # Multiple runs can exist for the same commit (different workflows,
  # retries, re-triggers). We need to wait for all of them and report
  # the worst conclusion.
  RUNS_JSON=$(gh run list --branch "$BRANCH" --commit "$HEAD_SHA" \
    --json databaseId,status,conclusion,workflowName \
    --jq '.')
  RUN_COUNT=$(echo "$RUNS_JSON" | jq 'length')
  if [ "$RUN_COUNT" -eq 0 ]; then
    echo "  Attempt $i: no runs found for ${HEAD_SHA:0:8}, waiting ${INTERVAL}s..."
    sleep $INTERVAL
    continue
  fi
  # Check if any runs are still in progress
  PENDING=$(echo "$RUNS_JSON" | jq '[.[] | select(.status != "completed")] | length')
  if [ "$PENDING" -gt 0 ]; then
    STATUSES=$(echo "$RUNS_JSON" | jq -r '[.[] | select(.status != "completed") | .status] | unique | join(", ")')
    echo "  Attempt $i: $PENDING of $RUN_COUNT runs still $STATUSES, waiting ${INTERVAL}s..."
    sleep $INTERVAL
    continue
  fi
  # All runs completed. Find the worst conclusion (failure > cancelled > success).
  FAILED_RUN=$(echo "$RUNS_JSON" | jq -r '[.[] | select(.conclusion != "success" and .conclusion != "skipped")] | first // empty')
  if [ -n "$FAILED_RUN" ]; then
    CONCLUSION=$(echo "$FAILED_RUN" | jq -r '.conclusion')
    RUN_ID=$(echo "$FAILED_RUN" | jq -r '.databaseId')
    WORKFLOW=$(echo "$FAILED_RUN" | jq -r '.workflowName')
    echo "CI: $CONCLUSION (run $RUN_ID, $WORKFLOW)"
    echo ""
    echo "--- Failed step logs ---"
    gh run view "$RUN_ID" --log-failed 2>&1 | tail -40
  else
    # All succeeded (or were skipped). Report the first non-skipped run.
    SUCCESS_RUN=$(echo "$RUNS_JSON" | jq -r '[.[] | select(.conclusion == "success")] | first // empty')
    if [ -n "$SUCCESS_RUN" ]; then
      RUN_ID=$(echo "$SUCCESS_RUN" | jq -r '.databaseId')
      echo "CI: success (run $RUN_ID)"
    else
      echo "CI: skipped (all $RUN_COUNT runs skipped)"
    fi
  fi
  break
done

# --- Merge status (if PR given) ---
if [ -n "$PR_NUMBER" ]; then
  echo ""
  MERGE_JSON=$(gh pr view "$PR_NUMBER" --json mergeable,mergeStateStatus)
  MERGEABLE=$(echo "$MERGE_JSON" | jq -r '.mergeable')
  MERGE_STATE=$(echo "$MERGE_JSON" | jq -r '.mergeStateStatus')
  case "$MERGEABLE" in
    MERGEABLE)  echo "Merge: clean" ;;
    CONFLICTING) echo "Merge: CONFLICTS — rebase or merge main to resolve" ;;
    UNKNOWN)    echo "Merge: unknown (GitHub still computing)" ;;
    *)          echo "Merge: $MERGEABLE ($MERGE_STATE)" ;;
  esac
fi

# --- Poll Copilot review (if PR given) ---
if [ -n "$PR_NUMBER" ]; then
  echo ""
  echo "Polling Copilot review for PR #$PR_NUMBER..."
  for i in $(seq 1 $MAX_ATTEMPTS); do
    COUNT=$(gh api "repos/$REPO/pulls/$PR_NUMBER/reviews" \
      --jq '[.[] | select(.user.login | startswith("copilot-pull-request-reviewer"))] | length')
    if [ "$COUNT" -gt 0 ]; then
      echo "Copilot review found."
      echo ""
      echo "--- Review body ---"
      gh api "repos/$REPO/pulls/$PR_NUMBER/reviews" \
        --jq '.[] | select(.user.login | startswith("copilot-pull-request-reviewer")) | .body'
      echo ""
      echo "--- Inline comments ---"
      gh api "repos/$REPO/pulls/$PR_NUMBER/comments" \
        --jq '.[] | select(.user.login | test("copilot|github-actions"; "i")) | "[\(.path):\(.line // .original_line // .start_line // "?")] \(.body)"'
      break
    fi
    if [ "$i" -eq "$MAX_ATTEMPTS" ]; then
      echo "Copilot review: not received after $((MAX_ATTEMPTS * INTERVAL))s"
      break
    fi
    echo "  Attempt $i: no review yet, waiting ${INTERVAL}s..."
    sleep $INTERVAL
  done
fi
