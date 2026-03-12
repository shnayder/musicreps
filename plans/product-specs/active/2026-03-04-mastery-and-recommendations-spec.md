# Mastery and Recommendations — Design Spec

## Overview

The app trains automaticity — knowing answers instantly without thinking. The
recommendation system should use the same metric the user already sees and
understands (the speed × freshness heatmap) to decide when to suggest reviewing
old material and when to suggest expanding to new material.

This spec defines:
1. How individual item metrics roll up into group-level status
2. How group-level status drives recommendations (consolidate vs expand)
3. How this connects to the user-visible heatmap and status labels

## Context

The app has a hierarchy:

- **Skill** (e.g., Guitar Fretboard, Semitone Math, Key Signatures)
  - **Level/Group** — a set of items to automatize, with a natural ordering
    - **Item** — a single question (e.g., "string 3 fret 5", "C+3")

Items are the atomic unit. Users drill items and get faster over time. The
system tracks their progress and recommends what to practice next.

### What the user sees today

Each item has a heatmap color encoding two axes:
- **Speed** — how fast you answer (EWMA of response times)
- **Freshness** — how much of your practiced speed you've retained since last
  session (decays over time based on stability)

These combine into **automaticity** = speed × freshness. The heatmap shows this
as a color: green (automatic), through yellow-green (fluent), to amber (needs
work), to grey (unseen). The mode-level status label is derived from **level
automaticity** — the 10th percentile of per-item automaticity values (unseen
items contribute 0). Labels: "Automatic" (≥0.8), "Fluent" (≥0.5), "Developing"
(≥0.2), "Learning" (<0.2), "Not started" (0 seen).

### The problem

The recommendation algorithm uses a different, hidden metric: **freshness
alone** (how much practiced speed is retained, without regard to current speed).
It classifies items as "mastered" (freshness ≥ 0.5) or "due" (freshness < 0.5)
and gates expansion on the ratio of mastered to due items.

This creates confusing mismatches:
- Items I always get right but slowly → the system calls them "mastered" and
  suggests expanding, but my heatmap is amber and status says "Getting started"
- Items I was once fast at but haven't practiced → the system doesn't flag them
  until freshness drops below 0.5, but my heatmap has already faded
- The status label and the recommendation can contradict each other

**Core principle**: The system should recommend based on the same data the user
sees. One mental model, not two.

## Item-Level Model

### What we're tracking

Every item in the app can be figured out given enough time — the question is
never "do you remember this?" but "can you produce the answer instantly?" The
model tracks two independent axes:

**Speed** — how fast you answer right now, based on recent practice.
- Raw metric: EWMA (exponential moving average of response times, in ms)
- Normalized: **speed score** maps EWMA to [0, 1]. Baseline (1000ms) → 1.0,
  target (3000ms) → 0.5. Higher = faster.

**Freshness** — how much of your practiced speed is retained since your last
session. This is the decay curve: `freshness = 2^(-elapsed / stability)`.
- Just practiced → freshness ≈ 1.0. You're as fast as your EWMA says.
- Haven't practiced in a while → freshness decays toward 0. You're "rusty" —
  you can still work it out, but you've lost the instant response.
- **Stability** controls the decay rate: how many hours until freshness drops to
  0.5. Grows with spaced repetition (more sessions → slower decay → less
  frequent practice needed to stay sharp).

Note: the current codebase calls this quantity "recall" in some places
(`computeRecall()`, `getRecall()`, `recallThreshold`). This is misleading —
it's not about whether you remember, it's about whether your practiced speed has
decayed. A code cleanup should rename these to use "freshness" consistently.

**Automaticity** = speed score × freshness. The single combined metric. It
answers: "given how fast you were in practice AND how long it's been, how
automatic is your response right now?"

### Summary of metrics

| Metric | What it measures | Range |
|--------|-----------------|-------|
| EWMA | Recent response time average | ms |
| Stability | Half-life of practiced speed retention | hours |
| Speed score | EWMA normalized to [0, 1] | 0 (slow) to 1 (instant) |
| Freshness | Retention of practiced speed over time | 0 (rusty) to 1 (fresh) |
| Automaticity | Speed score × freshness | 0 to 1 |

### Item classification

What the user intuitively understands from the heatmap:

| Category | Automaticity | What it means |
|----------|-------------|---------------|
| Automatic | > 0.8 | Fast and recently practiced |
| Working | > 0 but ≤ 0.8 | Seen but not instant yet |
| Unseen | null | Haven't tried this yet |

"Working" encompasses both "I'm slow at this" and "I used to know this but
haven't practiced recently" — both show up as non-green in the heatmap, and both
mean "not automatic yet."

## Group-Level Rollup

A group's status serves two different jobs:

1. **Expansion gating** (internal) — should the system suggest new material?
2. **Status display** (user-facing) — how am I doing in this group?

These need different metrics. A conservative gate that's strict about unseen
items is right for gating but misleading as a status display.

### Expansion gating: level automaticity (p10)

**Level automaticity** = 10th percentile of per-item automaticity values
(unseen items contribute 0). This compresses the group's distribution into one
number that reflects the weakest items. For 12 items the 2nd lowest value; for
48 items the 5th lowest.

This is deliberately strict: unseen items contribute 0, so you can't expand
until you've covered the group. It gates expansion but is NOT shown to users.

### Status display: per-group practice card

Each group shows a **mini progress bar** using the actual per-item heatmap
colors (sorted by automaticity, highest first) plus a short **action cue**:

| State | Condition | Text |
|-------|-----------|------|
| Not started | seen < 5 items | *(none — grey bar speaks for itself)* |
| You're good | few unseen AND ≥90% of seen items automatic | *(none — green bar)* |
| Review | few unseen AND >50% of non-automatic items are decayed | "Review" |
| Keep learning | everything else | "Keep learning" |

Where:
- **"Few unseen"** = unseen ≤ ceil(total × 0.1), matching the p10 margin
- **"Decayed"** = speed score ≥ 0.8 (was fast enough to be automatic) AND
  freshness < 0.7 (hasn't practiced recently). This distinguishes "was fast,
  got rusty" from "fast but not instant yet."
- **"Not started"** threshold (5 items) distinguishes "tried it for 30 seconds"
  from "actively learning." May refine later using total trial count.

The progress bar uses the same heatmap colors as the progress tab, so there's
one visual language. No separate label needed — the bar IS the status.

### Mode-level status label

Derived from level automaticity (used in the mode header, not per-group):

| Label | Level automaticity | Meaning |
|-------|-------------------|---------|
| Not started | 0 seen | Fresh group |
| Learning | < 0.2 | Just beginning |
| Developing | 0.2–0.49 | Making progress |
| Fluent | 0.5–0.79 | Most items fast |
| Automatic | ≥ 0.8 | Nearly complete |

## Recommendation Algorithm

The consolidate-before-expanding algorithm recommends which groups to practice:

### Consolidate

When the user has started some groups, identify which ones need the most work.
Groups with more non-fluent items (working + unseen) are recommended for
consolidation.

The recommendation text says "solidify Group X — N items to work on", pointing
the user to the groups where they have the most non-automatic items.

### Expand

The expansion gate opens when the **level automaticity** of all started items
is ≥ 0.7 (`expansionThreshold`) — meaning even the weakest 10% of items you've
attempted are close to automatic.

When the gate is open, the system suggests starting the next unstarted group.

This means:
- **You can't just be slow-but-correct** — you need to actually be fast to
  unlock new content. The system won't push you forward until your existing
  items are genuinely automatic.
- **Unseen items within started groups hold back expansion** — if you haven't
  seen all items in a group, those contribute automaticity = 0 and pull the
  percentile down. You need to cover the group before expanding.
- **Stale items hold back expansion** — if you haven't practiced in a while and
  your freshness has decayed, your automaticity drops and the gate closes. The
  system naturally suggests reviewing before expanding.
- **Speed matters for progression** — the core promise of the app is
  automaticity, not just recall. The recommendation system reinforces this.

### Idle messages

When the user opens a skill they haven't practiced recently:
- "Looks like you've got this!" — when all enabled items are automatic
- "Time to review?" — when items were once automatic but have decayed

### What the user can always do

Nothing is locked. The user can always enable any group, practice any items.
Recommendations guide, they don't gate. (Design principle: "Guide, don't
gate.")

## Diagnostic tooling

Three diagnostic scripts visualize the algorithm at each layer:

1. **Item-model diagnostic** (`deno task item-model`) — one item, many
   interactions. Shows how speed, stability, freshness, and automaticity evolve.
2. **Group-model diagnostic** (`deno task group-model`) — one group, many items
   at various states. Shows how item metrics roll up to group status.
3. **Recommendation diagnostic** (`deno task diagnostic`) — many groups. Shows
   the consolidate/expand algorithm output for each scenario.

## Out of scope

- Cross-skill recommendations (recommend which skill to practice)
- Skill-level rollup (levels → skill status)
- Custom drill mode (user-selected subset of items)
- Transfer model for unseen items (estimating automaticity from practiced items
  in the same group)

## Resolved decisions

- **Single metric for everything**: automaticity (speed × freshness) is used for
  heatmap display, status labels, and recommendations. No hidden freshness-only
  axis. — Rationale: the app trains automaticity, not recall. Users can always
  figure out the answer given enough time; the question is whether they have it
  at the tip of their finger.

- **"Working" includes both slow and stale items**: a single category for
  anything that's been seen but isn't automatic. — Rationale: from the user's
  perspective, both cases look the same in the heatmap (non-green) and mean the
  same thing (needs more practice).

- **Expansion gates on automaticity, not freshness alone**: you need to be fast
  at existing items before the system suggests new ones. — Rationale: this is
  what the user intuitively expects ("I'm fast at these, what's next?") and
  aligns with the app's core value proposition.

- **Level automaticity for gating, not display**: p10 is the right metric for
  expansion gating (conservative, penalizes unseen items) but wrong for status
  display (shows "Learning" after multiple sessions if 2 items happen to be
  unseen). Per-group status uses the progress bar + action cue instead.

- **Heatmap green reserved for truly automatic**: The color scale should
  visually distinguish "I just know it" (instant retrieval, speed > 0.9) from
  "I can quickly figure it out" (fast algorithm, speed 0.75–0.9). Both feel
  "fast" but represent different cognitive states. Green is earned at > 0.9;
  the 0.75–0.9 range gets a yellow-green that communicates "fast but not
  instant." — Rationale: the app's core promise is automaticity. The visual
  should push toward truly instant responses, not reward "pretty fast."

- **No transfer model for now**: For modes with hundreds of items (semitone
  math, chord spelling), a model estimating unseen items from practiced ones
  is cognitively plausible (algorithmic speedup transfers across items) but
  adds complexity. Item-specific automaticity (instant retrieval) transfers
  less than general algorithmic speed. Defer to a future iteration; for now,
  unseen items show as grey and contribute 0 to group metrics.

## Implementation status

### Done
- Diagnostic tooling for all three layers
- Unified item and group metrics on automaticity (speed × freshness)
- Level automaticity (10th percentile) replaces consolidation ratio for
  mode-level status labels and expansion gating
- Mode-level status labels: Not started / Learning / Developing / Fluent /
  Automatic
- Per-group practice card prototype in group-model diagnostic (progress bar +
  action cue heuristic)
- Shifted heatmap color scale prototype (green at > 0.9, yellow-green at
  0.75–0.9)

### Next
- Implement per-group practice card in the app (practice tab rework)
- Ship shifted heatmap color scale to the app's `stats-display.ts`
- Code cleanup: rename `recall` → `freshness` throughout the codebase
  (`computeRecall` → `computeFreshness`, `getRecall` → `getFreshness`,
  `recallThreshold` → `freshnessThreshold`, `recallClass`, etc.) to match the
  model described here. The current "recall" naming implies a memory model where
  you either remember or forget — but every item in the app can be figured out;
  the question is speed retention, not memory.
- Tune `expansionThreshold` (currently 0.7) for the level automaticity metric —
  it's stricter than the old consolidation ratio since unseen items within
  started groups now contribute 0.

