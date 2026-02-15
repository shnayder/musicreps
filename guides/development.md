# Development

Day-to-day workflow reference for building, testing, and deploying.

## Prerequisites

- **Deno** (preferred) or **Node.js** with `npx`
- No `npm install` needed for build/test — the app has zero runtime dependencies
- Playwright required for screenshots only: `npm install && npx playwright install chromium`. Only works locally, when `CLAUDE_CODE_REMOTE` is not set to `true`.

## Commands

```bash
# Dev server (serves index.html + sw.js on localhost:8000)
deno run --allow-net --allow-read main.ts

# Build for GitHub Pages (Deno)
deno run --allow-write --allow-read main.ts --build

# Build for GitHub Pages (Node — when Deno is unavailable)
npx tsx build.ts

# Run all tests
npx tsx --test src/*_test.ts

# Take screenshots of all modes (starts dev server automatically)
npx tsx scripts/take-screenshots.ts
```

## Template Sync

Both `main.ts` and `build.ts` contain the HTML template. When changing the
template (HTML structure, nav buttons, mode screens, or version number), update
**both** files. This is the single most common source of bugs — the review
checklist checks it first.

What lives in both files:
- HTML structure (nav drawer, mode screens, SVG fretboard)
- `<script>` block with file reads and concatenation order
- Version number in `<div class="version">`

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
- Runner: `npx tsx --test`
- Dependency injection: `Map` for storage, imported music data, seeded RNG
- No global state pollution — each test creates its own selector/helpers

Write tests as you go, not just at the end.

## Versioning

A version number is displayed top-right (`<div class="version">`). **Always bump
the version with every change** — even tiny bug fixes or label tweaks. The user
needs to confirm they're testing the latest build; a stale version number makes
that impossible. The version appears in both `main.ts` and `build.ts` — update
both. Bump by 1 for normal changes (v3.13 → v3.14 → v3.15) and bump the major
version for large overhauls (v3.x → v4.0).

## Branching

Always start from the latest `main` branch unless told otherwise. Fetch and
merge/rebase from `origin/main` after the feature design is finalized, before
beginning implementation.


## Deployment

Build output goes to `docs/` (GitHub Pages source directory):
- `docs/index.html` — the single-page app
- `docs/sw.js` — service worker (network-first cache strategy)
- `docs/favicon-32x32.png` — browser tab icon
- `docs/apple-touch-icon.png` — iOS home screen icon

After building, commit the changed files. The service worker ensures users get
the latest version on next load.

**If you add new files to `docs/`**, no workflow changes are needed — the preview
deploy workflow copies all files from `docs/` automatically.

## Preview Deploys

Pushes to `claude/*` branches automatically deploy a preview build via GitHub
Actions. The workflow (`.github/workflows/deploy-preview.yml`) builds the app
and commits the output to `docs/preview/<branch-name>/` on main.

- **Preview URL:** `shnayder.github.io/fretboard-trainer/preview/<branch-name>/`
- **Cleanup:** `.github/workflows/cleanup-preview.yml` removes the preview
  directory when the branch is deleted or PR is closed.
- **PR comment:** the deploy workflow posts the preview URL on any associated PR.

## Code Review

Run `/review` **before pushing final changes** on every branch. This is not
optional — it catches template sync issues, architecture violations, missing
tests, and convention drift that are easy to miss during implementation.

Use the `/review` slash command to run the code-reviewer subagent, which
applies the checklist in `.claude/commands/review-checklist.md`. The reviewer
checks for common issues: build file sync, architecture pattern violations,
missing tests, and more.

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
No `GH_TOKEN` needed. Git push/pull work normally via the `origin` remote.
