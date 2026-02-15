# Layout & Information Architecture

Principles for screen layout, content hierarchy, and information architecture.
Complements the visual design system in `visual-design.md` — that guide covers
*what things look like*; this one covers *where things go and why*.

---

## Screen States Are Distinct Designs

Each mode has distinct states: **idle/stats**, **quizzing**, and
**calibrating**. Each state should have its own clear layout — not just
show/hide toggles on a universal element list.

**Why:** A layout designed to accommodate every state serves none of them well.
Elements irrelevant to the current state take up space, create visual noise,
and confuse the interaction flow. Showing quiz-configuration toggles during an
active quiz distracts from the question-answer loop; showing dense stats grids
when the user just wants to start a quiz creates an unnecessary wall of data.

**Rules:**
- Elements irrelevant to the current state should be hidden, not merely
  visually de-emphasized.
- Each state's layout should be designed independently, then reconciled into
  shared DOM. Start from "what does the user need in this state?" not "what
  can we show/hide?"
- State transitions should feel intentional — a visible layout change, not
  subtle element flickering.

**Current violations (to fix):**
- Quiz-configuration controls (string toggles, naturals-only) remain visible
  during active quiz in fretboard mode.
- Stop button and × close button both visible during quiz (redundant
  affordances across states).

---

## Content Hierarchy Follows Interaction Priority

Top-to-bottom order should match the user's attention priority for each state.
The most important element goes at the top; supporting context below.

**During quiz:**
1. Question (fretboard highlight, text prompt)
2. Time pressure (countdown bar + deadline)
3. Answer input (buttons)
4. Feedback (correct/wrong + time)
5. Session context (question count, elapsed, progress bar)

**During idle/stats:**
1. Performance overview (heatmap or summary)
2. Legend / explanation
3. Quiz configuration (what to practice)
4. Primary action (Start Quiz)

**Why:** Users have limited attention budgets, especially under time pressure.
The question should command immediate focus; chrome and metadata should recede.
Placing five layers of chrome above the question (as in the current fretboard
quiz state) forces the eye to scan past irrelevant information to find what
matters.

**Rules:**
- Audit each state's top-to-bottom order against the priority list above.
- If a high-priority element is buried below low-priority chrome, restructure.
- On mobile, vertical space is scarce — every element above the question is
  space the user has to scroll past.

---

## Group Related Controls

Settings that configure the same concern should be visually grouped with a
clear label. Don't scatter related controls across different visual sections.

**Examples of concerns:**
- "What to practice" — string toggles, group toggles, naturals-only
- "View my progress" — Recall/Speed toggle, heatmap, legend
- "Quiz actions" — Start/Stop

**Why:** When controls for the same concern are scattered, users can't build a
mental model of the interface. They have to search for related options instead
of finding them in one place.

**Rules:**
- Each logical group should have a brief label or heading (e.g., "Strings",
  "Progress", "Practice").
- Groups should have clear visual boundaries — whitespace, dividers, or cards.
- Controls within a group should be adjacent, not interleaved with controls
  from other groups.

**Current violations:**
- Recall/Speed toggle sits in a separate `stats-controls` div between the
  stats display and quiz configuration, not clearly grouped with either.
- String toggles have no label — `e B G D A E` with no heading.
- Progress bar during quiz has no label — "3 / 13" without context.

---

## Label Everything

Toggles, progress indicators, and data displays need text labels or headings.
Users shouldn't have to infer meaning from context.

**Rules:**
- Any numeric display needs a label: "3 / 13 fluent", not just "3 / 13".
- Toggle groups need a heading: "Strings" above `e B G D A E`.
- Data grids need axis labels when meaning isn't obvious from content alone.
- Labels can be small (`--text-xs`) and muted — they don't need visual weight,
  just presence.
- **Labels should be self-interpreting.** A first-time viewer should understand
  a value without watching it change or reading surrounding context. If a label
  is ambiguous in isolation, it needs rewording. For example, "5 questions"
  could mean total, remaining, or answered — "#5" is immediately clear as a
  sequence position. Prefer formats that are unambiguous even to someone seeing
  the screen for the first time.

**Test:** Show the screen to someone who's never used the app. Can they tell
what each element means without explanation? If not, add a label.

---

## One Way to Do Each Thing

If two affordances perform the same action, consolidate to one. Redundant
controls create confusion about whether they're subtly different.

**Why:** When a user sees both a "Stop Quiz" button and a × close button,
they wonder: "Does × just close the quiz area, or does it actually stop? Does
Stop save my progress but × doesn't?" The answer is they're identical — but
the user can't know that.

**Rules:**
- Each action should have exactly one trigger in the visible UI.
- If an action needs to be accessible from multiple locations (e.g., stop quiz
  from both header and keyboard), use one visible button plus a keyboard
  shortcut — not two buttons.

---

## Minimize Chrome During Quiz

The active quiz state should maximize space for the question-answer loop.
Settings, stats, and non-essential metadata should be hidden.

**Why:** This is the core interaction — the user is under time pressure,
focused on identifying a note and tapping an answer. Every pixel of screen
space should serve that goal. Quiz-configuration controls (which strings are
enabled, whether to show accidentals) aren't actionable mid-quiz and shouldn't
compete for attention.

**What to keep during quiz:**
- Question display (fretboard, text prompt)
- Countdown / time pressure indicator
- Answer buttons
- Feedback (after answering)
- A way to stop (single button or × icon)

**What to hide during quiz:**
- Stats heatmaps and legends
- Configuration toggles (string selection, group selection, naturals-only)
- Recall/Speed toggle
- Recalibrate button

---

## Visual Containers Match Logical Groups

If elements are related, they should share a visual container (card, section
boundary). If elements belong to different concerns, don't put them in the
same container.

**Why:** Visual containment creates implicit grouping. A card that contains
the countdown bar and answer buttons but not the quiz header implies those
elements are in a different category — even if they're all part of the same
"active quiz" state. Partial containment is worse than no containment because
it actively misleads.

**Rules:**
- If using a card/surface treatment, it should contain an entire logical group.
- Don't split a logical group across card and non-card areas.
- Section dividers (`border-bottom`) should separate concerns, not cut through
  the middle of one.

**Current violations:**
- Quiz area card contains countdown + buttons + feedback but not the quiz
  header or session stats — all of which are quiz-state elements.

---

## Stats Should Scope to Configuration

When viewing stats, the data displayed should relate to what the user is
configured to practice. A mismatch between "what I see in stats" and "what
I'll be quizzed on" is confusing.

**Options (choose per mode):**
1. **Filter stats to enabled items** — only show cells for enabled groups.
2. **Visually distinguish enabled vs. disabled** — show all items but dim or
   outline the ones outside the current quiz scope.
3. **Show all with explicit labeling** — show everything but label which
   groups are enabled.

**Why:** If a user enables only I, IV, V chords but sees a 12×7 grid where
most cells are grey, they can't easily tell whether grey means "not practiced
yet" or "not in my current quiz scope." The heatmap becomes noise instead of
signal.

---

## Stats Need Aggregate Context

Raw heatmaps are useful for detail but overwhelming without an aggregate
summary. Users need a quick answer to "how am I doing overall?" before diving
into per-item detail.

**Rules:**
- Provide a one-line summary above detailed stats: "48 of 78 positions
  mastered" or "62% automatic".
- The summary should use the same metric as the progress bar (automaticity
  threshold) for consistency.
- Heatmaps serve as drill-down detail, not primary feedback.

---

## Dense Grids Need Support

Large data grids (12×7, 12×11) are powerful for experts but intimidating for
new users and hard to scan without support.

**Rules:**
- **Axis labels** on both dimensions: row header and column header should have
  descriptive titles, not just data labels.
- **Cell hover/focus** for identification: on desktop, hovering a cell should
  show its identity (e.g., "IV in Bb major").
- **Progressive disclosure**: consider showing a simplified view by default
  (e.g., per-group summary) with the full grid as an expandable detail.
- **Visual rhythm**: use alternating row backgrounds or group separators for
  grids with many rows.

---

## UX Terminology

Terms used in the UI and codebase with specific meanings in this app:

| Term | Meaning | Why this word |
|------|---------|---------------|
| **fluent** | An item the user can recall quickly and accurately right now (automaticity above threshold). Used in the progress bar: "5 / 78 fluent". | "Mastered" implies permanent learning, but you'll forget by next session. "Fluent" captures speed + accuracy without claiming permanence — you can be fluent today and rusty tomorrow. Matches the underlying automaticity metric. |

---

## Summary of Principles

| # | Principle | One-line test |
|---|-----------|---------------|
| 1 | Screen states are distinct designs | Can you describe each state's layout independently? |
| 2 | Content hierarchy follows interaction priority | Is the most important element at the top? |
| 3 | Group related controls | Can you point to where "quiz settings" lives? |
| 4 | Label everything | Can a new user understand each element without explanation? |
| 5 | One way to do each thing | Are there two buttons that do the same thing? |
| 6 | Minimize chrome during quiz | Is anything visible during quiz that isn't question/answer/feedback? |
| 7 | Visual containers match logical groups | Does any card split a logical group across its boundary? |
| 8 | Stats scope to configuration | Do stats show items the user can't currently be quizzed on? |
| 9 | Stats need aggregate context | Can the user answer "how am I doing?" in under 2 seconds? |
| 10 | Dense grids need support | Do axis labels, hover states, and summaries exist for large grids? |
