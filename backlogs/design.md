# Design Backlog

Owner: design workstream Branch: workstream/design

## Active

- Improving visual design — layout, spacing, component system
- Cleaning up and reorganizing design guides
- Fretboard polish — fret markers, visual clutter. Remove accidentals? Allow not
  showing notes at all?
  - https://claude.ai/code/session_01QcUZoZnGwepxvQhzv5NrSC
  - in progress mode:
    - show string names
    - if we're going to have hovers/taps for more details, need that in other
      modes too.
  - in quiz mode:
    - on desktop, pointers changes to pointer hand over fretboard positions, but
      there is no hover or anything to click on.
    - keyboard input needs tweaking -- I usually can't type "G#" fast enough to
      register. Accept 's' or '#' perhaps? And other cleanups for keyboard mode.
      - timing feels awkward -- waiting for second char, so I can't move on.
      - Later -- focus on phone, computer mostly for testing.
    - also keyboard -- escape should get me from quiz mode to main page. later.

  -> waiting for web site to come back.
  plans/design-docs/2026-02-17-fretboard-polish.md

## Backlog

- Quiz view

1. Let's keep "mode" header all quiz states. e.g. "Guitar Fretboard" should be
   visible during quiz, round complete states, and speed check. Put the timeout
   bar elements just below it.
1. selected strings still not persisting across reload -- are we overwriting
   with suggestion? not saving? Logic should be outside UI layer, tested.
1. suggestions should not depend on naturals/accidental toggle, just on your
   recall status. The mode should have some prioritization logic -- in case of
   fretboard, learn all naturals, then add accidentals, then polish everything.
   General rule: Page logic should flow top to bottom.

- Future: We might have multiple suggestions later. e.g. "Learn accidentals on E
  string" & "Solidify A and D strings" at the same time user can pick one or
  both. Later.

1. round complete state:

- see timeout bar, almost but not completely full. No timeout bar should be
  visible.
- next to timeout bar, see "11 answers". Shouldn't be there. We have that info
  in the main card.

- speed tap, fretboard, chord spelling
  - are our stats adjusted by incorrect answers? how?

- semitone quiz

- perhaps give "last question" mode a timeout. Say 30s.
- Color system and brand identity
- UI language -- glossary, etc.
- Component documentation — visual-design.md has brief patterns, needs expansion
- Visual design iteration workflow — moments.html (build-generated),
  colors.html, and components.html exist; process documented in visual-design.md
- Think about, document tone — playful, formal, serious, laid back
- Mode headers design
- Either support landscape mode or lock vertical. MVP: lock vertical.
- Double tap currently zooms — it shouldn't (from user feedback)
- Intervals should be displayed piano-style (like notes)

- BUG: chord spelling. if I'm spelling Bb major, I hsould see flats not sharps
  in the answer menu presumably.

- chord spelling -- let me fix mistakes? Like in speed tap.
  - fancy: show hints after mistake -- like Chord structure.

- move to "algorithms" backlog (engineering I suppose)
  - recommendation engine is not very smart
  - tooling, tests, then alg adjustments
  - also "justification" strings aren't quite right.

## User Feedback (design-relevant)

- "What am I supposed to do?" — onboarding/discoverability
- "What does fluent mean?" — terminology clarity
- Make mistake -> frustrated — help set expectations via UI
- "Why are the recommended strings E & A?" — UI doesn't explain
