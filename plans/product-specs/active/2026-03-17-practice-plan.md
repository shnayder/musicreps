# Skill Screen Redesign

## Terminology note:

We haven't done the full cleanup yet, so there are confusing terms around. Let's use these:

- Skill. Listed on the home screen. Guitar fretboard, semitone math, etc.
  - Level. Corresponds to a set of Items. There is an order of levels, in a
    logical learning progression. (Aka "Group" in earlier docs and still in the
    code in places.)
  - Single-level skill. A skill with only one level (all items in one pool).
    These include Note↔Semitones, Interval↔Semitones, and Speed Tap. No
    level selection is needed — the user just hits Practice.

## Summary

The skill screen (practice tab + progress + about) is on the critical path and
needs to be cleaner, faster, and more opinionated. Key changes:

- Simplified header with progress bar instead of subtitle
- Tabs move to bottom nav on mobile (top on desktop)
- Practice tab splits into Suggested (zero decisions) and Custom (manual toggles)
- Per-level progress bars move from Practice to Progress tab
- Single-level skills skip config entirely

## Current State

(Screenshots to be linked.)

### Problems with current design

**Ambiguous primary action** — Accept vs Practice vs selecting levels are three
competing paths. The user has to figure out which one matters.

**Suggestion isn't dominant** — The recommendation engine is the product's
strength, but the suggestion card is visually secondary, sandwiched between
status and the level list.

**Too much noise** — Stack of gray progress bars for unstarted levels. Unclear
toggle labels ("B e ♯♭", "iii,vii°"). The "..." menu is mysterious.

**Unclear interaction model** — Level rows look selectable but the consequences
of tapping are unclear. "Accept" doesn't explain what it does. The Practice
button doesn't say what it will practice.

**Weak feedback** — Progress bars lack context. "3/78 positions automatic" is
abstract without framing. No per-level completion signals.

---

# Proposal

## 1. Screen Structure

```
┌─────────────────────────┐
│ Header                  │
│  Title + [X]            │
│  Progress bar           │
├─────────────────────────┤
│                         │
│ Tab content             │
│  (Practice / Progress   │
│   / About)              │
│                         │
├─────────────────────────┤
│ ○ Practice ○ Progress   │  ← bottom nav (mobile)
│ ○ About                 │
└─────────────────────────┘
```

On desktop (≥768px), nav moves to top as horizontal tabs with icons + text.

---

## 2. Header

**Elements**
- Title: skill name (e.g., "Guitar Fretboard")
- Close button (X)
- Skill progress bar (same one shown on home screen cards)

**Changes from current**
- Subtitle ("Master the fretboard — identify any note on any string") moves to
  About tab
- Progress bar replaces the old status summary (e.g., "3/78 positions automatic")

**Notes**
- Idle state only — during a quiz, the existing quiz header takes over
- Static across all tabs when idle — always visible
- Progress bar gives at-a-glance skill status without text
- Same segmented multi-group bar as home screen (each segment = one level,
  colored by speed × freshness). Tap-to-explain modal out of scope here.

---

## 3. Navigation

**Tabs**
- Practice (default)
- Progress
- About

**Mobile (< 768px)**
- Standard bottom tab bar with icons + labels
- Fixed to viewport bottom

**Desktop (≥ 768px)**
- Horizontal tabs at top, below header, with icons + text

**Icons**
- Practice: small logo variant (reinforces the "repeat" theme)
- Progress: bar graph
- About: info circle

**Behavior**
- Switching tabs preserves all state (mode selection, level toggles)
- Active tab visually indicated

---

## 4. Practice Tab

### 4.1 Overall Structure

For skills with levels:

```
Practice config
  Section label
  Suggested / Custom toggle
  [Mode-specific content]

Action button
```

For single-level skills:

```
(No config — nothing to choose)

Action button
```

---

### 4.2 Practice Config Header

- Section label (e.g., "Practice setup" — exact wording TBD)
- Suggested / Custom segmented control

**Behavior**
- Suggested is the default
- Toggle persists per skill
- Switching does not auto-start practice

---

### 4.3 Suggested Mode

**Content**
- One or more suggestion lines, each: `{verb} {level(s)}`, grouped by `{verb}`
- Examples:
  - "Review E string"
  - "Start A string"
  - "Keep practicing G and B strings"

**Behavior**
- No decisions — user reads and hits "Go". It's our job to suggest the right
  amount — not too much, not too little.
- Suggestions come from the recommendation engine — no change to recommendation
  algorithms. Scope is computed on the fly from engine output; does not read or
  write the Custom toggle state.
- Current `buildRecommendationText` produces a single comma-joined string
  ("review scales, practice intervals 1–3, ..."). Needs reformatting into
  separate lines with capitalized verbs.
  - Some improvements to stringification would be nice since we have more space
    here — "Practice E e" → "Practice low E and high E (e) strings" or similar.
    Richer level display names should come from mode definitions.

**Edge cases**
- No data yet: handled by recommendation engine already ("Start {first level}")
- All levels learned: 
  - Review all levels.
  - Future: direct user to another skill.

---

### 4.4 Custom Mode

**Content**
- On/off toggle buttons for every level
- Item count summary: "24 items selected" (updates live)

**Behavior**
- Tapping a level toggles it on/off
- Multiple selection allowed
- At least one group must be selected to enable the action button
- No inline progress bars (those live on Progress tab now)
- No presets for now — add later if needed

**Edge cases**
- Nothing selected: action button disabled
- First visit: none selected. Make user choose -- they wanted to customize.

---

### 4.5 Action Button

**Label**
- "Practice". Don't include count -- it's already in the custom config section.

**Behavior**
- Starts session immediately with the relevant selection

**Position**
- Bottom of practice tab content, above the nav bar. (Details deferred to visual design and component creation phases.)
- Future: could make sticky so it's always visible if content scrolls. For now, content shouldn't scroll.

---

## 5. Progress Tab

**New additions**
- Per-level progress cards move here from the old practice tab
- Each card:
  ```
  {Level label}     [Recommendation pill]
  ████████░░░░░░░░  progress bar
  ```
- Recommendation pills: "Review", "Practice", "Learned", etc.
- Cards appear below existing stats, above speed check section
- "I know this" / "Skip" actions on each card via check/x icons (tap to toggle):
  - Check icon → marks level as "known" (clears skip if set)
  - X icon → marks level as "skipped" (clears known if set)
  - Tap active icon again → returns to normal (learning) state
  - Exact interaction to be refined during card component design.

**Existing content retained**
- Stats table/grid (top)
- Speed check section (bottom)

**Notes**
- More Progress tab redesign to come later — this is just relocating the
  per-level bars and adding recommendation context

---

## 6. About Tab

Design deferred — will be specified separately. Currently holds the skill
subtitle/description that's being removed from the header.

---

## 7. State & Persistence

**Persisted per skill**
- Last selected mode (Suggested / Custom)
- Custom level selection (independent of Suggested — switching modes doesn't
  stomp on user's Custom choices)

**Two independent scope tracks**
- Suggested: computed on the fly from recommendation engine output each time the
  tab renders. Not stored.
- Custom: user's explicit toggle selections, persisted in localStorage as today.
- Switching between modes reads the appropriate track; neither overwrites the
  other.

**Session construction**
- Suggested mode: recommendation engine determines scope
- Custom mode: explicit user selection

---

## 8. Key Principles

- **Zero decisions in Suggested** — one clear path, just hit Practice
- **Full control in Custom** — toggle exactly what you want
- **Progress bar in header** — status visible at all times, no text needed
- **Immediate start** — no multi-step setup in either mode
- **Single-level skills are trivial** — header + Practice, nothing else

---

## 9. Implementation Notes

**Mode definitions as source of truth for strings/icons** — Mode display strings
(`MODE_NAMES`, `MODE_DESCRIPTIONS`, `MODE_BEFORE_AFTER`, `TRACKS`) currently
live in `music-data.ts`, which should be pure music theory data. Move these into
mode definitions (or a dedicated UI registry) so each mode definition owns its
title, description, before/after text, and icon. Also eliminate the title
duplication in `build-template.ts`. Level labels already live in each mode's
`logic.ts` (reasonable since they vary by mode) — consider adding richer display
names there (e.g., "Low E and high E strings" vs "E e") for the suggestion text.

**Recommendation text reformatting** — `buildRecommendationText` in
`src/mode-ui-state.ts` currently returns a single string. Refactor to return
structured data (array of `{verb, levels}`) so the UI can render separate lines.
The recommendation algorithm in `src/recommendations.ts` is unchanged.
