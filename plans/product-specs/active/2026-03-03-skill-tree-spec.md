

# Goals
- Show skills
    - why they matter
    - especially why automatizing them is important
- show skill relationships
    - what builds on what
    - what's "core", what's specific to genres/instruments
- Build space for progress display and recommendations

# Observations

- users come with different skills
- there are different levels within a skill
    - depth / scope. 
    - how automatic you've gotten
    - it will take months of practice to automatize through repetition.
        -> can start next skills in the meantime.
- have strong defaults, but I don't like locking things.

# Decisions

Structure:
- track (core, guitar, classical, blues, jazz, etc)
    - skill (guitar fretboard, interval <-> semitones, key signatures, chord spelling, etc)
        - levels -- groups of items to automatize. Often have a natural order of complexity.
            - items (non-overlapping between levels)
                - "automaticity" status (not started, hesitant, fast, automatic)
                - "recency relative to stability" -- "needs review?"
            - item status rolls up to level status
        - level status rolls up to skill status
        - can have "custom drill" mode where you pick some subset of items in a skill to practice -- e.g. for fretboard, could be "all notes frets 8-12", or even "everything that I haven't seen in a while"
            - item status rolls up to levels. 
            - this is a more advanced path -- the standard path just follows the level progression. Start with just standard I think.
        - skills come with a description of what "automatic" vs "hesitant" feels like. 
        - Future: if scope for a skill expands a lot, can create Fretboard 1, Fretboard 2, Fretboard 3, each with multiple levels.

- Recommendations
    - items have a speed + freshness
    - groups have a speed + freshness derived from their items (separate spec -- worst(group) seems like a good place to start, but probably too strict).
    - skills ditto
    - skills and levels have aggregate status like "ready to start" derived from the necessary context (e.g. previous skills need to be sufficiently mastered)
    - within a skill:
        - recommends what level to practice
    - across skills:
        - recommends which skills to practice
    - nothing is ever locked -- users can practice anything they wish.


# User stories
- I want to see all the available skills
- I want to focus on skills relevant to my interests.
- I want to understand what a skill is (might be unfamiliar), what automating it gets me.
- I want suggestions for what to work on next

# Phases

## Phase 1: skill tree
1. Show which each skill buys you
1. Tag and organize skills by "track"
1. Pick your tracks. 
    - hides the ones you weren't interested in a collapsed section at the bottom. You can still practice them if desired.

## Phase 2: progress and recs

1. "Groups" -> levels. Not sure group is even in the UI today, but give it a bit more space, sense of progression
1. Show level status within a skill
1. Show level status on home page
1. Recommendations
    - types: "review", "continue", "start". Show in this order.


# Phase 1 details

- Show what a skill gets you as "before" vs "after". e.g.:
    - before:'D major: root, major 3rd = F♯, P5 = A?',  after:'D major: D F♯ A. Em7: E, G, B, D. Next.'
    - before:'7th fret, 3rd string... G, G♯, A, ... D?',  after:'7th fret, G string. D. Next.'
    - concise version always visible, longer animated version that shows the time difference/value of automating? or perhaps a single version is enough. Longer animated can be part of onboarding/marketing/about screens.
- Groups, colors for each "track"
- Logical ordering for each track. Rough prerequisites. Not enforced, but will be useful for recommendation system.

