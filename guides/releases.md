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
  +-- cached update (healthy)                --> load from Library/ota/current/
  +-- cached update (pending, attempts < 2)  --> retry from Library/ota/current/
  +-- cached update (pending, attempts >= 2) --> delete update, fall back to bundled
  +-- no update                              --> load from bundled public/
  |
  v
App boots from chosen content
  |
  JS calls reportHealthy() --> native marks update as healthy
  |
  Background: fetch /release/version.json from GitHub Pages
  +-- same version (including downloaded-but-not-applied): skip
  +-- new version: download, verify SHA-256, write to Library/ota/current/
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
git tag release-v<N>    # e.g. release-v1, release-v2
git push origin release-v<N>
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
git tag release-v<N+1> <older-commit-hash>
git push origin release-v<N+1>
```

Or force-update an existing tag (not recommended but works):

```bash
git tag -f release-v<N> <older-commit-hash>
git push -f origin release-v<N>
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
  Library/ota/
    current/                   # Active update (index.html + assets)
```

Stored under `Library/` via the Capacitor Filesystem plugin's `LIBRARY`
directory constant.

## gh-pages Branch Structure

```
gh-pages:
  index.html              # Latest main build (web users)
  sw.js, *.png, etc.
  release/                # Blessed release for native app
    index.html
    version.json
  release-staging/        # Staging area for testing (same structure)
  preview/                # PR preview builds
```

`release/` is only updated by the release workflow (tag push) or manual deploy.
`release-staging/` is for testing the OTA flow without touching the real release.
Web users always get the latest main build; native app users get the version you
explicitly released.

## Testing OTA Updates

### Using release-staging

The safest way to test the full OTA flow end-to-end without affecting the real
release path:

```bash
# 1. Build
deno task build

# 2. Deploy to staging
bash scripts/deploy-gh-pages.sh release-staging
```

Then point the updater at staging. Two options:

- **In HTML** (requires rebuild): add `data-release-base` attribute to the
  `#home-screen` div in `src/build-template.ts`:
  ```html
  <div ... data-release-base="https://shnayder.github.io/musicreps/release-staging">
  ```

- **In Safari Web Inspector** (no rebuild): run in the JS console after the app
  loads:
  ```js
  document.getElementById('home-screen').dataset.releaseBase =
    'https://shnayder.github.io/musicreps/release-staging';
  __otaForceCheck();
  ```

### Testing the full cycle

1. Build and run in Xcode — app boots from bundled content
2. Deploy to `release-staging/` (steps above)
3. In Safari Web Inspector, set releaseBase and force a check:
   ```js
   document.getElementById('home-screen').dataset.releaseBase =
     'https://shnayder.github.io/musicreps/release-staging';
   __otaForceCheck();
   ```
4. Check console for `[OTA] update registered, will apply on next restart`
5. Kill and relaunch the app in Xcode
6. Check console for `[OTA] switching to update at ...`
7. Confirm the app loads the updated content (check version string on home
   screen)

### Testing rollback

1. Complete the cycle above (app running from staging update)
2. Make a visible change (e.g. bump version), rebuild, redeploy to staging
3. Wait for background check, restart — confirm new version loads
4. Now redeploy the original version to staging
5. Wait for background check, restart — confirm rollback loads

### Testing crash recovery

1. Complete a successful update cycle
2. Corrupt the cached update on the device filesystem — in Safari Web Inspector:
   ```js
   const fs = Capacitor.Plugins.Filesystem;
   await fs.writeFile({
     path: 'ota/current/index.html',
     data: btoa('<html><body>BROKEN</body></html>'),
     directory: 'LIBRARY',
   });
   ```
3. Restart the app — it loads the broken HTML (attempt 1)
4. Restart again — attempt 2, still broken
5. Restart a third time — plugin gives up, falls back to bundled content
6. Check console for `[OTA] update failed after 2 attempts, reverting to bundled`

### Cleaning up staging

After testing, remove `release-staging/` from gh-pages:

```bash
# On the gh-pages branch:
git rm -rf release-staging
git commit -m "Clean up release-staging"
git push origin gh-pages
```

## Key Paths

| Path                                    | Purpose                              |
| --------------------------------------- | ------------------------------------ |
| `ios/App/App/OTAUpdatePlugin.swift`     | Native plugin (boot routing + state) |
| `ios/App/App/AppViewController.swift`   | Registers the plugin with Capacitor  |
| `src/updater.ts`                        | JS update checker + downloader       |
| `scripts/deploy-gh-pages.sh`            | Deploy script (all modes)            |
| `.github/workflows/deploy-release.yml`  | CI workflow for tag-triggered releases |
