# iOS App v0.1 — Product Spec

## Overview

Ship Music Reps to the iOS App Store as a free app using Capacitor (web app in
a native WebView shell). v0.1 is a derisking milestone: validate the full
submission pipeline with minimal scope, then iterate on monetization and polish.

**Approach**: Capacitor wraps the existing single-file HTML build (`docs/index.html`)
as on-device content. No network needed. All 11 quiz modes ship unlocked. No IAP.

**Why Capacitor**: The app is a self-contained vanilla JS app with zero runtime
dependencies. The build already produces a single HTML file with all CSS/JS inlined.
Capacitor adds a thin native shell around this — minimal code changes, no rewrite.
Alternatives (React Native, Flutter) would require rewriting the entire UI.

**Why free for v0.1**: Removes StoreKit/IAP complexity (the largest single scope
risk). Lets us validate App Store submission, review process, and on-device
behavior before adding payments.

## Milestones

### Phase 0: Prerequisites

Apple Developer account ($99/year), Xcode, CocoaPods. Hard blockers — do first.

- [ ] Enroll in Apple Developer Program (individual, instant–48hr approval)
   - decide individual vs org
- [x] Install Xcode 15+ (12 GB, install iOS Simulator runtime)
- [x] Install CocoaPods (`brew install cocoapods`)
- [ ] Choose bundle ID (see Open Questions)

### Phase 1: Capacitor Setup

Initialize project, establish build pipeline, verify app runs in Simulator.

- [x] Add Capacitor dependencies to `package.json`
- [x] Run `npx cap init` and `npx cap add ios` to generate Xcode project
- [x] Configure `capacitor.config.ts` (app name, bundle ID, `webDir: "docs"`)
- [x] Establish build pipeline: `npx tsx build.ts && npx cap copy ios`
- [~] Verify app runs in iOS Simulator — home screen, navigate to a mode,
  complete a quiz round (home screen verified; manual mode testing needed)
- [x] Set up `.gitignore` for `ios/App/Pods/` and `ios/App/App/public/`

### Phase 2: iOS Adaptation

Minimal changes for the app to behave well in a native shell.

- [x] Conditionally skip service worker registration when inside Capacitor
  (`window.Capacitor` detection — one-line change in `app.js`)
- [x] Add `viewport-fit=cover` to viewport meta tag (in `main.ts` and `build.ts`)
- [x] Add safe area inset padding in CSS (`env(safe-area-inset-*)` —
  backwards-compatible with web)
- [x] Disable rubber-band bounce scrolling (`overscroll-behavior: none`)
- [ ] Test all 11 modes on Simulator: layout, touch targets, quiz flow, feedback

**Not changing for v0.1**: localStorage stays as-is (works in WKWebView, eviction
is an edge case on modern iOS). Status bar uses default styling (dark text on light
bg matches our theme). No haptics, no custom splash screen.

### Phase 3: TestFlight

TestFlight only requires a signed build — no App Store assets needed. Get the
app on a real device as early as possible.

- [ ] Set up automatic code signing in Xcode (select team, auto-manage)
- [ ] Create app listing in App Store Connect (minimal info: name + bundle ID)
- [ ] Archive and upload build from Xcode
- [ ] Install via TestFlight on a real device
- [ ] Real-device testing checklist:
  - Safe areas render correctly
  - All modes load and function
  - localStorage persists across app restart
  - App survives background/foreground cycle
  - Touch targets comfortable on real hardware

### Phase 4: App Store Assets

Can be done in parallel with Phase 3 testing, or after. Only needed for
Phase 5 submission.

- [ ] Create 1024x1024 app icon (scale/refine existing `apple-touch-icon.png`)
- [ ] Take screenshots on iPhone 6.7" Simulator (3–5: home screen, active quiz,
  feedback, stats/heatmap)
- [ ] Write App Store description, subtitle, keywords
- [ ] Create privacy policy page (hosted on GitHub Pages — "collects no data")
- [ ] Set App Privacy to "Data Not Collected"

### Phase 5: Submit

- [ ] Complete App Store Connect listing (screenshots, description, privacy)
- [ ] Submit for review with reviewer notes explaining the app
- [ ] Handle any review feedback

## Open Questions

### Must resolve before submission

**App name and bundle ID**: Bundle ID is permanent. Options:
- `com.musicreps.app` — simple, works if "Music Reps" stays the brand
- `com.{brand}.musicreps` — if a parent brand emerges for the multi-app family
- Need to decide display name too: "Music Reps" vs "Music Reps: Theory Drills"
  (subtitle field provides additional discoverability either way)

### Can resolve during implementation

**Target iOS version**: Capacitor supports iOS 15+ (~98% of active devices).
Recommend iOS 15 unless there's a reason to go higher.

**Launch screen**: Default Xcode storyboard (white screen with app name) is fine
for v0.1. Custom splash screen can come later.

**App icon**: Existing apple-touch-icon works conceptually but needs 1024px
production. Design effort TBD.

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| App Review rejection (4.2 minimum functionality) | Low | On-device content, 11 modes, adaptive difficulty — substantial app. Include reviewer notes. |
| localStorage eviction on iOS | Low | Accept for v0.1. Modern iOS evicts less aggressively. Migrate to `@capacitor/preferences` in v0.2 if needed. |
| Safe area layout issues on specific devices | Medium | Test multiple Simulator sizes. CSS `env()` handles most cases. |
| First-time Xcode/signing confusion | Medium | Budget extra time. Xcode auto-signing handles most complexity. |
| Apple Developer enrollment delay | Low | Enroll first, before any other work. |

## Scope: What's Deferred to Post-v0.1

- **In-App Purchases** — largest scope item, requires StoreKit 2, receipt
  validation, content gating, pricing decisions
- **localStorage → Preferences migration** — only if data loss surfaces in practice
- **iPad layout** — shipping iPhone-only for v0.1
- **Cloud sync** — explicitly out of scope
- **Push notifications** — no use case yet
- **Custom splash screen / status bar styling** — cosmetic polish
- **CI/CD for iOS builds** — manual Xcode archive is fine for v0.1
- **Multi-app splitting** — ship everything in one app, evaluate splitting later
- **Dark mode** — not required for App Store
- **Haptic feedback** — nice-to-have polish
- **Analytics** — zero data collection keeps privacy story clean

## Resolved Decisions

- **Wrapper technology**: Capacitor — minimal changes to existing codebase,
  on-device HTML, active ecosystem with iOS plugins for future needs (IAP, etc.)
- **v0.1 pricing**: Free, all content unlocked — derisks the submission pipeline
- **Device target**: iPhone only — avoids iPad screenshots and layout work
- **Naming**: Open question, to be resolved before submission
- **Storage**: Keep localStorage for v0.1, migrate later if needed
