# CLAUDE.md

Interactive fretboard trainer for learning guitar note positions.

## Structure

```
main.ts                # Deno entry point: assembles HTML from modules, serves/builds
src/
  adaptive.ts          # Adaptive question selector (testable, pure logic)
  adaptive_test.ts     # Tests for adaptive selector (node --test via npx tsx)
  fretboard.ts         # SVG fretboard generation (build-time)
  styles.css           # CSS (read at build time, inlined into HTML)
docs/index.html        # Built static file for GitHub Pages
docs/sw.js             # Built service worker (network-first cache strategy)
```

## Development

```bash
# Run dev server (serves both index.html and sw.js)
deno run --allow-net --allow-read main.ts

# Build for GitHub Pages
deno run --allow-write --allow-read main.ts --build

# Run tests
npx tsx --test src/adaptive_test.ts
```

## How It Works

- SVG fretboard with clickable note positions
- Quiz mode: identifies a note, user answers via buttons or keyboard
- Adaptive learning: tracks response times in localStorage, prioritizes slower notes
- String selection persisted in localStorage

## Adaptive Selector

The adaptive question selector lives in `src/adaptive.ts` (tested reference) with a
browser-compatible copy inlined in `main.ts`. Keep both in sync. Key design:

- **Unseen items** get `unseenBoost` weight (exploration)
- **Seen items** get `ewma / minTime` weight (slower = more practice)
- No extra multiplier for low-sample items — this was a bug that caused startup ruts
- Last-selected item gets weight 0 (no immediate repeats)
- Storage is injected (localStorage in browser, Map in tests)

## Keyboard Shortcuts (during quiz)

- `C D E F G A B` - answer with natural note
- Letter + `#` - sharp (e.g., C then #)
- Letter + `b` - flat (e.g., D then b)
- `Space` / `Enter` - next question (after answering)
- `Escape` - stop quiz

## Versioning

There is a small version number displayed at the top-right of the app (`<div class="version">`). Increment it (e.g. v0.2 → v0.3) with every change so the user can confirm they have the latest build.
