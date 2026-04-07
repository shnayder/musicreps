# Static Assets

App icons, favicons, and other static files used across web and native builds.

## Source file

The canonical source is `static/app-icon.svg`. All PNG icons are generated from
it by `scripts/generate-icons.sh`. Never edit the PNGs by hand — update the SVG
and re-run the script.

## Where icons go

### Web — `static/`

Files in `static/` are copied to `docs/` at build time (controlled by the
`STATIC_ASSETS` whitelist in `main.ts`). The dev server also serves them from
this directory.

| File                  | Size    | Used by                                      |
| --------------------- | ------- | -------------------------------------------- |
| `favicon-32x32.png`   | 32x32   | Browser tab icon (`<link rel="icon">`)       |
| `apple-touch-icon.png`| 180x180 | iOS Safari "Add to Home Screen"              |
| `icon-192x192.png`    | 192x192 | Android PWA (required for installability)     |
| `icon-512x512.png`    | 512x512 | Android PWA splash / manifest                |
| `manifest.json`       |         | Web app manifest (references the icons above) |

Referenced in `src/build-template.ts` (`<link>` tags) and `static/manifest.json`.

**To update web icons:** replace the files in `static/`, keep the same
filenames. If adding a new file, also add it to `STATIC_ASSETS` in `main.ts`.

### iOS — `ios/App/App/Assets.xcassets/AppIcon.appiconset/`

Capacitor's iOS project uses a standard Xcode asset catalog.

| File                  | Size      | Notes                                    |
| --------------------- | --------- | ---------------------------------------- |
| `AppIcon-512@2x.png`  | 1024x1024 | Single universal icon; Xcode scales down |

`Contents.json` in the same directory tells Xcode which file to use. The current
config uses one universal 1024x1024 image for all iOS contexts.

**To update the iOS icon:** replace `AppIcon-512@2x.png` with a 1024x1024 PNG.
No transparency, no alpha channel (iOS rejects it). No changes to
`Contents.json` needed unless adding per-size variants.

### Android — `android/app/src/main/res/mipmap-*/`

Android uses adaptive icons (foreground + background layers) at five densities.
The icon generation script produces all needed files.

| Files                                   | Sizes                         | Notes                          |
| --------------------------------------- | ----------------------------- | ------------------------------ |
| `ic_launcher.png` + `ic_launcher_round.png` | 48–192 (mdpi→xxxhdpi)     | Legacy launcher icons          |
| `ic_launcher_foreground.png`            | 108–432 (mdpi→xxxhdpi)       | Adaptive foreground (72dp safe zone in 108dp canvas) |

The adaptive icon background is defined in
`android/app/src/main/res/drawable/ic_launcher_background.xml` (#FAFAFA solid)
and `values/ic_launcher_background.xml` (color resource). The foreground SVG
source is `static/android-foreground.svg`.

**To update the Android icon:** edit `static/app-icon.svg` and
`static/android-foreground.svg` (the foreground must match the main icon but
with adaptive-icon safe zone padding), then run `scripts/generate-icons.sh` and
`deno task build && npx cap sync android`.

## Skill icons — `static/icons/`

SVG icons shown next to each skill name in the UI. These are **not** app icons —
they're inline UI elements loaded at build time. Not part of `STATIC_ASSETS`
(they're embedded in the HTML, not served as separate files).

## Splash screen

iOS uses Xcode's launch storyboard (`ios/App/App/Base.lproj/LaunchScreen.storyboard`),
not a static image. The `capacitor.config.ts` sets `ios.backgroundColor` to
match the web background for a seamless transition from splash to webview.

## Quick reference: updating the app icon

Requires: `brew install resvg` (one-time setup).

```bash
# 1. Edit static/app-icon.svg with your new design
# 2. Generate all PNGs:
scripts/generate-icons.sh
# 3. Build + sync:
deno task build && npx cap sync
```

The script rasterizes the SVG at 1024x1024 with `resvg`, then uses `sips`
(macOS built-in) to resize to each target:

| Size      | Destination                                                        |
| --------- | ------------------------------------------------------------------ |
| 1024x1024 | `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`|
| 512x512   | `static/icon-512x512.png`                                          |
| 192x192   | `static/icon-192x192.png`                                          |
| 180x180   | `static/apple-touch-icon.png`                                      |
| 32x32     | `static/favicon-32x32.png`                                         |
| 48–192    | `android/app/src/main/res/mipmap-*/ic_launcher{,_round}.png`       |
| 108–432   | `android/app/src/main/res/mipmap-*/ic_launcher_foreground.png`     |
