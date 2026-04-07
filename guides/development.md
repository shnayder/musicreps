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
error on `deno install`). Two workarounds:

1. **`npm install`** — npm routes through the proxy correctly via
   `npm_config_proxy`. A session-start hook in `.claude/settings.json` runs this
   automatically when `IS_SANDBOX=yes`. If you see
   `Could not resolve "preact-render-to-string"` errors, run `npm install`
   manually.

2. **`DENO_TLS_CA_STORE=system`** — tells Deno to use the OS certificate store
   (which includes the proxy CA). Required for commands that download npm
   packages themselves, e.g. `DENO_TLS_CA_STORE=system deno task test`.

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

# Visual history archive (outside repo)
npx tsx scripts/capture-visual-history.ts --archive-dir <path>          # capture at HEAD
npx tsx scripts/capture-visual-history.ts --archive-dir <path> --force  # force capture
```

## Build System

`src/build-template.ts` assembles the HTML shell with empty mode container
divs (derived from `TRACKS` in `mode-catalog.ts`). `main.ts` is the single
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

### E2E tests

Browser-level tests using Playwright that verify cross-cutting user flows. They
run against a real dev server and exercise the full stack (HTML → CSS → JS →
localStorage).

#### Running

```bash
deno task e2e          # All 5 suites (~30s)
deno task e2e:quiz     # Quiz lifecycle (start, answer, feedback, next, stop)
deno task e2e:nav      # Navigation and mode switching
deno task e2e:persist  # localStorage persistence across reloads
deno task e2e:chord    # Chord spelling sequential input
deno task e2e:skip     # Skip/unskip recommendations
```

Requires Playwright's Chromium: `npx playwright install chromium`.

E2E tests also run in CI on every push to `claude/*` and `codex/*` branches.

#### Test infrastructure

Each suite lives in `tests/e2e/` and spawns its own Deno dev server on a
dedicated port (8003–8007) to avoid conflicts. Shared helpers in
`tests/e2e/helpers/`:

- **`server.ts`** — starts a dev server subprocess, waits for `Listening on`
  output, returns the actual port.
- **`page-helpers.ts`** — `createTestPage`, `seedLocalStorage`,
  `navigateToMode`, `startQuiz`, `advanceToNext`.
- **`fixture-builders.ts`** — `buildMotorBaseline`, `buildEnabledGroups` for
  seeding localStorage with known state.

The `?roundMs=N` query parameter overrides the 60-second round timer (e.g.,
`?roundMs=5000` for 5s rounds). Useful in both E2E tests and manual testing.

#### What to E2E test

- **Cross-cutting user flows** — quiz start → answer → feedback → next → stop.
- **Navigation lifecycle** — mode switching, back button, menu interaction.
- **Persistence** — localStorage survives reload, corrupt data doesn't crash.
- **Scope changes** — enabling/disabling groups, skip/unskip recommendations.
- **Multi-step input** — sequential answer entry (chord spelling).

#### What NOT to E2E test

- **Pure logic** — question generation, scoring, adaptive selection → unit tests.
- **Visual appearance** — layout, colors, spacing → screenshot diffing.
- **Exhaustive combinations** — every group × every direction → unit tests.
  E2E tests should spot-check representative flows, not enumerate.
- **Timing-sensitive internals** — EWMA values, exact scores → unit tests with
  controlled inputs.

#### Design principles

- **Wait for DOM state, not timeouts.** Use `waitForSelector` with a state
  (`'visible'`, `'hidden'`) instead of `waitForTimeout`. Timeouts are flaky
  across machines.
- **Be direction-agnostic.** Bidirectional modes pick a random direction each
  question. Don't assume the prompt will be a note vs. a number — read the
  placeholder or prompt text to determine which kind of answer to give.
- **Find targets dynamically.** When the app's recommendation algorithm picks
  which group to suggest, read the actual recommendation text instead of
  hardcoding expected values. Algorithms change; tests shouldn't break.
- **Seed known state.** Use `seedLocalStorage` + `buildMotorBaseline` to skip
  calibration and start from a deterministic baseline. Don't rely on completing
  calibration in-test.
- **Each suite owns its server.** Dedicated ports prevent interference between
  parallel or sequential runs. If adding a new suite, pick the next unused port.
- **Clean up contexts.** Wrap each test's page in `try/finally` with
  `page.context().close()` to avoid leaking browser contexts.

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

### Pruning stale branches

`scripts/prune-branches.sh` removes stale remote-tracking refs and deletes
local branches that have been merged into `main`. It always keeps `main`,
`gh-pages`, `workstream/*`, and the current branch.

```bash
scripts/prune-branches.sh          # Preview (dry run)
scripts/prune-branches.sh --do-it  # Actually delete
```

## Deployment

Build output goes to `docs/` (GitHub Pages source directory):

- `docs/index.html` — the single-page app
- `docs/sw.js` — service worker (network-first cache strategy)
- `docs/favicon-32x32.png` — browser tab icon
- `docs/apple-touch-icon.png` — iOS home screen icon (180x180)
- `docs/icon-192x192.png` — PWA icon (192x192, Android installability)
- `docs/icon-512x512.png` — PWA icon (512x512, splash screens)
- `docs/manifest.json` — web app manifest (PWA installability)
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

The **Colors** tab on the preview page shows live palette ramps, semantic token
swatches, pairings, heatmap scale, and component token reference.

Build-generated pages require `deno task build` or a dev server refresh.

**Every new UI component must appear in the preview page.** The preview is the
design system source of truth — it renders real components with mock data, not
copies or approximations. When adding a component, add a Section for it in the
relevant preview tab file (`src/ui/preview-tab-*.tsx`). If no tab fits, add a
new one.

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

## Screenshots

The `take-screenshots.ts` script captures fixture-based screenshots locally. It
dispatches state fixtures to the running app (no clicking through quizzes), so
screenshots are fully deterministic. **Screenshots are not captured in CI** —
preview deploys include only the built app. Use the visual history archive
(above) or run the script locally for visual review.

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

## Visual History Archive

A lightweight archive of key screenshots over time, stored **outside the repo**.
Each snapshot captures a few representative screens with commit metadata — an
easy way to see how the app looked at any point without checking out old commits.

**Why outside the repo?** Binary files (images, screenshots) bloat git history
permanently — even after deletion, the blobs stay in the object store. The CI
preview system previously committed screenshots to `gh-pages` on every push,
inflating the repo to 400+ MB. This archive avoids that by keeping images in a
local directory that syncs without polluting git.

### Capturing

The archive directory must be specified via `--archive-dir` or the
`MUSICREPS_VISUAL_HISTORY_DIR` environment variable.

```bash
ARCHIVE=~/my/visual-history

# Normal: capture at HEAD (skips if no new commits since last snapshot)
npx tsx scripts/capture-visual-history.ts --archive-dir $ARCHIVE

# Force capture even if HEAD unchanged
npx tsx scripts/capture-visual-history.ts --archive-dir $ARCHIVE --force

# Backfill from an old gh-pages preview commit
npx tsx scripts/capture-visual-history.ts --archive-dir $ARCHIVE \
  --backfill-ghpages <gh-pages-commit> \
  --preview <preview-dir-name> \
  --note "description"
```

### Automatic weekly capture

A launchd agent (`~/Library/LaunchAgents/com.musicreps.visual-history.plist`)
runs the capture script every Monday at 10:17am. It skips automatically if HEAD
hasn't changed since the last snapshot. Logs go to
`/tmp/musicreps-visual-history.log`.

```bash
# Check agent status
launchctl list | grep musicreps

# Reload after editing the plist
launchctl unload ~/Library/LaunchAgents/com.musicreps.visual-history.plist
launchctl load ~/Library/LaunchAgents/com.musicreps.visual-history.plist
```

### Manifest

`scripts/visual-history.json` lists which screenshots to capture. Edit this file
to change the set of screens in future snapshots. Names must match entries from
the screenshot manifest (`npx tsx scripts/take-screenshots.ts --list`).

### Archive structure

```
~/Dropbox/projects/musicreps-visual-history/
  index.md                        # Chronological table of all snapshots
  2026-03-17_8fcb41bb/
    home.jpg
    fretboard-idle.jpg
    semitoneMath-idle.jpg
    ...
    meta.json                     # {commit, date, subject, screenshots}
```

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

### Content source and OTA updates

The app boots from bundled local files (`ios/App/App/public/`). A background
updater checks for newer releases at
`https://shnayder.github.io/musicreps/release/` and downloads them for the next
app restart. See [releases.md](releases.md) for the full OTA system.

For local development, `CAP_DEV_PORT` points the app at a local dev server:

```bash
CAP_DEV_PORT=8002 npx cap copy ios    # then rebuild in Xcode
```

`CAP_DEV_HOST` overrides the hostname (default `localhost`). On iOS,
non-`localhost` hosts require an `NSAppTransportSecurity` exception in
`ios/App/App/Info.plist`.

The `OTAUpdatePlugin` is registered via `AppViewController.capacitorDidLoad()`,
not via `packageClassList`, so `npx cap sync ios` won't affect it.

## Android App (Capacitor)

The Android app is the same Capacitor wrapper as iOS. The Gradle project lives
in `android/`.

### Prerequisites

- Android Studio (includes bundled JDK 21 and emulator)
- Android SDK (installed via Android Studio's SDK Manager)
- A system image for the emulator (e.g., API 37 arm64)

The build uses Android Studio's bundled JDK. If building from the command line,
set `JAVA_HOME` to point to it:

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME=~/Library/Android/sdk
```

### Build and run in Emulator

```bash
# 1. Build web content + sync into Android project
deno task build && npx cap sync android

# 2. Build the debug APK
cd android && ./gradlew assembleDebug && cd ..

# 3. Boot an emulator (skip if already running)
$ANDROID_HOME/emulator/emulator -avd Pixel_8 &

# 4. Wait for boot, then install and launch
$ANDROID_HOME/platform-tools/adb wait-for-device
$ANDROID_HOME/platform-tools/adb install -r android/app/build/outputs/apk/debug/app-debug.apk
$ANDROID_HOME/platform-tools/adb shell am start -n com.musicreps.app/.MainActivity
```

Or open in Android Studio and hit Run (▶):

```bash
npx cap open android
```

### Iterating on changes

After editing JS/CSS/HTML, rebuild and sync web content — no native rebuild
needed unless you changed Java/Kotlin code:

```bash
deno task build && npx cap copy android
```

Then relaunch the app (kill it first — Capacitor loads from local files).

If you changed native code or Capacitor config, rebuild via Gradle:

```bash
cd android && ./gradlew assembleDebug && cd ..
```

### Sharing a debug APK

The debug APK is at `android/app/build/outputs/apk/debug/app-debug.apk`. Share
it directly (e.g., Drive link). The recipient needs to enable "Install from
unknown sources" in their Android settings.

### Key paths

| Path                                  | Contents                              |
| ------------------------------------- | ------------------------------------- |
| `capacitor.config.ts`                 | App name, bundle ID, web dir          |
| `android/app/build.gradle`            | App-level Gradle config               |
| `android/variables.gradle`            | SDK versions and dependency versions  |
| `android/app/src/main/AndroidManifest.xml` | Android app configuration        |
| `android/app/src/main/res/mipmap-*/`  | App icons (all densities)             |
| `android/app/src/main/assets/public/` | Web content (copied, gitignored)      |

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

# Git Safety Policy

## Core Rule
Only use Git operations that are **recoverable, non-destructive, and append-only**.  
Never rewrite or implicitly discard state.

Feature work:
- make feature branches for all work. Never push directly to main.
- merge from latest main as needed
- PR back into main. No rebase.

---

## Allowed Commands

- git status
- git diff
- git add <files>
- git commit -m "<message>"
- git switch -c <branch>
- git checkout -b <branch>
- git branch
- git log

---

## Strictly Disallowed Commands

- git stash pop
- git stash    // Let's not use stash at all. Temp commits or temp folders are always available.
- git commit --amend
- git rebase (any form)
- git reset --hard
- git clean -fd (or similar)
- git push --force (or --force-with-lease)
- git checkout <commit> (detached HEAD workflows)

If these truly need to be run, describe what needs to be done and why, give the exact command you'd like to run, and escalate.

## Failure / Recovery Protocol

If the repo state is unclear or something fails, run these:

- git status
- git stash list
- git reflog
- git diff

Do NOT:
- reset
- clean
- force push
- drop stashes blindly

Escalate instead.

---

## Behavioral Constraints

- Never assume hidden state (stash, index, reflog) is safe
- Never delete or overwrite work implicitly
- Prefer creating new commits over modifying existing ones
- Prefer visible state (branches, commits) over hidden state (stash)
