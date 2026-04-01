#!/bin/bash
set -e

echo "Setting up worktree: $WORKTREE_BRANCH"

# Start a dev server for this worktree
deno task dev &

echo "Setup complete"