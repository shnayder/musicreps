# Quiz IA Polish: Phase 2 — Design Spec

Phase 2 (IA fixes) from the
[Quiz Polish exploration](../../design-docs/2026-02-17-quiz-polish.md). Builds
on [Phase 1](2026-02-17-quiz-flow-polish-spec.md) (flow fixes).

## Overview

The quiz has the right features but the information architecture is sloppy.
Controls lack labels, the practice card is an undifferentiated wall, the
fretboard quiz gives no text prompt, and several elements show up in the wrong
screen state. Phase 2 restructures what appears where — adding labels, grouping
related content, and removing elements that don't belong — so every screen state
has a clear purpose and nothing requires guesswork.

---

## 1. Practice tab: structured card with labeled sections

### Problem

The practice card puts status, recommendation, scope toggles, session summary,
mastery message, and Start button in one flat gray box with no internal
structure. A user scanning the card can't tell where "how am I doing" ends and
"what should I practice" begins. Per _Group related controls_ and _Visual
containers match logical groups_, related controls need to be visually grouped
with clear boundaries.

### Design

Divide the practice card into three labeled zones with visual separation
(spacing, dividers, or subtle background shifts — exact treatment is Phase 4).
The zones correspond to three questions the user is answering top-to-bottom:

**Zone 1: Status** — "How am I doing?"

```
Overall: **Consolidating**. Master current strings before adding more.
12 of 78 items fluent
```

This is read-only context. No interactive elements.

**Zone 2: Scope** — "What should I practice?"

This zone contains the recommendation and the scope toggles. Combining them
makes the connection clear: the recommendation suggests a scope, the toggles let
you accept or customize it.

```
Suggestion: solidify G, D strings — 8 slow items 
            start A string — 13 new items
[Use suggestion]

Strings
[e] [B] [G] [D] [A] [E]        ← toggles
☐ Natural notes only

The "mastery" message ("Looks like you've got this!") appears here when
applicable — it's encouragement tied to the set selection.
```

**Future** master message should be rephrased -- if we're well-calibrated to
only show it when the user really does "got this", it should encourage them to
add more groups, or move to another quiz. Today, I often see it when

The suggestion section explains _why_ those groups are recommended (see section
2 below). The toggles below let the user override.

**Zone 3: Action** — "Go"

```
48 items · 60s
[Start Quiz]
```

Session summary (item count and round duration) sits directly above the CTA.

### Zone separation

Each zone should feel like a distinct section within the card. The exact visual
treatment (dividers, spacing, background tint) is deferred to Phase 4, but the
content grouping and ordering is specified here. At minimum, zones should have
noticeably more spacing between them than within them.

---

## 2. Scope toggles: labeled sections with descriptive groups

### Problem

Group-based modes show toggle buttons with opaque labels like "1,2", "3,4",
"0-1". No section heading explains what dimension is being selected. No
description hints at what's inside each group. The user must memorize group
contents or guess. Per _Label everything_ and _Visualize, don't decode_, every
toggle needs a label that a first-time user can understand.

### Current state by mode

| Mode            | Section heading | Toggle labels                            |
| --------------- | --------------- | ---------------------------------------- |
| Fretboard       | "Strings"       | e, B, G, D, A, E                         |
| Semitone Math   | _(none)_        | 1,2 / 3,4 / 5,6 / 7,8 / 9,10             |
| Interval Math   | _(none)_        | m2,M2 / m3,M3 / P4,TT / P5,m6 / M6,m7,M7 |
| Key Signatures  | _(none)_        | 0-1 / 2 / 3 / 4                          |
| Scale Degrees   | _(none)_        | 1st,5th / 4th / 3rd,7th / 2nd,6th        |
| Diatonic Chords | _(none)_        | I,IV,V / ii,vi / iii,vii°                |
| Chord Spelling  | _(none)_        | _(derived from chord type names)_        |

Fretboard is the only mode that gets this close to right — a heading ("Strings")
and self-explanatory labels (string names). A clearer description for first-time
users may still be helpful: "strings to practice", etc.

### Design

Every mode with scope toggles gets:

1. **A section heading** describing the dimension being selected
2. **Descriptive toggle labels** that tell the user what's in each group
3. **A parenthetical or subtitle** on each toggle showing group contents when
   the label alone isn't enough

Proposed headings and labels:

| Mode            | Heading     | Toggle labels                                      |
| --------------- | ----------- | -------------------------------------------------- |
| Fretboard       | Strings     | e, B, G, D, A, E _(unchanged)_                     |
| Semitone Math   | Distances   | ±1–2, ±3–4, ±5–6, ±7–8, ±9–10                      |
| Interval Math   | Intervals   | m2 M2, m3 M3, P4 TT, P5 m6, M6 m7 M7               |
| Key Signatures  | Keys        | C G F, D B♭, A E♭, E A♭, B D♭ F♯                   |
| Scale Degrees   | Degrees     | 1st 5th, 4th, 3rd 7th, 2nd 6th                     |
| Diatonic Chords | Chords      | I IV V, ii vi, iii vii°                            |
| Chord Spelling  | Chord types | maj, min, dom7, maj7, min7, dim aug hdim7, sus 6th |

**Key Signatures note**: showing the actual key names (C G F) is far more useful
than the accidental count (0-1). The user is practicing keys, not counting
accidentals. The grouping by difficulty is preserved but the labels show what's
actually in each group.

**Interval Math note**: interval name labels are already more descriptive than
semitone math's numeric labels. Adding the section heading "Intervals" provides
sufficient context.

### Fretboard checkbox

Replace "Natural notes only" checkbox with a similar pattern to string
selection: "natural notes" + "accidentals". The user can pick one or both. Same
IA level as the string selector. They both configure what you're practicing, so
treat them similarly. Also gets a label -- "Notes".

Design with space for additional scope configuration later. e.g. we might add a
fret range config, so you can practice all strings, frets 1-5, or accidentals on
frets 9-15, etc. (Not in scope for this change.)

---

## 3. Recommendations: always present, always explained

### Problem

When there's no practice history, the recommendation area collapses to nothing.
New users get no guidance on where to start. When recommendations are present,
they say "Recommended: G, D" without explaining why. Per _State should explain
itself_, every recommendation needs a rationale, and the area should never be
empty.

### Design

**Fresh start (no history):**

The recommendation area shows a default suggestion appropriate to the mode:

```
Suggestion: start with [first group label]
[Use suggestion]
```

Examples:

- Fretboard: "Suggestion: start with E, A strings"
- Semitone Math: "Suggestion: start with ±1–2"
- Scale Degrees: "Suggestion: start with 1st, 5th"
- Chord Spelling: "Suggestion: start with major triads"

The default always points to group 0 — the easiest/most fundamental group. This
follows the existing consolidate-before-expanding design.

**With history — consolidating:**

```
Suggestion: solidify [group] — [N] items need work
            start [next group] — [N] new items
[Use suggestion]
```

The rationale explains _why_: which group needs work and what would be added.
Two-line format when the recommendation includes both consolidation and
expansion.

**With history — all groups fluent:**

```
All [N] items fluent — nice work!
```

No suggestion needed. The mastery message in Zone 3 handles encouragement.

### Recommendation integration with toggles

When the user taps [Use suggestion], the toggles update to match the
recommendation. This already works today — no change to the mechanism, just the
presentation.

---

## 4. Fretboard quiz: add text prompt

### Problem

During fretboard quizzing, the question is a highlighted dot on the fretboard
diagram with no text prompt. The user must infer "identify this note" from
context. The fretboard dominates visually but the small highlight dot is the
only thing that matters. Per _Content hierarchy follows interaction priority_,
the question is priority #1 and should command attention.

### Design

Add a text prompt above the answer buttons during fretboard quizzing:

```
Name this note.
```

The prompt should be brief and consistent — the same text every question, since
the fretboard highlight already shows _which_ note. The purpose is to reinforce
what the user is doing and provide a text anchor for the eye.

The highlight dot size and color are visual concerns deferred to Phase 4.

---

## 5. Active quiz: clean up session info

### Problem

Two issues with the active quiz screen:

**Context label is cryptic.** The session info row shows scope filter shorthand
("±1,2", "E string", "maj") that reads as jargon. Per _Label everything_, labels
should be self-interpreting.

**Progress bar is ambiguous.** "0 / 48 fluent" during a quiz could mean this
round or all-time. It's all-time, but the mid-quiz context is confusing. Per
_Minimize chrome during quiz_, overall fluency isn't relevant during the
question-answer loop.

### Design

**Replace the context label** with a readable one-line description of what's
being practiced. The description should be a complete phrase, not filter
shorthand:

| Mode            | Current         | New                              |
| --------------- | --------------- | -------------------------------- |
| Fretboard       | "G, D strings"  | "G, D strings" _(already clear)_ |
| Semitone Math   | "±1,2, ±3,4"    | "±1–4 semitones"                 |
| Interval Math   | "m2,M2, m3,M3"  | "m2–M3 intervals"                |
| Key Signatures  | "D, Bb, A, Eb"  | "D, B♭, A, E♭" _(already clear)_ |
| Scale Degrees   | "1st,5th, 4th"  | "1st, 4th, 5th degrees"          |
| Diatonic Chords | "I,IV,V, ii,vi" | "I, IV, V, ii, vi chords"        |
| Chord Spelling  | "maj, min"      | "major, minor triads"            |

The goal is a phrase that would make sense to someone glancing at the screen for
the first time.

**Remove the progress bar** from the active quiz phase. Overall fluency is
useful on the Practice tab and round-complete screen, not mid-quiz. This reduces
chrome during the question-answer loop per _Minimize chrome during quiz_.

---

## 6. Round-complete screen: structured IA

### Problem

The round-complete screen shows three numbers floating in space ("8 / 9
correct", "1.2s median", "5 / 78 fluent") with no context about what was being
practiced, and the fluency stat is confusingly placed. Per _Visual containers
match logical groups_, the screen needs clear structure.

### Design

Three sections, top to bottom:

**Context** — what we were practicing (carried over from active quiz):

```
G, D strings · 12 / 78 fluent
```

Scope label + overall fluency. Fluency belongs here (tied to the scope, not the
round) rather than mixed in with round stats.

**Round summary** — what happened this round:

```
Round complete

5 / 9 correct · 63s
2.8s median response time
```

Round stats are about this round only: correct count, total round time
(including last-question wait from Phase 1), and median response time. These are
clearly round-scoped because they're under the "Round complete" heading.

Remove the round number for now. It's not a boxing match, and there's no round
target.

**Actions:**

```
[Keep Going]  [Stop]
```

Unchanged from today.

### What changes from current

- Fluency moves from a round stat box to the context line at top
- Round stats become natural-language lines instead of three equal-weight boxes
- Round duration displayed (currently missing — only correct and median shown)
- Context label (scope description) persists from active quiz to round-complete

---

## 7. Countdown bar and time display

### Problem

The depleting bar and the numeric timer both show time remaining — two
representations of the same data. Per _One way to do each thing_, this is
redundant. However, each serves a different purpose: the bar is glanceable at a
distance, the number is precise.

### Design

Keep both but visually connect them so they read as one element rather than two
independent displays. The timer text should feel like a label _on_ the bar, not
a separate data point in the session info row.

Exact visual treatment (positioning, typography) is deferred to Phase 4. The IA
decision is: **the timer text moves from the session info row to adjacent to the
countdown bar**, making the connection between bar and number obvious.

The session info row then contains only: context label + answer count + ×
button.

---

## Updated screen states

### Practice tab (idle)

```
← (back)  |  Mode Title

[Practice]  [Progress]

┌─ Practice Card ─────────────────────────┐
│                                         │
│ Status                                  │
│   Overall: Consolidating.               │
│   Master current strings before         │
│   adding more.                          │
│   12 of 78 items fluent                 │
│                                         │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│                                         │
│ Scope                                   │
│   Suggestion: solidify G, D strings     │
│               — 8 slow items            │
│               start A string            │
│               — 13 new items            │
│   [Use suggestion]                      │
│                                         │
│   Strings                               │
│   [e] [B] [G] [D] [A] [E]              │
│                                         │
│   Notes                                 │
│   [natural] [accidentals]               │
│                                         │
│   (mastery message when applicable)     │
│                                         │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│                                         │
│ Action                                  │
│   48 items · 60s                        │
│   [Start Quiz]                          │
│                                         │
└─────────────────────────────────────────┘
```

Note: "Status", "Scope", "Action" are zone names for this spec — they may or may
not appear as visible headings. The section heading for toggles ("Strings",
"Distances", etc.) does appear.

### Active quiz

```
───────── countdown bar (depleting) ─────────  0:42
Context label | 5 answers | ×

Question prompt (text or fretboard + "Name this note.")
Answer buttons
Feedback
```

Changes from current: progress bar removed, timer text moved adjacent to
countdown bar, context label is a readable phrase.

### Round-complete

```
───────── countdown bar (empty) ─────────  0:00
G, D strings · 12 / 78 fluent

Round complete
5 / 9 correct · 63s
2.8s median response time

[Keep Going]  [Stop]
```

---

## Scope

### In scope

- Practice card: three-zone structure with zone separation
- Scope toggles: section headings for all group-based modes
- Scope toggles: descriptive labels (Key Signatures labels change to key names)
- Recommendations: always present with rationale text; default for fresh start
- Fretboard quiz: add text prompt during active phase
- Context label: readable descriptions replacing filter shorthand
- Progress bar: remove from active quiz phase
- Round-complete: restructure with context line, natural-language round stats
- Timer text: move from session info row to adjacent to countdown bar

### Out of scope

- Visual treatment of zone separation (dividers, backgrounds) — Phase 4
- Fretboard highlight dot size/color — Phase 4
- Button layout changes (piano layout for non-fretboard modes) — Phase 3
- Empty space / vertical centering — Phase 3
- Round-complete card/background treatment — Phase 3
- Countdown bar size/color/animation — Phase 4
- "Advanced" section removal — already in Phase 1

---

## Resolved decisions

- **Practice card zones**: three zones (status → scope → action), not two or
  four. Status and recommendation were considered as separate zones, but
  recommendation is tightly coupled to scope toggles (it suggests a scope), so
  they belong together.

- **Recommendation always present**: show a default suggestion on fresh start
  rather than collapsing the area. The default points to group 0 for every mode
  — consistent with consolidate-before-expanding.

- **Recommendation rationale**: include brief explanation ("8 items need work",
  "13 new items") rather than just naming groups. The user should understand
  _why_ without consulting the progress tab.

- **Key Signatures toggle labels**: show key names (C G F) rather than
  accidental counts (0-1). The user is learning keys, not counting accidentals.
  The pedagogical grouping by difficulty is preserved in the toggle ordering.

- **Fretboard text prompt**: use a fixed prompt ("Name this note.") rather than
  a dynamic one ("What note is at string 3, fret 5?"). The fretboard already
  shows the specific note — the text prompt's job is to anchor attention and
  reinforce the task, not duplicate information.

- **Progress bar removal**: remove from active quiz entirely rather than
  relabeling. Mid-quiz fluency is neither actionable nor clearly scoped. Fluency
  appears on the round-complete screen's context line where it has clear
  meaning.

- **Round duration**: include total time (with last-question wait) rather than
  just timer duration. The user experienced 63 seconds, not 60 — showing the
  real time is more honest and connects to the Phase 1 "last question" signal.

- **Timer text placement**: move adjacent to countdown bar rather than keeping
  in session info row. Two representations of the same data should be visually
  adjacent so they read as one element. The session info row simplifies to
  context + count + close.

- **Countdown bar + timer kept**: despite redundancy, both serve distinct
  purposes (glanceable vs. precise). The fix is visual connection, not removal.
