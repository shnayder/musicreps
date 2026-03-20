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

**Problems:**
- Tabs are not accessible once you scroll
- Settings and current version only accessible after scrolling all the way
  down (mostly a dev inconvenience)

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
- SkillHeader scrolls away — progress bar becomes invisible
- Action button ("Practice") is inline in content — not anchored; scrolls
  below the fold on long configs
- Bottom nav and tab content don't coordinate well
- Tab bar is part of the content DOM, hard to fix independently

### Mode screen — active quiz

Full-viewport layout. No scrolling. Prompt area centered, controls at bottom.

```
┌──────────────────────┐
│ QuizSession header    │ ← countdown bar + session info + close
├──────────────────────┤
│                       │
│   prompt / fretboard  │ ← centered vertically
│   answer buttons      │
│                       │
├──────────────────────┤
│ feedback + next       │ ← pinned to bottom
└──────────────────────┘
```

The prompt + answer controls belong together in the main content area.
Feedback and the "Next" action belong in the footer — they're the response
to the user's action and the path forward.

### Mode screen — round complete

```
┌──────────────────────┐
│                       │
│  Round Complete       │ ← centered
│  heading + count +    │
│  stats                │
│                       │
├──────────────────────┤
│ Keep Going / Stop     │ ← pinned to bottom
└──────────────────────┘
```

---

## Proposed Structure

Three layout zones that are consistent across all states.

### The three zones

```
┌──────────────────────┐
│ HEADER                │ ← always visible, not scrollable
├──────────────────────┤
│                       │
│ MAIN                  │ ← content area (scrollable for info/nav
│                       │    screens; not scrollable during active
│                       │    practice)
├──────────────────────┤
│ FOOTER                │ ← always visible, not scrollable
└──────────────────────┘
```

- **Header**: fixed to top. Contains identity and/or navigation. Content
  varies by state but position is constant.
- **Main**: content area between header and footer. Takes all remaining space.
  Scrollable for info screens (progress, about); not scrollable during active
  practice (quiz, round complete).
- **Footer**: fixed to bottom. Contains navigation, feedback, or primary
  action depending on state.

### How each state uses the zones

| State | Header | Main | Footer |
|-------|--------|------|--------|
| Home | Title + tagline | Skill cards | Bottom nav: Active / All Skills / Settings tabs |
| Idle | SkillHeader (title + progress) | Tab content (scrollable) | Action button above bottom nav (mobile) |
| Active quiz | QuizSession (countdown + info + close) | Prompt + answer controls (not scrollable) | Feedback + next |
| Round complete | (empty or minimal) | Round stats (not scrollable) | Keep Going / Stop |
| Calibration | (minimal) | Speed check content | Speed check controls |

### Action button placement

**Rule: primary action always in footer zone.**

| State | Footer content |
|-------|---------------|
| Idle (practice tab) | "Practice" button (above nav on mobile) |
| Idle (progress tab) | Bottom nav only |
| Idle (about tab) | Bottom nav only |
| Active quiz — awaiting | (answer buttons are in main, not footer) |
| Active quiz — feedback | Feedback display + "Next" |
| Round complete | "Keep Going" / "Stop" |

On mobile, the footer can have two layers: the action area above, the nav bar
below. On desktop, nav moves to the header area, so the footer is just the
action.

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
│ quiz-content          │ ← centered, not scrollable
│ (prompt / fretboard)  │
│ answer buttons        │
├──────────────────────┤
│ feedback + next       │ ← fixed bottom
└──────────────────────┘

Home screen:
┌──────────────────────┐
│ Title + tagline       │ ← scrolls with content
├──────────────────────┤
│ Skill cards...        │ ← scrolls
├──────────────────────┤
│ ░ Active ░ All ░ ⚙ ░ │ ← fixed bottom nav
└──────────────────────┘
```

---

## Decisions

### 1. SkillHeader: fixed

Fixed to top. It's compact (~50px) and the progress bar provides always-visible
context.

### 2. "Practice" button: fixed in footer

Always anchored above the bottom nav, not inline in scrollable content.
Main content layout (what goes between header and footer) is a separate concern.

### 3. Bottom nav + action button: stacked (idle), hidden nav (quiz)

During idle: both the action button and nav bar are visible, stacked.
During active quiz: nav bar hides; quiz has its own full-screen layout.

### 4. Home screen: add bottom nav

Move Active/All Skills tabs to a bottom nav bar. Add Settings as a third tab.
Build number goes below settings content. No fixed header needed — title
scrolls with content.

### 5. Tab content padding

Main content area needs to account for fixed header and footer heights so
nothing is hidden behind them. Use a systematic approach rather than ad-hoc
per-panel padding.

---

## Next Steps

1. Implement the three-zone layout for the mode screen idle phase
2. Move "Practice" button to fixed footer zone
3. Restructure home screen: move tabs to bottom nav, add Settings tab
4. Adjust active quiz layout: feedback + next in footer, prompt + controls
   in main
5. Design the main content area layout (internal structure within the main
   zone) as a follow-on
