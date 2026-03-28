# Progress Bar Redesign

**Date:** 2026-03-25
**Status:** Ready to implement (bar encoding). Freshness indicator TBD.

## Problem

The current progress bar encodes two dimensions per item: speed (hue) and
freshness (saturation/lightness fade). This produces:

- **Mottled bars** — speed-sorted segments with varying freshness create noisy
  lightness variation within hue bands
- **Sad stale bars** — when data decays, everything fades toward grey, losing
  the speed information that was once clearly visible
- **Per-item freshness is too granular** — individual item freshness is noisy and
  highly correlated within a group. Users don't need 12 separate freshness
  signals.

## Decision: Separate Speed and Freshness

### Bar encoding: three zones

The bar shows speed only, with stale items moved to a distinct "review" color:

1. **Fresh items** (freshness >= 0.5): speed hue from heatmap scale, sorted by
   speed descending (green on left)
2. **Stale items** (freshness < 0.5): notice-family orange (`hsl(32, 80%, 55%)`,
   lighter tint of `--color-notice`), regardless of speed
3. **Unseen items**: neutral grey (`--heatmap-none`)

Sorted: fresh by speed desc → stale → unseen. Items visually migrate from their
speed color into the orange zone as they decay, then back to speed colors after
review.

**Why notice orange?** Ties to the recommendation system's "review" suggestion
cards, which also use the notice color family. One color = one meaning.

### Freshness indicator: group-level, not per-item

Freshness is communicated as a single aggregate signal per group. Only shown for
groups at solid+ mastery level (level speed >= 0.7) — groups still being learned
don't need "review" signals, they need more practice.

**Aggregate metric:** speed-weighted average freshness across seen items. Fast
items decaying matters more than slow ones.

**Indicator options explored** (see `scripts/progress-bar-compare.ts`):

- Binary "Review" pill/icon — appears when weighted freshness < 0.5
- Trinary pills — "Review soon" (0.25–0.5) / "Overdue" (< 0.25)
- Countdown ring — SVG donut depleting as freshness drops

Decision on which indicator to use is deferred — the bar encoding change stands
on its own. A future task will add tap-to-see explanation cards on the progress
bar that surface freshness details on demand.

## Files to modify

| File | Change |
|------|--------|
| `src/stats-display.ts` | `progressBarColors()` → three-zone sort + coloring |
| `src/stats-display.ts` | Keep `getSpeedFreshnessColor()` for heatmap cells (unchanged) |
| `src/ui/scope.tsx` | `GroupProgressBar` — no changes needed (already takes color array) |
| `src/styles.css` | May need a CSS variable for the stale bar color |
| `guides/design/color-system.md` | Updated (done) |

## Diagnostic tooling

- `deno task bar-compare` — comparison page with all variants across 10 scenarios
- `deno task group-model` — full diagnostic with per-item tables
- Source: `scripts/progress-bar-compare.ts`, `scripts/group-model-diagnostic.ts`

## Implementation

### Step 1: Update `progressBarColors()` in `src/stats-display.ts`

Current: sorts by speed level then freshness, returns `getSpeedFreshnessColor()`
per item.

New: classify each item as fresh/stale/unseen, sort fresh by speed desc → stale
→ unseen, return speed-only color for fresh, notice orange for stale, heatmap
none for unseen.

```
fresh (freshness >= 0.5): speedOnlyColor(speedScore)  — heatmap HSL at full sat
stale (freshness < 0.5):  stale color (notice orange tint)
unseen (no data):         heatmapColors().none
```

### Step 2: Add stale bar color token

Add `--color-bar-stale` or similar to `src/styles.css` using the notice family.
Use `hsl(32, 80%, 55%)` or reference `--notice-*` scale. The JS in
`stats-display.ts` will need to read this via `cssVar()` with a hardcoded
fallback for tests.

### Step 3: Update tests

`src/stats-display_test.ts` — update any assertions about `progressBarColors()`
return values. The color format changes from speed×freshness HSL to either
speed-only HSL, the stale color, or the no-data color.

## Future work

- **Tap-to-explain card** on progress bars (separate task) — tap a group's bar to
  see a breakdown: items by status, freshness summary, next review estimate
- **Group-level freshness indicator** — pick from binary/trinary/ring prototypes
  and implement alongside the bar
