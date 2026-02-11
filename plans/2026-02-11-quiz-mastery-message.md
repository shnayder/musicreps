# Quiz Mastery Message

**Date:** 2026-02-11
**Goal:** Show "Looks like you've got this" above the start/stop button when
the user has mastered all enabled items in a quiz.

## Design

**Trigger:** After every answer submission, check if all enabled items have
predicted recall >= `recallThreshold` (0.5). This reuses the existing
threshold used by string recommendations for "mastered" items.

**Condition:** ALL enabled items must:
1. Have been seen (recall != null)
2. Have recall >= recallThreshold

If any item is unseen or below threshold, the message is hidden.

**Performance:** O(n) loop over enabled items, each doing a cached storage
lookup + Math.pow. Even the largest mode (semitone math, 264 items) is
negligible — a few hundred microseconds at most.

**UI placement:** A `<div class="mastery-message">` inside `.quiz-controls`,
right above the start/stop button div. Hidden by default; shown via JS
when mastery detected.

## Changes

1. **adaptive.js** — Add `checkAllMastered(items)` method to selector:
   returns true iff every item has recall >= recallThreshold.

2. **quiz-engine.js** — After `submitAnswer` records the response, call
   `checkAllMastered(mode.getEnabledItems())` and show/hide the mastery
   message element. Clear message on `start()`.

3. **HTML templates (main.ts + build.ts)** — Add `.mastery-message` div
   in each mode's `.quiz-controls`, above the button div.

4. **styles.css** — Style `.mastery-message` (hidden by default, green text).

5. **adaptive_test.ts** — Test `checkAllMastered` with various scenarios:
   all mastered, some unseen, some below threshold.

6. **Version** — Bump v2.3 → v2.4.
