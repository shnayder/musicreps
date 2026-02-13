# Feature Process

How to plan, design, implement, and document changes.

## Context when 
- vision.md describes the long-term vision for the app. Relevant when making major design decisions, rarely relevant when following existing patterns.
- ux-principles.md
- 

## When to Write What

### Design spec

Write when there are **open design questions** about what to build. Typical
for new quiz modes, new UX patterns, or features where the question format,
item structure, or interaction model needs to be worked out.

Example: `plans/product-specs/2026-02-11-new-quiz-modes-spec.md` — designed
question formats, item ID schemes, grouping, and answer input for 4 new modes.

When reviewing specs, focus on requirements, goals, scope, phasing. Do not bring up code-level concerns unless they have significant impact on scope, performance, etc. It is expected that new code will be necessary -- no need to bring it up at this stage.

Principle: don't future-proof in most cases. There'll be time enough to refactor and add additional abstractions, info, etc when we want to actually use it. e.g. when tracking # of items done in a quiz, don't need to persist it until we actually plan to display the persisted value somewhere. 

### Implementation plan

Write when the **design is settled** but the technical approach has options,
touches multiple systems, or benefits from a written walkthrough.

Example: `plans/design-docs/2026-02-11-architecture-review.md` — phased
refactoring plan with code samples for each extraction step.

### Bug fix plan

Write for **non-trivial bugs** affecting multiple files or shared systems.
Skip for obvious single-file fixes.

Example: `plans/exec-plans/completed/2026-02-12-fix-chord-spelling-bugs.md` —
diagnosed 3 related enharmonic bugs, documented root causes, and planned fixes.

### Skip the spec

- small, straightfoward tweaks to existing features.
- bug fixes
- version bumps
- Significant technical improvements should get a spec, even if they're not user-facing. 

### Skip the plan

- Single-file bug fixes with obvious solutions
- CSS-only visual changes
- Version bumps
- Typo fixes

## Plan File Naming

```
plans/product-specs/YYYY-MM-DD-{short-description}-spec.md  -- goals, functional design, UX notes
plans/design-docs/YYYY-MM-DD-{short-description}.md         -- architectural explorations
plans/exec-plans/active/YYYY-MM-DD-{short-description}.md   -- implementation plans (in progress)
plans/exec-plans/completed/                                  -- move here when done
```

Use the date you start the work. Use kebab-case for the description.

## Plan Lifecycle

1. **Create** the spec and/or plan on the feature branch BEFORE starting
   implementation. Place in the appropriate subdirectory (`product-specs/`,
   `design-docs/`, or `exec-plans/active/`).
2. **Commit** the spec and plan as the first commit on the branch.
3. **Implement** the feature, referring to the plan.
4. **Update** the plan: add an "Implementation Notes" section documenting
   deviations, additions, or dropped scope.
5. **Move** exec plans from `active/` to `completed/` when the branch merges.
6. **Commit** the updated plan alongside the implementation.

## Architectural Review (Before Implementing)

Before writing code, verify that your design:

- **Integrates with existing patterns**: state machine phases, declarative
  `render()`, mode plugin interface, factory pattern. Don't introduce parallel
  mechanisms (shadow booleans, imperative DOM overrides). See
  [architecture.md](architecture.md) for pattern details.
- **Extends shared abstractions** when that's cleaner than working around them.
  If adding a new state phase to the engine, add it to `quiz-engine-state.js`.
- **Follows build system conventions**: `readModule()` for ES modules,
  correct concatenation position, template sync in both `main.ts` and
  `build.ts`. See [architecture.md](architecture.md#build-system).
- **Reuses shared helpers**: `computeRecommendations()` for progression,
  `createStatsControls()` for stats display, `createNoteKeyHandler()` for
  keyboard input, `deriveScaledConfig()` for timing thresholds.

## Templates

### Design Spec

````markdown
# {Feature Name} — Design Spec

## Overview

One-paragraph summary: what this does for the user and why it matters.

## {Sub-feature / Mode 1}

### What you're memorizing/practicing

What knowledge or skill is being drilled.

### Question format

- **Forward**: "{example question}" → **{example answer}**
- **Reverse**: "{example question}" → **{example answer}**

### Items

- Total count and derivation (e.g., 12 keys × 7 degrees × 2 directions)
- Item ID format (e.g., `D:5:fwd`, `D:A:rev`)

### Grouping and sequencing

| Group | Contents | Rationale | Items |
|-------|----------|-----------|-------|
| 0 | ... | ... | ... |

### Answer input

- Button layout
- Keyboard shortcuts (check for conflicts)

## Cross-cutting design notes

Enharmonic handling, adaptive system integration, shared infrastructure reuse.

## Resolved decisions

- **Decision**: chosen option — rationale
````

### Implementation Plan

````markdown
# {Feature Name}

## Problem / Context

What motivates this change. What's broken, missing, or being improved.

## Design

Technical approach:
- Data structures and state shape
- Key functions and signatures
- UI changes (HTML/CSS)
- Build integration (new files, readModule vs read, concatenation position)

## Implementation Steps

1. Step one (independently testable/verifiable)
2. Step two
3. ...

## Files Modified

| File | Changes |
|------|---------|
| `src/...` | Description |
| `main.ts` | Template + file reads |
| `build.ts` | Template + file reads |

## Testing

- New test cases
- Manual verification scenarios

## Version

v{current} → v{new}

## Implementation Notes (added after completion)

### What was done

Summary of actual implementation.

### Deviations from plan

What changed and why.
````

### Bug Fix

````markdown
# Fix: {Short Description}

## Bug: {Title}

**Problem**: What the user sees or what breaks.

**Root cause**: Why it happens (file, function, mechanism).

**Fix**: What to change and where.

## Changes

1. `file.js` — description of change
2. `main.ts` / `build.ts` — version bump if needed

## Implementation Notes (added after completion)

What differed from plan, if anything.
````

## Updating Existing Plans

After implementation, always add an "Implementation Notes" section. This is
valuable for future reference — it documents what was actually built (vs.
planned), captures lessons learned, and helps future agents understand the
history of design decisions.

Include:
- **What was done**: brief summary of actual changes
- **Deviations from plan**: what changed and why
- **Test counts**: how many tests were added
- **Files modified**: final table (if it differs from the plan)

## Updating tech-debt-tracker

- If the implementation created any new technical debt, add it to
  `plans/exec-plans/tech-debt-tracker.md`.
- If code review or bug fixes identified untracked existing debt, add it too.
