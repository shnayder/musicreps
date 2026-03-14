# Phase 3: Cross-Skill Recommendations — Implementation Plan

## Architecture Overview

Phase 2 established `MODE_PROGRESS_MANIFEST` and `useHomeProgress` as the
pattern for reading learner data on the home screen. Phase 3 extends this by
running `computeRecommendations()` for each starred skill and classifying skills
into recommendation types (Review / Get faster / Learn next level / Automatic /
Not started).

### Data flow

```
MODE_PROGRESS_MANIFEST (per-mode: namespace, groups, getItemIds)
  + createLocalStorageAdapter(namespace) → StorageAdapter
  + createAdaptiveSelector(storage, cfg) → AdaptiveSelector
  + loadSkippedGroups(namespace) → skipped group indices
  → computeRecommendations(selector, activeIndices, getItemIds, config)
  → classifySkill(result) → { type, urgency, cueLabel }
  → rankAndCap(classifications) → top 3
```

## Prerequisite: Normalize no-group modes to one-group modes

### Problem

Three modes (`noteSemitones`, `intervalSemitones`, `speedTap`) have
`groups: null` in `MODE_PROGRESS_MANIFEST`. This forces every consumer to
branch on `groups !== null`, and `computeRecommendations()` can't run on them
at all — requiring a separate classification path.

### Solution

Treat every mode as having at least one group. A "no-group" mode is simply a
one-group mode where the single group contains all items. This eliminates all
`null` branching and lets `computeRecommendations()` handle every mode
uniformly.

### Changes

**`src/mode-progress-manifest.ts`:**
1. Change type: `groups: Array<{ label: string; getItemIds: () => string[] }>`
   (remove `| null`)
2. Replace the 3 `groups: null` entries with single-element arrays:
   ```
   groups: [{ label: 'All', getItemIds: () => NOTE_SEMI_ITEMS }]
   ```

**`src/hooks/use-home-progress.ts`:**
- Remove `groups !== null` checks (lines ~84, ~119)

**`src/hooks/use-home-progress_test.ts`:**
- Remove "non-group mode" special case (line ~120)
- Single-group modes naturally produce one color segment

**`src/mode-progress-manifest_test.ts`:**
- Remove `groups === null` / `groups !== null` assertions (lines ~41, ~78, ~81)
- All modes now have `groups.length >= 1`

**Not changed:**
- `ScopeDef` (`NoScopeDef` / `GroupScopeDef`) stays as-is — this controls
  whether the in-mode UI shows group toggles, which is a separate concern.
  A one-group mode still uses `NoScopeDef` (no toggles to show).
- `generic-mode.tsx` `groupScopeResult: ... | null` stays — it's about whether
  the mode UI has group scope controls, not about the data model.

**Follow-up (not this phase):** One-group modes could show a single-segment
progress bar on their practice tab, fixing the current gap where they show no
progress bar at all.

## Steps

### Step 0: Normalize no-group modes (prerequisite)

Apply the changes above. Run `deno task ok` to verify nothing breaks. This
unblocks all subsequent steps by removing `null` branching.

**Files:** `src/mode-progress-manifest.ts`, `src/hooks/use-home-progress.ts`,
`src/hooks/use-home-progress_test.ts`, `src/mode-progress-manifest_test.ts`

### Step 1: Create `computeSkillRecommendation()` pure function

New file `src/home-recommendations.ts`.

**Types:**

```
SkillRecommendationType = 'review' | 'get-faster' | 'learn-next' | 'not-started' | 'automatic'
SkillRecommendation = { modeId, type, urgency, cueLabel }
```

**Logic (uniform for all modes, since all now have groups):**

1. Build `activeIndices` = all group indices minus skipped
2. Run `computeRecommendations()` with the mode's selector
3. Classify from the result:
   - Has stale groups → "review", urgency = avg staleness
   - Has consolidation targets (working items) → "get-faster", urgency =
     working count
   - Expansion gate open, no consolidation work → "learn-next"
   - All automatic, nothing stale → "automatic"
   - No items seen → "not-started"

**Cue labels:**

| Type | Label |
|------|-------|
| review | "Review" |
| get-faster | "Get faster" |
| learn-next | "Learn next level" |
| not-started | — (or "Learn next level" if cold-start selected) |
| automatic | — |

**Tests** in `src/home-recommendations_test.ts`:
- Mode with stale groups → "review"
- Mode with consolidation targets, no stale → "get-faster"
- Mode with expansion ready → "learn-next"
- No items seen → "not-started"
- All automatic → "automatic"
- Single-group mode (e.g. noteSemitones) → correct classification via same path
- Skipped groups excluded from computation

### Step 2: Create `rankSkillRecommendations()` pure function

Same file `src/home-recommendations.ts`.

1. Filter out "automatic" and "not-started"
2. Sort by priority: review (0) > get-faster (1) > learn-next (2)
3. Within tier, sort by urgency descending
4. Cap at 3
5. Cold start: if no recommendations and all starred skills are "not-started",
   recommend first starred skill in definition order with "learn-next"

**Tests:**
- 5 skills: 2 review + 1 get-faster + 2 learn-next → top 3 = 2 reviews +
  1 get-faster
- All not-started → cold start picks first in definition order
- All automatic → empty list (triggers "all done" state)

### Step 3: Extend `useHomeProgress` hook

Modify `src/hooks/use-home-progress.ts`.

1. Accept `starred: Set<string>` parameter
2. For each starred mode, call `computeSkillRecommendation()` using the
   selector already created for progress bars
3. Call `rankSkillRecommendations()` to get top 3
4. Return `rankedRecommendations` alongside existing `progress`
5. Add `tab` or `refreshKey` dependency to recompute on tab switch

Progress is computed for ALL modes (for progress bars in accordion sections).
Recommendations only for starred modes.

### Step 4: Reorder Active Skills section

Modify `src/ui/home-screen.tsx`.

1. Thread `rankedRecommendations` to `ActiveSkillsList`
2. Partition starred skills: recommended (in rank order) first, then remaining
   (in definition order)
3. Pass recommendation type to `ActiveSkillCard` for cue label

### Step 5: Add cue label rendering + CSS

Modify `src/ui/home-screen.tsx` and `src/styles.css`.

1. Add `cueLabel?: string` and `cueType?: string` props to `ActiveSkillCard`
2. Render cue inline with track chip: "Reading music · Review"
3. CSS classes:
   - `.skill-cue-label` — base style
   - `.skill-cue-review` — amber/warm (matches stale item color)
   - `.skill-cue-get-faster` — recommendation color (matches in-mode display)
   - `.skill-cue-learn-next` — teal/cool

Prototype with `ui-iterate` session to tune appearance.

### Step 6: "All done" state

Modify `src/ui/home-screen.tsx`.

- When all starred skills are classified as "automatic" and recommendations
  list is empty, show a green-toned message above the skill list
- If all starred skills are "automatic", add a gentle suggestion to star new
  skills

### Step 7: User overrides — skipped levels

The storage mechanism already exists: `{namespace}_enabledGroups_skipped` in
localStorage, read by `loadSkippedGroups` in `use-home-progress.ts`. The
in-mode UI for skipping groups (via `GroupToggles` on the scope tab) already
works and persists.

**What's needed:**
- Verify `computeSkillRecommendation` excludes skipped groups from
  `activeIndices` (same pattern as `useGroupScope` lines 129-132)
- Add test: mode with skipped groups → recommendation ignores those groups

No new UI needed — users skip/unskip groups inside modes via existing scope
controls.

### Step 8: Unify classification constants

Extract hardcoded thresholds into named constants.

| Constant | Current location | Value |
|----------|-----------------|-------|
| Expansion threshold | `DEFAULT_CONFIG.expansionThreshold` + hardcoded `0.7` in `use-group-scope.ts:158` | 0.7 |
| Stale speed threshold | hardcoded in `detectStaleGroups` | 0.5 |
| Stale freshness threshold | hardcoded in `detectStaleGroups` | 0.5 |
| Automatic threshold | `DEFAULT_CONFIG.automaticityThreshold` | 0.8 |

**Changes:**
1. `use-group-scope.ts` — replace hardcoded `0.7` with
   `DEFAULT_CONFIG.expansionThreshold`
2. `recommendations.ts` — extract stale detection thresholds as named exports
3. `home-recommendations.ts` — import all thresholds from shared locations
4. Verify cue labels match between home screen and in-mode practice card text

## Risks and Tricky Parts

### 1. Stale detection scope

`computeRecommendations` runs `detectStaleGroups` only on **consolidation**
group indices (groups above median work), not all started groups. A group below
the consolidation cut could be stale but won't appear in `staleIndices`.

For home-screen "Review" classification, we need broader stale detection.
Options:
- (a) Call `detectStaleGroups` separately on ALL started groups in
  `home-recommendations.ts`
- (b) Add an `allStaleIndices` field to `RecommendationResult`

Recommend (a) — keeps `computeRecommendations` unchanged and makes the
home-screen logic explicit about its broader scope.

### 2. Performance

Running `computeRecommendations` for all 11 modes on every tab switch.
Phase 2 validated that creating 11 selectors + reading localStorage is fast.
`computeRecommendations` adds pure math on already-loaded data — should be
minimal overhead. Add to Phase 2's perf test to verify.

### 3. Cold start edge case

Multiple starred, all not-started. The "first in definition order" logic
requires traversing `TRACKS` to find ordering. `ActiveSkillsList` already does
this — reuse that ordering.

### 4. Single-group mode edge cases

After normalization, single-group modes (noteSemitones, intervalSemitones,
speedTap) will run through `computeRecommendations` with one group. Verify
that the algorithm behaves sensibly: no consolidation (only one group), no
expansion (no next group to unlock), classification falls to "get-faster" or
"automatic" based on that single group's state. Add specific test cases.

## Step Summary

| Step | What | Files | Tests |
|------|------|-------|-------|
| 0 | Normalize no-group → one-group | `mode-progress-manifest.ts`, `use-home-progress.ts`, tests | Update existing tests |
| 1 | `computeSkillRecommendation()` | `src/home-recommendations.ts` (new) | `src/home-recommendations_test.ts` (new) |
| 2 | `rankSkillRecommendations()` | `src/home-recommendations.ts` | `src/home-recommendations_test.ts` |
| 3 | Extend `useHomeProgress` hook | `src/hooks/use-home-progress.ts` | Update existing tests |
| 4 | Reorder Active Skills list | `src/ui/home-screen.tsx` | — |
| 5 | Cue label rendering + CSS | `src/ui/home-screen.tsx`, `src/styles.css` | `ui-iterate` |
| 6 | "All done" state | `src/ui/home-screen.tsx` | — |
| 7 | Skipped levels (verify existing) | Verify only | `src/home-recommendations_test.ts` |
| 8 | Unify constants | `src/recommendations.ts`, `src/hooks/use-group-scope.ts` | Update existing tests |
