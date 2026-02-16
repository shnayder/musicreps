# Layout & Information Architecture Fixes

## Problem / Context

Design review of the fretboard quiz screen (mid-quiz, idle/stats for fretboard,
idle/stats for diatonic chords) identified systematic layout and information
architecture issues. These fall into three categories:

1. **Missing labels and grouping** — controls are unlabeled, related settings
   scattered, no section boundaries.
2. **Wrong content for the state** — quiz-configuration controls visible during
   active quiz, redundant stop mechanisms, quiz area card boundary splits a
   logical group.
3. **Weak stats presentation** — no aggregate summary, stats scope doesn't
   match quiz config, grid axes unlabeled, legends detached from heatmaps.

The show/hide architecture historically mixed per-element JS `style.display`
toggles, CSS class cascades, and inline `style="display: none"`. Several rounds
of cleanup have introduced phase-class CSS and eliminated many issues. This plan
tracks what's been completed and what remains.

## Current Status (2026-02-16)

### Completed
- **Phase 1 (Labels):** String toggles have "Strings" label. Group toggles have
  "Groups" label. Progress bar shows "X / Y fluent". Session stats show answer
  count with context. Stop button removed (only x close + Escape remain).
- **Phase 2 (Speed Tap migration + response-count scaling):** Fully complete.
  Speed Tap uses `createQuizEngine` (275 lines, down from ~740). Response-count
  scaling in `adaptive.js` (`computeSpeedScore` takes `responseCount` param).
  `getExpectedResponseCount` implemented in Speed Tap and Chord Spelling.
- **Phase 3 (DOM grouping):** Template restructured into `stats-section`,
  `quiz-config`, `quiz-session` groups. `beforeQuizArea` slot exists.
  `modeScreen()` scaffold matches target structure.
- **Phase 4 (partial):** Phase classes on container (`phase-idle`, `phase-active`,
  `phase-calibration`, `phase-round-complete`). CSS phase rules exist for section
  visibility. `showStartBtn`/`showStopBtn`/`showHeatmapBtn`/`showStatsControls`
  state flags removed. Calibration sub-phase classes work.

### Remaining Work

**Phase 3 remnant — navigation class-based mode switching:**
- `navigation.js` lines 43, 49, 98 use inline `style.display` for mode-screen
  visibility. This blocks CSS phase rules from working on initially-hidden screens.

**Phase 4 remnants — inline `style.display` elimination:**
- `html-helpers.ts:212` — mastery-message `style="display: none;"`
- `html-helpers.ts:216` — recalibrate-btn `style="display: none;"`
- `html-helpers.ts:236` — round-complete `style="display: none;"`
- `quiz-engine.js:762` — mastery-message JS `style.display` toggle
- `quiz-engine.js:765` — recalibrate-btn JS `style.display` toggle
- `quiz-engine.js:797,799` — round-complete JS `style.display` toggle
- `quiz-speed-tap.js:197,208,254` — fretboard-wrapper `style.display`
- `stats-display.js:191,199` — stats-container `style.display` in show/hide
- `app.js:113,124` — checking `style.display` for stats visibility detection
- `styles.css:875,879` — `!important` on calibration sub-phase rules (symptom of
  inline style conflicts)

**Phase 4 remnant — render() decomposition:**
- 125-line `render()` in `quiz-engine.js:684-809` handles phase management,
  feedback, progress, calibration, and round-complete in one block.

**Phase 5 — per-state layout polish** (unchanged)

**Phase 6 — stats improvements** (unchanged)

## Identified Issues

### Mid-quiz state (all modes)
1. ~~Settings row visible mid-quiz~~ FIXED (phase CSS hides `.quiz-config`)
2. ~~Redundant Stop/x buttons~~ FIXED (Stop button removed)
3. "Practicing" header is low-information
4. ~~Session stats unlabeled~~ FIXED (shows "N answers", "X / Y fluent")
5. Content ordering: 5 layers of chrome above the question
6. ~~Quiz area card boundary splits group~~ FIXED (quiz-session group created)
7. Note buttons left-aligned in a centered layout
8. Countdown bar has low visual weight for a time-critical element

### Idle/stats state (fretboard)
9. ~~String toggles unlabeled~~ FIXED ("Strings" label added)
10. No aggregate progress summary
11. Heatmap shows all 78 positions regardless of enabled strings

### Idle/stats state (diatonic chords / grid modes)
12. 12x7 grid has no axis labels
13. Grey "no data" cells overwhelm actual progress when few groups enabled
14. ~~Group toggles unlabeled~~ FIXED ("Groups" label added)
15. Recall/Speed toggle not clearly grouped with stats display

### Cross-cutting
16. No clear visual boundary between "progress" and "quiz configuration"
17. Recall/Speed toggle always visible in idle (no dismiss option)

## Remaining Phases

### Phase 3R: Navigation class-based mode switching

**Goal:** Replace the last source of inline `style.display` outside the engine.

**Changes:**
- Add CSS rule: `.mode-screen { display: none; }` /
  `.mode-screen.mode-active { display: block; }`
- `navigation.js switchTo()`: toggle `.mode-active` class instead of
  `style.display`
- `navigation.js init()`: remove the `forEach` that sets `style.display = 'none'`
  on all mode screens (CSS handles it)
- `app.js`: replace `style.display !== 'none'` checks with `.mode-active` class
  check

**Files:** `navigation.js`, `app.js`, `styles.css`

**Risk:** Low. Behavioral no-op — just changes the mechanism.

**Test plan:**
- `npx tsx --test src/*_test.ts`
- Manual: switch between all 10 modes via hamburger menu
- Verify last-used mode persists across page reload
- Verify drawer closes after selection

### Phase 4R: Eliminate remaining inline style.display

**Goal:** All visibility is controlled by CSS classes/phase rules. No
`style.display` in JS or inline HTML.

**4R-a: Template inline styles -> CSS rules**

Remove `style="display: none;"` from three elements in `html-helpers.ts` and
add CSS rules:

| Element | Current | New CSS rule |
|---------|---------|-------------|
| `.mastery-message` | `style="display: none;"` + JS toggle | `.mastery-message { display: none; }` / `.mastery-message.mastery-visible { display: block; }` |
| `.recalibrate-btn` | `style="display: none;"` + JS toggle | `.recalibrate-btn { display: none; }` / `.phase-idle .recalibrate-btn.has-baseline { display: inline; }` |
| `.round-complete` | `style="display: none;"` + JS toggle | `.round-complete { display: none; }` / `.phase-round-complete .round-complete { display: block; }` |

Engine `render()` changes:
- mastery-message: `classList.toggle('mastery-visible', state.showMastery)`
  instead of `style.display`
- recalibrate-btn: `classList.toggle('has-baseline', !!motorBaseline)` once at
  init + when baseline changes. CSS handles phase visibility.
- round-complete: remove JS `style.display` toggle entirely — CSS phase rule
  handles it

**4R-b: stats-display.js -> CSS class**

`createStatsControls` uses `style.display` to show/hide the stats container.
Replace with `classList.toggle('stats-hidden')`:
- `show()`: remove `stats-hidden` class, render content
- `hide()`: add `stats-hidden` class, clear content
- CSS: `.stats-container.stats-hidden { display: none; }`

Update `app.js` to check for `.stats-hidden` class instead of
`style.display !== 'none'`.

**4R-c: Speed Tap fretboard-wrapper -> CSS class**

Speed Tap toggles fretboard-wrapper visibility via `style.display`. Replace
with `classList.toggle('fretboard-hidden')`:
- `onStart()`: remove `fretboard-hidden`
- `onStop()` + `init()`: add `fretboard-hidden`
- CSS: `.fretboard-wrapper.fretboard-hidden { display: none; }`

**4R-d: Remove !important from calibration CSS**

After all inline styles are gone, the `!important` on calibration sub-phase
rules (styles.css lines ~875, ~879) should no longer be needed. Remove and
verify calibration still works correctly.

**Files:** `html-helpers.ts`, `quiz-engine.js`, `stats-display.js`,
`quiz-speed-tap.js`, `app.js`, `styles.css`

**Risk:** Medium. Each change is small but there are several. Test after each
sub-step.

**Test plan:**
- `npx tsx --test src/*_test.ts` after each sub-step
- Manual: all 10 modes x idle/active/calibration/round-complete states
- Verify mastery message appears when all items mastered
- Verify recalibrate button appears after completing calibration
- Verify round-complete overlay shows at end of 60s round
- Verify stats toggle between Recall/Speed works
- Verify Speed Tap fretboard shows during quiz, hides during idle

### Phase 4R-e: render() decomposition

**Goal:** Break the 125-line `render()` into named helpers for readability.

**Proposed decomposition:**
```
render()
  renderPhaseClass(state, container)     // lines 695-701
  renderGearButton(state)                // lines 704-705
  renderCalibrationMarking(state)        // lines 708-723
  renderHeader(state)                    // lines 725-737
  renderFeedback(state)                  // lines 742-759
  renderMessages(state)                  // lines 760-766
  renderSessionStats(state)              // lines 768-783
  setAnswerButtonsEnabled(state)         // line 785 (already extracted)
  renderRoundComplete(state)             // lines 788-801
  renderCalibrationContent(state)        // lines 804-808
```

Each helper reads from `state` and writes to the corresponding DOM elements via
the `els` object (closure variable). No new abstractions — just named chunks.

**Files:** `quiz-engine.js`

**Risk:** Low. Pure refactor — no behavioral change.

**Test plan:**
- `npx tsx --test src/*_test.ts`
- Manual: quick smoke test of 2-3 modes across all states

### Phase 5: Per-state layout polish (builds on 3R + 4R)

**Goal:** Tune each state's layout now that visibility is fully CSS-controlled.

**Quiz state:**
- Content order: question -> countdown -> answers -> feedback
- Quiz area card boundary: extend to include quiz-session elements, or remove
  card treatment entirely and use spacing/dividers
- Countdown bar: consider increasing height or adding color emphasis
- Center note buttons in quiz area

**Idle state:**
- Stats section at top (heatmap/grid)
- Quiz config below (toggles + start)
- Clean visual separation between sections
- Consistent spacing between sections across modes

**Files:** `styles.css`, possibly `html-helpers.ts`

**Risk:** Low-medium. Mostly CSS. Visual verification needed.

**Test plan:**
- Visual verification: all 10 modes x idle + quiz states
- Mobile viewport (375px): verify no horizontal overflow, touch targets >= 44px
- Desktop: verify hover states work

### Phase 6: Stats improvements

**Goal:** Make stats displays more useful and less noisy.

**Changes:**
- **Aggregate summary:** "X / Y fluent" text above heatmap/grid in idle state.
  Computed from `computeProgress()`. Show in stats-section, update on toggle/
  config change.
- **Grid axis labels:** Add row/column headers to stats grids. Update
  `renderStatsGrid()` in `stats-display.js`.
- **Stats scoping:** Dim grid cells for items outside enabled groups.
  `opacity: 0.3` on out-of-scope cells. Pass enabled item set to
  `renderStatsGrid()`.
- **Legend proximity:** Verify legend lives inside stats-section adjacent to
  visualization for all modes.

**Files:** `stats-display.js`, `quiz-engine.js`, mode files, `styles.css`

**Risk:** Low-medium. Stats rendering is self-contained.

**Test plan:**
- Manual: verify aggregate summary updates when toggling groups
- Verify grid axis labels present for all grid modes
- Verify dimming matches enabled groups
- Verify fretboard heatmap legend placement

## Phase Dependencies

```
Phase 3R (navigation) ----+
                          |
Phase 4R (inline styles) -+-- Phase 5 (per-state polish)
                          |
Phase 4R-e (render decomp)|
                          |
Phase 6 (stats) ----------+-- standalone (after 3R)
```

3R -> 4R -> 4R-e are sequential. Phase 5 requires 3R + 4R. Phase 6 can start
after 3R.

## Files Modified (remaining phases)

| File | Phases | Changes |
|------|--------|---------|
| `src/navigation.js` | 3R | Class-based mode switching |
| `src/app.js` | 3R, 4R | Class check instead of style.display |
| `src/styles.css` | 3R, 4R, 5 | Mode-screen rules, element visibility rules, layout |
| `src/html-helpers.ts` | 4R | Remove inline display:none from 3 elements |
| `src/quiz-engine.js` | 4R, 4R-e | classList toggles, render decomposition |
| `src/stats-display.js` | 4R, 6 | classList toggle, grid labels, summary |
| `src/quiz-speed-tap.js` | 4R | classList toggle for fretboard-wrapper |
| `src/stats-display.js` | 6 | Grid axis labels, summary, scoping |
| `build.ts` | 4R | Mirror html-helpers changes (version bump) |
| `main.ts` | 4R | Mirror html-helpers changes (version bump) |

## Testing

- `npx tsx --test src/*_test.ts` after each phase
- Manual verification: all 10 modes x idle + quiz + calibration states
- Mobile viewport testing (375px width)
- Keyboard navigation (Tab, Escape, Space, note keys)
