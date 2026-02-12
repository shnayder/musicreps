# Adaptive Response-Time Thresholds

**Date:** 2026-02-11
**Branch:** `claude/improve-response-thresholds-TY1ZG`
**Status:** Implemented

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

## Approach: Motor Baseline Calibration

**Why not derive from quiz data?** The app's goal is automatizing things the user
can already figure out with thinking. Early quiz responses are slow due to
*cognitive* overhead, not motor limitations. The 25th percentile of EWMAs would
track "how fast am I when I still have to think a bit" — not the actual target.

**The right baseline is motor time only.** A short calibration test where we
highlight an answer button and the user taps it as fast as they can. This directly
measures reaction time + physical execution + device latency, with zero cognitive
load. That motor time is the floor — the response time you'd see if knowledge
were truly automatic.

### Calibration Test Design

- **Trigger:** first time the user clicks "Start" on a mode with no stored baseline
- **Framing:** "Quick warm-up" (not "calibration test")
- **Trials:** ~10. Highlight a random answer button (CSS glow), user taps it or
  presses the corresponding key. Either input method accepted.
- **Timing:** measure from highlight appearing to input received
- **Result:** median of trials (robust to warm-up effects and outliers)
- **Storage:** `motorBaseline_{namespace}` in localStorage, per-mode
- **Re-run:** available from a "Recalibrate" button (shown in idle state)

### Per-mode button sets

| Mode | Calibration buttons | CSS selector |
|------|-------------------|-------------|
| Fretboard | Note buttons (C, C#, ..., B) | `.note-btn` |
| Semitone Math | Note buttons | `.answer-btn-note` |
| Interval Math | Note buttons | `.answer-btn-note` |
| Note ↔ Semitones | Note buttons + number buttons | `.answer-btn-note`, `.answer-btn-num` |
| Interval ↔ Semitones | Interval buttons + number buttons | `.answer-btn-interval`, `.answer-btn-num` |
| Speed Tap | Skip for now (already has custom config) | — |

For bidirectional modes (note/interval semitones), calibrate using one button
set (notes or intervals); motor overhead is similar across 12-button grids.

### Threshold Scaling

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

Example: mobile user with baseline 1500ms → automaticity target = 4.5s,
heatmap green < 2.25s, self-correction < 2.25s. Keyboard user with baseline
700ms → target = 2.1s, green < 1.05s.

### Lifecycle

1. **First start:** no stored baseline → run calibration warm-up → store result →
   apply to config → start quiz.
2. **Subsequent starts:** load stored baseline → apply to config → start quiz.
3. **Idle heatmap:** load stored baseline → pass to heatmap color functions.
4. **No auto-recalibration.** User can re-run from a "Recalibrate" button.

## Changes

### 1. `adaptive.js` — Config scaling

**New exported function:**
```javascript
deriveScaledConfig(motorBaseline, cfg)
  → returns new config with minTime, automaticityTarget, selfCorrectionThreshold,
    maxResponseTime scaled proportionally from motorBaseline
```

**Selector changes:**
- `cfg` becomes a `let` (mutable via closure)
- Add `updateConfig(newCfg)` — merges new values into cfg
- Add `getConfig()` — returns current cfg (for countdown, heatmap)

### 2. `stats-display.js` — Parameterized heatmap

- `getSpeedHeatmapColor(ms, baseline)`: optional baseline. When provided, scale
  thresholds as `baseline * ratio` instead of fixed 1500/3000/4500/6000.
  When absent, current fixed thresholds (backward compatible).
- `buildStatsLegend(statsMode, baseline)`: show scaled values in legend text.
- `getStatsCellColor(selector, itemId, statsMode, baseline)`: pass baseline through.

### 3. `quiz-engine.js` — Calibration + baseline application

**Calibration logic** (callback-based, no async):
```
startCalibration(buttons, onComplete):
  - Show "Quick warm-up!" message in feedback area
  - For each of 10 trials:
    - Pick random button (not same as previous)
    - Add .calibration-target CSS class (green glow)
    - Start timer
    - Listen for click on that button OR corresponding keypress
    - Record elapsed time, remove highlight
    - Brief pause (300ms), next trial
  - Compute median of times
  - Call onComplete(median)
```

**Modified `start()` flow:**
```
start():
  - Check localStorage for motorBaseline_{namespace}
  - If missing: run calibration → store → apply → start quiz
  - If present: load → apply → start quiz

apply(baseline):
  - selector.updateConfig(deriveScaledConfig(baseline, DEFAULT_CONFIG))
  - Store baseline on engine instance for countdown/heatmap use
```

**Countdown bar:** `TARGET_TIME` changes from a constant (3000) to a value
derived from `selector.getConfig().automaticityTarget`.

**Mode interface addition:** each mode provides `getCalibrationButtons()` returning
an array of DOM elements (the answer buttons for that mode). Falls back to
`container.querySelectorAll('.note-btn, .answer-btn')` if not provided.

### 4. `styles.css` — Calibration highlight

```css
.calibration-target {
  background: #4CAF50 !important;
  border-color: #388E3C !important;
  color: white !important;
  box-shadow: 0 0 12px rgba(76, 175, 80, 0.6);
}
```

### 5. `quiz-speed-tap.js` — Skip for now

Speed tap already has custom config (minTime=4000, target=12000). It uses
fretboard circle tapping, not buttons. Calibration for speed tap would need
a different design (highlight circles). Defer to a future change.

### 6. Tests

**`adaptive_test.ts`:**
- `deriveScaledConfig`: verify all ratios (minTime, automaticityTarget,
  selfCorrectionThreshold, maxResponseTime) scale correctly
- Verify speedScore produces same relative results with scaled config
- Verify weight calculation preserves relative ordering with scaled config

**`stats-display_test.ts`:**
- `getSpeedHeatmapColor` with and without baseline
- Verify color thresholds scale correctly (e.g., baseline=1500 → green < 2250ms)

**`quiz-engine_test.ts`:**
- Existing tests only: TARGET_TIME constant, createNoteKeyHandler, updateModeStats.
- Calibration and baseline tests are not unit-testable here (require DOM + globals).
- Median computation is tested via `computeMedian` in `adaptive_test.ts`.

### 7. Version bump

Increment version in `main.ts` and `build.ts` (v3.0 → v3.1).

## What this does NOT do

- No auto-recalibration from quiz data (manual re-run only)
- No per-item baselines (motor overhead is per-mode, not per-item)
- No cross-mode baseline sharing (button layouts differ enough)
- No speed tap calibration (deferred — already has custom config)
- No user-configurable target multipliers (keep ratios fixed for simplicity)
