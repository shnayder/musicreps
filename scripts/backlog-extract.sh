#!/bin/bash
# Extract backlog items from markdown files for diffing/validation.
#
# Usage:
#   scripts/backlog-extract.sh [file...]
#   scripts/backlog-extract.sh backlogs/*.md
#
# Extracts top-level list items (lines starting with "- " or "N. "),
# normalizes them for comparison. Useful for checking that no items
# were dropped during a reorganization.
#
# Pipe through sort for diffing:
#   scripts/backlog-extract.sh backlogs/*.md | sort > /tmp/claude/after.txt

set -euo pipefail

files=("$@")
if [ ${#files[@]} -eq 0 ]; then
  files=(backlogs/product.md backlogs/engineering.md backlogs/design.md backlogs/process.md)
fi

for f in "${files[@]}"; do
  if [ ! -f "$f" ]; then
    echo "WARN: $f not found" >&2
    continue
  fi
  # Extract top-level list items only (not sub-items, not headers, not metadata)
  # Top-level = starts with "- " or "N. " (no leading whitespace)
  grep -E '^- |^[0-9]+\. ' "$f" | \
    # Strip list markers
    sed 's/^- //' | \
    sed 's/^[0-9]\+\. //' | \
    # Strip priority tags like [P1], [P2], [--]
    sed 's/^\[P[0-9]\] //' | \
    sed 's/^\[--\] //' | \
    # Strip leading BUG: / NIT: prefixes
    sed 's/^BUG: //' | \
    sed 's/^NIT: //' | \
    # Normalize whitespace
    sed 's/[[:space:]]\+/ /g' | \
    # Trim trailing whitespace
    sed 's/ $//' | \
    # Take first 80 chars for matching (enough to identify, ignore formatting diffs)
    cut -c1-80
done
