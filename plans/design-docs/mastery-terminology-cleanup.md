# Mastery Terminology Cleanup

## Before

### 1. Per-item Metrics (internal, `adaptive.ts`)

We track three derived metrics per item, computed from raw stats (ewma, stability,
lastCorrectAt):

| Metric | Range | Formula |
|---|---|---|
| **Speed Score** | 0-1 | exponential decay from ewma; 1000ms -> 1.0, 3000ms -> 0.5 |
| **Freshness** | 0-1 | half-life recall: `2^(-elapsed/stability)` |
| **Automaticity** | 0-1 | `freshness * speedScore` |

Config parameters that govern these (`adaptive.ts` DEFAULT_CONFIG):

| Parameter | Value | Role |
|---|---|---|
| `minTime` | 1000 ms | speedScore = 1.0 at this ewma |
| `automaticityTarget` | 3000 ms | speedScore = 0.5 at this ewma |
| `automaticityThreshold` | 0.8 | item is "automatic" above this |
| `recallThreshold` | 0.5 | item is "due" when freshness drops below this |

Notes on naming:
- `automaticityThreshold` is used for both the "Fluent" item classification
  (recommendations.ts) and the "Automatic" status label (mode-ui-state.ts).
  Same threshold, two names for the same concept.
- `recallThreshold` is based on freshness (half-life model), not
  automaticity. The mastery-and-recommendations-spec already calls for
  renaming it to `freshnessThreshold`.
- `recallThreshold` is used by the adaptive selector to boost priority for
  items that need refreshing. It does NOT feed into the F/W/U classification.

### 2. Per-item Display: Heatmap Colors (`stats-display.ts`)

The progress-tab heatmap displays item-level stats, keeping speed and freshness
as separate visual axes.

Hue encodes speed score (5 discrete levels):

| Level | Speed Score | Hue | Comment in code |
|---|---|---|---|
| heatmap-1 | <= 0.3 | 40 (gold) | "needs work" |
| heatmap-2 | > 0.3 | 48 | |
| heatmap-3 | > 0.55 | 60 (yellow) | |
| heatmap-4 | > 0.75 | 80 (yellow-green) | "fast but figuring it out" |
| heatmap-5 | > 0.9 | 125 (green) | "automatic" |

Freshness modulates saturation/lightness (vivid when fresh -> grey when stale).

### 3. Per-item Classification for Recommendations (`recommendations.ts`)

The in-mode recommendation engine buckets each item into one of three states
using the combined automaticity metric:

| State | Meaning |
|---|---|
| Fluent (F) | automaticity > 0.8 (`automaticityThreshold`) |
| Working (W) | seen but automaticity <= 0.8 |
| Unseen (U) | no data |

These counts drive the consolidate-before-expanding algorithm at the GROUP
level: which groups to recommend practicing, and whether to unlock a new group.

Item selection within a quiz is a separate system entirely -- the adaptive
selector (`adaptive.ts`) uses weighted random selection with unseen boost,
EWMA-based priority, and freshness-based "due" detection (`recallThreshold`).
The F/W/U counts don't directly influence which item comes next in a quiz.

### 4. Per-group: Stale Detection (`recommendations.ts`)

A group is "stale" when its items were once fast but have decayed. Detected by
averaging speed score and freshness across the group's seen items:

Yes, we compute mean(speedScore) and mean(freshness) across the group's seen
items, then compare each independently:

- `STALE_SPEED_THRESHOLD = 0.5` — mean speed must be at least this (was fast)
- `STALE_FRESHNESS_THRESHOLD = 0.5` — mean freshness must be below this (decayed)
- Stale = mean(speed) >= 0.5 AND mean(freshness) < 0.5

This deliberately uses the two metrics separately rather than automaticity,
because the question is specifically "was fast, has decayed" — not "is the
combined score low."

### 5. Per-level: Status Labels (user-facing, `mode-ui-state.ts`)

The practice tab rolls up item stats into a single status label per level
(group), using **level automaticity** -- the 10th percentile of per-item
automaticity across the level's items:

| Label | Threshold |
|---|---|
| Not started | seen = 0 |
| Slow | < 0.2 |
| Getting faster | 0.2 - 0.8 |
| Automatic | >= 0.8 |

### 6. Per-level: Expansion Gate (`recommendations.ts`)

The consolidate-before-expanding algorithm gates progression to new groups
behind mastery of existing ones. Expansion unlocks when:

| Parameter | Value | Role |
|---|---|---|
| `expansionThreshold` | 0.7 | level automaticity must reach this to unlock next group |

### 7. Per-skill: Home Recommendation Types (`home-recommendations.ts`)

The home screen classifies each starred skill into a recommendation type by
examining all its groups. Priority order determines which cue label to show:

| Type | Condition | Cue Label |
|---|---|---|
| review | any stale groups (see section 4) | "Review" |
| get-faster | consolidation work remaining (working items > 0) | "Get faster" |
| learn-next | expansion gate open (level auto >= 0.7) | "Learn next level" |
| not-started | no items seen across entire skill | (none) |
| automatic | all groups fluent, no stale, no work remaining | (none) |

When all starred skills are "automatic", the home screen shows an "all done"
message.

### 8. Fixture States (`heatmap-scenarios.ts`)

Test fixtures use their own vocabulary for seeding item data:

| Fixture state | ewma | freshness | Maps to |
|---|---|---|---|
| `unseen` | (none) | (none) | Unseen |
| `slow-fresh` | 3000-6000ms | recent | Working |
| `mixed` | 1500-4000ms | varied | mix of Working/Fluent |
| `fast-fresh` | 800-1400ms | recent | Fluent |
| `fast-stale` | 800-1300ms | 50-90 days old | Stale (was Fluent) |

### Inconsistencies

1. **"automatic" means different things at different thresholds.**
   - Heatmap level 5 requires speedScore > 0.9 for green.
   - Status label "Automatic" requires level automaticity >= 0.8.
   - Recommendation type "automatic" requires all groups to have no
     consolidation work and no stale items.
   - An item can be "automatic" by the recommendation engine (automaticity
     0.82) but show as yellow-green on the heatmap (speedScore 0.85).

2. **"fluent" vs "automatic" are used interchangeably** in different files
   for the same threshold (automaticity > 0.8).

3. **Fixture states use a different vocabulary** (`fast-fresh`, `slow-fresh`,
   `mixed`, `fast-stale`) that doesn't map cleanly to the item classification
   (Fluent/Working/Unseen) or heatmap levels.

4. **Heatmap levels are speed-only** (5 thresholds on speedScore), while
   item classification uses **automaticity** (speed * recall). An item can
   have high speed but low recall (stale) and still show green hue with
   faded saturation, which is visually confusing when paired with a "Review"
   cue label.

5. **Two separate 0.5 thresholds** serve different purposes:
   - `recallThreshold = 0.5` (when an item is "due" for review)
   - `STALE_FRESHNESS_THRESHOLD = 0.5` (when a group triggers "Review" cue)
   These happen to be the same value but are defined independently.

## Analysis

Two different ways of looking at item mastery coexist:

- **Heatmap** keeps speed and freshness as separate axes (hue = speed,
  saturation = freshness). This is the richest view -- you can see "fast but
  stale" vs "slow but fresh" at a glance.

- **Everything else** uses automaticity (`speed * freshness`), which collapses
  the two axes into one number. This is used for:
  - Item classification (Fluent/Working/Unseen) -- threshold 0.8
  - Level status labels (Slow/Getting faster/Automatic) -- thresholds 0.2, 0.8
  - Expansion gating -- threshold 0.7
  - Home screen progress bar colors (via `getStatsCellColorMerged`)

The collision point: the home screen progress bars use the **heatmap** color
system (speed + freshness axes), but the recommendation cue labels use
**automaticity**. So an item with speedScore 0.85 and freshness 0.95 has
automaticity 0.81 (> 0.8, classified Fluent, skill shows "automatic") but
shows as heatmap-4 yellow-green (speedScore 0.85 < 0.9 threshold for green).
The visual message contradicts the text message.

Stale detection adds a third path: it uses raw speed score and freshness
averages (not automaticity), with its own thresholds (both 0.5). This is
conceptually sound -- "was fast, has decayed" is the right question -- but
it's yet another way of combining the same two metrics.

## After

**!NOTE**: This has been superceded by plans/design-docs/mastery-terminology-visual.html

### Guiding principles

- The overall system isn't unreasonable, but needs cleanup in thresholds and
  terminology.
- The app's goal is to make things "automatic" -- keep that as the single word
  for the goal state at every level.
- Base item metrics (speed, freshness, automaticity) are sound.
- Roll up from items -> groups -> skills using the same three questions at each
  level: "how fast?", "how fresh?", "combine into automaticity."

### Terminology cleanup

**One word for the goal state: "automatic."** Drop "fluent" everywhere.

| Level | Current terms | Proposed |
|---|---|---|
| Item | "fluent" (recommendations), "automatic" (heatmap comment) | **automatic** (auto > 0.8) |
| Item | "working" | **working** (seen, auto <= 0.8) -- keep |
| Item | "unseen" | **unseen** -- keep |
| Group | "Slow" / "Getting faster" / "Automatic" | See below |
| Skill | "automatic" (recommendation type) | **automatic** -- keep |

**Rename `recallThreshold` -> `freshnessThreshold`** throughout (already
planned in mastery-and-recommendations-spec). It's a freshness threshold,
not a memory-recall threshold.

**Status labels**: rename to Hesitant / Learning / Automatic (from
Slow / Getting faster / Automatic). "Hesitant" is honest and descriptive
(you pause before answering), "Learning" captures the active middle phase,
and "Automatic" is the payoff. These also match the heatmap legend which
already uses "Hesitant" and "Automatic" as endpoints.

| Current | Proposed |
|---|---|
| Not started | Not started (keep) |
| Slow | **Hesitant** |
| Getting faster | **Learning** |
| Automatic | Automatic (keep) |

### The heatmap vs. automaticity tension

The heatmap's two-axis encoding (hue = speed, saturation = freshness) is
genuinely better for the detailed progress-tab view. Keep it. The issue is
only when heatmap colors leak into contexts where automaticity-based
decisions are being made.

**Two display contexts, two color encodings:**

| Context | Purpose | Color basis |
|---|---|---|
| Progress-tab heatmap grid | Detailed per-item diagnostic | Speed x freshness (two axes, as now) |
| Home screen progress bars | Summary per-group indicator | Automaticity (single axis) |

The home progress bars currently use `getStatsCellColorMerged` (heatmap
colors). Switch them to automaticity-based coloring so the bars are
consistent with the recommendation cue labels. An existing function
`getAutomaticityColor` already maps automaticity to the 5 heatmap CSS
colors with thresholds 0.2/0.4/0.6/0.8 — use that (or similar) for the
progress bars.

This resolves the "all done" screenshot bug: items with automaticity > 0.8
will show as green in the progress bar, matching the "automatic" classification.

### Threshold alignment

The 0.8 threshold already serves as the "automatic" boundary for both item
classification and status labels. The heatmap's top-green threshold (speed
> 0.9) is intentionally stricter — it means "instant recall, no hesitation"
in the speed dimension alone. This is fine; the heatmap is a different view.

The 0.5 thresholds (`recallThreshold` and `STALE_FRESHNESS_THRESHOLD`) are
conceptually the same: "freshness has dropped to the half-life point."
Consider unifying them into one named constant (`FRESHNESS_DUE_THRESHOLD`
or similar), even though they're used in different systems (item selection
vs. group stale detection). They should stay in sync.

### Fixture states

Rename fixture states to match the item classification vocabulary:

| Current | Proposed | Rationale |
|---|---|---|
| `unseen` | `unseen` | Already matches |
| `slow-fresh` | `working` | Working items that are fresh |
| `mixed` | `mixed` | Keep — useful for testing partial groups |
| `fast-fresh` | `automatic` | Automatic items that are fresh |
| `fast-stale` | `stale` | Was automatic, now decayed |

### Summary of changes

1. **Rename "fluent" -> "automatic"** in recommendations.ts, mode-ui-state.ts,
   architecture.md, and all test/fixture files.
2. **Rename `recallThreshold` -> `freshnessThreshold`** throughout.
3. **Switch home progress bars** from heatmap colors to automaticity-based
   colors.
4. **Unify the two 0.5 thresholds** into one constant.
5. **Rename fixture states** to match item classification vocabulary.
6. **Update architecture.md and terminology.md** to document the clean model.


