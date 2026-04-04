# Releases

How blessed versions of the web content reach native app users. Web users always
get the latest `main` build via GitHub Pages; this guide covers the native app
OTA (over-the-air) update system.

## How It Works

The iOS app bundles a copy of the web content at build time (in
`ios/App/App/public/`). On first launch, it loads from those bundled files. A
background updater checks for newer releases and downloads them for the next app
restart.

```
App launch
  |
  Native plugin (OTAUpdatePlugin) decides what to load:
  +-- cached update (healthy) --> load from Library/NoCloud/ota/current/
  +-- cached update (pending) --> previous boot failed, fall back to bundled
  +-- no update              --> load from bundled public/
  |
  v
App boots from chosen content
  |
  JS calls reportHealthy() --> native marks update as healthy
  |
  Background: fetch /release/version.json from GitHub Pages
  +-- same version: skip
  +-- new version: download, verify SHA-256, write to filesystem
      (applied on next app restart)
```

Updates are never applied mid-session. The user always finishes their current
session on the version they started with.

## Deploying a Release

Releases are served from `https://shnayder.github.io/musicreps/release/`. To
deploy:

```bash
# 1. Make sure main is up to date with the changes you want to release
git checkout main && git pull

# 2. Tag the release
git tag v<N>    # e.g. v42, v43
git push origin v<N>
```

The `deploy-release` GitHub Actions workflow:
1. Checks out the tagged commit
2. Runs the full `deno task ok` check suite
3. Builds with `deno task build`
4. Generates `version.json` (SHA-256 hash of index.html)
5. Deploys to `release/` on the `gh-pages` branch

Users get the new version on their next app restart after the background check
runs.

### Manual release (without CI)

If the GitHub Actions workflow isn't set up yet, or for testing:

```bash
deno task build
bash scripts/deploy-gh-pages.sh release
```

## Rolling Back

Push a new tag pointing at the older commit:

```bash
git tag v<N+1> <older-commit-hash>
git push origin v<N+1>
```

Or force-update an existing tag (not recommended but works):

```bash
git tag -f v<N> <older-commit-hash>
git push -f origin v<N>
```

Either way, the `release/` directory on gh-pages gets updated with the older
version. The next time the app checks for updates, it downloads the "new"
(actually older) version. On next restart, the rolled-back version loads.

Rollback is fully automatic from the client's perspective. The updater doesn't
distinguish between a rollback and a regular update.

## Crash Protection

The native plugin tracks a health state for each update:

| State     | Meaning                                      |
| --------- | -------------------------------------------- |
| `none`    | No update cached, using bundled content      |
| `ready`   | Update downloaded, will load on next restart |
| `pending` | Update loaded, waiting for JS to confirm     |
| `healthy` | JS confirmed boot succeeded                  |

On each app launch, if the state is `pending` (meaning the previous boot from
this update didn't complete), the plugin increments an attempt counter. After 2
failed attempts, it deletes the update and reverts to bundled content.

This means: even if a broken release is deployed, the app will try it twice,
then automatically fall back to the last known good bundled version. Users are
never permanently stuck.

## Version Manifest

Each release includes a `version.json`:

```json
{
  "version": "#456",
  "sha256": "a1b2c3d4...",
  "timestamp": "2026-04-04T12:00:00Z"
}
```

The updater uses `sha256` to verify the downloaded `index.html` matches what was
built. If the hash doesn't match (corrupted download, CDN serving stale
content), the update is discarded.

## Filesystem Layout

```
App bundle (read-only, ships with app binary):
  App.app/public/              # Bundled web content (the fallback)

Device filesystem (writable):
  Library/NoCloud/ota/
    current/                   # Active update (index.html + assets)
```

`Library/NoCloud/` is used to prevent iCloud backup of update files.

## gh-pages Branch Structure

```
gh-pages:
  index.html              # Latest main build (web users)
  sw.js, *.png, etc.
  release/                # Blessed release for native app
    index.html
    version.json
  preview/                # PR preview builds
```

`release/` is only updated by the release workflow (tag push), not by every push
to main. Web users always get the latest main build; native app users get the
version you explicitly released.

## Key Paths

| Path                                | Purpose                              |
| ----------------------------------- | ------------------------------------ |
| `ios/App/App/OTAUpdatePlugin.swift` | Native plugin (boot routing + state) |
| `ios/App/App/AppViewController.swift` | Registers the plugin with Capacitor |
| `src/updater.ts`                    | JS update checker + downloader       |
| `scripts/deploy-gh-pages.sh`        | Deploy script (production + release) |
| `.github/workflows/deploy-release.yml` | CI workflow for tag-triggered releases |

## Testing Updates Locally

To test the OTA flow without pushing to GitHub Pages:

1. Build the app: `deno task build && npx cap sync ios`
2. Run in Xcode, confirm app boots from bundled content
4. Manually place `version.json` and `index.html` at the release URL
   (or use a local server and temporarily change `RELEASE_BASE` in `updater.ts`)
5. Wait 5s for background check, or foreground the app
6. Restart the app — it should load the downloaded update

To test crash recovery:
1. Download a valid update (steps above)
2. Replace the cached `index.html` with broken HTML
3. Restart twice — app should fall back to bundled content
