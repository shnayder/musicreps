# Phase 2: Home Screen Progress Visibility — Implementation Plan

## Context

The home screen (Phase 1) has a tabbed interface: **Active** tab (starred
skills as `ActiveSkillCard`) and **All Skills** tab (track accordions with
`SkillCard`). Phase 1 also reorganized tracks ("Music theory", "Reading music",
"Guitar", "Ukulele") and made `MODE_BEFORE_AFTER` values functions for solfège.

Users can't tell which skills need attention without entering each mode. Phase 2
adds:

- A per-group **progress bar** on each skill card (colored segments)
- A **status label** ("Not started" / "Slow" / "Getting faster" / "Automatic")
- Eager computation of all mode metrics from localStorage on home screen mount

The spec lives at
`plans/product-specs/active/2026-03-13-home-screen-recommendations-spec.md`
(Phase 2 section).

---

## Step 1: Global status label update

**What:** Change `statusLabelFromLevel` from 4 labels to 3. The old labels
(Learning / Developing / Fluent / Automatic) become Slow / Getting faster /
Automatic. "Not started" (seen === 0) stays as-is.

**Files:**

| File | Change |
|------|--------|
| `src/mode-ui-state.ts:64-69` | Update thresholds: `< 0.2` → "Slow", `0.2–0.79` → "Getting faster", `≥ 0.8` → "Automatic" |
| `src/mode-ui-state_test.ts:131-150` | Update 4 test cases → 3 new labels + thresholds |
| `src/mode-ui-state_test.ts:340` | Update `'Learning'` assertion → `'Slow'` |
| `src/fixtures/recommendation-scenarios.ts:286-291` | Change `'Learning' \|\| 'Developing'` → `'Slow' \|\| 'Getting faster'` |
| `src/fixtures/recommendation-scenarios.ts:316-322` | Change `'Developing' \|\| 'Fluent' \|\| 'Automatic'` → `'Getting faster' \|\| 'Automatic'` |

**Verify:** `deno task test` — all label assertions pass. `PracticeCard` in
`src/ui/mode-screen.tsx` renders labels from `statusLabel` prop (just a
string — no change needed there).

**Note:** `src/ui/preview.tsx` uses custom mock labels ('Strong', 'Solid',
'Ready to start') — leave as-is (preview-only fixtures).

---

## Step 2: Create mode progress manifest

**What:** A lightweight registry mapping each mode ID to the metadata needed for
progress computation: namespace, group definitions, and item ID generation.
This avoids the home screen importing every mode definition directly.

**New file: `src/mode-progress-manifest.ts`**

```typescript
type ModeProgressEntry = {
  modeId: string;
  namespace: string;
  groups: Array<{ label: string; getItemIds: () => string[] }> | null;
  // null = no groups → single segment for entire allItems
  allItemIds: () => string[];
};
```

Build the manifest by importing from each mode's logic file:
- `key-signatures/logic.ts` → KEY_GROUPS, getItemIdsForGroup
- `scale-degrees/logic.ts` → DEGREE_GROUPS, getItemIdsForGroup
- `diatonic-chords/logic.ts` → DEGREE_GROUPS, getItemIdsForGroup
- `semitone-math/logic.ts` → DISTANCE_GROUPS, getItemIdsForGroup
- `interval-math/logic.ts` → DISTANCE_GROUPS, getItemIdsForGroup
- `chord-spelling/logic.ts` → SPELLING_GROUPS, getItemIdsForGroup
- `fretboard/logic.ts` → getGroups(GUITAR), getItemIdsForGroup, getAllItems
- `fretboard/logic.ts` → getGroups(UKULELE), getItemIdsForGroup, getAllItems
  (use GUITAR/UKULELE instrument objects from `music-data.ts`)
- `note-semitones/logic.ts` → ALL_ITEMS (no groups → null)
- `interval-semitones/logic.ts` → ALL_ITEMS (no groups → null)
- `speed-tap` → ALL_ITEMS from its logic (no groups → null)

Export: `MODE_PROGRESS_MANIFEST: ModeProgressEntry[]` and a lookup
`getModeProgress(modeId): ModeProgressEntry | undefined`.

**Verify:** Unit test in `src/mode-progress-manifest_test.ts` — correct number
of entries (11), each has valid namespace, group counts match expectations.

---

## Step 3: Create `useHomeProgress` hook

**What:** A Preact hook that computes progress data for all modes on mount and
on navigate-home. Returns a `Map<string, ModeProgress>`.

**New file: `src/hooks/use-home-progress.ts`**

```typescript
type ModeProgress = {
  statusLabel: string;          // "Not started" / "Slow" / "Getting faster" / "Automatic"
  groupColors: string[];        // one HSL string per group (or one for no-group modes)
};
```

**Logic:**
1. For each mode in the manifest:
   - Create `createLocalStorageAdapter(namespace)` from `adaptive.ts`
   - Create `createAdaptiveSelector(storage, scaledConfig)` — use
     `deriveScaledConfig` with motor baseline from
     `localStorage.getItem('motorBaseline_note-button')`
   - For each group: collect item IDs, call `getStatsCellColorMerged(selector,
     itemIds)` to get the segment color
   - Compute overall `computeLevelAutomaticity(allItemIds, getAutomaticity)` →
     feed into `statusLabelFromLevel` (or "Not started" if seen === 0)
2. Return `Map<modeId, ModeProgress>`

**Refresh on navigate-home:** The home screen `#home-screen` element gets
`hidden` class removed when navigating home. Use a `MutationObserver` on this
element's class attribute to detect visibility and trigger recomputation. This
keeps the hook self-contained without modifying `app.ts` or `navigation.ts`.

**Key reuse:**
- `createLocalStorageAdapter` / `createAdaptiveSelector` from `src/adaptive.ts`
- `deriveScaledConfig` from `src/adaptive.ts`
- `getStatsCellColorMerged` from `src/stats-display.ts`
- `computeLevelAutomaticity` from `src/mode-ui-state.ts`
- `statusLabelFromLevel` from `src/mode-ui-state.ts`

**Tricky part:** `getStatsCellColorMerged` requires a selector-like object with
`getSpeedScore`, `getFreshness`, `getAutomaticity`, `getStats`. The
`AdaptiveSelector` returned by `createAdaptiveSelector` already implements all
of these — no adapter needed.

---

## Step 4: Add progress bar + status label to skill cards

**Changes to `src/ui/home-screen.tsx`:**

Phase 1 established a tabbed layout: `ActiveSkillsList` (Active tab) renders
`ActiveSkillCard` components, and `AllSkillsList` (All Skills tab) renders
`SkillCard` components inside `TrackAccordion`s. Both card types need progress.

1. Import and call `useHomeProgress()` in `HomeScreen`
2. Thread `progressMap` down through `ActiveSkillsList` → `ActiveSkillCard`
   and `AllSkillsList` → `TrackAccordion` → `SkillCard`
3. Add a small `SkillProgressBar` component:

```tsx
function SkillProgressBar({ colors }: { colors: string[] }) {
  return (
    <div class="skill-progress-bar">
      {colors.map((color, i) => (
        <div class="skill-bar-segment" key={i} style={`background:${color}`} />
      ))}
    </div>
  );
}
```

4. Render `SkillProgressBar` and status label inside both `SkillCard` and
   `ActiveSkillCard`, between the header and the before/after text

**Note:** Both card types are `<div role='button'>` (not `<button>`) with
keyboard handlers — Phase 1 change. Adding children is straightforward.

---

## Step 5: CSS for progress bar and status label

**Changes to `src/styles.css`:**

Model on existing `.group-progress-bar` / `.group-bar-slice` (lines 853-886):

```css
.skill-progress-bar {
  display: flex;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  background: var(--color-surface);
}
.skill-bar-segment {
  flex: 1;
  min-width: 0;
}
.skill-status-label {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  margin-top: var(--space-1);
}
```

---

## Step 6: Performance test

**New file: `src/mode-progress-manifest_test.ts`** (or add to existing test)

1. Seed localStorage with realistic data for all modes (~1000 items total)
2. Measure time to run full progress computation
3. Assert completes within **50ms**
4. Log actual time for monitoring

**What it measures:** End-to-end from creating all storage adapters to having
all group colors and status labels computed. This validates the eager-compute
approach doesn't need pre-aggregation.

**Fallback if too slow:** Pre-aggregate per-group summaries when user finishes a
quiz session (write a summary record to localStorage alongside per-item data).

---

## Step 7: Verify end-to-end

- `deno task ok` passes
- Progress bars appear on both `ActiveSkillCard` (Active tab) and `SkillCard`
  (All Skills tab, inside track accordions)
- "Not started" shows all-grey segments
- Practicing a mode and returning to home shows updated colors
- Status labels match spec thresholds
- Visual style matches in-mode `.group-progress-bar`
- Both tabs render progress correctly when switching between them

---

## Risks

1. **Navigate-home refresh.** MutationObserver on `#home-screen` class changes
   is the recommended approach. If it proves fragile, fallback: add a
   `refreshKey` prop from `app.ts` that increments on navigateHome().

2. **Bundle size.** Importing all mode logic files into the manifest adds their
   constants to the bundle. These are already bundled (esbuild tree-shakes
   unused exports), so impact should be negligible. Verify with `deno task build`
   output size.

3. **Speed Tap edge case.** It stores per-note data (12 items) and is a motor
   calibration mode, not a learning progression. Include it in the manifest with
   `groups: null` — shows a single-segment bar. Fine for now.

4. **Function length.** `SkillCard` and `ActiveSkillCard` are ~50 lines each
   (after Phase 1 added keyboard handlers and star toggles). Adding progress bar
   rendering adds ~5-10 lines — should stay under 100 with `SkillProgressBar`
   extracted.

5. **Fretboard factory pattern.** Guitar and ukulele share logic via the
   instrument object. The manifest needs both GUITAR and UKULELE from
   `music-data.ts` — clean imports, no issue.

6. **Prop threading through tabs.** `progressMap` must pass through
   `HomeScreen` → `ActiveSkillsList` / `AllSkillsList` → cards. Three levels of
   prop passing is acceptable; no need for context.

---

## File Summary

| File | Action |
|------|--------|
| `src/mode-ui-state.ts` | Update `statusLabelFromLevel` labels |
| `src/mode-ui-state_test.ts` | Update label test assertions |
| `src/fixtures/recommendation-scenarios.ts` | Update scenario label checks |
| `src/mode-progress-manifest.ts` | **NEW** — mode metadata registry |
| `src/mode-progress-manifest_test.ts` | **NEW** — structure + perf tests |
| `src/hooks/use-home-progress.ts` | **NEW** — progress computation hook |
| `src/ui/home-screen.tsx` | Add progress bar to both card types (label deferred — cluttered cards) |
| `src/styles.css` | Reuse `.group-progress-bar` / `.group-bar-slice` for skill cards |
