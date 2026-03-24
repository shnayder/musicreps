#!/usr/bin/env bash
# Prune stale remote-tracking refs and delete local branches merged into main.
#
# Usage:
#   scripts/prune-branches.sh          # Preview mode (dry run)
#   scripts/prune-branches.sh --do-it  # Actually delete

set -euo pipefail

# Branches to always keep, even if merged.
KEEP=(
  main
  gh-pages
  "workstream/*"
)

DO_IT=false
if [[ "${1:-}" == "--do-it" ]]; then
  DO_IT=true
fi

# --- Remote prune ---
echo "=== Remote tracking refs to prune ==="
stale=$(git remote prune origin --dry-run 2>&1 | grep '\[would prune\]' || true)
if [[ -z "$stale" ]]; then
  echo "  (none)"
else
  echo "$stale"
  if $DO_IT; then
    git remote prune origin
    echo "  -> pruned."
  fi
fi

# --- Local merged branches ---
echo ""
echo "=== Local branches merged into main ==="

current_branch=$(git symbolic-ref --short HEAD 2>/dev/null || echo "")

# Build grep pattern to exclude kept branches.
# Anchors each pattern to full branch name (after leading whitespace).
exclude_pattern="^[\\*\\+]"
for keep in "${KEEP[@]}"; do
  # Convert glob * to regex .*, anchor to full line
  pattern=$(echo "$keep" | sed 's/\*/.\*/g')
  exclude_pattern="$exclude_pattern|^[[:space:]]*${pattern}$"
done

merged=$(git branch --merged main | grep -vE "$exclude_pattern" || true)

# Also exclude the current branch.
if [[ -n "$current_branch" ]]; then
  merged=$(echo "$merged" | grep -v "^[[:space:]]*${current_branch}$" || true)
fi

# Trim whitespace and drop empty lines.
merged=$(echo "$merged" | sed 's/^[[:space:]]*//' | grep -v '^$' || true)

if [[ -z "$merged" ]]; then
  echo "  (none)"
else
  echo "$merged" | while read -r branch; do
    echo "  $branch"
  done

  count=$(echo "$merged" | wc -l | tr -d ' ')
  echo ""
  if $DO_IT; then
    echo "$merged" | xargs git branch -d
    echo "  -> deleted $count branches."
  else
    echo "$count branches to delete. Run with --do-it to execute."
  fi
fi
