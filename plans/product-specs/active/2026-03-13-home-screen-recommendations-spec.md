# Home Screen Recommendations — Design Spec

## Problem

The home screen is a static menu. It shows skill cards grouped by track, but
tells the user nothing about where they are or what to do next. Three gaps:

1. **No focus control.** If you only care about ukulele fretboard, you still
   scroll past 8 core theory skills every time. Track chips filter at the track
   level, but "core" is a grab bag of 8 skills — you can't say "I'm working on
   intervals and key signatures, not chord spelling yet."

2. **No progress visibility.** Every skill card looks the same whether you've
   never touched it, are halfway through, or have it fully automatic. The only
   way to see your status is to enter each mode and check the stats tab.

3. **No recommendations.** The app has a mature recommendation engine
   (`computeRecommendations`) that knows which groups need consolidation, which
   are ready to expand, and which are getting stale — but this information only
   surfaces inside individual modes, on the practice tab. The home screen
   doesn't help you decide which *skill* to open.

### What this means in practice

- **New user**: sees 11 skill cards, doesn't know where to start. No onboarding
  guidance.
- **Returning user**: doesn't know what needs review. Has to open each mode to
  check. Friction → skips review → skills decay.
- **Focused user**: keeps scrolling past skills they haven't started and don't
  plan to start yet. The screen feels cluttered with irrelevant options.
- **Advanced user**: can't tell at a glance which skills are automatic and which
  need attention. No sense of overall progress.

## Context

### Existing infrastructure

The building blocks are already in place:

- **Track selection** — users pick tracks (Core, Guitar, Ukulele). Core is
  always selected. Deselected tracks collapse into "Other skills."
- **Per-mode metrics** — each mode has item-level speed, freshness, and
  automaticity data, rolled up to group-level and mode-level status (see
  [mastery spec](2026-03-04-mastery-and-recommendations-spec.md)).
- **Recommendation engine** — `computeRecommendations()` produces consolidation
  targets, expansion suggestions, and stale-group detection per mode.
- **Status labels** — "Not started", "Learning", "Developing", "Fluent",
  "Automatic" derived from level automaticity (p10).
- **Per-group practice cards** — progress bars with heatmap colors and action
  cues ("Keep learning", "Review"), currently shown only inside modes.

### Hierarchy

```
Track (Core, Guitar, Ukulele)
  └─ Skill / Mode (e.g., Key Signatures, Guitar Fretboard)
       └─ Group / Level (e.g., "natural keys", "string 1 frets 0-4")
            └─ Item (e.g., "D:fwd", "3-7")
```

The home screen currently operates at the Track → Skill level. Progress and
recommendations exist at the Group → Item level inside modes. This spec bridges
the gap.

## Goals

1. **Show progress at a glance.** Each skill card communicates where the user
   stands — not started, in progress, needs review, or mastered.
2. **Recommend what to do next.** Surface the most useful next action: continue
   a skill in progress, review something getting stale, or start something new.
3. **Reduce clutter.** Let users focus on what they're actively learning without
   losing access to everything else.


Principle to remember: **Guide, don't gate.** Recommendations are suggestions. Nothing is locked. Users can always tap
   any skill card to start practicing.

## Non-goals

- Cross-skill dependency recommendations ("learn intervals before chord
  spelling"). Valuable but separate.
- Reorganizing skills within a track (reordering, custom categories).
- Onboarding wizard or skill assessment flow.
- Notifications or reminders outside the app.

## Phase 1: Focus Control

### Overview

Replace the track chip filter with two complementary mechanisms:

1. **Active Skills section** — a persistent top section showing skills the user
   has starred. This is the user's working set, drawn from any track. It's the
   first thing they see when they open the app.
2. **Accordion track sections** — all tracks shown as collapsible sections below
   Active Skills. Each section can be expanded to browse its skills, with star
   icons on each card to add/remove from Active.

This replaces the current pattern where deselecting a track hides its skills in
a collapsed "Other skills" disclosure. With accordions, nothing is hidden — just
organized.

### Layout

```
┌─────────────────────────────────┐
│  Music Reps                     │
│  tagline                        │
│                                 │
│  Active Skills                  │
│  ┌───────────────────────────┐  │
│  │ ★ Interval ↔ Semitones    │  │
│  │   Music theory            │  │
│  │ ★ Guitar Fretboard        │  │
│  │   Guitar                  │  │
│  │ ★ Key Signatures          │  │
│  │   Reading music           │  │
│  └───────────────────────────┘  │
│                                 │
│  ▸ Music theory                 │
│  ▸ Reading music                │
│  ▾ Guitar                       │
│    ┌───────────────────────────┐│
│    │ ★ Guitar Fretboard        ││
│    │ ☆ Speed Tap               ││
│    └───────────────────────────┘│
│  ▸ Ukulele                      │
│                                 │
│  Settings             v1.2.3    │
└─────────────────────────────────┘
```

### Behavior

**Starring a skill:**
- Each skill card shows a star icon (☆ unstarred, ★ starred).
- Tapping the star toggles the skill in/out of the Active section.
- Starred state persists in localStorage.
- Stars are visible in both the Active section and the track accordion sections.

**Active Skills section:**
- Shows starred skills from any track, regardless of which accordions are
  expanded.
- Cards are tappable — they navigate to the mode, same as in track sections.
- If no skills are starred, the section shows a prompt: *"Star skills you're
  working on — they'll appear here."*
- Ordering: for Phase 1, maintain a stable order (e.g., same order as they
  appear in the track definitions). Phase 2 will reorder by recommendation
  priority.

**Accordion track sections:**
- Each track is a collapsible section with a header showing the track name.
- Tapping the header expands/collapses the section.
- Expanded/collapsed state persists in localStorage.
- Starred skills appear in their track section with a filled star (★) — they
  are not removed from the track listing.
- Default state for new users: all sections expanded (so they can see everything
  and pick what to star).

**Migration from track chips:**
- The track chip UI is removed entirely.
- The "alwaysSelected" concept for Core goes away — it was a filter concern.
- Existing `selectedTracks` localStorage data can be cleared on migration (no
  need to preserve — the new starring mechanism is different enough).

**Track reorganization**
- Let's add "reading music", with just "key signatures" for now. More to come.
- Rename "core" to "Music theory".

### Skill cards

Phase 1 skill cards keep the current content (icon, name, description,
before/after contrast) and add only the star toggle. Progress indicators and
recommendation cues are Phase 2.

### Resolved questions

1. **Star icon placement.** Top-right corner of the card, with a tap target of
   at least 44x44px to avoid accidental mode navigation.

2. **Accordion default state for returning users.** Remember last
   expanded/collapsed state.

3. **Empty Active section UX.** Prompt text only for now: *"Star skills you're
   working on — they'll appear here."*

4. **Active section ordering.** Order by track, then by position within track.
   Each active card shows a small track chip (e.g., "Guitar") so the user knows
   where it comes from.

5. **Maximum active skills.** No cap. Once the recommendation engine understands
   cross-skill progression, "I want to learn all the things" is a valid choice.

## Phase 2: Progress Visibility

### Overview

Add a progress bar to each skill card showing per-group mastery at a glance.
The bar uses the same heatmap color language as the in-mode stats, so users
build one mental model across the whole app.

### Progress bar design

Each skill card gets a thin horizontal bar divided into equal-width segments —
one per group/level in that skill. Each segment is colored by the group's
average speed × freshness (using `getStatsCellColorMerged`):

```
┌──────────────────────────────┐
│ ★ Interval ↔ Semitones       │
│   Music theory               │
│ [████████░░░░░░░░░░░░░░░░░░] │
│  grp1   grp2   grp3   grp4  │
│  green  yellow grey   grey   │
└──────────────────────────────┘
```

- **Green segment** — group items are fast and recently practiced (automatic)
- **Yellow/amber segment** — group items are slow or getting stale (working)
- **Grey segment** — group not started (no data)
- Segment width is equal regardless of group size — this is a progress
  *overview*, not a proportional breakdown. Each group is one step in the
  skill's progression.

### Color computation

Each group segment color = average speed × average freshness across items in
that group, mapped through `getSpeedFreshnessColor`. This is what
`getStatsCellColorMerged` already computes.

Why average rather than p10 (level automaticity):
- Average feels representative of "how well do I know this group" — a group
  where 10 of 12 items are green and 2 are amber shows as yellow-green, not
  amber.
- p10 is deliberately strict for expansion gating but too punishing for a
  progress display. Seeing grey for a group you've been working on feels wrong.
- Matches the visual weight of the in-mode heatmap, where the overall
  impression is an average.

### Where the bar appears

- On skill cards in the **Active Skills** section (most useful — this is the
  user's working set).
- On skill cards in **accordion track sections** (browse mode — helps when
  deciding what to star).
- The bar replaces no existing content — it's added below the skill name / track
  chip area.

### Skill-level status label

In addition to the progress bar, each card shows a short status label derived
from the overall skill state. This reuses the existing mode-level status labels
from the mastery spec:

| Label | Level automaticity | Meaning |
|-------|-------------------|---------|
| Not started | 0 seen | Haven't tried this |
| Slow | < 0.2 | Just beginning — responses are deliberate |
| Getting faster | 0.2–0.79 | Building speed — answers coming quicker |
| Automatic | ≥ 0.8 | Instant retrieval — you just know it |

The label provides a word for what the bar shows visually, useful for
accessibility and for users who haven't internalized the color scale yet.

### Data flow

The home screen needs to read learner data for all modes without entering each
mode. This requires:

- Reading per-item adaptive data from localStorage (each mode stores its own
  data under a mode-specific key).
- Computing per-group average speed and freshness.
- This computation should be lightweight — the home screen loads it once on
  mount and doesn't need real-time updates (the data only changes when the user
  practices inside a mode).

### Resolved questions

1. **Bar thickness and position.** Same thickness as the level progress bars
   inside skills. Position at the bottom of the card.

2. **Segment borders.** Blend — same continuous style as the existing in-mode
   progress bars.

3. **Tooltip / tap on segment.** Deferred — open the skill to see group details.

4. **Performance.** Eager computation for all modes on mount. Add a performance
   test; if it exceeds a threshold, add pre-aggregation then.

5. **Cards in accordion sections.** Eager computation even for collapsed
   sections. If performance becomes an issue, precompute incrementally as the
   user practices.

