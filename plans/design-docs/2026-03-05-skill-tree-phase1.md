# Skill Tree Phase 1 — Design

**Date:** 2026-03-05
**Status:** Draft
**Implements:** [skill-tree-spec.md Phase 1](../product-specs/active/2026-03-03-skill-tree-spec.md#phase-1-details)

## Goal

Replace the flat list of modes on the home screen with a skill tree that:

1. Shows users what each skill gets them (why automatize this?)
2. Organizes skills into tracks (core theory, guitar, etc.)
3. Lets users pick their tracks (focuses the list, never locks anything)

The home screen today is a simple list of 11 buttons grouped by rough category
(Fretboard, Theory Lookup, Calculation, Keys & Chords). It works for someone
who already knows what they want. It doesn't help someone answer "what should I
learn?" or "why does this matter?"

---

## Tracks

Tracks are interest-based groups. A guitarist doesn't need ukulele skills, and
vice versa. Core theory is shared.

| Track | Color | Skills |
|-------|-------|--------|
| Core | (neutral/default) | Note <-> Semitones, Interval <-> Semitones, Key Signatures, Semitone Math, Interval Math, Scale Degrees, Chord Spelling, Diatonic Chords|
| Guitar | (warm) | Guitar Fretboard, Speed Tap |
| Ukulele | (cool) | Ukulele Fretboard |

> **App guiding principle**: if you want to be a serious musician, you should just learn the core skills. You'll be
> happy you did, and automating all that is a better use of your time than scrolling on social media. If you don't
> agree, there are tons of other music apps out there.

> **Future:** In the future, we can add a group for more advanced theory,blues, jazz, classical, perhaps pop.

### Track selection

- First visit: user picks tracks. Simple multi-select with brief explanation
  of each track. 
- Subsequent visits: selection persists, visible as track chips on home screen. 
- Non-selected tracks are hidden in a collapsed "Other skills" section at the bottom.
  Tappable, not locked. This follows the "guide, don't gate" principle.

---

## Skill cards

Each skill (mode) gets a card on the home screen. The card communicates:

1. **Name** — what it is
2. **One-line description** — what practicing this does for you (already exists
   as `MODE_DESCRIPTIONS`)
3. **Before / After** — the key differentiator. Shows the contrast between
   knowing something haltingly vs. automatically.
4. **Track badge** — small colored indicator showing which track it belongs to

### Before / After

This is the heart of the Phase 1 value proposition. A user who's never heard
of "Semitone Math" should look at the card and think "oh, I want to be the
'after' person."

**Format:** Two short lines contrasting the thought process.

| Skill | Before | After |
|-------|--------|-------|
| Guitar Fretboard | "7th fret, G string... G, G#, A... D?" | "7th fret, G string. D." |
| Note <-> Semitones | "G#... G is 8, so G# is... 9?" | "G#. 8." |
| Interval <-> Semitones | "Major 6th... that's... 9 semitones?" | "M6. 9 semitones." |
| Semitone Math | "F# + 4... G, G#, A, A#... Bb?" | "F# + 4. Bb." |
| Interval Math | "C + m6... minor 6th is 8 semitones... Ab?" | "C + m6. Ab." |
| Key Signatures | "3 flats... Bb, Eb, Ab... so Eb major?" | "3 flats: Eb major." |
| Chord Spelling | "Fm7... F, Ab, C... what's the 7th... Eb" | "Fm7. F Ab C Eb." |
| Scale Degrees | "5th degree of Bb... Bb, C, D, Eb, F... F?" | "5th of Bb. F." |
| Diatonic Chords | "IV in G... G, A, B, C... C major?" | "IV in G. C major." |

**Visual treatment:**

- Before text is styled to convey hesitation — perhaps lighter, with ellipsis
  naturally embedded in the wording.
- After text is styled to convey confidence — bolder, crisper.
- The contrast should be immediately legible, not requiring close reading.

> **Open:** How much space can this take? On mobile, each card needs to fit
> comfortably without scrolling the home screen into a mile-long list. Options:
>
> a. **Always visible** — before/after shown directly on the card. Compact but
>    adds height to every card. Try this first, putting before on left, after on right. 
> b. **Expandable** — card shows name + one-liner by default. Tap to expand
>    and see the before/after. Keeps the list compact. Loses the "at a
>    glance" value.
> c. **Detail screen** — tap a card to see a skill detail view with the
>    before/after prominently displayed plus (future) progress. Cleanest home
>    screen but adds navigation depth.
>
> Leaning toward (a) for now — the before/after IS the pitch. Hiding it behind
> a tap defeats the purpose. But we need to prototype the height.

---

## Home screen layout

### Structure (top to bottom)

1. **Header** — "Music Reps" + tagline (existing)
2. **Track chips**. "Core" always selected. Others can be toggled on and off, control visibility.
3. **Skills list** — cards grouped by track, within each track ordered by
   rough learning progression (prerequisites first)
4. **"Other skills" section** — collapsed `<details>` containing groups of skills for
   unselected tracks. Label: "Other skills".
5. **Footer** — settings link, version (existing)

### Track chip behavior

- Chips show track name + optional icon/emoji
- Multi-select: user can pick any combination of non-core tracks.
- "Core" is always selected
- Selection persists in localStorage
- Deselecting a track moves those skills to the collapsed section

### Within-track ordering

Skills within a track are shown in a recommended learning sequence. This isn't
enforced, but the visual order communicates "start here, then this." 

**Guitar track example:**

1. Guitar Fretboard — the foundation
2. Speed Tap — builds on fretboard knowledge

**Theory track example:**

1. Note <-> Semitones — the numbering system
2. Interval <-> Semitones — names for the numbers
3. Semitone Math — applying the numbers
4. Interval Math — applying the names
5. Key Signatures — the key system
6. Scale Degrees — notes within keys
7. Diatonic Chords — chords within keys
8. Chord Spelling — building any chord

> **Open:** Should ordering be more explicit? E.g., a subtle connector line
> between cards, or a "builds on: Fretboard" note? Or is positional order
> enough? Start with positional order only — keep it simple, add
> connectors if users are confused about sequence.

---

## Card design

### Default (idle) state

```
  ┌────────────────────────────────────────────────────────┐
  │ Guitar Fretboard                               [Guitar]│
  │ Stop hunting for notes                                 │
  │                                                        │
  │ Before:                        After:                  │
  │ "7th fret, G string...         "7th fret, G string. D."|
  | G, G#, A... D?"                                        │
  └────────────────────────────────────────────────────────┘
```

- Track badge is a small colored chip (top-right or inline with name)
- Description text is the existing `MODE_DESCRIPTIONS` line
- Before/after lines use distinct typography to convey the contrast
- Tapping anywhere on the card navigates into the mode (same as today's
  buttons)

### Compact variant (if height is a problem)

```
  ┌─────────────────────────────────────┐
  │ Guitar Fretboard            [Guitar]│
  │ Stop hunting for notes              │
  │ "...G, G#, A... D?" -> "D."        │
  └─────────────────────────────────────┘
```

Single-line before/after with arrow. Loses some punch but saves vertical
space. Could use this for skills in non-primary tracks or after the user has
seen the expanded version.

This same information should be at the top of the skill (aka "mode") screen once the user selects it.

---

## First-visit experience

Let's keep it simple -- just have all tracks selected for now. User can deselect whatever they aren't interested in. Later we might have a simple "what do you want to work on?" screen, when there are more tracks and skills to look at.

This should be lightweight — a few taps, not a multi-step wizard. The user
should be drilling within 15 seconds of opening the app for the first time.
(Design principle #4: minimal friction.)

---

## Color system for tracks

Each track gets a color used for:

- Track chip fill when selected
- Track badge on skill cards
- Section divider or subtle background tint for grouped cards

Colors should be distinct from semantic colors (green/red for correct/wrong)
and from heatmap colors (green-to-gold for speed). Use the existing palette
where possible.

| Track | Candidate color | Rationale |
|-------|----------------|-----------|
| Core | `--color-text-muted` or neutral | Not an "interest" — it's shared |
| Guitar | warm tone | Guitar = warm wood, familiar |
| Ukulele | cool/teal | Distinct from guitar |

> **Open:** Exact values TBD. Need to extend the CSS custom property system.
> Check contrast on both light background and dark mode (if/when).

---

## What this doesn't include (Phase 2+)

- Progress display on skill cards (fluency %, status labels)
- Level progression within skills
- Cross-skill recommendations ("start this next")
- Prerequisite enforcement or visual prerequisite chains
- Animated before/after (the "longer animated version" from the spec — good
  for onboarding/marketing, not Phase 1 home screen)

---

## Design principles check

| Principle | How this design addresses it |
|-----------|----------------------------|
| Minimal friction (#4) | Track selection is 1-2 taps. No login, no wizard. |
| Guide, don't gate (#9) | Unselected tracks are collapsed, never locked. |
| Fewer options (#6) | Tracks reduce the visible list without removing access. |
| Label everything (UX #4) | Cards have name, description, and before/after. |
| Action gravity (UX #13) | Cards are the primary action — tap any card to start. |
| One screen, one intention (UX #11) | Home screen = "pick what to practice." |
| Data abstraction (UX #15) | Summary (card) before detail (mode screen). |

---

## Open questions summary

3. **Card height on mobile** — need to prototype. Can 4-5 cards fit on a
   screen with before/after visible?
7. **Track colors** — exact values, contrast requirements.
