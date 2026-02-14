# Vision & Roadmap

## Product Vision

<!-- [NEEDS INPUT] Fill in your vision for the product — what it should
     become, who it's for, what success looks like. The framing below is
     inferred from the codebase but may not match your actual intent. -->

Fretboard Trainer builds **automaticity** — instant, effortless recall of
music theory fundamentals. The goal is to take knowledge the user already
understands conceptually and drill it until it's reflexive.

## Design Principles

These are inferred from the existing codebase and design decisions:

- **Drill, not instruction.** The app assumes the user knows the theory. It
  trains speed and accuracy, not understanding. There are no lessons or
  explanations — just questions and immediate feedback.

- **Adaptive difficulty.** Practice what you're worst at. The adaptive
  selector prioritizes items with slow response times and low recall. Items
  you've mastered fade to the background.

- **Progressive disclosure.** Consolidate before expanding. New material
  (strings, distance groups, chord types) is gated behind mastery of what's
  already been started. This prevents overwhelming the learner with too many
  items at once.

- **Minimal friction.** Single-page app, instant start, works offline via
  service worker. No login, no cloud sync, no setup. Open the page and start
  drilling.

- **Short-session friendly.** Users often practice in free moments — a few
  minutes between activities. Every session should be productive without
  warm-up overhead. State that matters (item deadlines, mastery data) persists
  across sessions so progress carries over even when sessions are brief.

- **Fewer options.** Prefer smart defaults over user-facing toggles. Every
  option adds cognitive overhead ("should I turn this on?") and creates
  configurations to test. If the system can adapt automatically — via generous
  cold starts, staircase adjustments, or baseline scaling — do that instead
  of adding a setting.

- **Personalized timing.** Motor baseline calibration means thresholds adapt
  to each user's device and physical response speed. A phone user and a
  desktop keyboard user get equivalently challenging targets.

- **Clear screen states.** Each mode has distinct states (idle/stats, quizzing,
  calibrating). Each state should have its own clear layout — elements
  irrelevant to the current state hidden, content ordered by interaction
  priority. See [layout-and-ia.md](design/layout-and-ia.md) for details.

- **Label over inference.** Toggles, progress indicators, and data displays
  need text labels. Users shouldn't have to guess what `e B G D A E` means
  or what "3 / 13" represents.

## Current State

v3.5 with 10 quiz modes:

| Category | Modes |
|----------|-------|
| Fretboard geography | Fretboard, Speed Tap |
| Note/interval fundamentals | Note ↔ Semitones, Interval ↔ Semitones |
| Arithmetic | Semitone Math, Interval Math |
| Key-based theory | Key Signatures, Scale Degrees, Diatonic Chords |
| Chord construction | Chord Spelling |

All modes use the shared adaptive selector, forgetting model, and motor
baseline calibration.

## Roadmap

### Near-term

<!-- [NEEDS INPUT] Prioritize these or replace with your actual plans. -->

- Adaptive time pressure — per-item deadlines that tighten as the user
  improves, pushing from slow calculation to automatic recall
- Minor keys for Key Signatures, Scale Degrees, Diatonic Chords, Chord Spelling
- Chord spelling reverse direction (notes → chord name)

### Medium-term

<!-- [NEEDS INPUT] -->

- JSDoc type annotations + `tsc --noEmit` type checking (from architecture
  review Phase 5)
- Audio integration (hear intervals/chords, not just name them)
- Progress visualization beyond heatmaps

### Future considerations

<!-- [NEEDS INPUT] -->

- Multi-instrument support
- Custom practice sets / session goals
- Progress export/import
- Playwright-based visual dev tool (from architecture review Phase 4)

## Design Philosophy for New Features

Guidelines inferred from how existing modes were designed:

- **Each mode independently useful.** No cross-mode gating — all modes
  freely accessible from the hamburger menu. Recommended learning order is
  documented but not enforced.

- **Bidirectional drilling when applicable.** Forward (key → note) and
  reverse (note → key) are tracked as separate items. Mixing directions
  builds deeper fluency.

- **Group items by pedagogical difficulty.** Not alphabetical or numerical
  order. Easy/common items first (I-IV-V before iii-vii°, root+5th before
  2nd+6th).

- **Reuse shared infrastructure.** Adaptive selector, `computeRecommendations()`,
  `createStatsControls()`, `createNoteKeyHandler()`. A new mode should feel
  like a natural extension, not a separate app.

- **Consistency over accommodation.** When a mode behaves differently from
  the rest, the first question is "should it?" — not "how do we support
  that?" Often the different behavior is just legacy or an early prototype
  that predates the shared system. Change the outlier to match the standard
  rather than adding complexity to support the variation. Per-mode flags and
  overrides (`mode.useX = false`, `mode.customConfig`) are a code smell;
  they usually mean the outlier should be fixed, not preserved.

- **Stats visualization for every mode.** Users should always be able to see
  what they've mastered and what needs work. Heatmaps with Recall/Speed toggle.
