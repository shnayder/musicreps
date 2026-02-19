# Improve Speed Tap Stats Display

## Problem

Speed Tap records total round time (finding all 6-8 positions of a note), but
both heatmap modes use single-tap thresholds:

- **Speed heatmap**: `getSpeedHeatmapColor` has green < 1.5s — a 6s speed tap
  round (which is great!) shows as red.
- **Retention heatmap**: `computeSpeedScore` uses `automaticityTarget = 3000ms`,
  so a 6s EWMA yields speedScore ≈ 0.06, making automaticity near-zero even with
  perfect recall.

Also, the retention legend only shows 3 of 5 color levels with no numeric hints.

## Position counts per note (frets 0-12, standard tuning)

| Note | Positions | Note | Positions |
| ---- | --------- | ---- | --------- |
| C    | 6         | F#   | 6         |
| C#   | 6         | G    | 7         |
| D    | 7         | G#   | 6         |
| D#   | 6         | A    | 7         |
| E    | 8         | A#   | 6         |
| F    | 6         | B    | 7         |

Naturals range: 6-8. Average ≈ 7.

## Changes

### 1. `src/quiz-speed-tap.js` — Custom adaptive config

Create speed-tap-appropriate config overrides:

```js
const SPEED_TAP_CONFIG = {
  ...DEFAULT_CONFIG,
  minTime: 4000, // floor: can't tap 6-8 positions in < 4s
  automaticityTarget: 12000, // 12s → speedScore 0.5 (decent pace)
  maxResponseTime: 30000, // allow tracking up to 30s rounds
};
```

Pass to `createAdaptiveSelector(storage, SPEED_TAP_CONFIG)`.

### 2. `src/quiz-speed-tap.js` — Per-position speed coloring

In `showNoteStats`, for speed mode, normalize EWMA to per-position time before
passing to `getSpeedHeatmapColor`:

```js
const posCount = getPositionsForNote(note.name).length;
const perPosMs = stats ? stats.ewma / posCount : null;
getSpeedHeatmapColor(perPosMs);
```

This reuses the existing color scale (green < 1.5s/pos, etc.) without changing
the shared function signature. ~6s for 7 positions = 0.86s/pos → green.

### 3. `src/quiz-speed-tap.js` — Custom speed legend

Build a speed-tap-specific legend with "/pos" labels instead of calling
`buildStatsLegend('speed')`.

### 4. `src/stats-display.js` — Improve retention legend

Show all 5 color levels (currently skips yellow-green and orange) with
descriptive labels:

```
No data | Automatic | Solid | Getting there | Fading | Needs work
```

This benefits ALL modes, not just speed tap.

### 5. Version bump + build

Increment version in `main.ts` and `build.ts`. Rebuild `docs/index.html`.
