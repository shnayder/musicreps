# Fretboard Mode — Information Architecture

Wireframe-level IA description for guitar and ukulele fretboard modes.
Applies to both instruments with minor differences (string count, tuning).

---

## Top-Level Structure

```
Screen: Fretboard
 ├── Header (shared top bar)
 ├── Tab Bar
 │    ├── Practice (default landing)
 │    └── Progress
 ├── Tab Content (Practice or Progress)
 ├── Quiz Session (active phase only)
 └── Quiz Area (active phase only)
```

The tab bar and tab content are only visible during idle phase. During active
quiz, calibration, and round-complete, they are hidden and replaced by the
quiz-session + quiz-area scaffold.

---

## Practice Tab (Default Landing)

**Intent:** choose focus → start session quickly.

### 1. Practice Summary (compact guidance)

```
PracticeSummarySection
 ├── OverallStatus
 │    ├── label (e.g., "Overall recall: Solid")
 │    └── detail ("12 of 78 positions fluent")
 ├── SuggestedFocusCard
 │    ├── text ("Recommended: G and D strings")
 │    └── action button ("Use recommendation")
 └── QuickStatsRow
      └── string-level mastery chips (colored by avg automaticity)
```

No fretboard map here — this tab is about deciding and starting, not
inspecting.

### 2. Practice Scope

```
PracticeScopeSection
 ├── StringsSelector
 │    ├── multi-select chips (E A D G B e)
 │    └── (future: preset chips: All, Weak only)
 └── NoteFilter
      └── Natural only toggle
```

### 3. Start Section

```
StartSection
 ├── SessionSummaryText ("3 strings · natural notes · 60s")
 ├── MasteryMessage (conditional: "Looks like you've got this!")
 └── StartPracticeButton (primary CTA)
```

### 4. Advanced (Collapsed)

```
AdvancedSection (<details> element, collapsed by default)
 └── Recalibrate Speed Thresholds
```

---

## Progress Tab

**Intent:** inspect learning state and diagnose weak areas.

### 1. View Controls

```
ViewControlsSection
 └── ViewModeToggle
      ├── Recall
      └── Speed
```

### 2. Fretboard Visualization (primary element)

```
FretboardMapSection
 ├── FretboardSVG (heatmap-colored circles + note labels)
 └── Legend (heatmap color scale)
```

The fretboard SVG is the same element used during the active quiz (for
highlighting the question position). It lives outside the tab content divs
in the DOM so it can be shown during both idle/progress and active phases.
Visibility is controlled via CSS classes.

### 3. Future Enhancements

- Tap note → detail drawer (response time distribution, confidence, last
  practiced, suggested drills)
- Per-string performance breakdown
- Position/fret performance breakdown
- Recent improvements / regressions
- Overall mastery trend chart

---

## Phase Visibility Matrix

| Element | Idle (Practice) | Idle (Progress) | Active | Calibration | Round Complete |
|---------|:-:|:-:|:-:|:-:|:-:|
| Tab bar | ✓ | ✓ | — | — | — |
| Practice tab content | ✓ | — | — | — | — |
| Progress tab content | — | ✓ | — | — | — |
| Fretboard SVG | — | ✓ | ✓ | — | — |
| Quiz session | — | — | ✓ | ✓ | ✓ |
| Quiz area | — | — | ✓ | ✓ | ✓ |

---

## Decision Log

- **Fretboard SVG placement:** Lives outside tab content divs so it can serve
  both idle-progress (heatmap) and active-quiz (question highlight) phases
  without DOM duplication.
- **Practice tab is default:** Users visit this screen to practice. Progress
  inspection is secondary — available one tap away but not the landing state.
- **Collapsed advanced section:** Recalibration is infrequent. Hiding it behind
  `<details>` reduces visual noise without removing access.
- **No fretboard on Practice tab:** Keeps the practice tab focused on
  "configure and start." The full map is one tab away for users who want to
  inspect before practicing.
