# Speed Tap Stats: Two-Row Table + Always Show Accidentals

## Problem

The speed tap stats table is too wide on mobile when accidentals are included
(12 columns). Also, the stats should always show all 12 notes regardless of the
"naturals only" quiz setting.

## Changes

### `src/quiz-speed-tap.js` — `showNoteStats()`

- Remove the `naturalsOnly` filter: always use all 12 `NOTES`
- Split the 12 notes into two groups of 6 and render two separate
  `<table class="stats-table">` elements stacked vertically
- This keeps each table at 6 columns, fitting comfortably on mobile

### Version bump

- Increment version from v1.8 → v1.9 in `main.ts` and `build.ts`

### Build

- Rebuild `docs/index.html` via `npx tsx build.ts`
