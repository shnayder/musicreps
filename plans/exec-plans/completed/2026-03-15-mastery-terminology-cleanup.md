# Mastery Terminology Cleanup

**Branch:** `claude/mastery-terminology`
**Design doc:** `plans/design-docs/mastery-terminology-cleanup.md` + visual
reference `mastery-terminology-visual.html` (v4)

## Goal

Replace the inconsistent mastery terminology (fluent/automatic/working, mixed
thresholds, mismatched color systems) with the v4 two-step model:

1. Per-level stats → level status (speed axis × freshness axis)
2. Cross-level recommendations → skill cue labels

Remove "automaticity" (speed × freshness) as a concept. Speed and freshness
are independent axes — combining them into one number was the root cause of the
heatmap-vs-label mismatch. Everything that used the combined metric gets
rewritten to use speed and freshness separately.

The "all done" screenshot bug (yellow-green bars with "automatic" label) is
resolved as a side effect: "Automatic" now requires P10(speed) ≥ 0.9, matching
heatmap-5 green.

## Terminology mapping

| Old | New | Where |
|-----|-----|-------|
| Fluent (F) | Automatic | item/level classification |
| Working (W) | (drop — just "seen, not fast") | recommendations |
| `fluentCount` | `automaticCount` | `StringRecommendation`, fixtures, tests |
| `countFluent()` | `countAutomatic()` | `mode-ui-state.ts` |
| `automaticity` (speed × fresh) | **remove concept** | everywhere |
| `automaticityThreshold` (0.8) | **remove** — replaced by speed thresholds | `AdaptiveConfig` |
| `automaticityTarget` (3000ms) | `speedTarget` | `AdaptiveConfig` — the ewma at which speed ≈ 0.5 |
| `getAutomaticity()` | **remove** from selector API | `AdaptiveSelector` |
| `getLevelAutomaticity()` | `getLevelSpeed()` + `getLevelFreshness()` | `AdaptiveSelector` |
| `computeLevelAutomaticity()` | generalize to `computeLevelPercentile()` | `mode-ui-state.ts` |
| `getAutomaticityColor()` | **remove** (legacy, unused after cleanup) | `stats-display.ts` |
| `checkAllAutomatic()` | rewrite: all items speed ≥ 0.9 | `AdaptiveSelector` |
| `checkNeedsReview()` | rewrite: speed ≥ 0.5 AND freshness < 0.5 | `AdaptiveSelector` |
| `recallThreshold` (0.5) | `freshnessThreshold` | `AdaptiveConfig` |
| Slow (status label) | Hesitant | `statusLabelFromLevel()` |
| Getting faster (label) | Learning | `statusLabelFromLevel()` |
| (new) | Solid | P10 speed ≥ 0.7 |
| `slow-fresh` (fixture) | `working` | `heatmap-scenarios.ts` |
| `fast-fresh` (fixture) | `automatic` | `heatmap-scenarios.ts` |
| `fast-stale` (fixture) | `stale` | `heatmap-scenarios.ts` |
| `get-faster` (skill rec) | `practice` | `SkillRecommendationType` |
| "Get faster" (cue label) | "Keep practicing" | `home-recommendations.ts` |
| (new) | `automate` | `SkillRecommendationType` |
| (new) | "Automate it" (cue) | `home-recommendations.ts` |
| "X/Y items fluent" | "X/Y items automatic" | `mode-ui-state.ts` |
| "Consolidating" | update to match | `idle-page.ts` |

## Speed levels (new)

| Status | P10(speed) threshold | Heatmap range |
|--------|---------------------|---------------|
| Automatic | ≥ 0.9 | heatmap-5 (green) |
| Solid | ≥ 0.7 | heatmap-4 (yellow-green) |
| Learning | ≥ 0.3 | heatmap-2/3 |
| Hesitant | > 0 | heatmap-1 (gold) |
| Starting | = 0 | mostly grey |

Plus Not started (no items seen) and Skipped.

Freshness axis (orthogonal): Needs review (P10 fresh < 0.5) / Fresh (≥ 0.5).

## Expansion gate (changed)

**Old:** P10(automaticity) across all started items ≥ 0.7
**New:** All started, non-skipped levels have P10(speed) ≥ 0.7 (Solid)
AND P10(freshness) ≥ 0.5 (Fresh). Plus expand/automate alternation:
expand only if ≤ 3 Solid-but-not-Automatic levels, else automate first.

## Recommendation priority (changed)

**Old:** review > get-faster > learn-next > not-started > automatic
**New:** review > practice > expand > automate > not-started > automatic

## Implementation steps

### Phase 1: Rename types and constants (no behavior change)

Pure renames — tests should still pass with identical behavior.

**1a. `fluentCount` → `automaticCount` in types + adaptive.ts**

- `src/types.ts`: Rename `fluentCount` field in `StringRecommendation` (line 102)
- `src/adaptive.ts`: Rename local variable + field in
  `computeStringRecommendations` (lines 388, 394, 403)
- `src/recommendations.ts`: Rename in `checkReviewMode` (lines 129-131:
  `totalFluent` → `totalAutomatic`, `r.fluentCount`)
- Update all test files that reference `fluentCount`:
  - `src/recommendations_test.ts` (many occurrences)
  - `src/hooks/use-home-progress_test.ts` (lines 25-26, 39-42, etc.)
- `src/fixtures/recommendation-scenarios.ts`: Rename `fluentCount` in
  `GroupSpec` type (line 58) and all scenario data + `generateLocalStorageData`
  comments (lines 88-89, 107-125)
- `scripts/group-model-diagnostic.ts`: Update HTML text (line 1155)

**1b. `countFluent()` → `countAutomatic()` in mode-ui-state.ts**

- `src/mode-ui-state.ts`: Rename function (line 15), local variable `fluent` →
  `automatic` (lines 20-26), JSDoc comment (line 14)
- Update call site in `computePracticeSummary` (line 149): `{ fluent }` →
  `{ automatic }`
- Update status detail string (line 169): `'fluent'` → `'automatic'`
- `src/mode-ui-state_test.ts`: Update all references

**1c. `recallThreshold` → `freshnessThreshold`**

- `src/types.ts`: Rename in `AdaptiveConfig` (line 80)
- `src/adaptive.ts`: Rename in `DEFAULT_CONFIG` (line 26), all internal uses
- `src/sim.ts`: Rename in config keys (line 75)
- `scripts/item-model-diagnostic.ts`: Update HTML display (line 878)
- `scripts/group-model-diagnostic.ts`: Update HTML display (line 1144)

**1d. `automaticityTarget` → `speedTarget`**

- `src/types.ts`: Rename in `AdaptiveConfig` (line 84)
- `src/adaptive.ts`: Rename in `DEFAULT_CONFIG` (line 30), update comment,
  rename in `computeSpeedScore` (line 93), `deriveScaledConfig` (line 240),
  `computeSpeedScoreForResponseCount` (line 272), JSDoc (line 80)
- `src/adaptive_test.ts`: Rename all references (lines 227-228, 1043-1044,
  1053, 1065, 1073, 1084, 1100, 1105)
- `src/quiz-engine_test.ts`: Rename reference (line 16-17)
- `src/sim.ts`: Rename in config keys (line 78)
- `scripts/item-model-diagnostic.ts`: Update HTML (line 870, 888)
- `scripts/group-model-diagnostic.ts`: Update HTML (line 1140)

**1e. Status labels: Slow → Hesitant, Getting faster → Learning**

- `src/mode-ui-state.ts`: Update `statusLabelFromLevel()` (lines 64-67)
- `src/mode-ui-state_test.ts`: Update expected strings (lines 137-144, 334-335)
- `src/fixtures/recommendation-scenarios.ts`: Update check strings (lines
  288-289, 318)
- `src/fixtures/idle-page.ts`: Update "Consolidating" label (line 7)
- `plans/exec-plans/active/2026-03-13-home-screen-phase2.md`: Update (line 97)

**1f. Fixture state names**

- `src/fixtures/heatmap-scenarios.ts`: Rename type union + switch cases:
  - `'slow-fresh'` → `'working'`
  - `'fast-fresh'` → `'automatic'`
  - `'fast-stale'` → `'stale'`
  - Keep `'mixed'` and `'unseen'`
- Update all consumers:
  - `src/home-recommendations_test.ts` (lines 374, 388)
  - `scripts/screenshot-manifest.ts` (lines 126, 138, 344, 353-355, 364,
    376-378, 387-391)

**1g. `get-faster` → `practice` in SkillRecommendationType**

- `src/home-recommendations.ts`: Rename type variant (line 24), update
  `classifySkill` (line 125), `TYPE_PRIORITY` (line 147),
  `rankSkillRecommendations` filter (line 169), cue label (line 127):
  `'Get faster'` → `'Keep practicing'`
- `src/home-recommendations_test.ts`: Update all `'get-faster'` references
- `src/hooks/use-home-progress_test.ts`: Update references if any

**Run tests after Phase 1. Everything should pass with identical behavior,
just different names.**

### Phase 2: Remove automaticity, switch to speed + freshness

This phase removes the combined `automaticity = speed × freshness` metric and
replaces all uses with speed and freshness independently.

**2a. Generalize `computeLevelAutomaticity` → `computeLevelPercentile`**

Currently in `mode-ui-state.ts`, `computeLevelAutomaticity` takes a
`getAutomaticity` callback and returns P10. Generalize it to accept any
metric getter:

```ts
export function computeLevelPercentile(
  itemIds: string[],
  getMetric: (id: string) => number | null,
  percentile: number = 0.1,
): { level: number; seen: number }
```

- `src/mode-ui-state.ts`: Rename + generalize. Keep old name as alias
  temporarily if needed, but prefer a clean break.
- `src/mode-ui-state_test.ts`: Rename test describe block, update calls.
- Call sites pass `getSpeedScore` or `getFreshness` instead of `getAutomaticity`.

**2b. Remove `automaticityThreshold` from `AdaptiveConfig`**

- `src/types.ts`: Remove the field from `AdaptiveConfig`
- `src/adaptive.ts`: Remove from `DEFAULT_CONFIG`, remove from
  `deriveScaledConfig`
- All call sites that used it need to switch to speed-based thresholds:
  - `src/mode-ui-state.ts` (`countAutomatic`): use speed threshold 0.9 instead
    of automaticity > threshold
  - `src/hooks/use-engine-actions.ts` (mastery count): use speed > 0.9
  - `src/adaptive.ts` (`computeStringRecommendations`): classify by speed
    instead of automaticity. `automaticCount` = items with speed ≥ 0.9.
  - `src/adaptive.ts` (`checkAllItemsAutomatic`): all items speed ≥ 0.9
  - `src/adaptive.ts` (`checkItemsNeedReview`): speed ≥ 0.5 AND fresh < 0.5
- `src/adaptive_test.ts`: Remove automaticityThreshold tests, update config
  assertions

**2c. Remove `getAutomaticity()` from AdaptiveSelector**

- `src/types.ts`: Remove from `AdaptiveSelector` interface
- `src/adaptive.ts`: Remove the `getAutomaticity` closure + remove from the
  returned selector object
- Update all consumers that called `selector.getAutomaticity()`:
  - `src/mode-ui-state.ts`: switch to `selector.getSpeedScore()` for counting
    automatic items, `selector.getFreshness()` where needed
  - `src/hooks/use-engine-actions.ts`: switch mastery count to speed
  - `src/hooks/use-round-summary.ts` (line 13, 28): remove `getAutomaticity`
    from the selector subset type — what did it use it for? Check and replace.
  - `src/declarative/types.ts` (line 12): remove from type definition
  - `src/ui/preview.tsx`: update
  - `src/ui/components_test.tsx`: update
  - `src/home-recommendations.ts` (line 99): currently uses
    `selector.getAutomaticity(id) !== null` to check if seen — replace with
    `selector.getStats(id) !== null`
  - `src/stats-display.ts`: `getStatsCellColor`/`getStatsCellColorMerged`
    accept `getAutomaticity` in their selector type — remove it since they
    only use `getSpeedScore`/`getFreshness`
  - `src/stats-display_test.ts`: remove `getAutomaticity` from test selectors
- `src/adaptive_test.ts`: Remove `getAutomaticity` tests (lines 679-696,
  1137-1149)

**2d. Replace `getLevelAutomaticity()` on selector**

- `src/types.ts`: Replace `getLevelAutomaticity` with `getLevelSpeed` and
  `getLevelFreshness` on `AdaptiveSelector` interface
- `src/adaptive.ts`: Implement using `computeLevelPercentile` with
  `getSpeedScore` / `getFreshness` respectively. Remove old implementation.
- Update call sites:
  - `src/recommendations.ts` (line 336): expansion gate — switch to per-level
    speed + freshness checks
  - `src/home-recommendations.ts` (line 75): checking "any seen" — use
    `getLevelSpeed` or just check `getStats() !== null` per item
  - `src/mode-ui-state.ts`: already handled in 2a
- `src/recommendations_test.ts`: Update mock selector — replace
  `getLevelAutomaticity` mock with `getLevelSpeed`/`getLevelFreshness`
- `src/adaptive_test.ts`: Rename tests (lines 884-924)
- `src/recommendations.ts`: Update `RecommendationSelector` type to use
  new methods

**2e. Remove `getAutomaticityColor()`**

- `src/stats-display.ts`: Remove the function (lines 88-96)
- `src/stats-display_test.ts`: Remove tests (lines 18-32)
- `src/ui/stats.tsx` (line 9, 106): Remove import and usage — check what it's
  used for and replace if needed

**2f. Replace `averageAutomaticity()` in use-home-progress.ts**

- `src/hooks/use-home-progress.ts`: Replace with `averageSpeed()` — sort
  progress bar segments by average speed instead of average automaticity
- `src/hooks/use-home-progress_test.ts`: Update

**2g. Update `countAutomatic()` (from 1b) to use speed**

- `src/mode-ui-state.ts`: `countAutomatic` currently counts items with
  automaticity > threshold. Change to count items with speed ≥ 0.9:
  ```ts
  export function countAutomatic(
    itemIds: string[],
    getSpeedScore: (id: string) => number | null,
  ): { automatic: number; seen: number }
  ```
- Update `computePracticeSummary` to pass `getSpeedScore` instead of
  `getAutomaticity`

**2h. Update `StringRecommendation` classification to use speed**

- `src/adaptive.ts` in `computeStringRecommendations`: currently classifies
  items by automaticity > threshold. Change to speed ≥ 0.9:
  ```ts
  const speed = getSpeedScore(id);
  if (speed === null) { unseenCount++; }
  else if (speed >= 0.9) { automaticCount++; }
  else { workingCount++; }
  ```
  This removes the dependency on `getAutomaticity` and `automaticityThreshold`.

**Run tests. Some behavior will change (items that were "automatic" by
automaticity > 0.8 but speed < 0.9 will now be "working"). Verify test
expectations match the new semantics.**

### Phase 3: Add "Solid" speed level + update expansion gate

**3a. Add "Solid" status label**

- `src/mode-ui-state.ts`: Update `statusLabelFromLevel()`:
  ```
  if (level >= 0.9) return 'Automatic';
  if (level >= 0.7) return 'Solid';
  if (level >= 0.3) return 'Learning';
  return 'Hesitant';
  ```
- `src/mode-ui-state_test.ts`: Update threshold tests
- Note: `statusLabelFromLevel` now takes P10(speed), not P10(automaticity),
  since we switched in Phase 2.

**3b. Update expansion gate**

Old: single `level < threshold` check (P10 automaticity vs `expansionThreshold`)
New: per-level checks:
- Each started level must have P10(speed) ≥ 0.7 (Solid)
- Each started level must have P10(freshness) ≥ 0.5 (Fresh)
- At most 3 levels may be Solid-but-not-Automatic (expand/automate cap)

- `src/recommendations.ts`: Rewrite `selectExpansion` to take per-level stats.
  The main `computeRecommendations` function needs to compute P10(speed) and
  P10(freshness) per started group (not just one global level).
- `src/types.ts`: Update `RecommendationSelector` to provide `getLevelSpeed`
  and `getLevelFreshness` (already done in 2d).
- Consider: `expansionThreshold` config param may no longer be needed — the
  gate is now "all Solid + Fresh" which uses fixed thresholds (0.7, 0.5).
  Remove `expansionThreshold` from `AdaptiveConfig` if so.
- `src/recommendations_test.ts`: Update expansion tests
- `src/adaptive_test.ts`: Remove `expansionThreshold` references if removed

**3c. Add "automate" recommendation type**

- `src/home-recommendations.ts`: Add `'automate'` to `SkillRecommendationType`
- Update `classifySkill()`: after review/practice/expand, check for
  Solid-but-not-Automatic levels → return `'automate'` with cue "Automate it"
- Update `TYPE_PRIORITY`: review < practice < learn-next < automate
- Update `rankSkillRecommendations` filter to include `'automate'`
- `src/home-recommendations_test.ts`: Add test cases

**3d. Expand/automate alternation**

- `src/recommendations.ts` or `src/home-recommendations.ts`: When the
  expansion gate is open AND there are ≥ 3 Solid-not-Automatic levels,
  prioritize automate over expand. Implement as a check in `classifySkill`:
  count Solid levels, if > cap (3), return `'automate'` instead of
  `'learn-next'`.

**3e. Update `RecommendationResult` type**

- `src/types.ts`: Update `reviewMode` comment (line 170: "fluent" → "automatic")
- `consolidateWorkingCount` → consider rename but keep if the concept is clear.

### Phase 4: Update UI consumers + fixtures

**4a. use-engine-actions.ts: Mastery count**

- Already switched to speed > 0.9 in Phase 2b. Verify it works correctly.
- `checkAllAutomatic`: now uses speed ≥ 0.9 (from 2b). Verify end-of-quiz
  mastery detection.
- `checkNeedsReview`: now uses speed ≥ 0.5 AND fresh < 0.5 (from 2b). Verify
  post-round detection.

**4b. Home progress bars (use-home-progress.ts)**

- Colors come from `getStatsCellColorMerged` (heatmap speed × freshness
  encoding). Since "Automatic" now requires P10 speed ≥ 0.9, automatic levels
  will show green bars. No color system change needed.
- Sort order switched from `averageAutomaticity` to `averageSpeed` in Phase 2f.

**4c. Fixture data values**

- `src/fixtures/recommendation-scenarios.ts`: Verify "automatic" items in
  `generateLocalStorageData` have ewma producing speed ≥ 0.9 (already changed
  to 700-1000ms → speed ~1.0 at minTime=1000).
- Update all comments referencing F/W/U or automaticity.

**4d. Diagnostic scripts**

- `scripts/recommendation-diagnostic.ts`: Update HTML output text, replace
  "Fluent" → "Automatic", "level automaticity" → "level speed", all threshold
  descriptions. Remove references to automaticity as a combined metric.
- `scripts/group-model-diagnostic.ts`: Same — update all HTML, threshold
  docs, status label references. Remove `automaticityThreshold` display.
- `scripts/item-model-diagnostic.ts`: Update `freshnessThreshold` display
  (from 1c), remove `automaticityThreshold` display, rename `speedTarget`.

### Phase 5: Update tests (final sweep)

All test files should be mostly updated in prior phases. Final sweep:

- `src/recommendations_test.ts` — expansion gate, F/W/U naming, mock selectors
- `src/mode-ui-state_test.ts` — status labels, percentile function name
- `src/home-recommendations_test.ts` — rec types, cue labels, automate tests
- `src/hooks/use-home-progress_test.ts` — progress bar, sort order
- `src/adaptive_test.ts` — config params, selector methods, level percentile
- `src/stats-display_test.ts` — remove getAutomaticityColor tests, remove
  getAutomaticity from test selectors
- `src/quiz-engine_test.ts` — speedTarget rename

### Phase 6: Update documentation

**6a. Guides**

- `guides/architecture.md`: Replace all automaticity/F-W-U/old-threshold
  references with v4 system (speed levels, two-axis status, expansion gate).
- `guides/terminology.md`: Rewrite to match v4 terminology.
- `guides/design/visual-design.md`: Update status label references.
- `guides/design/layout-and-ia.md`: Update references.
- `guides/architecture-vision.md`: Update references.
- `guides/design/components-preview.html`: Update references.
- `guides/design/components.html`: Update references.
- `guides/design/progress-recall-prototype.html`: Update references.
- `guides/design/wireframes/fretboard.md`: Update references.

**6b. Design docs and plans**

- `plans/design-docs/mastery-terminology-cleanup.md`: Add "After (v4)" section
  summarizing the implemented changes.
- `plans/exec-plans/active/2026-03-13-home-screen-phase2.md`: Update status
  label references.

**6c. Code comments — final grep**

Grep for any remaining references to removed concepts:
```
rg -i 'automaticity|fluentCount|countFluent|recallThreshold|"Slow"|"Getting faster"|slow-fresh|fast-fresh|fast-stale|get-faster|"Get faster"|automaticityTarget|automaticityThreshold' src/ scripts/ guides/
```

## Files touched (comprehensive list)

### Core source
- `src/types.ts` — `StringRecommendation` fields, `AdaptiveConfig` (remove
  `automaticityThreshold`, rename `automaticityTarget` → `speedTarget`,
  rename `recallThreshold` → `freshnessThreshold`), `AdaptiveSelector`
  (remove `getAutomaticity`, `getLevelAutomaticity`; add `getLevelSpeed`,
  `getLevelFreshness`), `RecommendationResult` comments
- `src/adaptive.ts` — DEFAULT_CONFIG, `computeSpeedScore`, remove
  `getAutomaticity` closure, replace `computeLevelAutomaticity` with
  per-metric percentile, rewrite `computeStringRecommendations` to use speed,
  rewrite `checkAllItemsAutomatic`/`checkItemsNeedReview` to use speed/fresh
- `src/recommendations.ts` — expansion gate (per-level speed + fresh),
  review mode check, `RecommendationSelector` type, comments
- `src/home-recommendations.ts` — `SkillRecommendationType` (+automate,
  rename get-faster→practice), `classifySkill`, cue labels, priority,
  expand/automate alternation
- `src/mode-ui-state.ts` — `countFluent` → `countAutomatic` (speed-based),
  `computeLevelAutomaticity` → `computeLevelPercentile`, `statusLabelFromLevel`
  (5 levels), `computePracticeSummary` (use speed + freshness)
- `src/stats-display.ts` — remove `getAutomaticityColor`, clean up selector
  type (remove `getAutomaticity`)

### Hooks
- `src/hooks/use-engine-actions.ts` — mastery count: speed > 0.9,
  `checkAllAutomatic`/`checkNeedsReview` updated
- `src/hooks/use-group-scope.ts` — `expansionThreshold` may be removed
- `src/hooks/use-home-progress.ts` — `averageAutomaticity` → `averageSpeed`
- `src/hooks/use-round-summary.ts` — remove `getAutomaticity` from type

### UI
- `src/declarative/types.ts` — remove `getAutomaticity` from selector type
- `src/ui/stats.tsx` — remove `getAutomaticityColor` usage
- `src/ui/preview.tsx` — update selector type
- `src/ui/components_test.tsx` — update selector mocks

### Fixtures
- `src/fixtures/heatmap-scenarios.ts` — state names
- `src/fixtures/recommendation-scenarios.ts` — `fluentCount` → `automaticCount`,
  comments, check strings
- `src/fixtures/idle-page.ts` — status label

### Tests
- `src/recommendations_test.ts`
- `src/mode-ui-state_test.ts`
- `src/home-recommendations_test.ts`
- `src/hooks/use-home-progress_test.ts`
- `src/adaptive_test.ts`
- `src/stats-display_test.ts`
- `src/quiz-engine_test.ts`

### Scripts
- `scripts/recommendation-diagnostic.ts`
- `scripts/group-model-diagnostic.ts`
- `scripts/item-model-diagnostic.ts`
- `scripts/screenshot-manifest.ts`

### Docs
- `guides/architecture.md`
- `guides/terminology.md`
- `guides/design/visual-design.md`
- `guides/design/layout-and-ia.md`
- `guides/architecture-vision.md`
- `guides/design/components-preview.html`
- `guides/design/components.html`
- `guides/design/progress-recall-prototype.html`
- `guides/design/wireframes/fretboard.md`
- `plans/exec-plans/active/2026-03-13-home-screen-phase2.md`
- `plans/design-docs/mastery-terminology-cleanup.md`

## Verification

After each phase:
1. `deno task ok` (lint + fmt + typecheck + tests + build)
2. `deno task test` specifically for the changed test files
3. Grep for old terms to ensure no remnants

After Phase 6:
```bash
rg -i 'automaticity|fluentCount|countFluent|recallThreshold|"Slow"|"Getting faster"|slow-fresh|fast-fresh|fast-stale|get-faster|"Get faster"|automaticityTarget|automaticityThreshold' src/ scripts/ guides/
```
Should return zero matches.

Then:
- Run screenshot captures to verify "all done" state shows green bars
- Run recommendation diagnostic to verify scenarios produce expected results
