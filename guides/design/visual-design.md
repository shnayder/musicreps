# Visual Design Guide

Current-state reference for Music Reps' design system — colors, typography,
spacing, and component patterns. All values are defined as CSS custom properties
in `src/styles.css` `:root`.

### Design reference pages

Live HTML pages for visual iteration. Hand-written pages (`colors.html`,
`components.html`) link directly to `src/styles.css` — just edit and refresh.
`moments.html` is build-generated, so run `npx tsx build.ts` after edits.

| Page                               | Contents                                       | Source                                   |
| ---------------------------------- | ---------------------------------------------- | ---------------------------------------- |
| [colors.html](colors.html)         | Color swatches, heatmap scale, semantic tokens | Hand-written                             |
| [components.html](components.html) | Isolated component specimens                   | Hand-written                             |
| [moments.html](moments.html)       | Assembled screen layouts at 402px (all phases) | **Build-generated** (`npx tsx build.ts`) |

`moments.html` uses the same `modeScreen()`, `fretboardSVG()`, and button
helpers as the production app, so it never drifts from reality. To add or change
a moment, edit `buildMoments()` in `build.ts`.

For visual design principles (drill-first aesthetic, warmth, feedback clarity,
information density, mobile-primary), see
[design-principles.md](../design-principles.md). For layout and screen structure
principles, see [layout-and-ia.md](layout-and-ia.md).

---

## Color System

### Color Design Principles

These principles govern all color decisions and should be applied when modifying
the palette or adding new color tokens:

1. **Bright ends, faded middle** — the heatmap scale has vivid, high-saturation
   colors at both extremes ("needs work" and "automatic") with muted, lower-
   saturation tones in the middle. This makes the endpoints pop and draws
   attention to items that are either struggling or mastered.
2. **Warm-to-cool sequential hue** — the heatmap transitions from warm
   terracotta (hue ~15°) to cool sage (hue ~88°), a ~73° arc. This provides good
   perceptual separation without relying on red/green as the sole differentiator
   (colorblind-safe).
3. **Monotonically decreasing lightness** — heatmap levels go from L=68% down to
   L=33%. This ensures the scale reads correctly in grayscale and for users with
   color vision deficiencies. Text switches to white for L ≤ 50%.
4. **Sage brand is earthy, not neon** — the brand color sits at moderate
   saturation (35%) and lightness (45%), evoking a natural, focused practice
   space rather than a flashy game.
5. **Semantic colors are sacrosanct** — green = correct, red = wrong, blue =
   focus. These never change and are never used for decorative or brand
   purposes. Brand color is never used for correct/wrong feedback.
6. **Warm neutral chrome** — text, surfaces, and borders use warm-shifted grays
   (`hsl(30, …)`) to avoid a sterile wireframe feel.

### Brand

Sage green — natural, earthy feel. Distinct from feedback colors, works on light
and dark backgrounds.

| Token                | Value               | Usage                                               |
| -------------------- | ------------------- | --------------------------------------------------- |
| `--color-brand`      | `hsl(90, 35%, 45%)` | Start Quiz CTA, active stats toggle, focus outlines |
| `--color-brand-dark` | `hsl(90, 35%, 35%)` | CTA hover, nav active text                          |
| `--color-brand-bg`   | `hsl(90, 25%, 94%)` | Nav active item background                          |

**Rules:**

- Brand color for CTAs and identity elements only
- Never use brand color for correct/wrong feedback (use
  `--color-success`/`--color-error`)

### Semantic Colors

These are unchanged from the original design:

| Token                  | Value     | Usage                                   |
| ---------------------- | --------- | --------------------------------------- |
| `--color-success`      | `#4CAF50` | Active toggles, progress bar, countdown |
| `--color-success-dark` | `#388E3C` | Calibration target border               |
| `--color-success-bg`   | `#e8f5e9` | Mastery message background              |
| `--color-success-text` | `#2e7d32` | Text on success backgrounds             |
| `--color-error`        | `#f44336` | Incorrect answer, expired countdown     |
| `--color-error-bg`     | `#ffebee` | Wrong chord-slot background             |
| `--color-error-text`   | `#c62828` | Text on error backgrounds               |
| `--color-focus`        | `#2196F3` | Active chord-slot border                |
| `--color-focus-bg`     | `#e3f2fd` | Active chord-slot background            |
| `--color-recommended`  | `#FF9800` | Orange glow on suggested toggles        |
| `--color-highlight`    | `#FFD700` | Current fretboard question (SVG)        |

### Text (Warm Neutrals)

Subtle warmth instead of pure grays — shifted `hsl(30, …)` for cohesion.

| Token                | Value              | Usage                    |
| -------------------- | ------------------ | ------------------------ |
| `--color-text`       | `hsl(30, 5%, 20%)` | Primary text, headings   |
| `--color-text-muted` | `hsl(30, 3%, 40%)` | Labels, hints, secondary |
| `--color-text-light` | `hsl(30, 3%, 60%)` | Tertiary, close buttons  |

### Surfaces & Backgrounds

| Token                     | Value               | Usage                                |
| ------------------------- | ------------------- | ------------------------------------ |
| `--color-bg`              | `#fff`              | Page background, button default      |
| `--color-surface`         | `hsl(30, 10%, 96%)` | Quiz card bg, toggles, table headers |
| `--color-surface-hover`   | `hsl(30, 8%, 93%)`  | Button/nav hover state               |
| `--color-surface-alt`     | `hsl(30, 8%, 92%)`  | Progress bar bg, countdown bg        |
| `--color-surface-pressed` | `hsl(30, 5%, 82%)`  | Button `:active` state               |
| `--color-surface-accent`  | `hsl(30, 8%, 90%)`  | Accidental note button bg            |

### Borders

| Token                    | Value              | Usage                              |
| ------------------------ | ------------------ | ---------------------------------- |
| `--color-border`         | `hsl(30, 5%, 60%)` | Toggle borders, chord-slot borders |
| `--color-border-light`   | `hsl(30, 5%, 80%)` | Table borders, toggle separator    |
| `--color-border-lighter` | `hsl(30, 5%, 86%)` | Section dividers                   |

### Heatmap (Warm to Sage)

Warm-to-cool sequential scale matching the fretboard circle palette.
Monotonically decreasing lightness ensures grayscale readability. Text switches
to white on levels 3–5 (L ≤ 50%) via `heatmapNeedsLightText()`.

| Token            | Value               | Meaning              |
| ---------------- | ------------------- | -------------------- |
| `--heatmap-none` | `hsl(30, 4%, 85%)`  | No data (unseen)     |
| `--heatmap-1`    | `hsl(12, 48%, 65%)` | Needs work (<20%)    |
| `--heatmap-2`    | `hsl(30, 48%, 58%)` | Fading (>20%)        |
| `--heatmap-3`    | `hsl(50, 40%, 50%)` | Getting there (>40%) |
| `--heatmap-4`    | `hsl(72, 38%, 42%)` | Solid (>60%)         |
| `--heatmap-5`    | `hsl(90, 45%, 35%)` | Automatic (>80%)     |

### Fretboard SVG

Circle-based design — one `<circle class="fb-pos">` per position with inline
fill color. No text inside circles; hover card shows note details.

| Element                    | Color                | Usage                                 |
| -------------------------- | -------------------- | ------------------------------------- |
| `.fb-pos` (default)        | `hsl(30, 5%, 90%)`   | Dormant position circles              |
| `.fb-pos` (quiz highlight) | `hsl(50, 100%, 50%)` | Active question — vivid yellow        |
| `.fb-pos` (tap correct)    | `hsl(90, 45%, 35%)`  | Found position — sage green           |
| `.fb-string`               | `hsl(30, 8%, 72%)`   | String lines                          |
| `.fb-fret`                 | `hsl(30, 5%, 82%)`   | Fret lines                            |
| `.fb-nut`                  | `hsl(30, 8%, 48%)`   | Nut bar at fret 0                     |
| `.fb-marker`               | `hsl(30, 5%, 62%)`   | Inlay dots (3, 5, 7, 9, double at 12) |

Heatmap colors on fretboard circles match the `--heatmap-*` scale above. No fret
numbers — dropped for legibility at mobile sizes.

---

## Typography Scale

7 tokens consolidating 15+ previous `font-size` values:

| Token         | Size     | Maps to                                          |
| ------------- | -------- | ------------------------------------------------ |
| `--text-xs`   | 0.75rem  | Legend labels, progress text, tiny stats         |
| `--text-sm`   | 0.85rem  | Session stats, settings, table text, calibration |
| `--text-base` | 1rem     | Body, buttons, nav items, hints                  |
| `--text-md`   | 1.125rem | Answer buttons, note buttons, chord slots        |
| `--text-lg`   | 1.3rem   | Mode title                                       |
| `--text-xl`   | 1.5rem   | Back button, feedback, close buttons             |
| `--text-2xl`  | 2rem     | Home title, quiz prompts                         |

Font weights: 400 (normal), 500 (medium — buttons/labels), 600 (semibold —
headings, CTA).

---

## Spacing Scale

6 tokens consolidating 9+ gap/padding values:

| Token       | Value          | Usage                           |
| ----------- | -------------- | ------------------------------- |
| `--space-1` | 0.125rem (2px) | Toggle gaps                     |
| `--space-2` | 0.25rem (4px)  | Button grid gaps, tight padding |
| `--space-3` | 0.5rem (8px)   | Standard gap, small padding     |
| `--space-4` | 0.75rem (12px) | Section gaps, nav padding       |
| `--space-5` | 1rem (16px)    | Body padding, section spacing   |
| `--space-6` | 1.5rem (24px)  | Large section gaps              |

---

## Component Patterns

### Primary Button (Start Quiz)

Brand sage background, white text, subtle shadow, hover darkens. Uses
`.start-btn` class applied via `modeScreen()` scaffold.

```css
background: var(--color-brand);
color: white;
border: 2px solid var(--color-brand);
border-radius: 8px;
font-weight: 600;
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
```

### Secondary Buttons (Stop, Recalibrate)

Outlined, not filled. `.stop-btn` has normal border; `.recalibrate-btn` has
lighter border and muted text.

### Answer / Note Buttons

White background, 2px muted border, hover/active/focus states. Accidental
buttons use `--color-surface-accent` background.

### Toggle Buttons (String, Distance)

`--color-surface` inactive, `--color-toggle-active` active. 36px minimum size
for touch targets. Transition and hover states.

### Stats Toggle (Recall / Speed)

Uses `--color-brand` for active state instead of `--color-success`, providing
visual distinction from content toggles.

### Home Screen

Full-screen mode selector. Mode buttons are cards with name + description,
grouped by category with uppercase labels. Settings button and version in
footer.

Groups:

- **Fretboard:** Guitar Fretboard, Ukulele Fretboard, Speed Tap
- **Theory Lookup:** Note ↔ Semitones, Interval ↔ Semitones
- **Calculation:** Semitone Math, Interval Math
- **Keys & Chords:** Key Signatures, Scale Degrees, Diatonic Chords, Chord
  Spelling

### Mode Top Bar

Each mode screen has a simple top bar: ← back button + mode title. Hidden during
active quiz and calibration phases.

### Practice Card

Consolidated single card containing: status → recommendation → scope toggles →
Start Quiz CTA. Uses `--color-surface` background, 8px radius.

### Quiz Session Info

During active quiz: full-width countdown bar (4px, depletes over 60s, turns red
in last 10s) + single compact info row (context, time, count, × close).

### Quiz Area

Active quiz area gets `--color-surface` background via phase class on the mode
screen container. Lighter border (1px `--color-border-lighter`) and reduced
padding during active state.

### Round Complete Stats

Three stats in a row: correct (x/y), median time, fluent (x/y). Round number in
heading.

---

## Interaction Patterns

### Hover (Desktop)

Darken background slightly. No layout shift.

```css
transition: background 0.15s ease, border-color 0.15s ease;
```

### Active / Pressed

`--color-surface-pressed` background, subtle `scale(0.97)` on buttons.

### Focus Visible (Keyboard)

```css
:focus-visible {
  outline: 2px solid var(--color-brand);
  outline-offset: 2px;
}
```

Mouse/touch users see no outline (`:focus:not(:focus-visible)` removes it).

### Transitions

- Color changes: `0.15s ease`
- Layout/size: `0.1s ease` (transform scale)
- Progress bar: `0.3s ease` (width)
- Countdown bar: `0.2s linear`

---

## Accessibility Standards

- **WCAG AA contrast:** 4.5:1 for normal text, 3:1 for large text
- **No red/green as sole differentiator:** Heatmap uses terracotta-to-sage
- **44px minimum touch targets:** All answer/note buttons are 48px tall
- **`@media (prefers-reduced-motion: reduce)`:** Disables all transitions and
  animations
- **`:focus-visible`** on all interactive elements
- **Semantic color separation:** Feedback always green/red; brand never for
  correct/wrong
