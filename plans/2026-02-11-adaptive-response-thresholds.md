# Adaptive Response-Time Thresholds

**Date:** 2026-02-11
**Branch:** `claude/improve-response-thresholds-TY1ZG`

## Problem

All absolute timing thresholds are hardcoded (minTime=1000ms, automaticityTarget=3000ms,
selfCorrectionThreshold=1500ms, heatmap bands at 1500/3000/4500/6000ms). This means:

- A mobile/touch user who can't physically respond faster than ~1.5s never sees green
  on the speed heatmap, gets penalized on stability growth, and never triggers
  self-correction.
- Math modes (which require mental computation) are judged by the same absolute
  thresholds as simple fretboard recall.
- A fast keyboard user sees green on everything too easily — the system doesn't
  push them toward true automaticity at their capability level.

## Approach: Personal Baseline

Compute a **per-mode personal baseline** from the user's own performance data.
This single value naturally captures user speed, input device characteristics,
and mode complexity. All absolute thresholds become ratios of this baseline.

### What is the baseline?

The **25th percentile of EWMA values** for items with ≥ 3 correct answers
(i.e., "how fast am I on my better-known items?"). Requires at least 8
qualifying items before we trust it; falls back to current fixed defaults
during cold start.

This captures:
- **User speed**: fast typists get a low baseline, slow tappers get a high one
- **Input device**: touch adds ~500ms overhead, naturally reflected in all EWMAs
- **Mode complexity**: fretboard recall is faster than interval math computation
- **UX complexity**: modes with more scanning/movement produce higher EWMAs

### Threshold scaling

Current fixed values implicitly assume baseline = 1000ms. With personal baseline B:

| Threshold              | Fixed value | Scaled         | Ratio |
|------------------------|-------------|----------------|-------|
| minTime                | 1000ms      | B              | 1.0×  |
| automaticityTarget     | 3000ms      | B × 3.0        | 3.0×  |
| selfCorrectionThreshold| 1500ms      | B × 1.5        | 1.5×  |
| maxResponseTime        | 9000ms      | B × 9.0        | 9.0×  |
| Countdown bar          | 3000ms      | B × 3.0        | 3.0×  |
| Heatmap green          | < 1500ms    | < B × 1.5      | 1.5×  |
| Heatmap yellow-green   | < 3000ms    | < B × 3.0      | 3.0×  |
| Heatmap yellow         | < 4500ms    | < B × 4.5      | 4.5×  |
| Heatmap orange         | < 6000ms    | < B × 6.0      | 6.0×  |

### Lifecycle

1. Baseline computed at **quiz start** from current stored data, frozen for
   the session (no mid-quiz threshold shifts).
2. Baseline also computed on-demand for **idle heatmap rendering** (so the
   heatmap always reflects current thresholds).
3. During **cold start** (< 8 qualifying items), all defaults apply — identical
   to current behavior.
4. As the user improves, their EWMAs decrease → baseline decreases → thresholds
   tighten. The system gets harder as they get better.

### Why this works without circularity

EWMA tracks raw response times (clamped at maxResponseTime). The thresholds
only determine how to *interpret* those times (speed score, heatmap color,
self-correction gate). So deriving thresholds from EWMA data is not circular.

Weight-based selection is also fine: `speedWeight = max(ewma, minTime) / minTime`.
When minTime scales up, all weights scale down proportionally, preserving relative
ordering. The unseenBoost (fixed 3.0) matches a seen item at 3× baseline in both
cases.

## Changes

### 1. `adaptive.js`

**New config fields** in `DEFAULT_CONFIG`:
```javascript
baselineMinSamples: 3,    // min correct answers per item to include
baselineMinItems: 8,      // min qualifying items to trust baseline
baselinePercentile: 0.25, // which percentile (25th = "your fast items")
```

**New exported functions:**
```javascript
// Compute personal baseline from stored data
computePersonalBaseline(allItemIds, storage, cfg)
  → returns baseline in ms, or null if insufficient data

// Derive a scaled config from a baseline
deriveScaledConfig(baseline, cfg)
  → returns new config with minTime, automaticityTarget, etc. scaled
```

**Selector changes:**
- Store `cfg` as a `let` variable (currently const via closure)
- Add `updateConfig(newCfg)` method to merge in new config values
- Add `computeBaseline(itemIds)` convenience method
- Add `getConfig()` method so callers can read current thresholds

### 2. `stats-display.js`

- `getSpeedHeatmapColor(ms, baseline)`: accept optional baseline parameter.
  When provided, scale thresholds by `baseline / 1000`. When absent, use
  current fixed thresholds (backward compatible).
- `buildStatsLegend(statsMode, baseline)`: when baseline provided, show scaled
  threshold values in the legend text.
- `getStatsCellColor(selector, itemId, statsMode, baseline)`: pass baseline through.

### 3. `quiz-engine.js`

- At `start()`:
  1. Get all item IDs from `mode.getEnabledItems()` (plus any mode method to
     get ALL item IDs for broader baseline)
  2. Call `selector.computeBaseline(itemIds)`
  3. If non-null, call `selector.updateConfig(deriveScaledConfig(baseline, DEFAULT_CONFIG))`
  4. Store baseline for use in countdown and heatmap
- `TARGET_TIME`: change from constant to derived from `selector.getConfig().automaticityTarget`
- Pass baseline when rendering heatmap colors

### 4. `quiz-speed-tap.js`

Same pattern: compute baseline from speed tap data, update config at round start.
Lower `baselineMinItems` since there are only 12 possible items (notes). Use 5
instead of 8.

### 5. Tests

**`adaptive_test.ts`:**
- `computePersonalBaseline`: cold start (returns null), various distributions,
  edge cases (all same EWMA, single qualifying item)
- `deriveScaledConfig`: verify ratios are correct
- Round-trip: create items, record responses, verify baseline computation
  and that scaled config produces expected speed scores

**`stats-display_test.ts`:**
- `getSpeedHeatmapColor` with and without baseline
- Verify color thresholds scale correctly

### 6. Version bump

Increment version in `main.ts` and `build.ts` (v2.12 → v2.13).

## What this does NOT do

- No user-facing controls to set target speed (aspirational, but adds UI
  complexity without clear benefit — the system learns what you can achieve)
- No per-item baselines (would be overfitting — an item you're slow at IS one
  that needs practice)
- No cross-mode baseline sharing (modes are different enough that per-mode is
  correct)
- No gradual baseline transition (abrupt-at-session-boundary is fine since the
  change is typically small between sessions)

## Edge cases

- **Device switch** (desktop → mobile): EWMAs adjust over ~5-7 answers per item
  (EWMA alpha=0.3). Baseline will shift within 1-2 sessions. Acceptable lag.
- **Very fast user** (baseline ~600ms): countdown bar = 1.8s. Fine — they answer
  in ~600ms, bar gives 3× their pace. Visual nudge if they take longer.
- **New group enabled**: unseen items have no EWMA, so they don't affect baseline.
  Baseline reflects only practiced items.
