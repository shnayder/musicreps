# Android Play Store — Execution Plan

## Overview

Ship Music Reps to Google Play as a free app. Mirrors the iOS v0.1 strategy:
Capacitor wraps the existing single-file HTML build. All modes unlocked, no IAP.

**Current state**: Capacitor Android scaffolded, debug APK builds and runs on
emulator and sideloaded devices. App icons generated from `app-icon.svg`. Web
assets synced. What remains is Play Store logistics.

## Completed

- [x] Install `@capacitor/android` and scaffold `android/` project
- [x] Generate adaptive icons at all densities from `app-icon.svg`
- [x] Configure background color (#FAFAFA) and foreground SVG for adaptive icon
- [x] Update `.gitignore`, `deno.json` (exclude android/ from lint/fmt)
- [x] Update `scripts/generate-icons.sh` to include Android targets
- [x] Update `guides/static-assets.md` and `guides/development.md`
- [x] Build debug APK, run in emulator, sideload to a tester

## Phase 1: Google Play Developer Account

Hard blocker — do first.

- [ ] Register for Google Play Developer account ($25 one-time fee)
  - Requires Google account, ID verification (can take 1-2 days)
- [ ] Complete account identity verification

## Phase 2: Signing & Release Build

Debug builds use a throwaway debug keystore. Play Store requires a proper
release signing key.

- [ ] Generate release keystore (or use Play App Signing — recommended)
  ```bash
  keytool -genkey -v -keystore musicreps-release.keystore \
    -alias musicreps -keyalg RSA -keysize 2048 -validity 10000
  ```
- [ ] Configure signing in `android/app/build.gradle` (release buildType)
- [ ] Build signed release APK or AAB (Play Store prefers AAB):
  ```bash
  cd android && ./gradlew bundleRelease && cd ..
  # Output: android/app/build/outputs/bundle/release/app-release.aab
  ```
- [ ] Enable Play App Signing in Play Console (recommended — Google manages the
  signing key, you upload with an upload key)
- [ ] Test release build on emulator/device before uploading

## Phase 3: Play Store Listing Assets

Can be done in parallel with Phase 2.

- [ ] App title: "Music Reps" (30 char limit)
- [ ] Short description (80 chars): e.g., "Automate music theory skills with
  smart, adaptive drills"
- [ ] Full description (4000 chars): explain modes, adaptive learning, offline
- [ ] Feature graphic (1024x500 PNG) — required for Play Store
- [ ] Screenshots: phone (min 2, recommended 4-8)
  - Home screen, active quiz, feedback, stats/heatmap
  - 16:9 or 9:16, min 320px, max 3840px per side
  - Use emulator screenshots or Playwright
- [ ] App icon: 512x512 PNG (already have `static/icon-512x512.png`)
- [ ] App category: Education
- [ ] Content rating questionnaire (IARC) — fill out in Play Console
- [ ] Privacy policy URL (same as iOS — hosted on GitHub Pages, "collects no
  data")
- [ ] Set data safety section to "No data collected"

## Phase 4: Internal Testing Track

Play Console has testing tracks (internal → closed → open → production). Start
with internal testing to validate the full pipeline.

- [ ] Create app in Play Console with bundle ID `com.musicreps.app`
- [ ] Upload AAB to internal testing track
- [ ] Add testers by email (up to 100 for internal)
- [ ] Testers install via Play Store link (no sideloading needed)
- [ ] Verify: app installs, all modes work, data persists, no crashes

## Phase 5: Production Release

- [ ] Complete store listing (all assets from Phase 3)
- [ ] Complete content rating questionnaire
- [ ] Complete data safety form
- [ ] Promote build from internal testing to production
- [ ] Submit for review (typically 1-3 days, can be longer for new accounts)
- [ ] Handle any review feedback

## Open Questions

**Target API level**: Currently `targetSdkVersion 36`. Play Store requires
targeting a recent API level (within 1 year of latest). API 36 is fine for now;
may need to bump to 37 when it becomes required.

**App Bundle vs APK**: Play Store strongly prefers AAB (Android App Bundle) over
APK. AAB lets Google optimize delivery per device. Use `bundleRelease` instead
of `assembleRelease`.

**Versioning**: `versionCode` in `build.gradle` must increment with each
upload. Currently hardcoded to `1`. Options:
- Manual bump before each upload
- Derive from git (like the web version) — e.g., commit count
- CI-provided `BUILD_NUMBER`

**OTA updates**: The iOS app has an OTA update plugin. For Android, the same
approach could work, but Play Store updates are faster and more reliable than
iOS App Store updates. Consider whether OTA is worth the effort on Android or
if Play Store updates are sufficient for now.

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Developer account verification delay | Medium | Register early, before other work |
| Policy rejection (minimum functionality) | Low | 11 modes, adaptive difficulty — substantial app |
| Content rating issues | Low | No user-generated content, no violence, no ads |
| Signing key loss | Medium | Use Play App Signing (Google holds the key) |
| WebView compatibility on old Android | Low | minSdk 24 (Android 7.0) — modern WebView on all supported devices |

## Deferred to Post-v0.1

- In-App Purchases (Play Billing Library)
- Tablet layout optimization
- Dark mode
- CI/CD for Android builds (GitHub Actions)
- Play Store A/B listing experiments
- Android-specific features (widgets, etc.)
