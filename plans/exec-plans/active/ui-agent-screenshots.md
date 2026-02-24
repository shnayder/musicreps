# UI Agent Screenshots — Execution Plan

## Problem

The Claude Code web sandbox cannot run Chromium. This means the agent can't
visually verify UI changes during development. The agent needs to:

1. See the current state of UI components before making changes
2. Verify that changes look correct after making them
3. Iterate: make a change → see the result → adjust → repeat

## Approach

Extend the existing CI pipeline to automatically capture and publish
screenshots on every push to a `claude/*` branch. The agent downloads these
screenshots via `raw.githubusercontent.com` (which bypasses the egress proxy's
block on `*.github.io`), views them with the `Read` tool, and iterates.

### Network access (tested 2026-02-24)

| Path | Status | Use |
|------|--------|-----|
| `shnayder.github.io` | **Blocked** (403, egress proxy) | Humans only (browser) |
| `raw.githubusercontent.com` | **Works** | Agent downloads screenshots |
| `api.github.com` | **Works** (unauthenticated) | Agent polls workflow status |
| `github.com` | **Works** | General access |

### Why this approach

- **Existing infrastructure covers 80%.** `take-screenshots.ts` already
  captures ~25 screenshots across all modes and key design moments. The
  `deploy-preview.yml` workflow already builds and deploys to gh-pages on
  every `claude/*` push.
- **gh-pages + raw.githubusercontent.com** — files on the `gh-pages` branch
  are accessible at `raw.githubusercontent.com/shnayder/musicreps/gh-pages/...`
  without authentication. This works from the sandbox (tested).
- **Dual audience:** humans view screenshots via `shnayder.github.io` in their
  browser; the agent downloads the same files via `raw.githubusercontent.com`.

### Alternatives considered

- **Workflow dispatch with manual trigger** — adds latency (agent must
  explicitly trigger). Push-based is simpler since pushes already happen.
- **Commit screenshots to the feature branch** — pollutes git history with
  binary files. gh-pages is the right place.
- **Only use artifacts (no gh-pages)** — requires authenticated API calls.
  The artifact download endpoint returns 401 without a token.
- **Direct gh-pages URLs** — blocked by egress proxy (`*.github.io` not in
  allowlist). `raw.githubusercontent.com` is the working alternative.

---

## Implementation Steps

### Step 1: Add screenshot capture to `deploy-preview.yml`

After the existing build step, add steps to:

1. Install Playwright browsers (`npx playwright install --with-deps chromium`)
2. Capture screenshots to `screenshots/` (the default output directory)

The workflow already has Deno, Node 20, and npm dependencies installed.
Playwright is already in `package.json`. The only missing piece is browser
binaries.

```yaml
# After existing "Build" step:

- name: Install Playwright browsers
  run: npx playwright install --with-deps chromium

- name: Capture screenshots
  run: npx tsx scripts/take-screenshots.ts
```

### Step 2: Deploy screenshots alongside preview

Modify `deploy-gh-pages.sh` so that when deploying a preview, the
`screenshots/` directory is copied into the preview deployment:

```
preview/<branch-name>/
  index.html              # The app (already deployed)
  screenshots/
    fretboard-idle.png
    fretboard-quiz.png
    ...
```

Agent access URL pattern:
```
https://raw.githubusercontent.com/shnayder/musicreps/gh-pages/preview/<safe-branch>/screenshots/<name>.png
```

Human browser URL (same files):
```
https://shnayder.github.io/musicreps/preview/<safe-branch>/screenshots/<name>.png
```

Changes to `deploy-gh-pages.sh`:
- In the preview branch, after stashing `docs/*`, also stash `screenshots/`
  into the preview directory.

### Step 3: Enhance PR comment with screenshot info

Extend the existing PR comment bot to include screenshot links:

```
<!-- preview-bot -->
**Preview deployed:** https://shnayder.github.io/musicreps/preview/<branch>/

**Screenshots:** [View all](https://shnayder.github.io/musicreps/preview/<branch>/screenshots/)
```

This gives the human reviewer quick access.

### Step 4: Document agent workflow

Add a section to `guides/development.md` documenting the agent's screenshot
workflow:

1. **Make changes** to CSS/HTML/JS
2. **Push** to the `claude/*` branch
3. **Wait** for the workflow to complete (~2-3 min for build + screenshots)
4. **Check workflow status:**
   ```bash
   curl -s "https://api.github.com/repos/shnayder/musicreps/actions/runs?branch=<branch>&per_page=1" \
     | python3 -c "import sys,json; r=json.load(sys.stdin)['workflow_runs'][0]; print(r['status'], r['conclusion'] or '')"
   ```
5. **List available screenshots:**
   ```bash
   curl -s "https://api.github.com/repos/shnayder/musicreps/contents/preview/<safe-branch>/screenshots?ref=gh-pages" \
     | python3 -c "import sys,json; [print(f['name']) for f in json.load(sys.stdin) if f['name'].endswith(('.png','.jpg'))]"
   ```
6. **Download and view:**
   ```bash
   curl -sL -o /tmp/screenshot.jpg \
     "https://raw.githubusercontent.com/shnayder/musicreps/gh-pages/preview/<safe-branch>/screenshots/fretboard-idle.jpg"
   ```
   Then: `Read /tmp/screenshot.jpg`
7. **Iterate** (back to step 1)

---

## File Changes Summary

| File | Change |
|------|--------|
| `.github/workflows/deploy-preview.yml` | Add Playwright install, screenshot capture, enhanced PR comment |
| `scripts/deploy-gh-pages.sh` | Copy `screenshots/` into preview directory |
| `guides/development.md` | Document agent screenshot workflow |

---

## Workflow Diagram

```
Agent makes UI changes
        │
        ▼
   git push to claude/* branch
        │
        ▼
┌─────────────────────────────────┐
│  deploy-preview.yml             │
│                                 │
│  1. Lint / fmt / typecheck      │
│  2. Build app → docs/           │
│  3. Install Playwright          │
│  4. Capture screenshots → ...   │
│     screenshots/*.png           │
│  5. Deploy to gh-pages:         │
│     preview/<branch>/           │
│       index.html                │
│       screenshots/*.png         │
│  6. Comment on PR               │
└─────────────────────────────────┘
        │
        ▼
Agent polls workflow status via API
(api.github.com — works from sandbox)
        │
        ▼
Agent downloads screenshots via
raw.githubusercontent.com (works)
        │
        ▼
Agent views with Read tool
        │
        ▼
Agent iterates (back to top)
```

---

## Future Enhancements

1. **Baseline comparison page:** Use `build-screenshot-review.ts` to generate
   a side-by-side comparison HTML page. Requires baseline management (first
   run saves baseline, subsequent runs compare against it). Not needed for v1
   — the agent just needs to see current state.

2. **Targeted captures:** Add `--modes` flag to `take-screenshots.ts` for
   faster iteration when only specific modes are being changed.

3. **Pixel-diff images:** Generate visual diff overlays using `pixelmatch`.

4. **Artifact upload:** Upload screenshots as workflow artifacts alongside
   gh-pages deployment for redundancy.
