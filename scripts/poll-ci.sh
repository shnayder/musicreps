#!/usr/bin/env bash
# Poll GitHub Actions and Copilot code review for the current branch.
# Usage: scripts/poll-ci.sh [--pr NUMBER]
#
# Polls CI run status every 30s (max 10 min). If a PR number is given,
# also polls for Copilot code review. Prints results as structured output
# for easy parsing.

set -euo pipefail

BRANCH=$(git rev-parse --abbrev-ref HEAD)
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
echo "Polling CI for branch $BRANCH..."
for i in $(seq 1 $MAX_ATTEMPTS); do
  RUN_JSON=$(gh run list --branch "$BRANCH" --limit 1 \
    --json databaseId,status,conclusion,url \
    --jq '.[0] // empty')
  if [ -z "$RUN_JSON" ]; then
    echo "  Attempt $i: no runs found, waiting ${INTERVAL}s..."
    sleep $INTERVAL
    continue
  fi
  STATUS=$(echo "$RUN_JSON" | jq -r '.status')
  if [ "$STATUS" = "completed" ]; then
    CONCLUSION=$(echo "$RUN_JSON" | jq -r '.conclusion')
    RUN_ID=$(echo "$RUN_JSON" | jq -r '.databaseId')
    echo "CI: $CONCLUSION (run $RUN_ID)"
    if [ "$CONCLUSION" != "success" ]; then
      echo ""
      echo "--- Failed step logs ---"
      gh run view "$RUN_ID" --log-failed 2>&1 | tail -40
    fi
    break
  fi
  echo "  Attempt $i: run still $STATUS, waiting ${INTERVAL}s..."
  sleep $INTERVAL
done

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
        --jq '.[] | select(.user.login | test("copilot|github-actions")) | "[\(.path):\(.line)] \(.body)"'
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
