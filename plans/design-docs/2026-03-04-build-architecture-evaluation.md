# Build Architecture Evaluation

**Date:** 2026-03-04 **Status:** Discussion

## Context

The app currently builds into a single self-contained HTML file (~425 KB) with
CSS, JS, and fonts all inlined. Build-time HTML provides a static shell that
Preact replaces at runtime. Capacitor is scaffolded for iOS. A service worker
exists but there's no PWA manifest. This doc evaluates the tradeoffs of the
current approach and alternatives.

---

## 1. Dual Rendering Paths

### What exists today

Build-time HTML (`html-helpers.ts`, `build-template.ts`) generates a complete
page structure — mode screens, button grids, fretboard SVGs, tab containers —
with the same CSS class names that Preact components emit. On load:

1. Browser renders static HTML (layout visible immediately, CSS applies)
2. JS bundle executes
3. `registerPreactMode()` clears each mode container (`container.textContent = ''`)
4. Preact renders its component tree into the now-empty container

This is **sequential replacement**, not hydration. Preact doesn't reuse the
static DOM — it throws it away and rebuilds.

### What the static HTML buys

- **No flash of empty content** — layout, background colors, and structural
  elements are visible while JS loads (~425 KB parses fast, but still)
- **CSS development reference** — the static output shows intended structure
  without needing JS to run
- **Design artifact generation** — `docs/design/components-preview.html` reuses
  the same template functions

### What it costs

- **Class-name contract** — every CSS class in a Preact component must match
  what `html-helpers.ts` would generate. Drift = visual bugs. This is the main
  tax and the reason the Tailwind evaluation flagged it as the top risk.
- **Duplicated structure** — button layouts, tab structures, and mode scaffolds
  are defined twice (once in template functions, once in `.tsx` components)
- **Maintenance friction** — adding a new UI element means updating both paths

### What removal would look like

Drop `html-helpers.ts` content generation. Keep only a minimal shell:

```html
<div id="app">
  <div id="mode-fretboard" class="mode-screen"></div>
  <div id="mode-semitoneMath" class="mode-screen"></div>
  <!-- ... one empty div per mode ... -->
</div>
```

Preact already renders everything from scratch. The empty-div approach would:
- Eliminate the class-name contract (only Preact defines structure)
- Remove ~400 lines from `html-helpers.ts` and `build-template.ts`
- Introduce a brief blank-content period on first load (mitigated by the fact
  that JS is inlined and executes immediately — no network round-trip)
- Lose the design preview pages (could regenerate via `preact-render-to-string`,
  which is already a devDependency)

**Verdict:** removing build-time HTML is viable and would simplify the codebase.
The flash-of-empty-content risk is low because JS is inlined (no separate fetch).
Worth doing if we touch this area for other reasons. Not urgent on its own.

---

## 2. Single-File vs Multi-File Serving

### Current approach

Everything inlined into one `index.html`:
- Base64-encoded DM Serif Display font (~32 KB encoded)
- All CSS (~30 KB)
- All JS (~140 KB bundled)
- All build-time HTML (~220 KB)
- Total: ~425 KB

Plus `sw.js` (~438 bytes) and two icon PNGs served separately.

### Pros of single-file

- **Trivially deployable** — copy one file anywhere. GitHub Pages, S3, local
  file system, email it to someone.
- **Atomic updates** — no cache coherence issues. The HTML, CSS, and JS are
  always from the same build. No stale-CSS-with-new-JS bugs.
- **Offline by default** — once cached by the service worker, the entire app is
  one cache entry.
- **Capacitor-friendly** — Capacitor loads `docs/index.html` locally. One file =
  simple.

### Cons of single-file

- **No differential caching** — changing one line of CSS invalidates the entire
  425 KB file. A conventional app would let browsers cache `app.js` and
  `styles.css` separately with content hashes.
- **Bundle size opacity** — harder to see "CSS is 30 KB, JS is 140 KB, HTML is
  220 KB" at a glance. Everything is one blob.
- **Dev reload cost** — every refresh re-reads and re-assembles the full file
  (though at current size this is imperceptible).
- **No code splitting** — all 10 modes load upfront. A multi-file app could
  lazy-load mode bundles. (At 140 KB total JS this doesn't matter yet.)

### Would multi-file make anything harder?

Not really. The service worker already handles multiple URLs (network-first with
cache fallback). GitHub Pages serves static files. Capacitor can load a
`webDir` with multiple files.

The main thing lost is the "copy one file" simplicity. For this app's scale
(~425 KB total, 10 modes, single developer), the single-file approach is a
genuine advantage — cache invalidation is a non-problem when the whole payload
is smaller than a typical hero image.

**Verdict:** single-file is a good fit at current scale. Revisit if the app
grows past ~1 MB or if code-splitting becomes desirable (unlikely near-term).

---

## 3. iOS Offline Bookmark (PWA)

### Current state

- Service worker exists (`sw.js`) — network-first with offline fallback
- `apple-touch-icon.png` exists (180×180) — iOS uses this for home screen icon
- **No `manifest.json`** — iOS won't treat this as a proper web app
- No `<meta name="apple-mobile-web-app-capable">` tag

### What "Add to Home Screen" gets you today

Without a manifest, Safari's "Add to Home Screen" creates a bookmark that opens
in Safari. The service worker provides offline access as long as the cache hasn't
been evicted.

### What a proper PWA manifest would add

```json
{
  "name": "Music Reps",
  "short_name": "Music Reps",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1a1a2e",
  "theme_color": "#2e7d32",
  "icons": [{ "src": "apple-touch-icon.png", "sizes": "180x180" }]
}
```

Plus `<meta name="apple-mobile-web-app-capable" content="yes">` in the HTML.

This would give:
- **Standalone mode** — no Safari chrome (address bar, tabs). Feels like an app.
- **Splash screen** — background color + icon while loading
- **Task switcher identity** — appears as its own app, not a Safari tab

### iOS PWA limitations (as of iOS 18)

- **Storage eviction** — iOS can purge service worker caches after ~7 days of
  non-use. User loses offline access until they revisit online. This is the big
  one.
- **No push notifications** — added in iOS 16.4+ for PWAs, but requires user
  opt-in and the Notification API. Not relevant for this app currently.
- **50 MB storage cap** — per-origin limit for service worker caches. At 425 KB
  this is not a concern.
- **No background sync** — can't sync learner data while app is closed.
- **Cross-origin restrictions** — can't open links in-app (not relevant here).
- **State loss on reboot** — iOS sometimes kills PWA processes; the app
  re-launches from scratch. Since all state is in `localStorage`, this is fine.

### Recommendation

Adding a manifest is ~10 minutes of work and meaningfully improves the iOS
experience (standalone mode, no Safari chrome). The storage eviction issue is
real but tolerable — the single-file approach means re-caching is fast, and
`localStorage` (learner data) is not evicted with service worker caches.

---

## 4. Capacitor iOS App

### Current state

Fully scaffolded and ready to build:
- `capacitor.config.ts` — points at `docs/` as `webDir`
- `ios/` directory — complete Xcode project with `AppDelegate.swift`,
  storyboards, app icons, splash images
- `@capacitor/ios` v8.1.0 in `package.json`
- Service worker registration skipped when `window.Capacitor` is detected

### What Capacitor gives you over PWA

| Aspect | PWA | Capacitor |
|--------|-----|-----------|
| **Distribution** | URL / home screen bookmark | App Store |
| **Offline reliability** | Cache can be evicted after ~7 days | Always local, never evicted |
| **Storage** | 50 MB SW cache, ~5 MB localStorage | Full device storage |
| **Native APIs** | Limited (no haptics, no audio session) | Full via plugins |
| **Updates** | Instant (service worker) | App Store review (~24-48h) |
| **Discoverability** | Share a URL | App Store search |
| **User trust** | Varies | App Store listing feels "real" |

### What's needed to ship

1. **Build:** `deno task build` → `npx cap sync` → open Xcode → archive
2. **App Store assets:** screenshots, description, privacy policy
3. **Apple Developer account** ($99/year)
4. **Update workflow:** build → `cap sync` → submit to App Store. Or use
   Capacitor Live Update to push web changes without App Store review.
5. **Testing:** currently no automated iOS testing. Manual verification on device.

### Single-file vs multi-file: irrelevant for Capacitor

Capacitor loads files from the local filesystem. Whether it's one file or twenty,
there's no network involved. The single-file approach is fine.

### Recommendation

Capacitor is the right path for a "real" iOS app. The scaffolding is done. The
remaining work is App Store logistics, not engineering. Worth pursuing when the
app is stable enough to warrant a store listing.

---

## 5. Other Distribution Considerations

### Android

Capacitor supports Android out of the box. Run `npx cap add android` to scaffold
the project. Same build flow as iOS. Google Play review is faster (~hours vs
days).

### Desktop

Not a strong use case. The app works fine in a browser tab. Electron/Tauri would
add complexity for minimal benefit. If someone wants it "installed," a PWA
bookmark on desktop already works well (Chrome's "Install" prompt).

### Alternative hosting

GitHub Pages works well for this. Alternatives if needed:
- **Netlify/Vercel** — adds CDN edge caching, custom domains, deploy previews
  (already have deploy previews via GitHub Actions)
- **Self-hosted** — just serve static files. Nginx, Caddy, anything.

The single-file approach makes hosting trivially portable.

---

## Summary

| Question | Answer |
|----------|--------|
| **Drop build-time HTML?** | Yes, viable. Low risk since JS is inlined. Simplifies codebase. Not urgent. |
| **Switch to multi-file?** | No strong reason at current scale (~425 KB). Revisit past ~1 MB. |
| **iOS offline bookmark?** | Add `manifest.json` + meta tag. ~10 min. Meaningful UX improvement. |
| **Capacitor iOS app?** | Scaffolding done. Remaining work is App Store logistics. Best path for reliable offline + native feel. |
| **Blocking issues?** | None. Current architecture supports all distribution paths. |

### Recommended next steps (in priority order)

1. **Add PWA manifest** — quick win for iOS home screen experience
2. **Remove build-time HTML** — when touching `html-helpers.ts` for other
   reasons, simplify to empty container divs
3. **Ship Capacitor app** — when app is stable enough for a store listing
