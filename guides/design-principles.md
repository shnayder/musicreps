# Design Principles

Enduring design values that guide decisions across the app. These principles
should outlast any particular implementation. For the product vision (who it's
for, where it's headed), see [vision.md](vision.md).

---

## Product Principles

How the product should work — what it does and doesn't do for users.

1. **Drill, not instruction.** The app assumes the user knows the theory. It
   trains speed and accuracy, not understanding. No lessons or explanations —
   just questions and immediate feedback.

2. **Adaptive difficulty.** Practice what you're worst at. The system
   prioritizes items with slow response times and low recall. Items you've
   mastered fade to the background.

3. **Consolidate before expanding.** New material is gated behind mastery of
   what's already been started. This applies within modes (item groups) and
   across modes (the skill lifecycle — see
   [vision.md](vision.md#skill-lifecycle)).

4. **Minimal friction.** Zero barriers to drilling. No login required to start
   practicing, no setup, no onboarding. Open the app and go.

5. **Short-session friendly.** 2-5 minutes should be productive. State that
   matters persists across sessions so progress carries over even when sessions
   are brief.

6. **Fewer options.** Prefer smart defaults over user-facing toggles. If the
   system can adapt automatically, do that instead of adding a setting.

7. **Personalized timing.** Thresholds adapt to each user's device and physical
   response speed. A phone user and a desktop keyboard user get equivalently
   challenging targets.

8. **Show data, not words.** The app mostly shouldn't talk. Show the user their
   data and let them draw their own conclusions. "574 minutes of practice" and a
   chart showing response times dropping from 9s to 1.2s — that's motivating
   without being noisy.

9. **Guide, don't gate.** The app recommends what to work on next — which mode,
   which items — but the user can always choose something else. All modes remain
   accessible. Guidance over enforcement.

10. **Practice, not performance.** Time constraints serve automaticity — pushing
    for speed should feel like building a skill, not racing a clock. If a user
    knows the material but the UI makes them feel like they're failing, the
    design is wrong. Urgency cues should pace, not punish.

---

## Visual Design Principles

How the app should look and feel. See
[visual-design.md](design/visual-design.md) for the full design system (colors,
typography, spacing, components).

1. **Drill-first aesthetic** — nothing distracts from drilling. Chrome fades
   away during quiz; visual weight goes to the question and answer buttons.

2. **Warmth over sterility** — inviting, like a good practice space. Warm
   neutrals, sage brand, no cold gray wireframe feel.

3. **Feedback clarity** — correct/wrong instantly recognizable via distinct
   semantic colors (green/red). Never use brand or heatmap colors for feedback.

4. **Information density** — stats scannable at a glance, not decorative.
   Heatmaps use accessible color scale; tables compact but readable.

5. **Mobile-primary** — thumb-friendly 48px touch targets with clear press
   feedback, no hover-dependent interactions. All hover states are enhancements,
   not requirements. Every tap should produce immediate visual confirmation that
   the input registered.

6. **Keyboard-fast** — on desktop, everything reachable from the keyboard.
   Drilling is a tight input loop; every mouse reach breaks flow. Note entry,
   accidentals, advancing, stopping, and navigating back should all be fast and
   convenient keystrokes so the user can focus on learning music, not futzing
   with the mouse.

---

## UX & Layout Principles

How screens are structured and how users interact. See
[layout-and-ia.md](design/layout-and-ia.md) for full detail with rules,
rationale, and examples for each principle.

| #  | Principle                                      | One-line test                                                        |
| -- | ---------------------------------------------- | -------------------------------------------------------------------- |
| 1  | Screen states are distinct designs             | Can you describe each state's layout independently?                  |
| 2  | Content hierarchy follows interaction priority | Is the most important element at the top?                            |
| 3  | Group related controls                         | Can you point to where "quiz settings" lives?                        |
| 4  | Label everything                               | Can a new user understand each element without explanation?          |
| 5  | One way to do each thing                       | Are there two buttons that do the same thing?                        |
| 6  | Minimize chrome during quiz                    | Is anything visible during quiz that isn't question/answer/feedback? |
| 7  | Visual containers match logical groups         | Does any card split a logical group across its boundary?             |
| 8  | Stats scope to configuration                   | Do stats show items the user can't currently be quizzed on?          |
| 9  | Stats need aggregate context                   | Can the user answer "how am I doing?" in under 2 seconds?            |
| 10 | Dense grids need support                       | Do axis labels, hover states, and summaries exist for large grids?   |
| 11 | One screen = one primary intention             | Does this screen have a single dominant user task?                   |
| 12 | Visualize, don't decode                        | Can the user understand the display without consulting a legend?     |
| 13 | Action gravity                                 | Is the next step visually obvious?                                   |
| 14 | One interaction grammar                        | Is each component type visually distinct by role?                    |
| 15 | Data abstraction before detail                 | Does the user see a summary before item-level data?                  |
| 16 | State should explain itself                    | Does every highlight answer "why this?"?                             |
| 17 | Spatial rhythm                                 | Are density zones consistent without abrupt transitions?             |

---

## New Mode Design Guidelines

Guidelines for designing new quiz modes, distilled from how existing modes were
designed.

- **Each mode independently useful.** Modes build on each other pedagogically
  (fretboard → intervals → key signatures → chords), and the app recommends a
  progression order, but every mode is accessible and self-contained.

- **Bidirectional drilling when applicable.** Forward (key → note) and reverse
  (note → key) are tracked as separate items. Mixing directions builds deeper
  fluency.

- **Group items by pedagogical difficulty.** Not alphabetical or numerical
  order. Easy/common items first (I-IV-V before iii-vii°, root+5th before
  2nd+6th).

- **Stats visualization for every mode.** Users should always be able to see
  what they've mastered and what needs work. Heatmaps with Recall/Speed toggle.

Engineering conventions for new modes (reuse shared infrastructure, consistency
over accommodation) are in [architecture.md](architecture.md).
