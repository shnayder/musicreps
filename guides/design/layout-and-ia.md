# Layout & Information Architecture

Enduring UX principles for screen layout, content hierarchy, and information
architecture — _where things go and why_. These principles should outlast any
particular implementation.

For how to apply these principles to specific layout decisions, see
[screen-patterns.md](screen-patterns.md). For the full principles index
(product, visual, and UX), see [design-principles.md](../design-principles.md).
For the current DOM structure, see
[architecture.md](../architecture.md#universal-mode-layout).

---

## 1. Screen States Are Distinct Designs

Each mode has distinct states (configuring, quizzing, reflecting). Each state
should have its own clear layout — not just show/hide toggles on a universal
element list.

**Why:** A layout designed to accommodate every state serves none of them well.
Elements irrelevant to the current state take up space, create visual noise, and
confuse the interaction flow.

**Rules:**

- Elements irrelevant to the current state should be hidden, not merely visually
  de-emphasized.
- Each state's layout should be designed independently, then reconciled into
  shared DOM. Start from "what does the user need in this state?" not "what can
  we show/hide?"
- State transitions should feel intentional — a visible layout change, not
  subtle element flickering.

---

## 2. Content Hierarchy Follows Interaction Priority

Top-to-bottom order should match the user's attention priority for each state.
The most important element goes at the top; supporting context below.

**Why:** Users have limited attention budgets, especially under time pressure.
The primary task should command immediate focus; chrome and metadata should
recede. On mobile, vertical space is scarce — every element above the primary
content is space the user has to scroll past.

**Rules:**

- Audit each state's top-to-bottom order against the user's attention priority.
- If a high-priority element is buried below low-priority chrome, restructure.
- The active quiz state has the strictest hierarchy: question → time pressure →
  answer input → feedback → session context.

---

## 3. Group Related Controls

Settings that configure the same concern should be visually grouped with a clear
label. Don't scatter related controls across different visual sections.

**Why:** When controls for the same concern are scattered, users can't build a
mental model of the interface. They have to search for related options instead of
finding them in one place.

**Rules:**

- Each logical group should have a brief label or heading.
- Groups should have clear visual boundaries — whitespace, dividers, or cards.
- Controls within a group should be adjacent, not interleaved with controls from
  other groups.

---

## 4. Label Everything

Toggles, progress indicators, and data displays need text labels or headings.
Users shouldn't have to infer meaning from context.

**Rules:**

- Any numeric display needs a label: "3 / 13 fluent", not just "3 / 13".
- Toggle groups need a heading explaining what they control.
- Data grids need axis labels when meaning isn't obvious from content alone.
- Labels can be small and muted — they don't need visual weight, just presence.
- **Labels should be self-interpreting.** A first-time viewer should understand
  a value without watching it change or reading surrounding context. If a label
  is ambiguous in isolation, it needs rewording. Prefer formats that are
  unambiguous even to someone seeing the screen for the first time.

**Test:** Show the screen to someone who's never used the app. Can they tell
what each element means without explanation? If not, add a label.

---

## 5. One Way to Do Each Thing

If two affordances perform the same action, consolidate to one. Redundant
controls create confusion about whether they're subtly different.

**Why:** When a user sees two controls that do the same thing, they wonder if
there's a difference they're missing. The cognitive load of resolving that
ambiguity is worse than just having one clear control.

**Rules:**

- Each action should have exactly one trigger in the visible UI.
- If an action needs to be accessible from multiple locations, use one visible
  control plus a keyboard shortcut — not two visible controls.

---

## 6. Minimize Chrome During Quiz

The active quiz state should maximize space for the question-answer loop.
Settings, stats, and non-essential metadata should be hidden.

**Why:** This is the core interaction — the user is under time pressure, focused
on answering. Every pixel of screen space should serve that goal. Configuration
controls aren't actionable mid-quiz and shouldn't compete for attention.

**Keep during quiz:** question display, time pressure indicator, answer controls,
feedback, and a single way to stop.

**Hide during quiz:** everything else — stats, configuration toggles, navigation
chrome, calibration controls.

---

## 7. Visual Containers Match Logical Groups

If elements are related, they should share a visual container (card, section
boundary). If elements belong to different concerns, don't put them in the same
container.

**Why:** Visual containment creates implicit grouping. Partial containment is
worse than no containment because it actively misleads — a card boundary implies
the contents are a unit, and elements outside are something different.

**Rules:**

- If using a card/surface treatment, it should contain an entire logical group.
- Don't split a logical group across card and non-card areas.
- Section dividers should separate concerns, not cut through the middle of one.

---

## 8. Stats Should Scope to Configuration

When viewing stats, the data displayed should relate to what the user is
configured to practice. A mismatch between "what I see in stats" and "what I'll
be quizzed on" is confusing.

**Options (choose per mode):**

1. **Filter stats to enabled items** — only show cells for enabled groups.
2. **Visually distinguish enabled vs. disabled** — show all items but dim the
   ones outside the current quiz scope.
3. **Show all with explicit labeling** — show everything but label which groups
   are enabled.

**Why:** When a user enables a subset of items but sees stats for everything,
they can't easily tell whether "no data" means "not practiced yet" or "not in my
current scope."

---

## 9. Stats Need Aggregate Context

Raw heatmaps are useful for detail but overwhelming without an aggregate
summary. Users need a quick answer to "how am I doing overall?" before diving
into per-item detail.

**Rules:**

- Provide a one-line summary above detailed stats (e.g., "48 of 78 fluent").
- The summary should use the same metric as the primary progress indicator for
  consistency.
- Heatmaps serve as drill-down detail, not primary feedback.

---

## 10. Dense Grids Need Support

Large data grids are powerful for experts but intimidating for new users and hard
to scan without support.

**Rules:**

- **Axis labels** on both dimensions with descriptive titles, not just data
  labels.
- **Cell hover/focus** for identification on desktop.
- **Progressive disclosure**: consider showing a simplified view by default with
  the full grid as expandable detail.
- **Visual rhythm**: use alternating row backgrounds or group separators for
  grids with many rows.

---

## 11. One Screen = One Primary Intention

Each screen (or tab within a mode) should answer exactly one question: **observe
progress**, **configure practice**, or **run practice**. Secondary tasks should
collapse behind progressive disclosure or a separate tab.

**Why:** When a single screen combines progress visualization, practice
configuration, and session launching, there is no dominant user task. The user
must parse the full screen to find what to do next.

**Rules:**

- Identify the primary intention for each visible state. If you can't name it in
  one phrase, the screen is doing too much.
- Use tabs or progressive disclosure to separate concerns that don't share the
  same primary intention.
- Secondary tasks (calibration, resets, advanced settings) should be visually
  deprioritized.

---

## 12. Visualize, Don't Decode

Avoid legends where possible. Encode state with direct labels, grouping, or
simplified buckets. Limit color categories to what a user can remember without
a legend (typically 3-4).

**Why:** Legends add a layer of indirection — the user sees a color, then looks
up its meaning. For quick scanning, the meaning should be inline or obvious from
context.

**Rules:**

- Prefer direct labels on elements over requiring a legend lookup.
- If a legend is needed (e.g., a heatmap), make it collapsible or inline.
- When showing performance data, provide a text summary alongside any visual
  encoding.

---

## 13. Action Gravity

The next step must be visually obvious. Configuration controls live immediately
adjacent to the action they affect. The primary action should be anchored
consistently across screens.

**Why:** When secondary controls compete visually with the primary action, users
must search for what to do next. The spatial flow from "choose settings" to
"start" should be a clear path.

**Rules:**

- The primary CTA should be the most visually prominent element in its state.
- Configuration controls should lead spatially to the primary action (top to
  bottom: configure → summary → start).
- Consistently anchor the primary action in the same zone across modes.

---

## 14. One Interaction Grammar

Define system-wide component roles and never reuse styles across roles. Each
interactive element type should have a distinct visual treatment so users can
predict what clicking it will do.

**Rules:**

- Don't style a tab like a toggle or a filter like a button.
- Each component type should have distinct visual treatment (see
  [components.md](components.md) for the taxonomy).
- Selection states should vary by component type (tabs: underline, toggles:
  background fill, buttons: pressed state).

---

## 15. Data Abstraction Before Detail

Show summaries first, detail on demand.

**Why:** A full data grid is overwhelming as the first thing a user sees. Most
visits only need "how am I doing?" — the answer should be immediate, with
drill-down available for diagnosis.

**Rules:**

- Top level: aggregate summary (e.g., "12 of 78 fluent", "Overall: Solid").
- Second level: group-level breakdown.
- Third level: item-level detail (full heatmap, expanded grid).
- Default to the highest abstraction level. Reveal detail on user action.

---

## 16. State Should Explain Itself

Recommendations and highlights must be explained inline, not via styling alone.
Every highlighted element should answer "why this?"

**Why:** Visual emphasis without explanation is noise. The user sees a highlight
but doesn't know why that item is recommended.

**Rules:**

- When recommending an action, explain the reasoning in text.
- Provide an action to accept the recommendation, not just a visual highlight.
- Explanations can be compact (a single line of muted text) but must be present.

---

## 17. Spatial Rhythm

Consistent vertical sections with balanced density zones. Avoid abrupt dense →
empty transitions.

**Why:** Uneven spacing creates visual noise and makes the interface feel
unfinished. Dense clusters of controls next to large empty areas break scanning
rhythm.

**Rules:**

- Use consistent section spacing from the spacing token scale.
- Each section should have similar visual density — if one section is very
  dense, consider splitting or adding breathing room.
- Empty states should still occupy reasonable space with placeholder or
  instructional content, not collapse to zero height.

---

## Summary

| #  | Principle                                      | One-line test                                                        |
| -- | ---------------------------------------------- | -------------------------------------------------------------------- |
| 1  | Screen states are distinct designs             | Can you describe each state's layout independently?                  |
| 2  | Content hierarchy follows interaction priority | Is the most important element at the top?                            |
| 3  | Group related controls                         | Can you point to where "quiz settings" lives?                        |
| 4  | Label everything                               | Can a new user understand each element without explanation?           |
| 5  | One way to do each thing                       | Are there two buttons that do the same thing?                        |
| 6  | Minimize chrome during quiz                    | Is anything visible during quiz that isn't question/answer/feedback?  |
| 7  | Visual containers match logical groups         | Does any card split a logical group across its boundary?              |
| 8  | Stats scope to configuration                   | Do stats show items the user can't currently be quizzed on?           |
| 9  | Stats need aggregate context                   | Can the user answer "how am I doing?" in under 2 seconds?             |
| 10 | Dense grids need support                       | Do axis labels, hover states, and summaries exist for large grids?    |
| 11 | One screen = one primary intention             | Does this screen have a single dominant user task?                    |
| 12 | Visualize, don't decode                        | Can the user understand the display without consulting a legend?      |
| 13 | Action gravity                                 | Is the next step visually obvious?                                    |
| 14 | One interaction grammar                        | Is each component type visually distinct by role?                     |
| 15 | Data abstraction before detail                 | Does the user see a summary before item-level data?                   |
| 16 | State should explain itself                    | Does every highlight answer "why this?"?                              |
| 17 | Spatial rhythm                                 | Are density zones consistent without abrupt transitions?              |
