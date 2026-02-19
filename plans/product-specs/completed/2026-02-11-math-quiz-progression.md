# Math Quiz Distance Group Progression

## Problem

Both math quiz modes (Semitone Math, Interval Math) expose all 264 items at once
(12 notes x 11 distances x 2 directions). This is overwhelming — users need
progressive unlocking similar to fretboard string selection.

## Design

### Distance Groups

Group items by the semitone distance (1-11), in numerical pairs — 6 groups:

| Group | Distances | Semitone label | Interval label | Items |
| ----- | --------- | -------------- | -------------- | ----- |
| 0     | 1, 2      | 1,2            | m2,M2          | 48    |
| 1     | 3, 4      | 3,4            | m3,M3          | 48    |
| 2     | 5, 6      | 5,6            | P4,TT          | 48    |
| 3     | 7, 8      | 7,8            | P5,m6          | 48    |
| 4     | 9, 10     | 9,10           | M6,m7          | 48    |
| 5     | 11        | 11             | M7             | 24    |

Default: Group 0 only (distances 1,2) on first launch.

### UI

Toggle buttons in a `.settings-row` above Start Quiz, matching the fretboard
string toggle pattern. Buttons are generated dynamically in JS (since labels
differ between the two modes). Styled identically to string toggles but with
auto-width for longer labels.

### Recommendation System

Reuses `getStringRecommendations()` from the adaptive selector (it's already
generic — takes indices and a `getItemIds` callback). Same consolidation-before-
expansion logic as fretboard strings:

1. Partition groups into started/unstarted
2. Calculate consolidation ratio across started groups
3. Recommend started groups with above-median work remaining
4. Gate expansion: when consolidated ratio >= 0.7, recommend the **next
   sequential** unstarted group (always progressing numerically)

### Persistence

- `semitoneMath_enabledGroups` — JSON array of group indices
- `intervalMath_enabledGroups` — same

### getEnabledItems()

Filters to only items in enabled groups. Called every question by the engine,
allowing mid-quiz group changes (same as fretboard mid-quiz string changes).

### Stats Heatmap

Unchanged — continues showing all 11 columns regardless of enabled groups, so
users see full progress.

## Files Changed

- `src/quiz-semitone-math.js` — group toggle logic + recommendation
- `src/quiz-interval-math.js` — same, different labels
- `src/styles.css` — `.distance-toggles` / `.distance-toggle` styles
- `main.ts` — add `.distance-toggles` container div to both math mode HTML
- `build.ts` — same HTML changes
- `CLAUDE.md` — document the new feature
