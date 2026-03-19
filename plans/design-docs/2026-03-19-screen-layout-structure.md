# Screen Layout Structure

How the app divides the viewport into fixed and scrollable zones, where
action buttons live, and how each screen state uses the structure.

## Current State

### Overall structure

The app is a single-page app. One screen is visible at a time: the home screen
or a mode screen (one per skill). Each mode screen has phases (idle, active
quiz, round complete, calibration) that show completely different content within
the same container.

### Home screen

Simple scrolling page. No fixed elements beyond the browser chrome.

```
┌──────────────────────┐
│ Title + tagline       │ ← scrolls with page
│ Tabs (Active / All)   │
│ Skill cards...        │
│ Settings + version    │
└──────────────────────┘
```

### Mode screen — idle phase

Currently the tallest and most complex layout. Content scrolls freely; nothing
is fixed except the bottom nav on mobile.

```
┌──────────────────────┐
│ SkillHeader           │ ← title + progress bar, scrolls
│ [mode-nav tabs]       │ ← fixed bottom (mobile) / static top (desktop)
├──────────────────────┤
│ Tab content           │ ← scrolls
│  Practice: config +   │
│    action button      │
│  Progress: stats +    │
│    level cards        │
│  About: description   │
├──────────────────────┤
│ ░░ bottom nav ░░░░░░ │ ← fixed bottom (mobile only)
└──────────────────────┘
```

**Problems:**
- SkillHeader scrolls away — progress bar becomes invisible.
- Action button ("Practice") is inline in content — not anchored. On long
  practice configs it scrolls below the fold.
- Bottom nav is fixed but the tab content doesn't know about it except via
  `padding-bottom: 64px`.
- The tab bar renders as part of the tab content in the DOM (inside the
  `Tabs` component), making it hard to fix independently of content.

### Mode screen — active quiz

Full-viewport layout. No scrolling. Two-zone flex column: content area
(centered prompt) and controls area (answer buttons, pinned to bottom).

```
┌──────────────────────┐
│ QuizSession header    │ ← countdown bar + session info + close
├──────────────────────┤
│                       │
│   quiz-content        │ ← flex: 1, centered vertically
│   (prompt, fretboard) │
│                       │
├──────────────────────┤
│ quiz-controls         │ ← margin-top: auto (pinned to bottom)
│  answer buttons       │
│  text input           │
│  feedback + next      │
└──────────────────────┘
```

**This works well.** Clear zones, prompt is centered, controls are anchored.
The `flex: 1` + `margin-top: auto` pattern is the right approach.

### Mode screen — round complete

Same two-zone structure as active quiz.

```
┌──────────────────────┐
│                       │
│  Round Complete       │ ← flex: 1, centered
│  heading + count +    │
│  stats                │
│                       │
├──────────────────────┤
│ Keep Going / Stop     │ ← margin-top: auto (pinned)
└──────────────────────┘
```

**This also works well.** Same pattern as quiz.

## Proposed Structure

Three layout zones that are consistent across all states.

### The three zones

```
┌──────────────────────┐
│ HEADER                │ ← always visible, not scrollable
├──────────────────────┤
│                       │
│ MAIN                  │ ← scrollable content area
│                       │
├──────────────────────┤
│ FOOTER                │ ← always visible, not scrollable
└──────────────────────┘
```

- **Header**: fixed to top of viewport (or top of mode container). Contains
  identity + navigation. Content varies by state but position is constant.
- **Main**: scrollable content area between header and footer. Takes all
  remaining space (`flex: 1; overflow-y: auto`).
- **Footer**: fixed to bottom. Contains either navigation or primary action,
  depending on state.

### How each state uses the zones

| State | Header | Main | Footer |
|-------|--------|------|--------|
| Home | Title + tagline | Skill cards | (none — or settings?) |
| Idle | SkillHeader (title + progress) | Tab content (practice config, stats, about) | Bottom nav (mobile) |
| Active quiz | QuizSession (countdown + info + close) | quiz-content (prompt, fretboard) | quiz-controls (buttons, feedback, next) |
| Round complete | (empty or minimal) | Round stats | Keep Going / Stop |
| Calibration | (minimal) | Speed check content | Speed check controls |

### Action button placement

This is the key consistency question. Where does the primary action live?

**Current:**
- Idle: "Practice" button is inline in tab content, scrolls with it
- Active: "Next" / answer buttons are in footer zone (via `margin-top: auto`)
- Round complete: "Keep Going" / "Stop" are in footer zone

**Proposed rule: primary action always in footer zone.**

| State | Footer action |
|-------|--------------|
| Idle (practice tab) | "Practice" button |
| Idle (progress tab) | Bottom nav only (no action) |
| Idle (about tab) | Bottom nav only |
| Active quiz — awaiting | Answer buttons + text input |
| Active quiz — feedback | Feedback display + "Next" |
| Round complete | "Keep Going" / "Stop" |

On mobile, the footer has two layers: the action area above, the nav bar below.
On desktop, the nav is at the top (header), so the footer is just the action.

```
Mobile idle (practice tab):
┌──────────────────────┐
│ SkillHeader           │ ← fixed top
├──────────────────────┤
│ Practice config       │ ← scrolls
│ (suggested/custom)    │
├──────────────────────┤
│ [Practice] button     │ ← fixed above nav
│ ░░ bottom nav ░░░░░░ │ ← fixed bottom
└──────────────────────┘

Mobile active quiz:
┌──────────────────────┐
│ QuizSession header    │ ← fixed top
├──────────────────────┤
│ quiz-content          │ ← centered, no scroll
│ (prompt / fretboard)  │
├──────────────────────┤
│ answer buttons        │ ← fixed bottom
│ feedback + next       │
└──────────────────────┘
```

## Open Questions

### 1. Should the SkillHeader be fixed or scroll?

**Fixed**: progress bar always visible, consistent anchor. But takes ~60px of
vertical space on a small screen.

**Scrolls**: more room for content, but user loses progress context when
scrolling through stats.

**Recommendation**: fixed on mobile (it's only ~50px with the compact progress
bar). On desktop where vertical space is plentiful, it can stay fixed too.

### 2. Should the "Practice" button be truly fixed or just at end of content?

If content is short (suggested mode — just 2 lines), the button is visible
without scrolling anyway. If content is long (custom mode with 8 levels +
item count), it might scroll below the fold.

**Recommendation**: start with fixed. If it causes problems with very short
content (too much empty space between config and button), revisit.

### 3. How does the bottom nav interact with the action button on mobile?

Two options:
- **Stacked**: action button sits directly above the nav bar. Both always visible.
- **Replaced**: during active quiz, nav bar hides and action zone takes its place.

**Recommendation**: stacked for idle (both visible), hidden nav during quiz
(quiz has its own full-screen layout with no nav).

### 4. What about the home screen?

The home screen currently has no fixed header or footer. Should it get the same
treatment?

**Recommendation**: defer. The home screen layout is simpler and works fine as
a scrolling page. Address if it becomes a problem.

### 5. Tab content padding

With fixed header + fixed footer, the main content area needs padding-top and
padding-bottom to avoid content being hidden behind them. Currently this is
done with `padding-bottom: 64px` on tab panels for the nav bar. Need a more
systematic approach.

**Recommendation**: use CSS custom properties for header/footer heights and
apply padding via a `.main-content` wrapper rather than per-panel.

## Implementation Approach

1. **Don't change the quiz/round-complete layouts.** They already work well
   with the two-zone pattern.
2. **Fix the idle layout.** Make SkillHeader + bottom nav fixed, main content
   scrollable between them, action button in a fixed footer zone.
3. **Use the same flex pattern** as quiz: outer container is `display: flex;
   flex-direction: column; height: 100dvh`, header and footer are fixed-size,
   main is `flex: 1; overflow-y: auto`.
4. **CSS-only where possible.** The component structure is mostly right — this
   is mainly about positioning, not restructuring.
