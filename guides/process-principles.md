# Process Principles

Enduring values for how we develop this app. Not workflow steps (those are in
[feature-process.md](feature-process.md) and [development.md](development.md))
but the principles behind them.

---

## Accelerate through investment

The goal is to continuously improve context, tooling, and process so that
changes and improvements happen faster, with less review and fewer bugs over
time. Every feature is an opportunity to leave the codebase in better shape than
we found it -- better guides, sharper conventions, more reusable patterns,
tighter review automation.

This means:

- When a bug reveals a missing convention, document the convention.
- When a feature requires a pattern that will recur, extract it as shared
  infrastructure.
- When review catches a class of issue repeatedly, add it to the automated
  checklist.
- When a guide is wrong or incomplete, fix it now rather than working around it.

The measure of success isn't just "did the feature ship" but "is the next
feature easier to ship correctly?"
