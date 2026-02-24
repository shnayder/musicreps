# UI Agent Screenshots — Execution Plan

## Problem

The Claude Code web sandbox cannot run Chromium. This means the agent can't
visually verify UI changes during development. The agent needs to:

1. See the current state of UI components before making changes
2. Verify that changes look correct after making them
3. Iterate: make a change → see the result → adjust → repeat

## Approach

Extend the existing CI pipeline to automatically capture and publish
screenshots on every push to a `claude/*` branch. The agent fetches these
screenshots via public URLs (gh-pages) or the GitHub API, views them with the
`Read` tool (which renders images), and iterates.

### Why this approach

- **Existing infrastructure covers 80%.** `take-screenshots.ts` already
  captures ~25 screenshots across all modes and key design moments. The
  `deploy-preview.yml` workflow already builds and deploys to gh-pages on
  every `claude/*` push. The `build-screenshot-review.ts` script already
  generates a baseline-vs-current comparison page.
- **gh-pages is publicly accessible** — no API auth needed to download images.
  The agent can also use `Read` on downloaded files to view them.
- **Workflow artifacts are the backup path** — uploaded alongside gh-pages
  deployment, available via GitHub API for programmatic access.

### Alternatives considered

- **Workflow dispatch with manual trigger** — adds latency (agent must
  explicitly trigger). Push-based is simpler since pushes already happen.
- **Commit screenshots to the feature branch** — pollutes git history with
  binary files. gh-pages is the right place.
- **Only use artifacts (no gh-pages)** — requires authenticated API calls.
  gh-pages avoids this.
- **Build a custom lightweight system** — unnecessary given the existing
  `take-screenshots.ts` does exactly what's needed.

---

## Implementation Steps

### Step 1: Add screenshot capture to `deploy-preview.yml`

After the existing build step, add steps to:

1. Install Playwright browsers (`npx playwright install --with-deps chromium`)
2. Run `deno task screenshots` (captures to `screenshots/`)
3. Run `deno task screenshots:baseline` first time, then `screenshots:review`
   to generate the comparison HTML

The workflow already has Deno, Node 20, and npm dependencies installed. Playwright
is already in `package.json`. The only missing piece is browser binaries.

```yaml
# After existing "Build" step:

- name: Install Playwright browsers
  run: npx playwright install --with-deps chromium

- name: Capture screenshots
  run: npx tsx scripts/take-screenshots.ts --dir screenshots/current

- name: Generate screenshot review page
  run: |
    # If baseline exists in the repo, use it; otherwise current = baseline
    if [ -d screenshots/baseline ]; then
      npx tsx scripts/build-screenshot-review.ts
    else
      cp -r screenshots/current screenshots/baseline
    fi
```

### Step 2: Deploy screenshots alongside preview

Modify `deploy-gh-pages.sh` (or the workflow directly) so that when deploying a
preview, the `screenshots/` directory is included in the preview deployment:

```
preview/<branch-name>/
  index.html          # The app (already deployed)
  screenshots/
    current/
      fretboard-idle.png
      fretboard-quiz.png
      ...
    baseline/
      ...              # (if available)
  design/
    screenshot-review.html  # Comparison page
```

This means screenshots are accessible at:
`https://shnayder.github.io/musicreps/preview/<branch>/screenshots/current/<name>.png`

Changes to `deploy-gh-pages.sh`:
- In the preview branch, after copying `docs/*`, also copy `screenshots/` into
  the preview directory.

### Step 3: Upload screenshots as workflow artifacts (backup)

Add an artifact upload step so screenshots are also available via the GitHub API:

```yaml
- name: Upload screenshots
  uses: actions/upload-artifact@v4
  with:
    name: screenshots-${{ github.sha }}
    path: screenshots/
    retention-days: 30
```

This provides an API-accessible backup. The agent can download via:
```bash
curl --proxy "$PROXY_URL" \
  "https://api.github.com/repos/shnayder/musicreps/actions/runs/{run_id}/artifacts"
```

### Step 4: Establish baseline management

**Baseline strategy:** The first screenshot run on a branch becomes the baseline.
Subsequent runs compare against it.

Options (in order of simplicity):

**Option A — Branch-relative baseline (recommended):**
- First push to a `claude/*` branch: capture screenshots, save as both
  `baseline/` and `current/`.
- Subsequent pushes: capture only `current/`, compare against saved `baseline/`.
- Baseline is stored as a workflow artifact from the first run, downloaded
  in subsequent runs.

**Option B — Main-branch baseline:**
- Maintain a `screenshots/baseline/` directory in the repo (or on gh-pages)
  from the `main` branch.
- Every `claude/*` push compares against main's screenshots.
- Simpler conceptually but requires a separate workflow to update baselines
  when main changes.

**Recommendation: Start with Option A.** It's self-contained per branch.

Implementation:
```yaml
- name: Download baseline (if exists)
  uses: actions/download-artifact@v4
  with:
    name: screenshots-baseline-${{ github.ref_name }}
    path: screenshots/baseline
  continue-on-error: true  # First run won't have baseline

- name: Capture current screenshots
  run: npx tsx scripts/take-screenshots.ts --dir screenshots/current

- name: Save baseline (first run only)
  if: steps.download-baseline.outcome == 'failure'
  uses: actions/upload-artifact@v4
  with:
    name: screenshots-baseline-${{ github.ref_name }}
    path: screenshots/current
    retention-days: 90
```

### Step 5: Post screenshot summary on PR

Extend the existing PR comment bot to include screenshot information:

```
<!-- preview-bot -->
**Preview deployed:** https://shnayder.github.io/musicreps/preview/<branch>/

**Screenshots:** [View all](https://shnayder.github.io/musicreps/preview/<branch>/screenshots/current/)
**Comparison:** [Baseline vs Current](https://shnayder.github.io/musicreps/preview/<branch>/design/screenshot-review.html)
```

This gives the human reviewer quick access too.

### Step 6: Agent workflow for fetching and viewing screenshots

Document the agent's workflow for UI iteration:

1. **Make changes** to CSS/HTML/JS
2. **Push** to the `claude/*` branch
3. **Wait** for the workflow to complete (~2-3 min for build + screenshots)
4. **Check workflow status:**
   ```bash
   curl --proxy "$PROXY_URL" \
     "https://api.github.com/repos/shnayder/musicreps/actions/runs?branch=<branch>&per_page=1"
   ```
5. **Download specific screenshots** from gh-pages:
   ```bash
   curl --proxy "$PROXY_URL" -L -o /tmp/screenshot.png \
     "https://shnayder.github.io/musicreps/preview/<branch>/screenshots/current/fretboard-idle.png"
   ```
6. **View with Read tool:** `Read /tmp/screenshot.png`
7. **Iterate** based on what's visible

### Step 7: Enhance screenshot script for targeted captures (stretch)

Add an optional `--modes` flag to `take-screenshots.ts` to capture only
specific modes:

```bash
npx tsx scripts/take-screenshots.ts --modes fretboard,semitoneMath
```

This would allow the workflow to accept a configuration input for faster
iteration when only specific modes are being changed. Not needed for v1 —
the full set of ~25 screenshots runs fast enough in CI.

---

## File Changes Summary

| File | Change |
|------|--------|
| `.github/workflows/deploy-preview.yml` | Add Playwright install, screenshot capture, artifact upload, baseline management, enhanced PR comment |
| `scripts/deploy-gh-pages.sh` | Copy `screenshots/` and `screenshot-review.html` into preview directory |
| `scripts/take-screenshots.ts` | Minor: accept `--modes` flag for subset capture (stretch goal) |
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
│  4. Capture screenshots         │
│  5. Generate review page        │
│  6. Deploy to gh-pages:         │
│     preview/<branch>/           │
│       index.html                │
│       screenshots/current/*.png │
│       design/screenshot-review  │
│  7. Upload artifact (backup)    │
│  8. Comment on PR               │
└─────────────────────────────────┘
        │
        ▼
Agent polls workflow status via API
        │
        ▼
Agent downloads screenshots from gh-pages
        │
        ▼
Agent views with Read tool
        │
        ▼
Agent iterates (back to top)
```

---

## Open Questions

1. **Screenshot review page generation:** `build-screenshot-review.ts` currently
   reads from `screenshots/baseline/` and `screenshots/` (not
   `screenshots/current/`). Need to either adjust the script's paths or use
   symlinks/copies in the workflow so baseline/current align with the script's
   expectations.

2. **Baseline persistence across workflow runs:** GitHub Actions artifacts with
   the same name overwrite. We need the baseline artifact to persist while
   current changes. Using distinct artifact names
   (`screenshots-baseline-<branch>` vs `screenshots-current-<sha>`) handles
   this.

3. **Workflow duration:** Playwright screenshot capture adds ~30-60s to the
   workflow (browser install is cached after first run). This is acceptable
   for the value provided.

4. **Screenshot diff images:** A future enhancement could generate pixel-diff
   images (red overlay showing changed pixels) using a tool like `pixelmatch`.
   Not needed for v1 — side-by-side comparison is sufficient.
