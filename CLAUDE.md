# CLAUDE.md

Interactive music training app — fretboard note identification, interval math,
and more. Multiple quiz modes accessed via hamburger menu.

## Structure

```
main.ts                # Deno entry point: reads src/ files, assembles HTML, serves/builds
build.ts               # Node-compatible build script (npx tsx build.ts)
src/
  adaptive.js          # Adaptive question selector (ES module, single source of truth)
  adaptive_test.ts     # Tests for adaptive selector
  music-data.js        # Shared music theory data: notes, intervals, helpers
  music-data_test.ts   # Tests for music data
  quiz-engine.js       # Shared quiz lifecycle (timing, countdown, feedback)
  quiz-engine_test.ts  # Tests for quiz engine
  quiz-fretboard.js    # Fretboard quiz mode
  navigation.js        # Hamburger menu and mode switching
  app.js               # Thin init: registers modes, starts navigation
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
npx tsx --test src/*_test.ts
```

**Important:** Both `main.ts` and `build.ts` contain the HTML template. When
changing the template, update both files to keep them in sync.

## Architecture

The app uses a **mode-based architecture**:

- **QuizEngine** (`quiz-engine.js`) — shared lifecycle: adaptive selector, timing,
  countdown, feedback, keyboard/tap handling. Each mode gets its own engine instance.
- **QuizMode** — each mode provides: `getEnabledItems()`, `presentQuestion()`,
  `checkAnswer()`, `handleKey()`, plus `onStart`/`onStop` hooks.
- **Navigation** (`navigation.js`) — hamburger menu, mode switching, persists
  last-used mode in localStorage.
- **MusicData** (`music-data.js`) — shared notes/intervals arrays and helpers.

All source files are concatenated into a single `<script>` at build time.
Files using `export` keywords (adaptive.js, music-data.js, quiz-engine.js)
have exports stripped; other files use plain function declarations.

## How It Works

- SVG fretboard with clickable note positions
- Quiz modes: fretboard notes, note/interval semitones, semitone math, interval math
- Adaptive learning: tracks response times in localStorage, prioritizes slower notes
- Hamburger menu to switch between modes
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
- Two heatmap modes: **retention** (default, predicted recall) and **speed** (EWMA)

## String Recommendations ("Consolidate Before Expanding")

On load, the app recommends which strings to practice. The algorithm gates
expansion to new strings behind consolidation of what's already been started:

1. **Partition** strings into "started" (≥ 1 item seen) and "unstarted" (all unseen).
2. **Consolidation ratio** = mastered items / total seen items across all started
   strings. An item is "mastered" when `recall >= recallThreshold` (0.5).
3. **Rank** started strings by work remaining (`dueCount + unseenCount`); recommend
   those above the median.
4. **Expansion gate**: only suggest one unstarted string when `consolidationRatio
   >= expansionThreshold` (0.7). This prevents recommending new strings while the
   user is still weak on material they've already begun learning.
5. **First launch**: no data → keep persisted selection (default: low E).

Config: `expansionThreshold` (default 0.7) in `DEFAULT_CONFIG`.

`getStringRecommendations` returns per-string:
`{ string, dueCount, unseenCount, masteredCount, totalCount }` — separating
items with no recall data (`unseenCount`) from those with established recall
(`dueCount` + `masteredCount`), so the UI can make smarter decisions.

## Keyboard Shortcuts (during quiz)

- `C D E F G A B` - answer with natural note
- Letter + `#` - sharp (e.g., C then #)
- Letter + `b` - flat (e.g., D then b)
- `Space` / `Enter` - next question (after answering)
- `Escape` - stop quiz

## Testing

Write tests as you go, not just at the end. Any new module with logic should
have a corresponding `_test.ts` file. Run all tests before committing:

```bash
npx tsx --test src/*_test.ts
```

## Versioning

There is a small version number displayed at the top-right of the app (`<div class="version">`). Increment it (e.g. v0.2 → v0.3) with every change so the user can confirm they have the latest build.

## GitHub API Access (Claude Code Web Environment)

`gh` CLI is not authenticated in the web environment. Instead, use `curl`
through the egress proxy:

```bash
PROXY_URL="$GLOBAL_AGENT_HTTP_PROXY"

# List open PRs
curl -sS --proxy "$PROXY_URL" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/shnayder/fretboard-trainer/pulls?state=open"

# Get PR review comments
curl -sS --proxy "$PROXY_URL" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/shnayder/fretboard-trainer/pulls/{PR_NUMBER}/comments"

# Get issue/PR conversation comments
curl -sS --proxy "$PROXY_URL" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/shnayder/fretboard-trainer/issues/{PR_NUMBER}/comments"
```

The proxy authenticates automatically via the JWT in `GLOBAL_AGENT_HTTP_PROXY`.
No `GH_TOKEN` is needed. Git push/pull work normally via the `origin` remote.
