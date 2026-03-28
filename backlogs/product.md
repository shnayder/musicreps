# Product Backlog

Owner: product workstream
Branch: workstream/product

## Scope

User-facing improvements: features, UX flows, content, user-visible behavior,
new modes, public release planning. If a user would notice and care, it belongs
here.

## Prioritization principles
1. Make it work for me: major usefulness or usability blockers first
2. Validate big risks or unknowns early (e.g. app store, overall approach)
3. Ongoing process and tech improvements — pull in small ones regularly

## Goals
1. Reach acceptable usability for fretboard mode — getting close
2. Reach acceptable layout, UI design -- still work to be done
3. Reasonable recommendation system so I can just hit "next" and get reasonable behavior at per-skill, cross-skill level
4. Basic progress/usage tracking. I want to feel good that I'm using the app "enough", see what I'm learning
5. Derisk testflight iOS app
6. make my life reviewing and guiding agents easier, aiming to make the agents more autonomous

## Active
- UX glossary — mode, quiz, round, item, fluent vs mastered, recall vs speed
- Roadmap cleanup

## Bugs
- single-group modes should have a progress bar on practice tab

- BUG: 6# not getting recognized in key signatures mode
- BUG: chord spelling — if I'm spelling Bb major, should see flats not sharps
  in the answer menu
how 

## Backlog


### Global views
- Skill tree
  - what are all these skills? 
  - why is it worth automatizing them?
  - how do they build/relate to each other?
- Show status/progress on skills
- Show effort:
  - how much have I practiced today? 
  - how much have I practiced ever, over time?
  - "Have I practiced long enough?" — question count, coverage, recall status
- Show progress
  - response time trends, modes started -> mastered
- Cold start for non-novice: what do you already know (and how well)? or fast-test mode.
- "What should I work on next" recommendation
- Chord spelling — let me fix mistakes (like speed tap)
  - Fancy: show hints after mistake — e.g. chord structure
- Think about, document tone — playful, formal, serious, laid back, etc.
  For imagery, colors, typography, UI language, marketing.
- before->then->then->after learning progressions for modes. Show the shortcuts along the way. Maybe later.


### Mode specific
- Diatonic chords: response should match options (A#/Bb vs "Bb major")
- Chord spelling: if wrong note, flash red and re-enter vs keep going
- Chord spelling: reverse direction
- Fretboard speed check should test all notes including accidentals
- Notes <-> semitones speed check should reuse fretboard speed check #review
- speed tap really needs keyboard on non-touch devices, and string by string responses. Not really necessary, but painful to test without it. or perhaps just e8 for 8th fret of e string (fine to count for both e strings.), g12, etc.


### Algorithms, cog sci

- show stability/freshness in some way, so I can understand why things look stale
- group diagnostic model needs update if I'm going to use again (still has "working", etc.)
- RT tracking: Consider switching from EWMA to median over recent window (RTs log-normal)
- RT variability goes down as you get better — use as progress measure
- Speed tap, fretboard, chord spelling — are stats adjusted by incorrect
  answers? How?
- Recommendation engine is not very smart — tooling, tests, then alg
  adjustments
- Recommendation "justification" strings aren't quite right
- review speed check design, system

### User Feedback
- "What am I supposed to do?" — onboarding/discoverability
- "What does fluent mean?" — terminology clarity
- Make mistake -> frustrated — help set expectations via UI
- "Why are the recommended strings E & A?" — UI doesn't explain
- It showed 6/8 fluent yesterday, now showing 2/8. What the heck? 

### Musical extensions/improvements
- Handle minor keys in scale degrees
- Relative major/minor
- Chord tones on fretboard
- Common chord relationships / transposition
- Musical modes (Dorian, Lydian, etc.)
- Pentatonic scale notes
- Circle of fifths navigation

## Public Release
- Finalize name
- iOS support
- Android support
- Review code license
- Monetization plan
- Marketing materials, landing page
- Required docs -- privacy policy, etc
- Intro/landing screen
- Feedback loops (email, bug reports)
