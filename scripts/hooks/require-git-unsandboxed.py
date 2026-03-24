#!/usr/bin/env python3
"""PreToolUse hook: blocks sandboxed git commands so they retry unsandboxed.

Git needs full filesystem access to update .claude/ files during checkout/merge.
Without this, git silently skips sandbox-protected files, leaving a dirty worktree
that looks like uncommitted changes (which would undo upstream .claude/ updates).
"""

import json
import sys

input_data = json.load(sys.stdin)
tool_input = input_data.get("tool_input", {})

command = tool_input.get("command", "")
if not command.split()[0:1] == ["git"]:
    sys.exit(0)

if tool_input.get("dangerouslyDisableSandbox"):
    sys.exit(0)

print(
    "Git must run outside the sandbox to avoid partial updates to .claude/ files."
    " Retry with sandbox disabled.",
    file=sys.stderr,
)
sys.exit(2)
