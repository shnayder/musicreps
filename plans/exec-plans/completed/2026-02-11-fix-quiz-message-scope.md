# Fix Quiz Message Scope on Subset Change

**Date:** 2026-02-11 **Goal:** Ensure "Looks like you've got this!" and "Time to
review?" messages update immediately when the user changes the enabled item
subset (string toggles, naturals-only checkbox).

## Problem

The mastery/review messages are correctly scoped to `getEnabledItems()`, but
`updateIdleMessage()` is not called when the item set changes in fretboard mode.
The math modes already call `engine.updateIdleMessage()` in `toggleGroup()`, but
`toggleString()` and the naturals-only toggle in `quiz-fretboard.js` do not.

Result: if the user has mastered strings 1–2 and the mastery message is showing,
enabling string 3 (no data) doesn't clear the message until the next quiz
start/stop cycle.

## Fix

1. **quiz-fretboard.js `toggleString()`** — Add `engine.updateIdleMessage()`
   after `updateStringToggles()`, matching the pattern in math mode
   `toggleGroup()`.

2. **quiz-fretboard.js naturals-only toggle** — Add `engine.updateIdleMessage()`
   after `updateAccidentalButtons()`, since toggling naturals-only changes which
   items are enabled.

3. **Version** — v2.7 → v2.8.

## What was actually done

Implemented message scope fix as planned. Added `engine.updateIdleMessage()`
calls to both `toggleString()` and the naturals-only change handler in
`quiz-fretboard.js`. Version bumped to v2.8.

Additionally fixed stale recommendations (orange borders): recommendations were
only computed at page load via `applyRecommendations()` in `init()` and never
refreshed. Refactored into `computeRecommendations()` (pure logic) +
`updateRecommendations()` (highlight-only refresh) + `applyRecommendations()`
(full init with enabled-set override). Added `updateRecommendations()` calls to
`activate()` and `onStop()` in all three modes (fretboard, semitone math,
interval math) so orange borders update after quiz sessions and mode switches
without overriding the user's manual group/string selection. Version v2.9.
