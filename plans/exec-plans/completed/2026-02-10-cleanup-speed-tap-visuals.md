# Cleanup Speed Tap Visuals

## Problem
1. Speed Tap mode shows the fretboard when in "stats viewing" mode (before quiz
   starts / after stop). The fretboard is empty and takes up space — it should
   be hidden when not quizzing.
2. The heatmap legend wraps to two lines on mobile; it should fit on one line.
3. The note stats were split into two separate tables; should be a single row.
4. The "Hide Stats" button was mixed in with quiz controls (naturals checkbox,
   start button) — needs visual separation.

## Changes

### 1. Hide fretboard in stats viewing mode (`src/quiz-speed-tap.js`)
- On `init()` and `stop()`, hide `.fretboard-wrapper`.
- On `start()`, show `.fretboard-wrapper` again (the quiz needs it).
- Cache `.fretboard-wrapper` and `.stats-controls` DOM references in `els`.

### 2. Make legend fit on one line (`src/styles.css`)
- Reduce `.heatmap-legend` gap from `0.8rem` to `0.5rem`.
- Reduce `.legend-item` font-size from `0.85rem` to `0.75rem`, gap `0.3rem` to `0.2rem`.
- Reduce `.legend-swatch` size from `16px` to `12px`.

### 3. Single stats table (`src/quiz-speed-tap.js`)
- Replaced two separate 6-column tables with one 12-column table.
- Added `.speed-tap-stats` CSS class with smaller font/cell sizes.

### 4. Separate stats controls from quiz controls
- Moved heatmap button out of `.quiz-controls` into a new `.stats-controls` div
  in both `main.ts` and `build.ts` HTML templates.
- Added `.stats-controls` CSS with border-bottom separator.
- JS hides/shows `.stats-controls` on start/stop alongside the fretboard.

### 5. Bump version
- `v1.9` → `v2.0` in both `main.ts` and `build.ts`.
