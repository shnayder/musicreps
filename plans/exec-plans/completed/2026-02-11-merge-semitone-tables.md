# Merge +/− Stats Tables for Math Modes

**Date:** 2026-02-11 **Status:** In progress

## Goal

Replace the separate +/− direction toggle on semitone math and interval math
stats heatmaps with a single merged grid. Each cell averages the stats from both
directions (e.g., `C+3` and `C-3`), showing only directions that have data. If
neither has data, the cell stays gray.

## Motivation

- The quiz intermixes + and − questions; separate stats views don't match the
  quiz controls.
- Simpler UI — removes the direction toggle buttons entirely.

## Changes

### stats-display.js

- Add `getStatsCellColorMerged(selector, itemIds, statsMode)`:
  - **Retention mode**: averages `getAutomaticity()` across non-null items.
  - **Speed mode**: averages `ewma` across items that have stats.
  - Returns gray `#ddd` when no items have data.
- Modify `renderStatsGrid`: if `getItemId` callback returns an array, use
  `getStatsCellColorMerged`; if string, use `getStatsCellColor` (backward
  compat).

### quiz-semitone-math.js

- Remove `statsDir` variable and direction toggle DOM creation.
- Change `getItemId` callback to return
  `[noteName + '+' + n, noteName + '-' + n]`.

### quiz-interval-math.js

- Same changes as semitone math, but with interval abbreviations.

### styles.css

- Remove `.stats-dir-toggle` and `.dir-btn` styles (no longer used).

### stats-display_test.ts

- Add tests for `getStatsCellColorMerged`.

### Version

- Bump v2.12 → v2.13.
- Rebuild docs/index.html.
