# Restructure Documentation for AI-Friendly Development

## Context

CLAUDE.md (~300 lines) had grown into a monolith mixing quick-reference info,
detailed algorithm docs, process guidance, and environment-specific setup.
This mirrors the failure mode described in OpenAI's harness engineering post:
too much in one file crowds out the task, agents pattern-match locally instead
of navigating intentionally, and the file becomes hard to maintain.

Meanwhile, the recently added code-reviewer subagent and review checklist
encode coding standards in "verify" form — but the explanatory context (why
patterns exist, how to follow them, when to use each approach) lived only
implicitly in the codebase.

## Design

### Approach: CLAUDE.md as map, guides/ as system of record

Inspired by OpenAI's harness engineering lessons: treat the instruction file
as a ~100-line table of contents, with the knowledge base in separate files.

- **CLAUDE.md** (~105 lines): orientation + pointers. Dev commands,
  architecture overview (pattern names with one-line descriptions), quiz modes
  table, keyboard shortcuts, guide index.
- **guides/**: focused documents that are the source of truth for how and why.
- **Review checklist**: cross-references guides so reviewers can look up the
  full explanation for each check.

### File structure

```
CLAUDE.md                           # ~105-line entry point
guides/
  architecture.md                   # Patterns, module graph, algorithms, adding modes
  coding-style.md                   # Naming, DOM rules, testing patterns
  development.md                    # Commands, testing, versioning, branching, deploy
  feature-process.md                # Plan types, templates, lifecycle
  vision.md                         # Skeleton with [NEEDS INPUT] placeholders
```

### What moved where

| CLAUDE.md section | Destination |
|-------------------|-------------|
| Motor Baseline Calibration | guides/architecture.md § Algorithms |
| Adaptive Selector | guides/architecture.md § Algorithms |
| Forgetting Model | guides/architecture.md § Algorithms |
| String Recommendations | guides/architecture.md § Algorithms |
| Distance Group Progression | guides/architecture.md § Algorithms |
| "How It Works" | Dropped (redundant with expanded Architecture section) |
| Testing | guides/development.md |
| Versioning | guides/development.md |
| Screenshots | guides/development.md |
| Branching | guides/development.md |
| Implementation Plans | guides/feature-process.md |
| GitHub API Access | guides/development.md |

### New content (not previously documented)

- Module dependency graph (ASCII diagram)
- Build system detail: readModule() vs read(), concatenation order, ES module
  ↔ browser global bridge
- State + Render pattern (explanation and code examples)
- Mode plugin interface (full createXxxMode() structure)
- Factory pattern for testability (createFretboardHelpers example)
- Stats display pattern
- "Adding a New Quiz Mode" 12-step checklist
- Coding conventions: file naming, naming conventions (with tables), DOM rules,
  state management, error handling, CSS conventions
- Feature process: when to write a design spec vs. implementation plan vs. bug
  fix plan, plan lifecycle, architectural review checklist
- Templates: design spec, implementation plan, bug fix
- Vision skeleton: design principles, current state, roadmap placeholders

## Files Modified

| File | Changes |
|------|---------|
| `CLAUDE.md` | Rewritten as ~105-line table of contents |
| `guides/architecture.md` | **New** — patterns, module graph, algorithms, adding modes |
| `guides/coding-style.md` | **New** — naming, DOM rules, testing patterns |
| `guides/development.md` | **New** — commands, testing, versioning, deploy |
| `guides/feature-process.md` | **New** — plan types, templates, lifecycle |
| `guides/vision.md` | **New** — skeleton with [NEEDS INPUT] placeholders |
| `.claude/commands/review-checklist.md` | Added cross-references to guides |

## Version

No version bump — docs-only change, no code changes.
