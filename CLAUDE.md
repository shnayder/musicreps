# CLAUDE.md

Interactive fretboard trainer for learning guitar note positions.

## Structure

```
main.ts                # Deno entry point: reads src/ files, assembles HTML, serves/builds
build.ts               # Node-compatible build script (npx tsx build.ts)
src/
  adaptive.js          # Adaptive question selector (ES module, single source of truth)
  adaptive_test.ts     # Tests for adaptive selector (npx tsx --test)
  app.js               # Browser quiz/UI logic (references adaptive globals)
  fretboard.ts         # SVG fretboard generation (build-time)
  styles.css           # CSS (read at build time, inlined into HTML)
docs/index.html        # Built static file for GitHub Pages
docs/sw.js             # Built service worker (network-first cache strategy)
```

## Development

```bash
# Run dev server (serves both index.html and sw.js)
deno run --allow-net --allow-read main.ts

# Build for GitHub Pages (Deno)
deno run --allow-write --allow-read main.ts --build

# Build for GitHub Pages (Node — use when Deno is unavailable)
npx tsx build.ts

# Run tests
npx tsx --test src/adaptive_test.ts
```

**Important:** Both `main.ts` and `build.ts` contain the HTML template. When
changing the template, update both files to keep them in sync.

## How It Works

- SVG fretboard with clickable note positions
- Quiz mode: identifies a note, user answers via buttons or keyboard
- Adaptive learning: tracks response times in localStorage, prioritizes slower notes
- String selection persisted in localStorage

## Adaptive Selector

The adaptive question selector lives in `src/adaptive.js` — a single JS file
that is both the ES module imported by tests and the source that `main.ts` reads
at build time (stripping `export` keywords for browser inlining). Key design:

- **Unseen items** get `unseenBoost` weight (exploration)
- **Seen items** get `ewma / minTime` weight (slower = more practice)
- No extra multiplier for low-sample items — this was a bug that caused startup ruts
- Response times clamped to `maxResponseTime` (9s) to reject outliers
- Last-selected item gets weight 0 (no immediate repeats)
- Storage is injected (localStorage adapter in browser, Map in tests)

## Forgetting Model (Spaced Repetition)

Per-item half-life forgetting curve: `P(recall) = 2^(-t/stability)`.

- Each item tracks `stability` (half-life in hours) and `lastCorrectAt`
- First correct answer: `stability = initialStability` (4 hours)
- Subsequent correct: stability grows by `stabilityGrowthBase * speedFactor`
- Wrong answer: stability reduced by `stabilityDecayOnWrong` (floored at initial)
- **Self-correction**: fast answer after long gap → stability boosted to at least
  `elapsedHours * 1.5` (handles off-app learning, e.g., actual guitar playing)
- Within-session weighting: recall factor `1 + (1 - recall)` multiplies speed weight
- String recommendations: on load, strings with most "due" items are auto-selected
  and visually highlighted (orange indicator on toggle buttons)
- Two heatmap modes: **retention** (default, predicted recall) and **speed** (EWMA)

## Keyboard Shortcuts (during quiz)

- `C D E F G A B` - answer with natural note
- Letter + `#` - sharp (e.g., C then #)
- Letter + `b` - flat (e.g., D then b)
- `Space` / `Enter` - next question (after answering)
- `Escape` - stop quiz

## Versioning

There is a small version number displayed at the top-right of the app (`<div class="version">`). Increment it (e.g. v0.2 → v0.3) with every change so the user can confirm they have the latest build.
