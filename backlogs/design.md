# Design Backlog

Owner: design workstream
Branch: workstream/design

## Scope

Design tools, visual debt, typography system, component patterns. Things users
might see but won't consciously notice: spacing, sizing, color consistency,
visual feedback, layout polish, mobile UX details.

## Active
- Improving visual design — layout, spacing, component system
- Cleaning up and reorganizing design guides
- Fretboard polish — fret markers, visual clutter. Remove accidentals? Allow not
  showing notes at all?
  - https://claude.ai/code/session_01QcUZoZnGwepxvQhzv5NrSC
  - In-progress mode: show string names; hovers/taps for details (need in other
    modes too)
  - Quiz mode: pointer changes to pointer hand on desktop, but nothing to click
  - plans/design-docs/2026-02-17-fretboard-polish.md
  - -> waiting for web site to come back.

## Backlog

### Visual presentation
- settings page looks terrible.
+ icons for each mode
- fonts too small on mobile
- Key signatures: use unicode sharp and flat symbols (check throughout app)
- Scale degrees: keyboard answers are 1st, 2nd, etc but expects 1, 2, 3 — be
  clearer from UI
- Speed check: show feedback (flash green/red)
- Chord spelling speed check: show progress indicators (which note I'm supposed
  to pick — successful, next, future styling)
- Use musical key signature notation instead of "E major" for scale degrees
- Show actual music notation for key signatures (not just "3 flats")
- Intervals should be displayed piano-style (like notes)
- Buttons wrong size for semitone math and other related modes
- Version number on every screen

### Component system and layout
- clean up component page
  - are they styled identically to real app?
  - remove old variants
- Try stats and fretboard with rectangle tabs instead of small circles
- Round complete state: timeout bar visible (shouldn't be), "11 answers" next to
  timeout bar (shouldn't be there, info is in main card)
- Mode headers design
- Component documentation — visual-design.md has brief patterns, needs expansion
- Visual design iteration workflow — moments.html (build-generated),
  colors.html, and components.html exist; process documented in visual-design.md

### Mobile and interaction
- Either support landscape mode or lock vertical. MVP: lock vertical.
- Double tap currently zooms — it shouldn't (from user feedback)

### Design system and tools
- design/css lint -- look for random hard-coded things (sizes, colors, spaces, etc).
- Color system and brand identity
- CSS standards/patterns (Tailwind?)
- Tailwind to make iteration more local?
- Better design workflow — make sure components are right, iterate locally with
  HTML, CSS, fixtures
- Semitone quiz (needs design attention)
