# Screen & Layout Patterns

How to make layout decisions in this app. Not a description of what exists (the
preview page serves that role) and not a list of principles
([layout-and-ia.md](layout-and-ia.md) covers those). This is the practical
bridge — how to apply principles to concrete screen decisions.

**Companion docs:**

- [layout-and-ia.md](layout-and-ia.md) — 17 enduring UX principles (the "why")
- [architecture.md](../architecture.md#universal-mode-layout) — DOM structure
  and phase classes (the implementation)
- Preview page (`/preview`) — visual source of truth

---

## The Three-Act Loop

Every mode follows the same rhythm: **Configure, Drill, Reflect.** This maps
directly to the phase cycle (`idle` → `active` → `round-complete` → `idle`).
Each act has fundamentally different user needs and therefore fundamentally
different layout constraints.

**Act 1 — Configure (idle phase).** The user is browsing. They can tolerate
density. They are making decisions: what to practice, how they are doing, whether
to accept a recommendation. The layout can afford information richness — status
cards, scope toggles, stats grids, recommendations. Scrolling is fine. The
user's attention is diffuse.

**Act 2 — Drill (active phase).** The user is under time pressure. Every pixel
must serve the question-answer loop. The layout must be sparse: prompt, answer
controls, minimal session chrome. No scrolling. The user's attention is focused
on a single point. See layout-and-ia.md principle #6 (Minimize chrome during
quiz).

**Act 3 — Reflect (round-complete phase).** The user has just finished a burst.
This is a decompression moment. The layout should give them a clear summary (how
did that round go?) and a clear choice (keep going or stop?). Not as sparse as
drilling, not as dense as configuring. The content is read-only — there are no
decisions to make except "again?" See principle #15 (Data abstraction before
detail).

**The key insight: density is a function of phase.** If you are adding something
to the drill phase and it makes the screen denser, you are almost certainly
putting it in the wrong place. If you are adding something to the idle phase and
it feels sparse, you might be under-using the space.

---

## The Zone Model

The app uses a three-zone structural layout (`ScreenLayout` →
`LayoutHeader` / `LayoutMain` / `LayoutFooter`). This is not just CSS
convenience — it is a content placement contract.

**Header zone — identity and navigation chrome.** In idle: mode top bar (icon,
title, close). In active: quiz session info (countdown bar, context, count,
close). The header is fixed; it does not scroll. It should be as thin as
possible. Nothing the user needs to interact with frequently belongs here.

**Main zone — the primary content area.** This is where the user's attention
lives. In idle, it holds tab panels (Practice, Progress) and scrolls. In active,
it holds the quiz stage (prompt + response) and does not scroll. The switch
between scrollable and non-scrollable main is a key phase transition marker. If
content scrolls during drilling, something is wrong.

**Footer zone — actions and navigation.** In idle: the Practice button and the
tab bar. In round-complete: continue/stop actions. The footer is fixed; it
anchors the user's next action at a predictable screen position. See principle
#13 (Action gravity).

**The practical rule:** you never need to ask "where vertically does this go?"
The answer is always: is it chrome (header), content (main), or an action
(footer)?

### Viewport and safe-area model (iOS)

With `viewport-fit=cover`, the web content fills the full viewport including the
notch and home-indicator zones. Safe-area insets tell us where those zones are.
The rule: **`body` owns the top safe-area inset; `.mode-nav` owns the bottom
inset; children fill the remaining space.**

```
┌───────────────────────────────┐  ← 0
│     safe-area-inset-top       │  body padding-top
├───────────────────────────────┤
│  ┌─────────────────────────┐  │
│  │ .screen-layout           │  │  height: calc(100dvh - inset-top)
│  │  ┌───────────────────┐  │  │
│  │  │ .layout-header     │  │  │  flex-shrink: 0
│  │  ├───────────────────┤  │  │
│  │  │ .layout-main       │  │  │  flex: 1
│  │  ├───────────────────┤  │  │
│  │  │ .layout-footer     │  │  │  flex-shrink: 0
│  │  │  .mode-nav         │  │  │
│  │  │  pb: inset-bottom  │  │  │  ← home indicator clearance
│  │  └───────────────────┘  │  │
│  └─────────────────────────┘  │
└───────────────────────────────┘  ← 100dvh
```

Key invariants:

- **Top inset: body owns it.** `padding-top: env(safe-area-inset-top)` pushes
  content below the notch/status bar.
- **Bottom inset: `.mode-nav` owns it.** `padding-bottom: env(safe-area-inset-bottom)`
  provides clearance from the home indicator. Body padding-bottom is `0`.
- **`.screen-layout`** uses `height: calc(100dvh - env(safe-area-inset-top, 0px))`
  — an absolute value that works regardless of DOM nesting. It spans from below
  the notch to the bottom of the viewport; mode-nav's padding keeps tabs above
  the home indicator within that space.
- **Each inset is applied exactly once.** No component should add safe-area
  padding that another component already handles.
- **On desktop** (no safe-area insets), all `env()` values resolve to `0` and
  the layout degrades to a simple full-viewport flexbox.

---

## Placing New Content

When you have a new piece of UI, follow this decision path.

### Step 1: Which phase?

- **User needs it while drilling** → active phase. Apply extreme scrutiny —
  does it genuinely serve the question-answer loop? If not, it belongs
  elsewhere.
- **User needs it before starting** → idle phase, in one of the tabs.
- **User needs it after a round** → round-complete phase.
- **User needs it across phases** → session chrome (header zone) or a
  persistent action (footer zone). This is rare.

### Step 2: If idle phase, which tab?

- **Practice tab** — anything that configures what the next session will be.
  Scope controls, recommendations, status summary, the start action.
- **Progress tab** — anything that shows historical performance. Stats grids,
  heatmaps, calibration, trends.
- **A new tab** — only if the content has a different primary intention that
  does not fit either existing tab. The bar is high — adding a tab adds
  navigation cost for every user on every visit. (About is the precedent for
  truly orthogonal content.)

### Step 3: Within a tab, what container?

- The **Practice tab** uses a single PracticeCard that flows top-to-bottom:
  status → recommendation → scope → (start button in footer). New
  practice-related content slots into this flow based on the principle of
  configuration leading to action.
- The **Progress tab** is more modular: stats container, then optional extras,
  then baseline info. New analytics or visualization features slot in here.

### Step 4: Could this be an overlay?

Overlays (modals, drawers) are for content that interrupts the current flow:
global settings, confirmations, or content requiring a different interaction
mode. Do not use overlays for content the user accesses frequently within a mode.

### Anti-patterns

- Adding a scope control to the Progress tab (scope belongs in Practice)
- Adding a stats summary to the active quiz phase (stats are for reflection)
- Creating a new tab for something that could be a section within Practice or
  Progress
- Putting an action in the header zone (actions belong in footer or inline with
  content)

---

## Layout Techniques

Each technique below is a design decision with rationale, not a CSS recipe.

### Quiz stage: prompt/response split

During active drilling, the main zone divides into two vertically-stacked
regions: the prompt (what the app presents) and the response (how the user
answers). The prompt has more space because it carries more visual complexity
(fretboard SVG, multi-line text prompts), while response controls are compact (a
row or two of buttons). Both regions center their content. The response area
stays in the lower half of the screen, within thumb reach on mobile.

### Card containment for configuration

The Practice tab wraps all configuration in a single card surface. This visually
communicates "this is one decision" (what to practice). If a new configuration
concern is added, it should go inside this card, not beside it. A second card
would imply a second independent decision. See principle #7 (Visual containers
match logical groups).

### Unified answer grid

All answer buttons use a single 4-column grid (`.answer-grid`) with square
buttons (`.answer-btn`). 12-note and 12-interval layouts fill 3 clean rows.
Partial rows (7 degrees, 7 numerals) wrap naturally with gaps on the right.

Two-step inputs (chord spelling, key signatures) stack multiple grids vertically
in an `.answer-grid-stack` wrapper.

### Scrollable vs. fixed main

The idle phase main zone scrolls because configuration and stats content may
exceed viewport height, especially on mobile. The active phase main zone is
fixed — no scrolling — because scrolling during a timed drill is a failure of
layout. If active-phase content does not fit without scrolling, the content needs
to be reduced, not the constraint relaxed.

### Flex chain constraint (active phase)

During active quiz, the fretboard SVG (and any other variable-height content)
must scale to fit the available space — never overflow, never scroll. This works
by maintaining an **unbroken flex chain** from the viewport-anchored root to the
content leaf. Every flex child in the chain has `flex: 1; min-height: 0` so it
fills remaining space and can shrink below its content size.

```
.screen-layout           height: calc(100dvh - inset-top)  ← anchor
  .layout-header         flex-shrink: 0                     ← natural
  .layout-main-fixed     flex: 1; min-height: 0             ← fills
    .mode-screen.active  flex: 1; min-height: 0             ← fills
      .quiz-area         flex: 1; min-height: 0             ← fills
        .quiz-content    flex: 1; min-height: 0             ← fills
          .quiz-stage    flex: 1; min-height: 0             ← fills
            .prompt      flex: 3; min-height: 0             ← 60%
              text       flex-shrink: 0                     ← natural
              fretboard  flex: 1; min-height: 0             ← remainder
            .response    flex: 2; min-height: 0             ← 40%
        .quiz-controls   margin-top: auto                   ← natural
  .layout-footer         flex-shrink: 0                     ← natural
```

**The rule:** every flex child between the viewport anchor and variable-height
content must have `min-height: 0`. Without it, the child defaults to
`min-height: auto` (content size) and the content can't shrink to fit.

**No viewport-unit hacks.** Content like the fretboard SVG should use
`max-height: 100%` and `max-width: 100%` to scale within its flex-allocated
space via viewBox + preserveAspectRatio. Never use `max-height: 50vh` or similar
— the layout IS the constraint.

### Viewport queries: structural only

Viewport-based responsive changes should affect structural layout (body padding,
phase margins) and typography scaling. They should not change component
internals. A component should look the same whether rendered in the app, the
preview page, or a screenshot viewport. Components size themselves via max-width
constraints, not media queries.

---

## Density Management

Information density should be inversely proportional to time pressure.

**Idle phase: density is welcome.** The user is in browsing mode. They can scan
a stats grid, read a recommendation, toggle scope options. Multiple information
groups on screen simultaneously is fine. The constraint is not density but
clarity — every group must be labeled, contained, and ordered by priority
(principles #2, #3, #4).

**Active phase: density is the enemy.** Strip everything that is not question,
answer, feedback, or session progress. The countdown bar and session info row are
the maximum acceptable chrome. Even feedback should be transient — it appears
after answering and clears when the next question arrives. If you are tempted to
show "helpful context" during drilling, put it in the idle phase instead.

**Round-complete phase: density should decompress.** Show the round summary
prominently. Show the overall context secondarily. The two actions (continue,
stop) should be the only interactive elements. This is a breathing moment — do
not fill it with configuration options or detailed analytics.

**Transitions matter.** The shift from idle (dense, scrollable) to active
(sparse, fixed) should feel like the lights dimming in a theater. The shift from
active to round-complete should feel like an exhale. The shift back to idle
should feel like the lights coming back up. Phase classes handle the mechanical
show/hide, but the designer's job is to ensure the emotional density shift is
right.

---

## The Home Screen

The home screen is the only screen that does not follow the three-act loop. It
has one job: get the user into a mode. It is a launcher, not a dashboard.

Mode cards are the primary interactive elements. Section labels group modes by
category. The footer holds global navigation (Settings, version).

**Placement heuristic:** if content applies to a specific mode, it does not
belong here. If it applies across modes (global settings, overall progress,
mode recommendations), it could live here — but the bar is high. Every element
on the home screen is friction between the user and their practice session. See
principle #4 (Minimal friction in design-principles.md).

---

## Cross-References

| Need | Go to |
|------|-------|
| Why a layout decision is right | [layout-and-ia.md](layout-and-ia.md) (17 principles) |
| Current DOM structure and phase classes | [architecture.md](../architecture.md#universal-mode-layout) |
| What components look like now | Preview page (`/preview`) |
| How to implement a new mode | [architecture.md](../architecture.md) (Adding a New Quiz Mode) |
| Color, typography, spacing tokens | [visual-design.md](visual-design.md) (index) |
