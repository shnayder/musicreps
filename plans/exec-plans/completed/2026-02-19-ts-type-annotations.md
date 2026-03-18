# TypeScript Type Annotations

**Branch:** `claude/ts-type-annotations` **Depends on:** Phase 3 (consolidate
build on Deno) — PR #86

## Problem / Context

All 21 source files are `.ts` but have zero type annotations. `deno check`
reports 924 errors (516 implicit-any params, 146 implicit-any variables, 68
missing DOM lib, the rest argument mismatches and null checks). The goal is
strict type checking in CI — `deno check` clean, no `any` except at genuine
boundaries.

TypeScript conventions are added to `guides/coding-style.md` as the canonical
reference. This plan covers the phased implementation order.

## Phasing

The dependency graph dictates order: annotate leaves first so imports type-check
immediately.

### Phase 0: Infrastructure (~70 errors eliminated)

One config change:

- Add `compilerOptions: { "lib": ["deno.window"] }` to `deno.json`
- Eliminates all 68 TS2584 + 2 TS2304 errors (DOM globals not found)

### Phase 1: Shared types (1 new file: `src/types.ts`)

All shared interfaces in one types-only file — zero runtime code, erased by
esbuild:

- `EngineState` — quiz engine state shape
- `QuizMode` — mode plugin interface (`getEnabledItems`, `presentQuestion`,
  `checkAnswer`, `handleKey`, `onStart`/`onStop`, lifecycle hooks)
- `AdaptiveConfig` — adaptive selector configuration
- `ItemStats` — per-item statistics (EWMA, timestamps, counts)
- `StorageAdapter` — storage interface for adaptive selector
- `AdaptiveSelector` — adaptive question selector interface
- `RecommendationResult` — output of `computeRecommendations()`
- `EngineEls` — DOM element cache for quiz engine
- Any other shapes referenced by 2+ files

### Phase 2: Pure foundation (6 files, ~200 errors)

- `music-data.ts` — type arrays (`NOTES`, `INTERVALS`, etc.), helper functions,
  `Record<string, number>` for lookup objects
- `adaptive.ts` — type pure functions, factory, storage adapter
- `quiz-engine-state.ts` — type state transitions
- `recommendations.ts` — type algorithm
- `deadline.ts` — type staircase
- `quiz-fretboard-state.ts` — type factory

### Phase 3: Engine + stats (2 files, ~150 errors)

- `stats-display.ts` — type color functions, stats rendering
- `quiz-engine.ts` — largest file (~1460 lines), type key handlers, calibration,
  engine factory. Uses `EngineEls` interface for DOM cache.

### Phase 4: Quiz modes (10 files, ~350 errors)

Start with `quiz-note-semitones.ts` as template (simplest), then apply the same
pattern to remaining 9 modes.

Order: note-semitones, interval-semitones, key-signatures, scale-degrees,
diatonic-chords, semitone-math, interval-math, chord-spelling, speed-tap,
fretboard.

### Phase 5: Navigation + app (3 files, ~50 errors)

- `navigation.ts`, `settings.ts`, `app.ts`
- Declare `Window.Capacitor` for iOS detection

### Phase 6: Tests (8 files, ~80 errors)

- Type mock objects to satisfy interfaces
- `as any` acceptable for partial keyboard event mocks

### Phase 7: CI gate

- Add `deno check src/**/*.ts` to both CI workflows
- Becomes a blocking check on every PR

## Key Patterns

**DOM element cache** (in quiz-engine.ts):

```typescript
interface EngineEls {
  feedback: HTMLElement;
  timeDisplay: HTMLElement;
  // ...
}
```

**Storage adapter** (shared interface):

```typescript
interface StorageAdapter {
  getStats(itemId: string): ItemStats | null;
  saveStats(itemId: string, stats: ItemStats): void;
  // ...
}
```

**Timer IDs:** `let timer: number | null = null` (browser `setInterval` returns
`number`).

**Record types for lookup objects:** `Record<string, number>` for
`NATURAL_SEMITONES`, `SOLFEGE_MAP`, etc.

## PR Strategy

Can be split into multiple PRs for reviewability:

- **PR 1:** Phase 0 + 1 + 2 (infrastructure + types + foundation)
- **PR 2:** Phase 3 (engine + stats)
- **PR 3:** Phase 4 (all 10 modes)
- **PR 4:** Phase 5 + 6 + 7 (nav/app + tests + CI gate)

Or consolidated into fewer PRs if momentum is good. Each PR gets one version
bump.
