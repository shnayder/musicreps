# Speed Tap Mode

## Summary

New fretboard quiz mode: given a note name (e.g., "Tap all C"), find and tap
every position of that note on the fretboard as quickly as possible.

This is the reverse of the normal fretboard quiz — instead of "see position,
name the note" (recognition), it's "hear note name, recall all positions"
(spatial recall).

## Core Mechanic

1. Adaptive selector picks a note (e.g., "C")
2. Display: **"Tap all C"** with progress counter ("0 / 6") and live timer
3. User taps circles directly on the SVG fretboard:
   - **Correct**: circle stays green, note name shown, progress increments
   - **Wrong**: circle flashes red + shows actual note name, resets after 800ms
   - **Already found**: ignored
4. All found → round complete, show total time, tap/Space to continue
5. Escape to stop

## Design Decisions

### Can't reuse createQuizEngine

The existing engine assumes one question → one answer → next. Speed Tap needs
one question → N answers (find all positions) → next. The countdown bar,
single-answer submit flow, and answer-button wiring don't apply. Speed Tap has
its own quiz loop.

### Items = note names, not positions

The atomic unit of performance is "how well do you know where all the C's are,"
not individual fret positions. Tracking per-note EWMA of round completion time
is the natural metric.

- Naturals-only: 7 items (C D E F G A B)
- All notes: 12 items (C C# D ... B)
- Each note appears 6–8 times on the fretboard (frets 0–12, all 6 strings)

### Separate storage namespace

Namespace: `speedTap` (independent from `fretboard`).

The two modes measure different cognitive tasks — recognition vs. recall — with
different response time ranges. Mixing storage would corrupt both.

### All strings always enabled

No string toggles. The point of this mode is holistic spatial recall across the
full fretboard, not drilling one string at a time.

### Wrong taps: flash + show note, no penalty

Circle flashes red and shows the actual note you tapped (so you learn from the
mistake), then resets after 800ms. No time penalty — wrong taps already waste
time naturally, and adding artificial penalty would make the time metric less
meaningful.

### No heatmap (for now)

Per-note items on a multi-position fretboard makes heatmap ambiguous (all C
positions would be the same color). Can revisit later.

## Adaptive/Memory Integration

Uses the standard `createAdaptiveSelector` + `createLocalStorageAdapter`:

- **EWMA**: tracks total round completion time per note
- **Stability/forgetting**: half-life model applies — if you haven't practiced
  finding all C's in a while, the selector will prioritize it
- **Selection**: slower and more-forgotten notes get higher weight
- **No repeats**: last-selected note gets weight 0

## Files Changed

| File | Change |
|------|--------|
| `src/quiz-speed-tap.js` | New — mode implementation (~230 lines) |
| `src/app.js` | Register `createSpeedTapMode()` |
| `main.ts` | HTML template: mode screen, nav drawer button, JS concat |
| `build.ts` | Mirror template changes |
| `src/styles.css` | `.speed-tap-prompt`, `.speed-tap-status`, `.speed-tap-progress`, `.speed-tap-timer` |
| Version | v1.5 → v1.6 |

## What It Reuses

- `createAdaptiveSelector` / `createLocalStorageAdapter` — item selection + memory
- `NOTES`, `NATURAL_NOTES`, `STRING_OFFSETS` — music data
- SVG circle `data-string`/`data-fret` attributes — tap targets
- Navigation registration pattern — `init`/`activate`/`deactivate`
- `updateModeStats` — median EWMA display

## What It Does NOT Reuse

- `createQuizEngine` — wrong lifecycle for multi-tap rounds
- String toggles — all strings always on
- Heatmap — skipped for now
