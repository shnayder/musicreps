# Capacitor Preferences Storage Abstraction

Design doc for replacing direct `localStorage` usage with a cross-platform
storage abstraction that uses `localStorage` on web and the Capacitor
Preferences API on native (iOS).

## Problem

`localStorage` works in Capacitor's WKWebView but is subject to iOS eviction
(OS may clear WebView storage under memory pressure, especially if the app is
backgrounded). The Capacitor Preferences plugin uses native `UserDefaults`
(iOS), which is not subject to this eviction. All learner data — item stats,
deadlines, motor baselines, scope config — must survive across sessions.

## Goals

1. **Zero behavior change on web.** Reads and writes remain synchronous. No new
   async APIs in UI code.
2. **Eviction-resistant persistence on native.** Use Capacitor Preferences
   (backed by `UserDefaults`) for all persisted data.
3. **Transparent migration.** Existing native users who had data in
   `localStorage` get it copied to Preferences on first launch.
4. **Testability.** Unit tests run in Deno without a browser. The storage module
   must not crash when `localStorage` is unavailable.
5. **No module-eval side effects.** No storage reads at ES module evaluation
   time, so initialization order doesn't matter.

## Design

### Architecture: synchronous facade over async backend

```
┌─────────────────────────────────┐
│  storage.getItem / setItem      │  ← synchronous, used everywhere
│  (src/storage.ts)               │
├─────────────────────────────────┤
│  _storage (swappable backend)   │
├──────────┬──────────────────────┤
│  Web:    │  Native:             │
│  lazy    │  in-memory cache     │
│  local-  │  + fire-and-forget   │
│  Storage │  Preferences writes  │
└──────────┴──────────────────────┘
```

- **`storage`** is the public singleton. Its methods delegate to `_storage`,
  which starts as the web backend and is replaced by the native backend after
  `initStorage()`.
- **Web backend**: lazily resolves `localStorage` on each call (safe in
  non-browser contexts — returns `null`/no-ops when unavailable).
- **Native backend**: reads from an in-memory `Map` (populated at init); writes
  update the map and fire-and-forget the async `Preferences.set()`.

### Initialization sequence

```
app.ts boot():
  1. await initStorage()              — on native: bulk-load all Preferences keys
  2. await migrateFromLocalStorage()  — one-time, native only (before any reads)
  3. loadNotationPreference()         — deferred read (was at module eval)
  4. cleanupLegacyKeys()              — removes from both storage + localStorage
  5. createNavigation(), registerModes(), render()
```

**Critical constraint:** Migration must complete before any deferred reads, so
migrated values are visible. No storage reads may happen at ES module evaluation
time. The `music-data.ts` notation preference read and the `home-screen.tsx`
legacy key cleanup must be deferred to explicit init functions called after
`initStorage()` and migration.

### Module-eval timing issue (PR feedback)

**Problem:** `music-data.ts` currently reads `storage.getItem('fretboard_notation')`
at module evaluation time. ES module imports are evaluated before `boot()` runs.
On native, `initStorage()` hasn't run yet, so the Preferences cache is empty,
and the read falls through to the web backend (localStorage), which may be empty
or stale.

**Fix:** Export a `loadNotationPreference()` function from `music-data.ts`.
Remove the module-level read. Call `loadNotationPreference()` from `boot()` after
`initStorage()`. Same fix for the legacy key cleanup in `home-screen.tsx`.

### Web backend: safe in non-browser contexts

**Problem:** The current `webStorage` eagerly references `localStorage` at
module evaluation, which would throw in environments where `localStorage` is
undefined (e.g., Node scripts that transitively import foundation modules).

**Fix:** Resolve `localStorage` lazily inside each method via
`globalThis.localStorage` with a try/catch. When unavailable, fall back to an
in-memory `Map`. This makes the module safe to import in any JS context.

### Migration: `migrateFromLocalStorage()`

Called once on native after `initStorage()`. Copies all `localStorage` keys to
Preferences (skipping keys that already exist in Preferences). Updates the
in-memory cache directly (not via `_storage.setItem`, which would cause a
redundant Preferences write).

Wrapped in try/catch so a failure doesn't prevent the app from rendering.

### Error handling

- `initStorage()` catches all errors and falls back to the web backend.
- `migrateFromLocalStorage()` catches all errors — partial migration is
  acceptable (will retry remaining keys on next launch).
- `boot()` catches unhandled rejections so they are logged and don't crash
  the bootstrap sequence.
- Individual `storage.setItem()` calls on the native backend already catch
  Preferences errors (fire-and-forget).

### Testing

**Unit tests (`storage_test.ts`):**
- Run in Deno, which provides `localStorage` via `deno.window`.
- Test the public API (getItem/setItem/removeItem round-trip, initStorage
  no-op on web).
- If `localStorage` is unavailable, the in-memory fallback activates
  transparently — tests still pass.

**Existing tests:**
- Pure-logic tests (adaptive, recommendations, etc.) use `createMemoryStorage()`
  — unaffected.
- Hook/component tests that reference `storage` work because Deno provides
  `localStorage`.
- E2E tests run in a real browser — unaffected.

**Not tested here:** The native Capacitor Preferences path. This requires an
actual iOS build with the Preferences plugin installed. Verified manually during
iOS development.

### Dynamic import strategy

The `@capacitor/preferences` import must not be statically analyzed by Deno
(causes TLS errors in the web sandbox). Use a string concatenation trick:

```ts
const mod = '@capac' + 'itor/preferences';
const { Preferences } = await import(mod);
```

This is only reached on native (guarded by `isNative()` check). The type is
described by a local `PreferencesPlugin` interface, not imported from the
package.

## Files changed

| File | Change |
|------|--------|
| `src/storage.ts` | New: storage abstraction, init, migration |
| `src/app.ts` | Call `initStorage()`, `migrateFromLocalStorage()`, `loadNotationPreference()` in `boot()` |
| `src/music-data.ts` | Defer notation read to `loadNotationPreference()` |
| `src/ui/home-screen.tsx` | Defer legacy cleanup to `cleanupLegacyKeys()` |
| `src/adaptive.ts` | Use `storage` instead of `localStorage` |
| `src/effort.ts` | Use `storage` instead of `localStorage` |
| `src/navigation.ts` | Use `storage` instead of `localStorage` |
| `src/hooks/use-learner-model.ts` | Use `storage` instead of `localStorage` |
| `src/hooks/use-scope-state.ts` | Use `storage` instead of `localStorage` |
| `src/hooks/use-group-scope.ts` | Use `storage` instead of `localStorage` |
| `src/hooks/use-home-progress.ts` | Use `storage` instead of `localStorage` |
| `src/ui/preview.tsx` | Use `storage` instead of `localStorage` |
| `src/ui/preview-comments.tsx` | Use `storage` instead of `localStorage` |
| `src/storage_test.ts` | New: unit tests |
| `src/architecture_test.ts` | Add `storage.ts` to FOUNDATION layer |
| `package.json` | Add `@capacitor/preferences` |

## Risks

1. **Module-eval ordering** — The biggest risk. Any storage read at module
   evaluation time will see stale data on native. Mitigated by auditing all
   `storage.getItem` calls and ensuring none happen at module scope.
2. **Async write failures** — Fire-and-forget Preferences writes could silently
   fail. Acceptable: the in-memory cache stays correct for the current session,
   and the data will be re-written on the next interaction.
3. **Migration incompleteness** — If migration is interrupted, some keys may not
   be copied. Acceptable: migration retries on each launch (skips already-copied
   keys).

## Alternatives considered

1. **Keep localStorage only** — Simplest, but risks data loss on iOS.
2. **Async storage API throughout** — Would require rewriting all hooks to be
   async. Massive change for marginal benefit (the cache makes reads synchronous
   anyway).
3. **Lazy per-key caching** — Load Preferences values on first access rather
   than bulk-loading. Rejected: would make first-access async or require
   blocking the UI, and complicates the API.
