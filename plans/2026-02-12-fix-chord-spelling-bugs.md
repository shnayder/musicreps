# Fix Chord Spelling Bugs

## Bug 1: Accidentals buttons pick wrong enharmonic variant

**Problem**: Answer buttons always send the sharp variant (e.g., `data-note="A#"` for the
"A#/Bb" button). When the expected chord tone is "Bb", `spelledNoteMatchesInput("Bb", "A#")`
returns false because it does strict letter+accidental matching.

**Root cause**: Buttons can't distinguish between enharmonic pairs — the user clicking
"A#/Bb" means "this pitch", not "specifically A#". But `submitTone()` uses the strict
`spelledNoteMatchesInput()` which requires exact letter+accidental match.

**Fix**: In the button click handler in `quiz-chord-spelling.js`, resolve the input to the
correct enharmonic spelling before calling `submitTone()`. If the button's pitch (semitone)
matches the expected tone's pitch, use the expected spelling. This preserves strict checking
for keyboard input (where the user explicitly types the enharmonic they want).

## Bug 2: Stats table shows only enabled chord flavors

**Problem**: `showStats()` only iterates over `enabledGroups` to build the stats table columns.
If only one group is enabled (e.g., group 1 = minor), only "m" appears. The user expects to
see all chord types in the stats.

**Fix**: Change `showStats()` to display ALL chord types as columns instead of only the
enabled ones. This gives a complete view of progress across all chord types.

## Changes

1. `src/quiz-chord-spelling.js` — button click handler (enharmonic resolution via
   `spelledNoteMatchesSemitone`) + `showStats` (show all chord types)
2. `main.ts` / `build.ts` — increment version to v3.1
