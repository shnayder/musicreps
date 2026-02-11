# Fix Quiz Message Scope on Subset Change

**Date:** 2026-02-11
**Goal:** Ensure "Looks like you've got this!" and "Time to review?" messages
update immediately when the user changes the enabled item subset (string
toggles, naturals-only checkbox).

## Problem

The mastery/review messages are correctly scoped to `getEnabledItems()`, but
`updateIdleMessage()` is not called when the item set changes in fretboard mode.
The math modes already call `engine.updateIdleMessage()` in `toggleGroup()`,
but `toggleString()` and the naturals-only toggle in `quiz-fretboard.js` do not.

Result: if the user has mastered strings 1–2 and the mastery message is showing,
enabling string 3 (no data) doesn't clear the message until the next quiz
start/stop cycle.

## Fix

1. **quiz-fretboard.js `toggleString()`** — Add `engine.updateIdleMessage()`
   after `updateStringToggles()`, matching the pattern in math mode
   `toggleGroup()`.

2. **quiz-fretboard.js naturals-only toggle** — Add
   `engine.updateIdleMessage()` after `updateAccidentalButtons()`, since
   toggling naturals-only changes which items are enabled.

3. **Version** — v2.7 → v2.8.

## What was actually done

Implemented exactly as planned — no deviations. Added `engine.updateIdleMessage()`
calls to both `toggleString()` (line 77) and the naturals-only change handler
(line 352) in `quiz-fretboard.js`. Version bumped to v2.8.
