# Action Button Layout Consistency

**Date:** 2026-03-16
**Area:** Layout system, button positioning
**Principle:** Action gravity (layout-and-ia.md #13)

## Problem

Primary action buttons (Practice, Start, Done, Next, Keep Going, Stop) appear in
different positions across screens and states. On mobile, inconsistent button
placement forces the user to hunt for the next action, breaking the spatial
muscle memory that makes one-handed phone use comfortable.

## Current State Audit

### Button inventory by screen state

| State | Button(s) | Container | Positioning mechanism |
|-------|-----------|-----------|----------------------|
| **Idle / Practice tab** | Practice | `.practice-zone-action` inside `.practice-card` | Flow: `text-align: center; margin-top: var(--space-5)` -- sits below scope toggles inside card |
| **Active quiz** | Next / Continue | `.next-btn` (ActionButton) in `.quiz-controls` | Flow: `display: block; margin: var(--space-4) auto`. Controls zone pushed to bottom via `margin-top: auto` |
| **Round complete** | Keep Going + Stop | `.page-action-row` in `.quiz-controls` | Flex row: `margin: var(--space-4) auto var(--space-2)`. Also pushed to bottom via `margin-top: auto` on `.quiz-controls` |
| **Speed check intro** | Start | `.calibration-action-btn` in `.quiz-controls` | Flow: `display: block; margin: var(--space-6) auto 0` |
| **Speed check results** | Done | `.calibration-action-btn` in `.quiz-controls` | Same as intro |

### How each works spatially

**Idle state (Practice button):** The Practice button lives at the bottom of the
`.practice-card`, which is a flow-positioned card inside the Practice tab. Its
vertical position depends entirely on how much content is above it (status,
suggestion card, scope toggles). On modes with many toggles (e.g., 6 distance
groups), the button is pushed well below the fold. On simple modes (no scope
controls), it sits higher. There is no anchoring to the viewport.

**Active quiz (Next button):** The `.quiz-area` is a flex column filling the
viewport (`flex: 1` inside the mode-screen which is `min-height: 100dvh` during
active phase). `.quiz-controls` has `margin-top: auto`, pushing it toward the
bottom of the viewport. The Next button sits at the bottom of the controls zone.
This is the best-positioned button -- it reliably lands near the bottom of the
screen on mobile.

**Round complete (Keep Going / Stop):** Uses the same `.quiz-controls` with
`margin-top: auto` mechanism as the active quiz state. The button pair lands in a
similar bottom-viewport position. A hidden `.hint-spacer` below the buttons
reserves space to prevent layout shift when transitioning from active quiz (which
has a visible hint line) to round-complete (which doesn't).

**Speed check (Start / Done):** The `.calibration-action-btn` class adds extra
top margin (`var(--space-6)`) and custom padding. These buttons sit inside
`.quiz-controls` within the quiz area, so they benefit from the same
`margin-top: auto` bottom-push. However, the speed check renders its own
`.quiz-content` and `.quiz-controls` divs directly (not via the `QuizArea`
component's two-zone pattern), so the structure is slightly different.

### Key inconsistencies

1. **Idle vs. active position gap.** The Practice button in idle state is
   flow-positioned inside a card, with no viewport anchoring. The Next button in
   active state is viewport-anchored near the bottom. When the user taps
   Practice, the primary action "jumps" from its card position to the bottom of
   the screen. When they stop and return to idle, it jumps back.

2. **Practice button position varies by mode.** Modes with many scope toggles
   push Practice lower. Modes with no scope push it higher. The button has no
   consistent vertical position across modes in idle state.

3. **Speed check buttons use a different margin.** `.calibration-action-btn`
   overrides with `margin: var(--space-6) auto 0` instead of the standard
   `.next-btn` margin of `var(--space-4) auto var(--space-2)`. This creates a
   visually different gap above the Start/Done buttons during calibration.

4. **Round-complete hint spacer is a workaround.** `RoundCompleteActions` renders
   `<div class='hint hint-spacer'>&nbsp;</div>` to keep the buttons in the same
   position as the Next button + hint in the active state. This is fragile -- any
   change to hint styling or margin breaks the alignment.

## Proposed Standard

### Design principle

Primary action buttons should have **consistent, predictable vertical
positioning** across all screen states within a mode. The user's thumb should
find the primary action in the same zone every time.

### Recommended approach: bottom-anchored action zone

Use the existing `margin-top: auto` pattern (already working well in
`.quiz-controls`) and extend it to the idle state. The Practice button should
sit in a viewport-anchored zone at the bottom of the visible content area, not
inside the scrollable practice card.

**Structure:**

```
Idle state:
  .mode-top-bar        (fixed at top, flex-shrink: 0)
  .mode-tabs           (flex-shrink: 0)
  .tab-content         (flex: 1, scrollable if needed)
    .practice-card     (status, suggestion, scope -- NO action button)
  .mode-idle-action    (NEW: flex-shrink: 0, bottom-anchored)
    Practice button

Active state (already correct):
  .quiz-session        (flex-shrink: 0)
  .quiz-area           (flex: 1)
    .quiz-content      (flex: 1, centered)
    .quiz-controls     (margin-top: auto)
      answer buttons, Next/Continue, hint

Round-complete (already correct):
  .quiz-area           (flex: 1)
    .quiz-content      (flex: 1, centered)
    .quiz-controls     (margin-top: auto)
      Keep Going + Stop
```

### Why bottom-anchored, not fixed-position

- `position: fixed` creates issues with virtual keyboards on mobile, safe area
  insets, and overlapping scrollable content.
- The existing `margin-top: auto` inside a flex column is simpler, already
  battle-tested in the quiz phase, and doesn't fight the browser's layout engine.
- On short screens where content exceeds viewport, the button should scroll with
  the content (below it), not float over it.

### Mobile ergonomics

Bottom-of-viewport is the natural thumb zone for one-handed phone use. The
active quiz state already gets this right. Extending it to idle state means the
user's thumb targets the same zone for Practice, Next, Keep Going, and Start.

## Implementation Approach

### Phase 1: Extract Practice button from PracticeCard

**Goal:** Move the Practice button out of `PracticeCard` into a sibling element
that can be independently positioned.

1. **`PracticeCard` component** (`src/ui/mode-screen.tsx`): Remove the
   `.practice-zone-action` / `StartButton` rendering from inside PracticeCard.
   PracticeCard becomes purely status + suggestion + scope.

2. **`PracticeTab` component** (`src/ui/mode-screen.tsx`): Render `StartButton`
   as a sibling after `TabbedIdle`, not inside the tab content. This lets it sit
   outside the scrollable tab panel.

3. **`GenericMode`** and **`SpeedTapMode`**: No changes needed -- they call
   `PracticeTab` which handles the restructuring.

4. **CSS**: Make `.mode-screen.phase-idle` a flex column (mirroring the active
   phase pattern). The new `.mode-idle-action` zone gets `margin-top: auto` to
   push it toward the bottom.

### Phase 2: Normalize calibration button margins

**Goal:** Make speed check Start/Done buttons use the same spacing as Next.

1. **Remove** `.calibration-action-btn` margin/padding overrides from
   `src/styles.css`.
2. **Apply** `.next-btn` class to the calibration ActionButtons in
   `SpeedCheckIntro` and `SpeedCheckResults` (`src/ui/speed-check.tsx`).

### Phase 3: Remove hint spacer workaround

**Goal:** The hint spacer in `RoundCompleteActions` exists to keep buttons
aligned with the active-state Next+hint layout. Once all action buttons are
consistently bottom-anchored via the flex layout, the spacer is unnecessary.

1. Remove `<div class='hint hint-spacer'>&nbsp;</div>` from
   `RoundCompleteActions`.
2. Remove `.hint-spacer` CSS rule.

## Files to Modify

| File | Change |
|------|--------|
| `src/ui/mode-screen.tsx` | Extract `StartButton` from `PracticeCard`; render in `PracticeTab` as sibling after tabs |
| `src/ui/speed-check.tsx` | Normalize button class/margin on `SpeedCheckIntro` and `SpeedCheckResults` |
| `src/styles.css` | Add `.mode-screen.phase-idle` flex column layout; add `.mode-idle-action`; remove `.calibration-action-btn` overrides; remove `.hint-spacer` |

## Risks and Open Questions

1. **Scroll behavior on small screens.** If the Practice tab content is tall
   (e.g., 6 group toggles + suggestion card), and the Practice button is outside
   the scrollable area, the button might overlay content. Need to verify that the
   flex layout handles this gracefully -- the button should be pushed below
   content, not floating over it. May need `min-height: 0` on the scrollable
   area and `overflow-y: auto`.

2. **Progress tab doesn't have an action button.** When the user switches to the
   Progress tab, the Practice button should probably remain visible (it's still
   the primary action). This means the button must sit outside the tab panels,
   which the proposed structure supports.

3. **Transition animation.** Moving the Practice button from inside the card to
   outside it will change its visual position on existing installations. No
   animation needed -- this is a layout improvement, not a state transition. But
   worth noting for visual regression review.
