# Fix: Tap-anywhere doesn't work below hint text

**Date:** 2026-02-10
**Status:** In progress

## Problem

After answering a question, the "Tap anywhere or press Space for next" hint
appears. Tapping on disabled buttons now works (previous fix: `pointer-events:
none`), but tapping below the hint text does nothing.

**Root cause:** The click handler is attached to `.mode-screen`, which only
wraps its content (no explicit height). Below the last child element (`.hint`),
taps land outside `.mode-screen` entirely and are never captured.

## Fix

Make `.mode-screen` fill the remaining viewport height so taps anywhere on
screen (including below the content) are captured by the click handler.

1. **`body`**: Add `display: flex; flex-direction: column; min-height: 100dvh`
   (with `100vh` fallback) so it fills the viewport as a flex column.
2. **`.mode-screen`**: Add `flex: 1` so the visible mode screen stretches to
   fill all remaining space below the top bar.

This is safe because:
- Hidden mode-screens have `display: none` (set inline by navigation.js), so
  they don't participate in flex layout.
- The single visible mode-screen gets all remaining space.
- Fixed-position elements (nav-overlay, nav-drawer) are unaffected.

## Files changed

- `src/styles.css` — body flex layout, mode-screen flex: 1
- `main.ts` — version bump
- `build.ts` — version bump
