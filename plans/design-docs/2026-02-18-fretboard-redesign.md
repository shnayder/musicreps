# Fretboard Redesign — Exploration & Final Direction

**Date:** 2026-02-18 **Status:** Decided — implementing

## Problem

The original fretboard had several usability issues:

- Black-outlined white circles with note text crammed inside were hard to read
  at mobile sizes
- Fret numbers below the neck were completely illegible at 400px screen width
- Heatmap colors overlaid on circles with text inside made both harder to read
- The visual treatment was functional but not polished

## Exploration Process

Built an interactive static HTML exploration page
(`fretboard-explorations.html`) and iterated through several rounds, each
narrowing the design space.

### Round 1: Five diverse directions

Explored fundamentally different approaches:

1. **Transparent Text** — no circles, note names float on strings
2. **Dot Grid** — even spacing, small filled dots, hover tooltips
3. **Vertical Dark** — rotated 90°, dark theme
4. **Cell Grid** — GitHub-style heatmap grid (dropped: doesn't look like a
   fretboard)
5. **Warm Wood / Glass** — premium dark wood aesthetic

Each exploration showed four states: Quiz, Tap Quiz, Heatmap, Blank.

**Key finding:** Direction 1 (transparent text on strings) was the most
promising starting point.

### Round 2: Riff on direction 1

Generated 5 variations based on direction 1, adding:

- Tap quiz state (user taps fretboard to find all positions of a note)
- Hover card for note details (name, string/fret, skill bar)
- Darker fret markers, double dots on fret 12 between strings 2-3 and 3-4
- Solid dots for heatmap (text inside dots was illegible)

Variations: A. Whisper (tiny dots), B. Standard (medium), C. Even Grid, D. Rings
(colored outlines), E. Data Dense (size encodes skill).

### Round 3: Simplify and unify

Key decisions:

- **Same circle size across all modes** (no size encoding)
- **Normal fret spacing** (no even grids — not realistic)
- **No borders on circles** — solid fill, hide strings underneath
- **Drop fret numbers entirely** (illegible at mobile sizes)
- Darker fret markers

Generated 5 color palette variations: Cream, Warm Gray, Translucent, Cool Slate,
High Contrast.

### Round 4: Final color tuning

Started from palette E (High Contrast), adjusted values:

- Lightened blank circles from 77% → 90% (circles don't need to stand out when
  dormant)
- Vivid yellow quiz highlight
- Reuse heatmap "good" color (sage green) for tap quiz correct

## Final Design

### Key principles

1. **Legibility is critical** — nothing decorative at the cost of readability
2. **Don't be over the top** — circles don't need to be huge without note names
3. **Consistent colors for targets** — reuse heatmap "good" color for tap
   correct

### Parameters

```
Circle radius: 10 (px in SVG coordinate space)
```

### Color palette

```javascript
blank:      'hsl(30, 5%, 90%)'     // light warm gray — dormant positions
quizHl:     'hsl(50, 100%, 50%)'   // vivid yellow — current question
quizOther:  'hsl(30, 5%, 90%)'     // same as blank — hide other positions
tapNeutral: 'hsl(30, 4%, 90%)'     // same as blank — unfound positions
tapCorrect: 'hsl(90, 45%, 35%)'    // sage green — found (= heatmap best)

heat[0]:    'hsl(30, 4%, 85%)'     // unseen
heat[1]:    'hsl(12, 48%, 65%)'    // needs work (<20%)
heat[2]:    'hsl(30, 48%, 58%)'    // fading (>20%)
heat[3]:    'hsl(50, 40%, 50%)'    // getting there (>40%)
heat[4]:    'hsl(72, 38%, 42%)'    // solid (>60%)
heat[5]:    'hsl(90, 45%, 35%)'    // automatic (>80%)
```

### SVG structure

- **One `<circle class="fb-pos">` per position** — fill set via inline style. No
  stroke, no borders. Radius 10.
- **Strings** — `hsl(30, 8%, 72%)` — visible but circles cover them at each
  position
- **Frets** — `hsl(30, 5%, 82%)` — light, unobtrusive
- **Nut** — `hsl(30, 8%, 48%)` — darker bar at fret 0
- **Fret markers** — `hsl(30, 5%, 62%)` — darker than before
  - Single dot at frets 3, 5, 7, 9 (center of neck)
  - Double dots at fret 12 (between strings 2-3 and 3-4)
- **No fret numbers** — dropped entirely
- **No note text elements** — note names never shown in circles

### Hover card

Positioned above the circle on hover/touch. Shows:

- Note name (bold)
- String and fret ("E string, fret 5")
- Skill label + percentage ("Solid · 65%")
- Skill bar with heatmap color fill

**Important:** Card must not clip at the top of the fretboard — when position is
on string 0 (high e), the card should appear below the circle instead.

### States

| State        | Circle fills                               | Other              |
| ------------ | ------------------------------------------ | ------------------ |
| Blank (idle) | All `blank`                                | No legend          |
| Quiz         | Highlighted = `quizHl`, rest = `quizOther` | Note buttons below |
| Tap Quiz     | Found = `tapCorrect`, rest = `tapNeutral`  | Prompt: "Find: G"  |
| Heatmap      | `heat[0..5]` based on skill                | Legend shown       |

## Changes to existing code

### fretboard.ts (build-time SVG generation)

- Remove `noteElements()` (no more text + circle pairs)
- Add `positionCircles()` generating `<circle class="fb-pos">` elements
- Update `fretMarkerDots()` — double dots between strings at fret 12
- Remove `fretNumberElements()` (no more fret numbers)
- Adjust string thickness formula

### html-helpers.ts

- Update `fretboardSVG()` to use new elements, remove fret-numbers div
- Keep string toggles unchanged

### styles.css

- Replace `.note-circle` / `.note-text` / `.fret-marker` / `.fretboard-nut`
  styles with `.fb-pos` / `.fb-marker` / `.fb-nut` styles
- Add hover card styles
- Update heatmap CSS variables to match new palette
- Remove fret-number styles

### quiz-fretboard.js

- Replace `highlightCircle` / `showNoteText` / `clearAll` with single-circle
  fill operations on `.fb-pos` elements
- Add hover card setup and positioning logic

### quiz-speed-tap.js

- Same circle-fill approach
- Update click handler to target `.fb-pos` elements

### stats-display.js / CSS variables

- Update `--heatmap-*` variables to match final palette
