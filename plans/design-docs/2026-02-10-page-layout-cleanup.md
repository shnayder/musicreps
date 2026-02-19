# Page Layout Architecture Cleanup

## Goal

Make all quiz modes follow a consistent top-to-bottom layout:

1. **Stats visualization** (with legend) — heatmap on fretboard SVG, or stats
   table/grid
2. **Stats mode controls** — toggle between recall/speed/hidden + median stats
3. **Item-subset controls** — string toggles + naturals-only (fretboard only);
   direction toggle (math modes, inside stats-container)
4. **Quiz start/stop** — Start Quiz / Stop Quiz buttons
5. **Quiz content** — shown only when quiz is running (countdown, answer
   buttons, feedback)

## Current State

### Inconsistencies

- **Fretboard**: string toggles beside SVG, static legend divs in quiz-area,
  heatmap shown by activating quiz-area and hiding quiz elements inside it
- **Non-fretboard**: quiz-controls (with start+stats+heatmap buttons) above
  stats-container
- **Button text differs**: "Show Retention"/"Hide Heatmap" (fretboard) vs "Show
  Stats"/"Hide Stats" (others)
- Fretboard uses static legend HTML; other modes use `buildStatsLegend()`
  dynamically

### Target Layout (all modes)

```
stats-container (stats viz + legend)
quiz-controls:
  [Show Recall] [median: Xms]     ← stats toggle row
  [string toggles] [naturals]     ← item-subset row (fretboard only)
  [Start Quiz] / [Stop Quiz]      ← quiz control row
quiz-area (hidden until quiz starts)
```

## Changes

### HTML (main.ts + build.ts)

1. **Fretboard**: Remove fretboard-row wrapper, move string toggles/naturals
   into quiz-controls, remove static legend divs, add stats-container after
   fretboard-wrapper
2. **Non-fretboard**: Move stats-container before quiz-controls, split
   quiz-controls into sub-divs

### JavaScript

1. **quiz-fretboard.js**: Rewrite showHeatmapView/hideHeatmap to use
   stats-container + buildStatsLegend() instead of toggling quiz-area + static
   legends
2. **All modes**: Unify button text cycle: "Show Recall" → "Show Speed" → "Hide
   Stats"

### CSS

1. Remove .fretboard-row rules (no longer used)
2. Clean up mobile overrides

### Version

Bump v1.6 → v1.7
