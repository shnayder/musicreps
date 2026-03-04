# Development

Day-to-day workflow reference for building, testing, and deploying.

## Prerequisites

- **Deno** v2.x
- `npm install` required for esbuild (dev dependency, invoked via `npx`)
- Playwright required for screenshots only: `npx playwright install chromium`.
  Only works locally, when `CLAUDE_CODE_REMOTE` is not set to `true`.

### Web sandbox (`IS_SANDBOX=yes`)

Deno's built-in npm resolver fails in the Claude Code web sandbox because the
egress proxy's TLS certificate isn't in Deno's trust store (`UnknownIssuer`
error on `deno install`). Workaround: use `npm install` instead — npm routes
through the proxy correctly via `npm_config_proxy`.

A session-start hook in `.claude/settings.json` handles this automatically: it
runs `npm install` when `IS_SANDBOX=yes`. If you see
`Could not resolve "preact-render-to-string"` errors, run `npm install`
manually.

## Commands

```bash
deno task dev                        # Dev server (localhost:8001)
deno task build                      # Build to docs/
deno task test                       # Run all tests
deno task lint                       # Lint check
deno task fmt                        # Format check

# Screenshots (starts dev server automatically)
npx tsx scripts/take-screenshots.ts             # all screenshots (3x PNG)
npx tsx scripts/take-screenshots.ts --list      # print all names and exit
npx tsx scripts/take-screenshots.ts --only pat  # only names matching pat
npx tsx scripts/take-screenshots.ts --ci        # 1x JPEG (CI mode)

# UI iteration (local design review)
deno task iterate new <session> <state1> [state2...]  # create session + capture v1
deno task iterate capture [session]                   # capture next version
deno task iterate view [session]                      # open review page
deno task iterate list                                # list sessions
deno task iterate --list-states                       # print valid state names
```

## Build System

The HTML template and page structure live in `src/build-template.ts` — the
single source of truth. `main.ts` is the single
build script (Deno), which shells out to esbuild CLI via `Deno.Command`. Source
files are ES modules bundled by esbuild into a single IIFE `<script>` block.

To add a new source file, just create it with proper `import`/`export`
statements and import it from where it's needed. esbuild resolves the module
graph automatically from the entry point (`src/app.ts`).

## Testing

### What to test

- Pure functions: state transitions, data helpers, algorithms
- Edge cases: empty sets, boundary values, single-element collections
- Enharmonic equivalence where relevant to music theory
- New modules with logic should always have a `_test.ts` file

### What NOT to test

- `render()` functions — they are declarative and tested visually
- DOM event wiring — tested by manual interaction
- CSS styling

### Infrastructure

- Framework: `node:test` (`describe`, `it`, `assert`)
- Runner: `deno task test` (or
  `deno test --no-check --allow-read --allow-run=deno`)
- Dependency injection: `Map` for storage, imported music data, seeded RNG
- No global state pollution — each test creates its own selector/helpers

Write tests as you go, not just at the end.

### Architecture test

`src/architecture_test.ts` enforces the layer boundaries documented in
[architecture.md](architecture.md#module-dependency-graph). It shells out to
`deno info --json src/app.ts` to get the real import graph (resolved by Deno's
module resolver — no regex parsing), then asserts:

- No circular dependencies
- No cross-mode imports (`src/modes/a/` → `src/modes/b/`)
- Foundation only imports foundation
- Engine only imports foundation + engine
- Display only imports foundation + display
- Hooks and UI don't import from modes or app
- `quiz-engine-state.ts` has no deps beyond `types.ts`
- Every file is classified into a known layer

The test requires `--allow-run=deno` (already in `deno task test` and
`deno task ok`). If you add a new source file outside `src/modes/`, add it to
the correct layer set in the test (`FOUNDATION`, `ENGINE`, `DISPLAY`, `APP`,
`BUILD_TIME`, or `TOOL`). Files under `src/modes/`, `src/hooks/`, and `src/ui/`
are classified by path automatically.

## Versioning

A version identifier is displayed on the home screen (`<span class="version">`).
It is derived from git at build time — no source changes needed. The logic lives
in `getVersion()` in `main.ts`:

- **`main` branch:** `#<commit-count>` (e.g., `#1247`) — monotonic build number.
  In CI, the count comes from the GitHub API via the `BUILD_NUMBER` env var
  (avoids fetching full history). Falls back to short SHA if unavailable.
- **Other branches:** `<short-hash> <branch-suffix>` (e.g., `a1b2c3 fix-button`)
- **Fallback (no git):** `dev`

The HTML template in `src/build-template.ts` contains a `__VERSION__` placeholder
that gets replaced during the build.

## Branching

Always start from the latest `main` branch unless told otherwise. Fetch and
merge/rebase from `origin/main` after the feature design is finalized, before
beginning implementation.

**Always set up remote tracking** when creating a new branch. This prevents
accidentally pushing to `origin/main` instead of the feature branch:

```bash
# Create and push with tracking in one step
git checkout -b my-branch
git push -u origin my-branch

# Or push with tracking later (before any other push)
git push -u origin HEAD
```

The `-u` flag sets the upstream, so subsequent `git push` goes to the right
remote branch. Never run bare `git push` on a branch that doesn't track a remote
yet — it may default to pushing to `origin/main`.

**Recommended git config:** `git config --global push.default simple` ensures
`git push` refuses if the local and remote branch names don't match — an extra
safeguard against accidentally pushing to `main`.

## Deployment

Build output goes to `docs/` (GitHub Pages source directory):

- `docs/index.html` — the single-page app
- `docs/sw.js` — service worker (network-first cache strategy)
- `docs/favicon-32x32.png` — browser tab icon
- `docs/apple-touch-icon.png` — iOS home screen icon
- `docs/design/` — design reference pages (copied from `guides/design/`)

After building, commit the changed files. The service worker ensures users get
the latest version on next load.

### Design reference pages

The build copies all `.html` files from `guides/design/` to `docs/design/`,
rewriting the stylesheet path for co-located access. Two of these pages are
build-generated:

- `guides/design/components-preview.html` — **generated from
  `src/ui/preview.tsx`**. Renders real Preact UI components (`NoteButtons`,
  `PracticeCard`, `StatsGrid`, `RoundComplete`, etc.) with mock data. This is
  the primary tool for iterating on component design. Available at
  `localhost:8001/preview` during dev.

- `guides/design/colors.html` — hand-written color palette reference.

- `guides/design/components.html` — hand-written design system reference (CSS
  tokens, spacing/typography scales, grid patterns, variant A/B panels).

All pages link to `src/styles.css` so CSS changes are visible on refresh.
Hand-written pages need no rebuild; build-generated pages require
`deno task build`.

**If you add new files to `docs/`**, no workflow changes are needed — the
preview deploy workflow copies all files from `docs/` automatically.

## Preview Deploys

Pushes to `claude/*` branches automatically deploy a preview build via GitHub
Actions. The workflow (`.github/workflows/deploy-preview.yml`) builds the app
and deploys the output to `preview/<branch-name>/` on the `gh-pages` branch.

- **Preview URL:** `shnayder.github.io/musicreps/preview/<branch-name>/`
- **Cleanup:** `.github/workflows/cleanup-preview.yml` removes the preview
  directory when the branch is deleted or PR is closed.
- **PR comment:** the deploy workflow posts the preview URL on any associated
  PR.

## Agent Screenshot Workflow

The CI pipeline captures fixture-based screenshots on pushes to `claude/*/ui/*`
branches. The script dispatches state fixtures to the running app (no clicking
through quizzes), so screenshots are fully deterministic.

### How it works

1. `deploy-preview.yml` runs `take-screenshots.ts --ci` on `/ui/` branches
2. The script opens the app with `?fixtures`, dispatches `__fixture__` events
   to inject engine state, and captures after Preact re-renders
3. CI uses `--ci` flag: 1x device scale, JPEG output (smaller, faster)
4. Screenshots deploy to `preview/<branch>/screenshots/` on gh-pages

### Branch requirement

Screenshots only run on branches matching `*/ui/*` (e.g.,
`claude/fix-buttons/ui/review`). Non-UI branches skip Playwright entirely.

### Step-by-step

```bash
# 1. Push to a /ui/ branch
git push -u origin claude/my-feature/ui/review

# 2. Poll workflow status until complete (~2-3 min)
curl -s "https://api.github.com/repos/shnayder/musicreps/actions/runs?branch=claude/my-feature/ui/review&per_page=1" \
  | python3 -c "import sys,json; r=json.load(sys.stdin)['workflow_runs'][0]; print(r['status'], r['conclusion'] or '')"

# 3. List available screenshots
curl -s "https://api.github.com/repos/shnayder/musicreps/contents/preview/claude-my-feature-ui-review/screenshots?ref=gh-pages" \
  | python3 -c "import sys,json; [print(f['name']) for f in json.load(sys.stdin) if f['name'].endswith(('.png','.jpg'))]"

# 4. Download a specific screenshot
curl -sL -o /tmp/screenshot.jpg \
  "https://raw.githubusercontent.com/shnayder/musicreps/gh-pages/preview/claude-my-feature-ui-review/screenshots/fretboard-idle.jpg"
```

Then use `Read /tmp/screenshot.jpg` to view the image.

### Available screenshots

Each mode produces `<mode>-idle` and `<mode>-quiz`. Bidirectional modes also
get `<mode>-quiz-rev` (reverse direction). Speed Check adds three fixture-based
captures: `speedCheck-intro`, `speedCheck-testing`, `speedCheck-results`.
Design moments: `design-correct-feedback`, `design-wrong-feedback`,
`design-round-complete`, `design-fretboard-correct`, `design-fretboard-wrong`.

~34 screenshots total. Run `--list` to see the full manifest.

### Filtering screenshots

Use `--only` with comma-separated substrings to capture a subset:

```bash
npx tsx scripts/take-screenshots.ts --only speedCheck
npx tsx scripts/take-screenshots.ts --only noteSemitones-quiz,intervalSemitones-quiz
```

### Screenshot & Fixture Design Principles

1. **Fixture injection, not UI interaction** — screenshots use `__fixture__`
   events to inject state directly. Never click through the UI to reach a
   state. This is deterministic, fast, and doesn't break when CSS/selectors
   change.

2. **Pure state drives rendering** — if a UI state can't be reached via fixture
   injection, that's a signal the state should be hoisted or exposed. Add
   fixture support to the component, don't work around it with Playwright
   clicks.

3. **Manifest as single source of truth** — `buildManifest()` defines all
   screenshots. Use `--list` to inspect, `--only` to filter. No separate
   override files.

4. **Each screenshot = one fixture** — every `ScreenshotEntry` with visual
   content has a `fixture` field. Entries without fixtures capture idle state
   (the default after navigation).

## UI Iteration Tool

Local tool for iterating on visual changes. Captures specific app states across
versions, generates an HTML review page for side-by-side comparison and
annotation.

```bash
deno task iterate --list-states                          # print all valid state names
deno task iterate new my-session fretboard-idle semitoneMath-quiz  # create session, capture v1
deno task iterate capture my-session                     # capture v2 (next version)
deno task iterate view my-session                        # open review page
deno task iterate list                                   # list all sessions
```

### How it works

1. `new` creates a named session with a set of state names, captures v1
   screenshots using the same fixture injection as `take-screenshots.ts`, and
   generates `review.html`.
2. Make code changes, then run `capture` to add the next version.
3. The review HTML shows a table: one column per state + a General column, rows
   grouped by version. Each cell has the screenshot (300px wide, 1x scale) and a
   textarea for notes.
4. Notes persist in localStorage. "Copy Summary" formats all annotations as
   markdown for pasting back into a conversation.
5. **Tip:** Claude can view screenshots directly via the Read tool (e.g.,
   `screenshots/iterate/<session>/v3/design-progress-building.png`) — useful
   for inspecting visual details without opening the review page.

### State names

State names match the screenshot manifest — the same names used by
`take-screenshots.ts`. Run `deno task iterate --list-states` to see the full
list. Common ones: `<mode>-idle`, `<mode>-quiz`, `<mode>-quiz-rev`,
`design-correct-feedback`, `design-wrong-feedback`, `design-round-complete`.

### Session storage

Sessions live in `screenshots/iterate/<session-name>/` (gitignored). Each
version's screenshots are in a `v1/`, `v2/`, etc. subdirectory. `session.json`
tracks the state list and version history.

## iOS App (Capacitor)

The iOS app is a Capacitor wrapper around the same `docs/index.html` build. The
Xcode project lives in `ios/App/`.

### Prerequisites

- Xcode 16+ with iOS Simulator runtime installed
- Capacitor deps already in `package.json` — just `npm install` if needed

### Build and run in Simulator

```bash
# 1. Build web content + copy into Xcode project
deno task build && npx cap copy ios

# 2. Build the iOS app for Simulator
xcodebuild -project ios/App/App.xcodeproj \
  -scheme App -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 16' build

# 3. Boot a simulator (skip if already running)
xcrun simctl boot "iPhone 16"

# 4. Install the app
xcrun simctl install booted \
  ~/Library/Developer/Xcode/DerivedData/App-*/Build/Products/Debug-iphonesimulator/App.app

# 5. Launch the app
xcrun simctl launch booted com.musicreps.app
```

Or do it all in one shot:

```bash
deno task build && npx cap copy ios && \
xcodebuild -project ios/App/App.xcodeproj \
  -scheme App -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 16' build && \
xcrun simctl install booted \
  ~/Library/Developer/Xcode/DerivedData/App-*/Build/Products/Debug-iphonesimulator/App.app && \
xcrun simctl launch booted com.musicreps.app
```

### Opening in Xcode

```bash
npx cap open ios
```

This opens the Xcode project where you can run/debug with the play button,
inspect the view hierarchy, or manage signing for device builds.

### Useful Simulator commands

```bash
# List available simulators
xcrun simctl list devices available

# Take a screenshot
xcrun simctl io booted screenshot /tmp/screenshot.png

# Open a URL in the simulator's browser
xcrun simctl openurl booted "https://example.com"

# View app logs (useful for JS console.log output)
xcrun simctl spawn booted log stream --predicate 'process == "App"' --level debug

# Shut down the simulator
xcrun simctl shutdown booted
```

### Resetting app state

localStorage persists between launches. To start fresh:

```bash
# Uninstall and reinstall the app (clears all data)
xcrun simctl uninstall booted com.musicreps.app
xcrun simctl install booted \
  ~/Library/Developer/Xcode/DerivedData/App-*/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch booted com.musicreps.app
```

Or reset the entire simulator to factory state:

```bash
xcrun simctl erase booted
```

### Iterating on changes

After editing JS/CSS/HTML, you only need to rebuild web content and copy it into
the Xcode project — no native rebuild needed unless you changed Swift code:

```bash
deno task build && npx cap copy ios
```

Then relaunch the app in the Simulator (or kill and reopen it — Capacitor loads
from local files, so the new content appears on next launch).

If you changed Swift code or Capacitor config, you need a full rebuild:

```bash
xcodebuild -project ios/App/App.xcodeproj \
  -scheme App -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 16' build
```

### Key paths

| Path                            | Contents                         |
| ------------------------------- | -------------------------------- |
| `capacitor.config.ts`           | App name, bundle ID, web dir     |
| `ios/App/App/AppDelegate.swift` | Native app lifecycle             |
| `ios/App/App/Info.plist`        | iOS app configuration            |
| `ios/App/App/Assets.xcassets/`  | App icon and launch images       |
| `ios/App/App/public/`           | Web content (copied, gitignored) |

## Code Review & PR

Every branch that changes code follows these steps before merging:

1. **Run `/review`** — catches template sync issues, architecture violations,
   missing tests, and convention drift. Fix any critical findings and re-run
   until approved.
2. **Push the branch** — `git push -u origin <branch-name>`
3. **Create a PR** — `gh pr create` with a summary of changes and a test plan.

`/review` is not optional — it's the gate before pushing. Use the `/review`
slash command to run the code-reviewer subagent, which applies the checklist in
`.claude/commands/review-checklist.md`.

Review scopes:

- `/review` — review working tree diff (default)
- `/review 42` — review PR #42
- `/review main..HEAD` — review a commit range

## GitHub API Access (Web Environment)

`gh` CLI is not authenticated in the Claude Code web environment. Use `curl`
through the egress proxy:

```bash
PROXY_URL="$GLOBAL_AGENT_HTTP_PROXY"

# List open PRs
curl -sS --proxy "$PROXY_URL" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/shnayder/musicreps/pulls?state=open"

# Get PR review comments
curl -sS --proxy "$PROXY_URL" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/shnayder/musicreps/pulls/{PR_NUMBER}/comments"

# Get issue/PR conversation comments
curl -sS --proxy "$PROXY_URL" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/shnayder/musicreps/issues/{PR_NUMBER}/comments"
```

The proxy authenticates automatically via the JWT in `GLOBAL_AGENT_HTTP_PROXY`.
No `GH_TOKEN` needed. Git push/pull work normally via the `origin` remote.

**Read-only.** The proxy supports GET requests (list PRs, read comments) but
not POST/PATCH (create PRs, post comments). Push the branch and create PRs
manually or let CI handle it.
