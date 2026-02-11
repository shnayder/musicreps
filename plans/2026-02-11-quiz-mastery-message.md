# Quiz Mastery & Review Messages

**Date:** 2026-02-11
**Goal:** Show contextual messages above the start/stop button:
- "Looks like you've got this!" when all enabled items are mastered
- "Time to review?" when previously-learned items have decayed recall

## Design

### Mastery message (during quiz)

**Trigger:** After every answer submission, check if all enabled items have
predicted recall >= `recallThreshold` (0.5). This reuses the existing
threshold used by string recommendations for "mastered" items.

**Condition:** ALL enabled items must:
1. Have been seen (recall != null)
2. Have recall >= recallThreshold

### Review message (when idle)

**Trigger:** On mode activation and after quiz stops, check if
previously-mastered material needs review.

**Condition — ALL items must have high prior skill:**
1. Been answered correctly before (`lastCorrectAt != null`)
2. Have `speedScore >= 0.5` (EWMA at or below automaticityTarget of 3s)

**AND at least one item's recall has decayed** below `recallThreshold`.

This avoids false positives from items still being learned, one-off
correct answers, or fat-finger mistakes on items you barely know. The
speedScore threshold (0.5) means you were answering at or below the
automaticity target — real evidence of prior mastery, not just having
seen an item once.

### Priority order

When idle, if all items are mastered show mastery message; else if any
need review show review message; else hide. During quiz, only the mastery
message can appear.

**Performance:** O(n) loop over enabled items, each doing a cached storage
lookup + Math.pow. Even the largest mode (semitone math, 264 items) is
negligible — a few hundred microseconds at most.

**UI placement:** A `<div class="mastery-message">` inside `.quiz-controls`,
right above the start/stop button div. Hidden by default; text and
visibility set dynamically by JS.

## Changes

1. **adaptive.js** — Add `checkAllMastered(items)` and `checkNeedsReview(items)`
   methods to the selector.

2. **quiz-engine.js** — `submitAnswer` checks mastery during quiz.
   New `updateIdleMessage()` checks both mastery and review when idle;
   called from `stop()` and exposed publicly. Message text set dynamically.

3. **quiz-*.js (5 modes)** — Call `engine.updateIdleMessage()` in `activate()`.
   Speed Tap uses its own engine and is excluded.

4. **HTML templates (main.ts + build.ts)** — `.mastery-message` div in all modes.

5. **styles.css** — Style `.mastery-message` (hidden by default, green text).

6. **adaptive_test.ts** — Tests for both `checkAllMastered` and `checkNeedsReview`.

7. **Version** — v2.4 → v2.5.
