# Feature Process

How to plan, design, implement, and document changes.

## Context

- `vision.md` describes the product vision.
  [design-principles.md](design-principles.md) covers product, visual, and UX
  principles. Relevant when making major design decisions, rarely relevant when
  following existing patterns.

## When to Write What

### Design spec

Write when there are **open design questions** about what to build. Typical for
new quiz modes, new UX patterns, or features where the question format, item
structure, or interaction model needs to be worked out.

Example: `plans/product-specs/completed/2026-02-11-new-quiz-modes-spec.md` —
designed question formats, item ID schemes, grouping, and answer input for 4 new
modes.

When reviewing specs, focus on requirements, goals, scope, phasing. Do not bring
up code-level concerns unless they have significant impact on scope,
performance, etc. It is expected that new code will be necessary -- no need to
bring it up at this stage.

Principle: don't future-proof in most cases. There'll be time enough to refactor
and add additional abstractions, info, etc when we want to actually use it. e.g.
when tracking # of items done in a quiz, don't need to persist it until we
actually plan to display the persisted value somewhere.

### Implementation plan

Write when the **design is settled** but the technical approach has options,
touches multiple systems, or benefits from a written walkthrough.

Example: `plans/design-docs/2026-02-11-architecture-review.md` — phased
refactoring plan with code samples for each extraction step.

### Bug fix plan

Write for **non-trivial bugs** affecting multiple files or shared systems. Skip
for obvious single-file fixes.

Example: `plans/exec-plans/completed/2026-02-12-fix-chord-spelling-bugs.md` —
diagnosed 3 related enharmonic bugs, documented root causes, and planned fixes.

### Skip the spec

- small, straightfoward tweaks to existing features.
- bug fixes
- version bumps
- Significant technical improvements should get a spec, even if they're not
  user-facing.

### Skip the plan

- Single-file bug fixes with obvious solutions
- CSS-only visual changes
- Version bumps
- Typo fixes

## Plan File Naming

```
plans/product-specs/active/YYYY-MM-DD-{short-description}-spec.md  -- goals, functional design, UX notes
plans/product-specs/completed/                                     -- move here when done, tested, signed off
plans/design-docs/YYYY-MM-DD-{short-description}.md               -- architectural explorations
plans/exec-plans/active/YYYY-MM-DD-{short-description}.md         -- implementation plans (in progress)
plans/exec-plans/completed/                                        -- move here when done
```

Use the date you start the work. Use kebab-case for the description.

## Plan Lifecycle

1. **Create** the spec and/or plan on the feature branch BEFORE starting
   implementation. Place in the appropriate subdirectory
   (`product-specs/active/`, `design-docs/`, or `exec-plans/active/`).
2. **Commit** the spec and plan as the first commit on the branch.
3. **Implement** the feature, referring to the plan.
4. **Update** the plan: add an "Implementation Notes" section documenting
   deviations, additions, or dropped scope.
5. **Move** exec plans from `active/` to `completed/` when the branch merges.
6. **Move** product specs from `active/` to `completed/` when the feature is
   done, tested, and signed off on.
7. **Commit** the updated plan alongside the implementation.

## Product Spec Review Checklist

Before considering a spec ready for review, verify:

- [ ] **Links to source documents.** If the spec implements part of a larger
      design doc, exploration, or backlog item, link to it in the Overview so
      readers can find the original context.
- [ ] **Stays at product level.** No state shapes, function signatures, storage
      keys, or DOM structure. Those belong in the implementation plan.
- [ ] **Consistent with design principles.** Check
      [design-principles.md](design-principles.md) — especially "fewer options"
      (can the system adapt instead of adding a toggle?) and "short-session
      friendly" (does state need to persist?).
- [ ] **Single user-facing metric where possible.** Avoid exposing internal
      distinctions (speed vs accuracy, timeout vs wrong) unless they're
      genuinely useful to the user.
- [ ] **Screen states described.** For UI features, describe what each screen
      state looks like (idle, quizzing, etc.) and the content priority order.
      See [layout-and-ia.md](design/layout-and-ia.md).
- [ ] **Labels and grouping specified.** New toggles, indicators, or data
      displays have labels. Related controls are grouped. No unlabeled elements.
- [ ] **Scope is clear.** Goals and non-goals are explicit. No feature creep
      disguised as "cross-cutting notes."
- [ ] **Decisions are resolved.** Each decision states the chosen option and the
      rationale. No "TBD" or "we could do X or Y."

## Architectural Review (Before Implementing)

Before writing code, verify that your design:

- **Integrates with existing patterns**: state machine phases, declarative
  `render()`, mode plugin interface, factory pattern. Don't introduce parallel
  mechanisms (shadow booleans, imperative DOM overrides). See
  [architecture.md](architecture.md) for pattern details.
- **Extends shared abstractions** when that's cleaner than working around them.
  If adding a new state phase to the engine, add it to `quiz-engine-state.ts`.
- **Follows build system conventions**: proper ES module `import`/`export`,
  entry point is `src/app.ts`. See
  [architecture.md](architecture.md#build-system).
- **Reuses shared helpers**: `computeRecommendations()` for progression,
  `createStatsControls()` for stats display, `createNoteKeyHandler()` for
  keyboard input, `deriveScaledConfig()` for timing thresholds.
- **Follows layout/IA principles**: content ordered by interaction priority per
  screen state, controls grouped and labeled, no redundant affordances. See
  [layout-and-ia.md](design/layout-and-ia.md).
- **Consistency over accommodation**: if a mode behaves differently, ask "should
  it?" before "how do we support that?" Change the outlier to match the standard
  rather than adding per-mode flags or overrides. See
  [architecture.md](architecture.md).

## Templates

### Design Spec

```markdown
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
| ----- | -------- | --------- | ----- |
| 0     | ...      | ...       | ...   |

### Answer input

- Button layout
- Keyboard shortcuts (check for conflicts)

## Cross-cutting design notes

Enharmonic handling, adaptive system integration, shared infrastructure reuse.

## Resolved decisions

- **Decision**: chosen option — rationale
```

### Implementation Plan

```markdown
# {Feature Name}

## Problem / Context

What motivates this change. What's broken, missing, or being improved.

## Design

Technical approach:

- Data structures and state shape
- Key functions and signatures
- UI changes (HTML/CSS)
- Build integration (new files, imports, entry point wiring)

## Implementation Steps

1. Step one (independently testable/verifiable)
2. Step two
3. ...

## Files Modified

| File      | Changes              |
| --------- | -------------------- |
| `src/...` | Description          |
| `main.ts` | Build script changes |

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
```

### Bug Fix

```markdown
# Fix: {Short Description}

## Bug: {Title}

**Problem**: What the user sees or what breaks.

**Root cause**: Why it happens (file, function, mechanism).

**Fix**: What to change and where.

## Changes

1. `file.js` — description of change
2. `src/build-template.ts` — version bump if needed

## Implementation Notes (added after completion)

What differed from plan, if anything.
```

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

## Updating guides

When a change introduces a convention, pattern, or rule that future development
must follow, update the relevant guide(s) so the knowledge isn't lost. Examples:

- New accidental naming rule → update `accidental-conventions.md` mode table
- New shared utility or pattern → update `architecture.md`
- New build step or workflow → update `development.md`
- New quiz mode → update the "Adding a New Quiz Mode" checklist

The test is: **if someone adding a new mode or feature would need to know this
to get it right, it belongs in a guide.** Don't rely on code comments alone for
cross-cutting concerns — they're too easy to miss.

Also update `CLAUDE.md` if the change affects the top-level overview (new guide,
new mode, changed commands).

## Updating tech-debt-tracker

- If the implementation created any new technical debt, add it to
  `plans/exec-plans/tech-debt-tracker.md`.
- If code review or bug fixes identified untracked existing debt, add it too.
- If the implementation resolved an existing debt item, move it to the "Fixed"
  section with a brief note on how it was resolved.

## Backlog conventions

Each workstream backlog (`backlogs/*.md`) uses lightweight inline tags:

- **Priority**: `[P1]` soon, `[P2]` when I can, `[--]` unprioritized/someday.
- **Categories**:
  - kind: `#bug`, `#polish`, `#feature`, `#tooling`
  - sizes: `#XL` (break down), `#L/#M/#S/#XS`
  - workflow status: `#clarify`, `
  - plus other backlog-specific tags. Keep the sets small.

- **Format**: `- [P1] Description of item #tag1 #tag2`

Priorities reflect the backlog's own prioritization principles, not urgency.
Re-triage periodically — items that stay `[--]` for a long time should be
dropped or promoted.
