# Feature/improvement ideas

This is a categorized, semi-prioritized list of things we _could_ work on.
Things move from here to the backlog.

# Inbox

(To clean up, triage, categorize)

- dev: periodic git cleanup. v0: Remove merged feature branches.

  - Show effort
    - how much you've practiced this mode today
    - how much you've practiced across all modes today
    - practice over time
  - show progress
    - response time trends or similar
    - modes started -> mastered
- Landing screen.
  - Follow up in new session. claude/redesign-navigation-menu-xpSD4 at
    plans/product-specs/2026-02-13-landing-screen.md.

- Project timeline report/viz/analysis. Typically see slowdown with complexity,
  polish. Let’s see.

- mode headers
- full-screen modes, no header. Part of home screen revamp I suppose.
- think about, document tone -- playful, formal, serious, laid back, .... For
  imagery, colors, typography, UI language, marketing, etc.

3. No UX glossary — layout-and-ia.md has one term ("fluent"). Needs more: mode,
   quiz, round, item, fluent vs mastered, recall vs speed, etc.
4. Roadmap fragmentation — vision.md roadmap, ideas.md, backlog.md all have
   overlapping content with different structures. Could consolidate but that's a
   separate effort.
5. Visual design iteration workflow — moments.html (build-generated),
   colors.html, and components.html now exist with process in visual-design.md.
6. Component documentation is thin — visual-design.md has brief component
   patterns. Could expand as part of the design system work.

https://code.claude.com/docs/en/memory -- use this structure for rules, etc.

Anne requests:

- RT distributions are skewed, take median, not mean. Use median instead of
  ewma?
- RT variability goes down as you get better -- can use that as a measure of
  progress perhaps

- too much copy+paste between quizzes. More shared structure with options or
  injection of differences?

  ⎿  Tip: Working with HTML/CSS? Add the frontend-design plugin:\
  /plugin marketplace add anthropics/claude-code /plugin install
  frontend-design@claude-code-plugins

# Small bugs to batch fix

- speed check:
  - fretboard speed check should show and test all notes, including accidentals.
    Shouldn't depend on the quiz setting.
  - notes <-> semitones speedcheck should probably reuse the fretboard one
    (currently has table of notes.)
  - does interval selection need a different speed check than note selection?
    - Feels like right abstraction is something like "Choose specified one of N
      ordered buttons" / "Choose multiple" / "Choose from an unordered set" /
      "Choose fret or frets on a guitar", etc. If I know how fast you can pick
      out F#, that's probably close enough to how fast you can pick m6. (could
      test if I have metrics some day).
  - general: show feedback. If I hit the right note, flash it green or something
    before moving on. If I hit the wrong one, flash it red, say "try again" (and
    restart the timer).
    - Chord spelling extension: show progress, which one I'm supposed to pick.
      e.g. E D F E — when I'm supposed to press F, E and D should be styled
      "successful", F should be "next", E should be "future".
      - why are there 2-note chords in the speed check here?
    - if we're assuming speed is N*single-note speed, then we don't need a
      separate speed check.

- intervals should probably be displayed the same way as notes (will that scale
  if I extend to > octave?), piano style

# Design and Dev workflow

- set up notifications when web mode finishes what it's doing.
  https://justin.searls.co/posts/notify-your-iphone-or-watch-when-claude-code-finishes/
- review and improvement process after every feature or few features, ditto bug
  fixes
  - how could we have prevented this bug from being introduced in the first
    place?
  - how could we have caught this bug using build-time tools (tests, linter)
  - how could this feature have been easier to design and implement? Missing
    patterns, component libraries, principles, etc.
- process improvements
  - make sure we have a spec for new features
    - have a product spec review checklist
      - use it every time
      - make a command, just like code review
  - post-merge clean-up checklist, trigger.
    - I check that it works well, merge it (don't want to wait)
    - then we check that all the docs are up to date, look for tech debt, etc.
    - add a cleanup PR if needed.
- regular code review
- P2. Testing on a branch —- I can run dev server locally, but when I'm on my
  phone I have to merge
- Fix GH auto review config, see if I can get Claude to wait or get an event and
  automatically reply.
  - also improve GH code review instructions
- Make a project timeline report/viz/analysis. Typically see slowdown with
  complexity, polish. Let’s see if we can speed-up instead by adding more and
  more structure, guidance, tooling, context.
- Use GH issues for backlog to make it more organized? Integrate with Claude?
- Tune local sandboxing. https://code.claude.com/docs/en/sandboxing
- Use up weekly token budget. If have extra, have backlog of tasks to run.
  Someone must have written this utility already.

- size plans using XS-L. e.g. see 2026-02-13-visual-design-plan.md anything >L
  needs to be split up

- linter
- UX
  - standards, heuristics
  - process -- design docs with ascii art, before/after screenshots, etc.
  - color system. Brand.
  - component system
  - css standards, patterns. Tailwind?
  - glossary for user-facing terms (quiz? recall? speed? mode? exercise? item?
    etc etc)
  -
- product vision guidance
- workflow process: design phase, implementation plan, implementation, review
  - https://openai.com/index/harness-engineering/
- doc management

- test — https://nativebridge.io/pricing

# Music

## Display

- more fretboard polish -- e.g. show fret markers

## Math modes

Use a piano or fretboard control for responding. On guitar, pick a string, or
allow any string. Or ask about specific notes using treble clef/etc, and require
the user to find the note in the the correct octave.

## key signatures

- show actual music notation, not just "3 flats"

## scale degrees

- cleaner question format -- "1st of E major = ?" is not ideal. Is there a
  standard notation?
- use musical key signature instead of "E major"?
- handle minor keys

## diatonic chords

- response should match options. If I'm supposed to hit "A#/Bb", don't say "Bb
  major" as the correct answer

## chord spelling

- TBD: if I get a note wrong, should we flash it red and let me re-enter? for
  now, just keep going and see right answer at the end.
- reverse direction

## Modes to consider adding

- **Relative major/minor** — "Relative minor of Eb?" → Cm. Simple but needs to
  be instant. 12 items, bidirectional. Could be a small mode or bundled with key
  signatures.
- **Chord tones on fretboard** — "Where is the 3rd of Am on the G string?" →
  fret 2 (B). This directly connects theory to finger positions. Combines your
  existing fretboard knowledge with chord spelling. This is the "killer app" for
  bridging theory and playing.
- **Common chord relationships / transposition** — "Transpose Am-F-C-G from C to
  E" → C#m-A-E-B. Or simpler: "F is what numeral in the key of Bb?" → V.
  Practical for jam sessions and learning songs in new keys.

- **Musical modes** — "4th mode of C major?" → F Lydian. "D Dorian has what
  notes?" This matters once you start improvising over chord changes, but it
  builds on scale degrees so it's a natural progression.
- **Pentatonic scale notes** — "A minor pentatonic?" → A C D E G. Guitarists
  live in pentatonics, and knowing which notes are in/out helps escape box
  patterns.
- **Circle of fifths navigation** — "Two fifths up from Bb?" → C. "Three fourths
  up from E?" → A. Helps with key changes and understanding chord movement.

# Memory/cog sci

## response time handling

- bug: speed tap doesn't seem to have warmup
- bug: interval/note <-> semitones warmup has too many options. Don't need both
  notes and numbers
- consider switching from EWMA to median over recent window (RTs are usually
  log-normally distributed apparently)

- ** explain recall stats, give hint whether low values are due to likely
  forgetting or slow speed

## cold start for non-novice

- mark areas as "I know this", or "fast test mode" or something

## sequencing, prioritization, recommendation.

Duo-path style, or cadence-like levels, or something else?

# Behavior guidance/gamification

- Timing
  - track how long I've been doing a quiz, how long I practiced overall today
    - time and # of questions
      - for time, handle long pauses somehow
  - streaks/practice log
  - reminders

# Polish

- visual style.
  - Colors, sizes, fonts. Brand.
  - Don't use red/green scales

- speed check should be styled as a secondary action
- landscape mode (or lock vertical)

## Explanations

- No explanation that orange border means "recommended"
- Brief descriptions of each mode

# Public release

- better name.
  - Reflex Music (other ideas:
    https://claude.ai/chat/54e6f967-1fc9-4843-bced-2185f64fe0ce)
- iOS / android support.
- marketing materials in-app
- landing page
- marketing materials
  - website
- LLC? or personal business enough? needs a name
- intro / landing screen
- feedback loops (email, bug reports, feedback)
- monetization plan

## competition

- fretboard forever
- fermata
- earmaster (not really)
- music theory by justin guitar
- cadence
- fretzl
- anki et al
