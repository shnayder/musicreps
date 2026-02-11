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
  quiz-note-semitones.js      # Note <-> semitone number quiz mode
  quiz-interval-semitones.js  # Interval <-> semitone number quiz mode
  quiz-semitone-math.js       # Note +/- semitones = note quiz mode
  quiz-interval-math.js       # Note +/- interval = note quiz mode
  navigation.js        # Hamburger menu and mode switching
  app.js               # Thin init: registers modes, starts navigation
  fretboard.ts         # SVG fretboard generation (build-time)
  styles.css           # CSS (read at build time, inlined into HTML)
  stats-display.js     # Shared stats color functions, table/grid rendering
  stats-display_test.ts  # Tests for stats display helpers
docs/index.html        # Built static file for GitHub Pages
docs/sw.js             # Built service worker (network-first cache strategy)
plans/                 # Implementation plans (checked in before starting work)
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
Files using `export` keywords (adaptive.js, music-data.js, quiz-engine.js,
stats-display.js) have exports stripped; other files use plain function
declarations.

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

## Distance Group Progression (Math Modes)

The 264 items in each math mode are grouped into 6 distance groups (by
semitone count), unlocked progressively. Same consolidate-before-expanding
logic as fretboard strings. Default: group 0 only on first launch.

| Group | Distances | Semitone label | Interval label | Items |
|-------|-----------|---------------|----------------|-------|
| 0     | 1, 2      | 1,2           | m2,M2          | 48    |
| 1     | 3, 4      | 3,4           | m3,M3          | 48    |
| 2     | 5, 6      | 5,6           | P4,TT          | 48    |
| 3     | 7, 8      | 7,8           | P5,m6          | 48    |
| 4     | 9, 10     | 9,10          | M6,m7          | 48    |
| 5     | 11        | 11            | M7             | 24    |

Toggle buttons generated dynamically in JS (labels differ per mode).
Persisted in localStorage: `semitoneMath_enabledGroups`, `intervalMath_enabledGroups`.
Expansion always recommends the next sequential group (smallest distance first).

## Quiz Modes

| Mode | Items | Answer type | Item ID format |
|------|-------|-------------|----------------|
| Fretboard | 78 (6 strings x 13 frets) | Note name | `0-5` (string-fret) |
| Note ↔ Semitones | 24 (12 notes x 2 dirs) | Note or number 0-11 | `C:fwd`, `C:rev` |
| Interval ↔ Semitones | 24 (12 intervals x 2 dirs) | Interval or number 1-12 | `m2:fwd`, `m2:rev` |
| Semitone Math | 264 (12 notes x 11 x 2 dirs) | Note name | `C+3`, `C-3` |
| Interval Math | 264 (12 notes x 11 x 2 dirs) | Note name | `C+m3`, `C-P4` |

Bidirectional modes mix both directions, tracking each as a separate item.
Math modes exclude octave/P8 (adding 12 semitones gives same note).

## Keyboard Shortcuts (during quiz)

- `C D E F G A B` - answer with natural note
- Letter + `#` - sharp (e.g., C then #)
- Letter + `b` - flat (e.g., D then b)
- `0-9` - answer with number (semitone modes; two-digit via timeout)
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

## Implementation Plans

Before starting work on a feature, write a plan and check it into `plans/`
with a descriptive filename (e.g. `plans/2026-02-10-add-quiz-stats.md`).
Commit the plan as part of the feature branch before beginning implementation.
After the feature is complete, update the plan to reflect what was actually
done (any deviations, additions, or things dropped).

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
