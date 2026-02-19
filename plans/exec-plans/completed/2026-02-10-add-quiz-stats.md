# Plan: Add Stats Tables for All Quiz Modes

## Context

The fretboard mode has a rich heatmap overlay showing per-item retention/speed
data on the SVG. The four text-based quiz modes (Note ↔ Semitones, Interval ↔
Semitones, Semitone Math, Interval Math) only show a single aggregate "median
EWMA" number. The original music-math app had per-item color-coded reference
tables that were lost during integration.

## Design

### Semitone Lookup Modes (Note ↔ Semitones, Interval ↔ Semitones)

**Reference tables with per-cell color coding** — 12 rows, one per
note/interval:

```
Note ↔ Semitones:
  Note  | #  | N→#  | #→N
  C     | 0  | ●    | ●
  C#/Db | 1  | ●    | ●
  ...

Interval ↔ Semitones:
  Interval | #  | I→#  | #→I
  m2       | 1  | ●    | ●
  ...
```

Each direction cell is color-coded by automaticity (retention mode) or EWMA
(speed mode). These double as reference material AND performance dashboards —
visible when the quiz is stopped.

### Math Modes (Semitone Math, Interval Math)

**12×11 heatmap grids** — rows are starting notes, columns are
offsets/intervals:

```
Semitone Math (showing + direction):
      1   2   3   4   5   6   7   8   9  10  11
  C  [●] [●] [●] [●] [●] [●] [●] [●] [●] [●] [●]
  C# [●] [●] ...
  ...

Interval Math (showing + direction):
      m2  M2  m3  M3  P4  TT  P5  m6  M6  m7  M7
  C  [●] [●] [●] [●] [●] [●] [●] [●] [●] [●] [●]
  ...
```

Direction toggle button switches between `+` and `−` views. Each cell colored by
automaticity/EWMA.

### UI Pattern (shared across all 4 modes)

- A **"Show Stats" toggle button** in quiz-controls (like fretboard's "Show
  Retention")
- Cycles: **Retention → Speed → Hide**
- Stats visible when quiz is **stopped** (hidden during active quiz)
- **Legend** shown alongside stats (reuses existing legend pattern)
- Aggregate median stat still shown below the table

### Color Scales (reused from fretboard)

- **Retention/Automaticity**: green (>0.8) → yellow (0.4–0.6) → red (<0.2), gray
  = no data
- **Speed/EWMA**: green (<1.5s) → red (>6s), gray = no data

## Implementation Steps

### Step 1: Extract shared stats-display helpers

Move `getAutomaticityColor()` and `getSpeedHeatmapColor()` from
`quiz-fretboard.js` into a new `src/stats-display.js` module. Add shared
functions:

- `renderStatsTable(selector, rows, getItemId, container)` — for the 12-row
  lookup modes
- `renderStatsGrid(selector, rowLabels, colLabels, getItemId, container)` — for
  the 12×11 math modes
- `cycleStatsMode(currentMode)` — returns next mode in
  `retention → speed → null` cycle

### Step 2: Add HTML for stats display in each mode

In both `main.ts` and `build.ts`, add to each mode screen:

- A `.heatmap-btn` button in quiz-controls (between start/stop)
- A `.stats-table-container` div in the mode screen for the table/grid
- Legend divs (can reuse the same legend pattern)

### Step 3: Wire up Note ↔ Semitones stats

In `quiz-note-semitones.js`:

- Add `onStop` behavior to show the stats table
- Build 12 rows from NOTES, item IDs `"C:fwd"` / `"C:rev"` for each direction
- Add heatmap button click handler cycling through retention/speed/hide

### Step 4: Wire up Interval ↔ Semitones stats

Same pattern as Step 3 but using INTERVALS data and `"m2:fwd"` / `"m2:rev"` IDs.

### Step 5: Wire up Semitone Math stats

In `quiz-semitone-math.js`:

- 12×11 grid: rows = NOTES, columns = 1–11
- Direction toggle button (separate from the retention/speed cycle)
- Item IDs: `"C+3"` / `"C-3"` depending on direction toggle

### Step 6: Wire up Interval Math stats

Same pattern as Step 5 but columns = m2–M7 and item IDs like `"C+m3"`.

### Step 7: CSS for stats tables and grids

- `.stats-table` — bordered table, compact cells, responsive
- `.stats-grid` — grid layout for math modes, small colored cells
- `.stats-cell` — individual cell with background color
- Responsive: stack or scroll on mobile

### Step 8: Update both template files

Ensure `main.ts` and `build.ts` templates stay in sync.

### Step 9: Tests

- Test the shared stats-display helper functions (color computation, table
  generation logic)
- Test the grid/table rendering with mock selector data

### Step 10: Version bump

Increment version number (v1.5 → v1.6).

## Files Modified

| File                             | Changes                                                  |
| -------------------------------- | -------------------------------------------------------- |
| `src/stats-display.js`           | **New** — shared stats rendering helpers                 |
| `src/quiz-fretboard.js`          | Extract color helpers to stats-display.js, import shared |
| `src/quiz-note-semitones.js`     | Add stats table rendering, heatmap toggle                |
| `src/quiz-interval-semitones.js` | Add stats table rendering, heatmap toggle                |
| `src/quiz-semitone-math.js`      | Add stats grid rendering, direction + heatmap toggles    |
| `src/quiz-interval-math.js`      | Add stats grid rendering, direction + heatmap toggles    |
| `src/quiz-engine.js`             | Minor: may export additional shared helpers              |
| `src/styles.css`                 | New styles for stats tables and grids                    |
| `main.ts`                        | Add HTML elements for stats in each mode screen          |
| `build.ts`                       | Mirror HTML changes from main.ts                         |
| `src/stats-display_test.ts`      | **New** — tests for shared helpers                       |
