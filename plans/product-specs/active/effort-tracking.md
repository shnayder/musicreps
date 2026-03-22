# Effort Tracking — Product Spec

## Goal

Show the user how much work they've put in: total reps, items started per mode,
and global activity (total reps, daily breakdown, days active).

## Scope (v1)

### Per-mode effort (shown in each mode's idle screen)

- **Total reps** — sum of `sampleCount` across all items in the mode's
  namespace. Already stored; just needs display.
- **Items started** — count of items with `sampleCount > 0`. Already stored.

Display: a small effort line below the existing practice summary, e.g.
"237 reps · 54/78 items started".

### Global effort (shown on home screen)

- **Total reps** — sum across all modes.
- **Reps per day** — new storage: `effort_daily` in localStorage, a
  `Record<string, number>` mapping ISO date strings to rep counts. Incremented
  on every `recordResponse()`.
- **Days active** — derived from `effort_daily` keys (count of dates with
  reps > 0).
- **Calendar view** — heatmap-style grid showing activity by day (like GitHub
  contribution graph). Data source: `effort_daily`.

Display: a summary section on the home screen footer area, e.g.
"6,386 total reps · 47 days active". Calendar view as a separate expandable
or always-visible element.

## What's NOT in v1

- Streaks
- Minutes/time tracking
- Progress tracking (speed trends, milestone log)
- Per-mode daily breakdown (only global daily)
- Server-side storage

## Data Model

### Existing (no changes needed)

Per-item `ItemStats` already has `sampleCount` — sum these for total reps and
count non-null for items started.

### New: daily rep counter

```
localStorage key: "effort_daily"
value: JSON Record<string, number>  // e.g. {"2026-03-13": 42, "2026-03-12": 85}
```

Increment on every call to `recordResponse()` (both correct and wrong answers).
Use `new Date().toISOString().slice(0, 10)` for the date key.

Storage estimate: ~30 bytes per day × 365 days/year = ~11 KB/year. Negligible.

## Implementation Approach

### Per-mode effort display

1. Add a `computeEffort(allItemIds, getStats)` pure function to
   `mode-ui-state.ts` that returns `{ totalReps, itemsStarted, totalItems }`.
2. Surface it in `computePracticeSummary()` return value (or compute separately
   in the hook).
3. Render in the idle screen's practice summary area — a new line or inline
   with existing status.

### Global daily counter

1. Add `incrementDailyReps()` and `getDailyReps()` functions in a new
   `src/effort.ts` module.
2. Hook into `recordResponse()` in `adaptive.ts` — call `incrementDailyReps()`
   on every response.
3. Pure functions for aggregation: `totalRepsAllModes()` (reads all
   `adaptive_*` keys and sums `sampleCount`), `daysActive()`,
   `repsPerDay()`.

### Home screen display

1. Add an effort summary section to `HomeScreen` component. Compute on mount
   by scanning localStorage.
2. Calendar heatmap: a small grid component. Reuse existing heatmap color
   scale (`--heatmap-*` CSS variables).

## Open Questions

1. **Calendar orientation** — weeks as columns (GitHub-style) or rows? How many
   weeks to show?
2. **Home screen placement** — above the mode list? Below? In a collapsible
   section?
3. **Per-mode effort line** — exact placement and formatting within the
   existing practice summary UI.
