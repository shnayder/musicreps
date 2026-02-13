# Mid-Quiz Status — Design Spec

## Overview

During a quiz session, the user just sees whether they're correct or not on the
most recent question, and has no visibility into how they're doing or whether
they've practiced enough. Let's add basic status information so users know how
long they've been practicing, how many questions they've done, and how their
mastery is progressing.

## Problem

- Users don't know how many questions they've answered or how long they've been
  going
- No sense of coverage — am I seeing all the items or just a narrow subset?
- The adaptive system has rich data (recall rates, item coverage, mastery
  levels) but none of it is surfaced during the quiz

## Goals

- Give users lightweight, glanceable status during a quiz
- Surface mastery progress so users can decide when to stop or move on
- Avoid cluttering the quiz UI or distracting from the core drill loop

## Non-Goals
- Adding gamification -- streak mechanics, question goals, etc
- Explicit stop/move-on recommendations (already have "you've mastered these"
  message; more sophisticated recommendations can come later)
- Session summary screen on stop

## Mid-Quiz Status Display

### What to show

_What information is most useful mid-quiz? Options to consider:_

- How long have I been going?
   - Questions answered (e.g., "42")
   - duration (e.g. 1m 23s)
- How well have I learned these items? Should I stop drilling them?
  - Mastery summary or other notion of progress (see Progress Display below)

### What to hide or change
- the question/prompt and the answer are shouldn't have anything between them:
  - e.g. for the fretboard quiz, we currently have
    Fretboard
    String selector & natural only checkbox
    Stop quiz button
    Countdown timer bar
    Answer buttons
  - it should probably be
    String selector & natural only checkbox
    Countdown timer bar
    Fretboard
    Answer buttons
    Stop quiz button

### Where and when to show it

- Always:
  - Time and number of questions. Time should count continuously.
  - progress tracker -- it only updates between answers, so shouldn't distract too much.
- during feedback phase after answer
  - existing "you've mastered these" message continues to appear when applicable

### Visual design

- Show that we're in quiz mode with a header of some sort (Practicing... X (close button))
  - instead of a "stop quiz" button, use X pattern.
- Then # of questions and total time. These should be visually tertiary in the info hierarchy -- available, but not distracting.
- Then progress display
- then the question and answer options
  - inconsistency to fix: fretboard modes put the thing you're supposed to tap below the fretboard, other modes have the question, then answer. Let's put question above answer in all cases I think. 
- Then feedback and "tap anywhere for next" message

## Progress Display

_What does the progress tracker show, and how?_

The adaptive system tracks per-item recall and speed. We need to distill that into something glanceable.

**Scope**: reflect the currently-enabled items. That's what I'm working on, so that's what I want to see.

**Metric**: let's use **Fraction of enabled items with recall >= threshold**. Simple, directly meaningful. Once this is close to 100%, you may not have mastered them forever, but probably don't need to practice more now.

**Visual format**: let's use a progress bar with a count inside or next to it (5/7). Exact details pending visual design.

## Cross-cutting Design Notes

- The adaptive selector already tracks per-item stats (EWMA, seen count,
  last-seen time). The recommendations module has `computeRecommendations()`.
  Both are potential data sources for the progress display.
- Must work across all quiz modes (not just fretboard)
- Should not interfere with the existing state machine phases
- Motor baseline / speed thresholds are per-mode — status should reflect the
  mode's own calibration

## Resolved Decisions

- No explicit stop/move-on recommendations for now — the existing "you've
  mastered these" message is sufficient. Users can see their progress and
  decide when to stop.
- No session summary screen on stop.

# Phasing
This doesn't all need to be implemented at once. Let's sequence this way.

1. Add a quiz header and change "stop quiz" button to "X" at the top of the quiz
1. Add question count and time tracking
1. Reorder elements so controls are above the "question/answer options" space in fretboard and speed tap modes
1. Add progress display

