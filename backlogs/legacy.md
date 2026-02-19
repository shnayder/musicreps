# Legacy Backlog (archived)

This is the original monolithic backlog.md, preserved for reference. Content has
been distributed to the workstream-specific backlogs:

- backlogs/product.md
- backlogs/design.md
- backlogs/engineering.md
- backlogs/process.md

---

# Prioritization principles

1. Make it work for me: major usefulness or usability blockers for me first

- https://claude.ai/code/session_017bkZMbMGMKLvhm8EuMyHc9

1. Validate big risks or unknowns early -- e.g. what does it actually take to
   get into the app store. Will overall approach work.
1. Ongoing process and tech improvements -- pull in small ones regularly, larger
   ones every once in a while.

# Goals

1. Reach acceptable usability for fretboard mode — getting close.
1. Reach acceptable layout, UI design — just starting
1. Derisk testflight iOS app
1. Make agents more autonomous in extending the app: engineering, design,
   product direction.

# In progress (WIP=3 major features, lots of bug fixes)

1. Joint work:
1. Improving the visual design of the app -- layout, spacing, component system
1. Building tools for quickly iterating on visual design, likely similar to
   colors.html
1. Cleaning up and reorganizing the guides around product vision and design

Gaps to Flag (not addressed in this PR, but noted)

1. Product vision is thin — the [NEEDS INPUT] placeholder needs real content:
   who is this for, what does mastery look like, what's the end state. Currently
   just 2 sentences.
2. No tone/personality guidance — ideas.md mentions "think about, document tone"
   but nothing exists yet. Should cover UI language, imagery feel, etc.
3. No UX glossary — layout-and-ia.md has one term ("fluent"). Needs more: mode,
   quiz, round, item, fluent vs mastered, recall vs speed, etc.
4. Roadmap fragmentation — vision.md roadmap, ideas.md, backlog.md all have
   overlapping content with different structures. Could consolidate but that's a
   separate effort.
5. No visual design iteration workflow — colors.html and components.html exist
   but no documented process for using them.
6. Component documentation is thin — visual-design.md has brief component
   patterns. Could expand as part of the design system work.

Issues.

- Guitar fretboard page
  - practice tab
    - layout

# Backlog (Limit 5-10)

1. Fretboard quiz mode usability improvements

- Need a "finish this question" state when timer runs out
-

BUG: notes <-> semitones: A# not accepted for 10 -- said "Bb" NIT: notes <->
semitones: keyboard input for accidental resolution. If the answer is C and I
type C, don't wait for accidental — just mark it correct immediately.

1. (Hold) Home screen: what skills exist, what's my status on each
1. What should I work on next recommendation?
1. Have I practiced long enough? How many questions, what's my coverage + recall
   status?

Key signature mode:

- use unicode sharp and flat symbols (check throughout the app)
- 6# not getting recognized. In general, keyboard mode for multi-char input
  needs to be cleaned up. Show chosen or in-progress answers perhaps. (or drop
  keyboard entirely)

1. Scale degrees, keyboard. answers are 1st, 2nd, etc, but expects 1,2,3. Makes
   sense, but could be clearer from UI.

1. Diatonic chords, keyboard: I, ii, iii, etc. Not working. Need design if we're
   going to support it.

# Done log

1. Separate mode setup, stats, and quiz — land it
1. CSS / component design smell again. Let's do another review.
1. TWEAK: "You've got this" threshold is too low -- I don't feel like I got
   this -
1. Code review command, agent. Needs testing.
1. BUG: Progress bar from plans/product-specs/2026-02-12-mid-quiz-status-spec.md
   not showing up
1. timeouts to keep user moving, push for automatization
1. Color improvements v1.

- needs review, tweaks -- visual, explanation of progress bar

1. Time pressure system improvements.
