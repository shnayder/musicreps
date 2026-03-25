# Terminology

User-facing terms with specific meanings in this app. When writing UI copy,
prompts, or documentation, use these terms consistently.

The codebase may use different internal names (noted where applicable). The
terms here are what the **user sees**.

---

## Core concepts

| Term | Meaning | Internal name | Why this word | Needs review |
|------|---------|---------------|---------------|---|
| **fluent** | An item you can recall quickly and accurately right now (automaticity above threshold). Used in the progress bar: "5 / 78 fluent". | `automatic`, `automaticity` | "Mastered" implies permanent learning, but you'll forget by next session. "Fluent" captures speed + accuracy without claiming permanence — you can be fluent today and rusty tomorrow. | |
| **speed check** | A quick exercise (~15s) measuring how fast you can answer without thinking. Used to calibrate speed thresholds to your device and reaction time. | `calibration`, `motorBaseline` | "Calibration" is technical jargon — users don't calibrate apps, they check their speed. "Speed check" is self-describing: you're checking how fast you are. | |
| **sharps and flats** | The five notes between naturals (C#/Db, D#/Eb, F#/Gb, G#/Ab, A#/Bb). Used in the Notes toggle on fretboard and speed tap modes. | `hideAccidentals` prop on `NoteButtons` | "Accidentals" is music theory jargon. "Sharps and flats" is self-describing and beginner-friendly. | |
| **round** | One 60-second timed quiz session. Multiple rounds can be played back-to-back ("Keep Going"). | `round` | Neutral and accurate. Not "level" (implies progression), not "game" (implies play). | |
| **recall** | The heatmap tab showing how well you remember each item (predicted retention probability). | `retention`, `statsMode === 'retention'` | Users think about "recall" — can I recall this? "Retention" is psychology jargon. The tab button says "Recall". | |
| **item** | A single question the app can ask. Generic counting term for theory modes: "24 items fluent". | `item`, `itemId` | Neutral container. Specific modes should use more specific nouns when possible (see below). | |
| **position** | A specific fret on a specific string. Fretboard-mode counting term: "78 positions to learn". | `item` (same system) | "Position" is natural guitar vocabulary — "what note is at this position?" | |
| **skill** | A self-contained quiz topic (e.g., Guitar Fretboard, Interval Math). Each has its own progress, settings, and item pool. | `mode`, `modeId` | Standard UI term. May have multiple "levels" of the skill. | |
| **level** | Levels within a skill -- corresponds to a set of items to learn, typically in order of progressive difficulty or relevance (first learn major chords, then add minor, then 7, then maj 7, etc), though could also be fairly arbitrary ordering (e.g. fretboard: you can learn E, then A, then D, or frets 1-3, then 3-5, then..., or some other sequence). There is a per-level fluency assessment which affects when the system recommends moving to subsequent levels. | `group` |  | |
| **suggestion** | The app's suggestion for what to practice next within a skill — which item groups to enable. Shown as "Recommended: E string" with a "Use recommendation" button. | `computeRecommendations()` | The system recommends, not demands. The user can ignore it. | |

### Recommendation types

The recommendation pipeline produces per-level recs in priority order. These
map to both in-skill suggestion text and home screen cue labels.

| Type | Meaning | In-skill text | Home screen cue | When |
|------|---------|---------------|-----------------|------|
| **review** | Level's items are stale (P10 freshness < 0.5) | "review {levels}" | "Review" | Any started level needs review |
| **practice** | Level is slow (Starting/Hesitant/Learning) | "practice {levels}" | "Keep practicing" | Any started level P10 speed < 0.7 |
| **expand** | Ready to start a new level | "start {level} — N new items" | "Learn next level" | Expansion gate open + unstarted level available |
| **automate** | Level is Learned but not yet Automatic | "automate {levels}" | "Almost there" | Any level with P10 speed 0.7–0.9 |

---

## Progress labels

Overall status label shown on the Practice tab ("Overall: Building"). Based on
what percentage of a mode's items are fluent.

| Label | Threshold | Meaning | Needs review |
|-------|-----------|---------|---|
| **Ready to start** | No data yet | Haven't tried this mode. | |
| **Getting started** | < 20% fluent | Just beginning. | |
| **Building** | 20–49% fluent | Making progress, still lots to learn. | |
| **Solid** | 50–79% fluent | More than half fluent. | |
| **Strong** | >= 80% fluent | Nearly everything fluent. | |

---

## Heatmap labels (Recall tab)

Legend labels for the recall heatmap, mapping automaticity score to a
human-readable level.

| Label | Threshold | Notes | Needs review |
|-------|-----------|-------|---|
| **Needs work** | < 20% | | |
| **Fading** | > 20% | Was once better, now decaying. | |
| **Getting there** | > 40% | | |
| **Solid** | > 60% | | |
| **Automatic** | > 80% | Same threshold as "fluent" — different word in different context. | |
| **No data** | (grey) | Never attempted. | |

> **Question:** "Automatic" in the heatmap legend and "fluent" in progress bars
> refer to the same threshold (> 80% automaticity). Should we unify these? The
> heatmap is a per-item view ("is this item automatic?") while the progress bar
> counts items ("N items fluent"). The distinction may be intentional — "automatic"
> describes the state of knowledge, "fluent" describes the person's relationship
> to it — but it's worth confirming this is deliberate rather than accidental.
>
> Related: summary vs individual item. Also >80% is far from fully mastered, on both individual items and groups. A kid that 81% on a multiplication tables test is not ready to move on. It should be very close to 100% for a while before you call it "automatic".

---

## Speed check labels

Speed band labels shown after completing a speed check, and used in the Speed
heatmap legend. Thresholds are multiples of the user's baseline response time.

| Label | Multiplier | Meaning (shown in table) | Needs review |
|-------|-----------|--------------------------|---|
| **Automatic** | < 1.5x baseline | "Fully memorized — instant recall" | |
| **Good** | < 3x | "Solid recall, minor hesitation" | |
| **Developing** | < 4.5x | "Working on it — needs practice" | |
| **Slow** | < 6x | "Significant hesitation" | |
| **Very slow** | >= 6x | "Not yet learned" | |

---

## UI elements

| Term | Where it appears | Notes | Needs review |
|------|-----------------|-------|---|
| **Practice** | Tab label (idle state) | The default tab — shows status and start button. | |
| **Progress** | Tab label (idle state) | Shows heatmap and stats table. | |
| **Start Quiz** | Button on Practice tab | Begins a round. | |
| **Keep Going** | Button on round-complete screen | Starts another round. | |
| **Stop** | Button on round-complete screen | Returns to idle. | |
| **Use recommendation** | Button below recommendation text | Applies the algorithm's suggested item scope. | |
| **Redo speed check** | Button in Advanced section | Re-runs the motor baseline calibration. | |
| **Natural only** | Checkbox in fretboard / Speed Tap modes | Restricts to non-accidental notes (no sharps/flats). | |
| **Groups** | Label for item-group toggles (theory modes) | The toggle buttons that enable/disable subsets (e.g., "1,2", "m2,M2"). | |

---

## Home screen

| Term | Where | Notes | Needs review |
|------|-------|-------|---|
| **Music Reps** | App title | | |
| **Fretboard** | Group heading | Fretboard quiz modes. | |
| **Theory Lookup** | Group heading | Bidirectional lookup modes (Note/Interval ↔ Semitones). | |
| **Calculation** | Group heading | Modes that apply an operation to a note (Semitone Math, Interval Math). | |
| **Keys & Chords** | Group heading | Key Signatures, Scale Degrees, Diatonic Chords, Chord Spelling. | |

> **Question:** These group labels don't appear anywhere else in the app and
> aren't defined or explained. Are they the right categories? "Theory Lookup"
> in particular — is "lookup" the right metaphor? The user is doing recall, not
> looking things up.

---

## Settings

| Term | Where | Notes | Needs review |
|------|-------|-------|---|
| **Note names** | Setting label | Which notation system to use. | |
| **A B C** | Toggle option | Letter notation (default). | |
| **Do Re Mi** | Toggle option | Solfege notation. | |

---

## Feedback and messages

| Text | When shown | Needs review |
|------|-----------|---|
| "Correct!" | Right answer. | |
| "Incorrect — [answer]" | Wrong answer, with correct answer shown. | |
| "Tap anywhere or press Space for next" | After answering, before next question. | |
| "Looks like you've got this!" | All enabled items are fluent (idle or mid-quiz). | |
| "Time to review?" | Items were once fluent but have decayed (idle only). | |
| "Round N complete" | End of a 60-second round. | |

---

## Music notation

These are standard music theory terms, not app-specific. Included for
consistency in how the app renders them.

| Convention | Example | Notes | Needs review |
|-----------|---------|-------|---|
| Sharp symbol | C**#** on buttons, C**♯** in prompts | Buttons use ASCII `#`; display text uses Unicode ♯. | |
| Flat symbol | D**b** internally, D**♭** in display | Internal storage uses ASCII `b`; display uses Unicode ♭. | |
| Enharmonic display | C♯/D♭ | Slash-separated when both spellings are shown. | |
| Interval abbreviations | m2, M2, P4, TT, P5, P8 | Lowercase m = minor, uppercase M = major, P = perfect, TT = tritone. | |
| Roman numerals | I, ii, iii, IV, V, vi, vii° | Uppercase = major, lowercase = minor, ° = diminished. | |
| Ordinal degrees | 1st, 2nd, 3rd, 4th, 5th, 6th, 7th | Scale degree buttons. | |
| Key signature labels | 2#, 3b | Number + accidental character. | |
| Chord symbols | Cm7, F#dim, Gsus4 | Root + type suffix. | |

---

## Terms we deliberately avoid

| Avoided term | Why | What we use instead | Needs review |
|-------------|-----|-------------------|---|
| **mastered** | Implies permanence. You forget things. | **fluent** (progress bars), **automatic** (heatmap) | |
| **calibration** | Technical jargon | **speed check** | |
| **lesson** | We don't teach — we drill | **mode** | |
| **level** | Implies linear progression | **mode** (for topics), **round** (for sessions) | |
| **score** | Implies gamification | **correct** (count), **fluent** (progress) | |
| **streak** | Gamification mechanic | (not used) | |
| **game** | We're a practice tool, not a game | **quiz**, **round** | |

---

## Open questions

1. **"Automatic" vs "fluent"** — same threshold, different words in different
   contexts (heatmap legend vs progress bar). Intentional or accidental? Should
   we pick one? See note in Heatmap labels section.

2. **"Theory Lookup" group label** — "lookup" implies reference, but the user
   is doing recall from memory. Would "Theory Basics" or "Note & Interval IDs"
   be better?

3. **"Items" as generic counting noun** — fretboard modes say "positions",
   Speed Tap says "notes", everything else says "items". Should we find a
   better word for the theory modes? "Questions" or "pairs" might be more
   concrete. Or is "items" fine because it's unobtrusive?

4. **"Groups" label** — the toggle section for theory modes is labeled "Groups"
   which is accurate but opaque. Would "Difficulty groups", "Practice scope",
   or just no label (the buttons are self-evident) work better?

5. **Speed band overlap with heatmap labels** — the speed check results table
   uses "Automatic / Good / Developing / Slow / Very slow" while the recall
   heatmap uses "Needs work / Fading / Getting there / Solid / Automatic".
   These are different scales measuring different things (speed vs retention),
   but "Automatic" appears in both with slightly different meanings. Confusing?

6. **"Overall:" prefix** — the status label is shown as "Overall: Building".
   Is the "Overall:" prefix pulling its weight, or is it noise? The label
   already sits in a clear status position.

7. **Solfege toggle "Do Re Mi"** — should this be "Do Re Mi" or "Solfege"?
   "Do Re Mi" is self-describing to anyone who knows solfege, but "Solfege"
   is more discoverable for users who don't recognize the syllables.
