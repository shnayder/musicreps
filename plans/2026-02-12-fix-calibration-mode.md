# Fix Calibration Mode

## Issues

1. **Too many buttons in bidirectional modes**: Note↔Semitones and Interval↔Semitones
   show both note/interval buttons AND number buttons during calibration. Only need one
   set (the note/interval buttons).

2. **Mode switch during calibration leaves stale state**: If user starts calibration
   then switches modes, it should cleanly reset. (Currently `deactivate()` calls
   `engine.stop()` which does reset — verify this works, fix edge cases.)

3. **No way to close calibration**: Need an × button to dismiss calibration without
   completing it. Currently only Escape key works.

4. **Speed tap lacks calibration**: Should participate in the shared baseline system.

5. **Calibration doesn't hide quiz controls**: Fretboard, string toggles, distance
   group toggles, and other mode-specific UI remain visible during calibration.
   Need a clean architectural solution, not per-mode show/hide calls.

6. **Redundant calibration across modes**: Each of the 10 modes runs its own
   10-trial calibration. Modes using the same input type should share results.

7. **"Calibration" is too technical**: Need a friendlier user-facing term.

## Design

### Issue 7: Rename "Calibration" → "Quick Speed Check"

Replace all user-facing text:
- "Quick Calibration" → "Quick Speed Check"
- "Calibration Complete" → "Speed Check Complete"
- "Quick warm-up!" → "Speed check!"
- "Recalibrate" → "Redo speed check"

Internal code names (variable names, function names) stay as-is — renaming
`runCalibration` etc. would be churn with no benefit.

### Issue 5: Hide quiz controls during calibration (CSS-driven)

Add a `calibrating` class to the `.mode-screen` container during any calibration
phase. One CSS rule hides everything except `.quiz-area`:

```css
.mode-screen.calibrating > *:not(.quiz-area) {
  display: none !important;
}
```

In `render()`, one line toggles the class based on phase:

```javascript
container.classList.toggle('calibrating',
  state.phase === 'calibration-intro' ||
  state.phase === 'calibrating' ||
  state.phase === 'calibration-results');
```

This automatically hides the fretboard, string toggles, distance toggles,
stats controls, quiz controls (start/stop/settings) — for all modes, with no
per-mode logic.

### Issue 1: Hide irrelevant button groups during calibration

During calibration, mark the answer-button container holding calibration buttons
with a `calibration-active` class. CSS hides other containers:

```css
.mode-screen.calibrating .answer-buttons:not(.calibration-active),
.mode-screen.calibrating .note-buttons:not(.calibration-active) {
  display: none !important;
}
```

Engine logic: when entering calibrating phase, find the parent container of
the first calibration button and add `calibration-active`. Remove on cleanup.

### Issue 3: Close button for calibration

Render a close button (×) in the quiz-area during all calibration phases.
Position it in the top-right of the quiz-area. Clicking it calls `stop()`.

Created dynamically alongside other calibration content. Removed on cleanup.

### Issue 6: Shared calibration providers

All modes that measure single-button-tap speed share one baseline. Instead of
`motorBaseline_{storageNamespace}`, use `motorBaseline_{provider}`.

- Mode config gains `calibrationProvider` property (default: `'button'`)
- Engine reads baseline from `motorBaseline_{provider}` key
- Calibration result stored under provider key
- First mode used triggers calibration; all others skip

All current modes use provider `'button'`. If future modes need different
input types, they'd define a new provider.

**Migration**: On engine init, if shared key doesn't exist but per-mode key
does, migrate the value. This preserves existing user baselines.

### Issue 4: Speed tap calibration

Speed tap doesn't use `createQuizEngine`, so it needs its own calibration
integration:

1. Add hidden `.answer-btn-note` buttons to speed tap's quiz-area HTML
   (only visible during calibration via the `.calibrating` CSS)
2. On activate, check `motorBaseline_button` in localStorage
3. If missing, enter calibration flow (reuse `runCalibration()` function)
4. Store result in shared provider key
5. Apply baseline to scale SPEED_TAP_CONFIG via `deriveScaledConfig()`

Speed tap calibration phases managed via local state (not engine state machine),
with the same visual flow (intro → trials → results → idle).

Speed tap quiz-area also needs `.speed-tap-prompt` and `.speed-tap-status`
hidden during calibration: `calibrating .speed-tap-prompt, .calibrating
.speed-tap-status { display: none; }`.

### Issue 2: Mode switch during calibration

Already handled: `deactivate()` → `engine.stop()` → `engineStop()` resets to
idle. With shared providers, switching to another mode that uses the same
provider and has no baseline will re-trigger calibration in that mode, but
completing it there means the original mode won't re-trigger on return.

Verify: speed tap cleanup on deactivate also cancels any running calibration.

## Implementation Order

1. Rename user-facing text (issue 7) — smallest, no architecture changes
2. Add `.calibrating` CSS class and render toggle (issue 5)
3. Hide irrelevant button groups (issue 1) — builds on issue 5 CSS
4. Add close button (issue 3)
5. Shared calibration providers (issue 6) — changes engine init and storage
6. Speed tap calibration (issue 4) — builds on shared providers
7. Verify mode-switch behavior (issue 2)
8. Update both HTML templates (main.ts and build.ts) for speed tap button changes
9. Update version number
10. Run tests, fix any issues
