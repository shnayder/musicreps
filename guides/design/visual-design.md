# Visual Design Guide

Current-state reference for Music Reps' design system — colors, typography,
spacing, and component patterns. All values are defined as CSS custom properties
in `src/styles.css` `:root`.

### Design reference pages

Live HTML pages for visual iteration. Build-generated pages use the same Preact
components and HTML helpers as production — rebuild (`deno task build`) or
refresh the dev server after edits. Hand-written pages link directly to
`src/styles.css` so CSS changes are visible on refresh with no rebuild.

| Page                                               | Contents                                       | Source                                                 |
| -------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------ |
| [components-preview.html](components-preview.html) | Preact UI components with mock data            | **Build-generated** from `src/ui/preview.tsx`          |
| [moments.html](moments.html)                       | Assembled screen layouts at 402px (all phases) | **Build-generated** by `buildMoments()` in `main.ts`  |
| [colors.html](colors.html)                         | Color swatches, heatmap scale, semantic tokens | Hand-written                                           |
| [components.html](components.html)                 | Design tokens, layout patterns, variant A/B    | Hand-written                                           |

**Component preview** (`components-preview.html`) is the primary tool for
iterating on component design. It renders real Preact components (`NoteButtons`,
`PracticeCard`, `StatsGrid`, `RoundComplete`, etc.) with fixture data, so
changes to `src/ui/*.tsx` are immediately visible after a rebuild. Available at
`localhost:8001/preview` during dev.

**Moments** (`moments.html`) shows assembled screen states (quiz active,
feedback, round complete, idle tabs) using the same `modeScreen()` and button
helpers as production. To add or change a moment, edit `buildMoments()` in
`main.ts`.

**Components** (`components.html`) covers design system primitives that aren't
Preact components: CSS custom property swatches, spacing/typography scales,
grid patterns, touch-target sizing, and variant comparison panels for A/B
iteration. It overlaps with `colors.html` on token visualization.

For visual design principles (drill-first aesthetic, warmth, feedback clarity,
information density, mobile-primary), see
[design-principles.md](../design-principles.md). For layout and screen structure
principles, see [layout-and-ia.md](layout-and-ia.md).

---

## Color System

### Palette Model

Three colors carry all the meaning:

- **Green** — actions, correctness, brand identity
- **Gold** — attention, recommendations, achievements
- **Red** — errors only

Everything else is warm neutral chrome. This simplicity is intentional: during a
drill, the user should never have to decode what a color means.

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
4. **Green is the one active color** — brand, success, focus, and active toggles
   all share the same deep green (`#2e7d32`). This avoids a rainbow of competing
   hues during drills and reinforces a single "go/correct/active" signal.
5. **Gold for attention, red for errors** — gold draws the eye to
   recommendations and highlights without implying right/wrong. Red is reserved
   strictly for incorrect answers and expired countdowns.
6. **Warm neutral chrome** — text, surfaces, and borders use warm-shifted grays
   (`hsl(30, …)`) to avoid a sterile wireframe feel.

### Brand / Success (Green)

Deep green — unified brand and success color. CTAs, correct feedback, active
toggles, and focus states all share this hue.

| Token                   | Value     | Usage                                      |
| ----------------------- | --------- | ------------------------------------------ |
| `--color-brand`         | `#2e7d32` | CTA, correct feedback, active toggles      |
| `--color-brand-dark`    | `#1b5e20` | CTA hover, nav active text, pressed state  |
| `--color-brand-bg`      | `#e8f5e9` | Success/brand background                   |
| `--color-success`       | `#2e7d32` | Alias — same as brand                      |
| `--color-success-dark`  | `#1b5e20` | Alias — same as brand-dark                 |
| `--color-success-bg`    | `#e8f5e9` | Alias — same as brand-bg                   |
| `--color-success-text`  | `#1b5e20` | Text on success/brand backgrounds          |
| `--color-focus`         | `#2e7d32` | Active chord-slot border (green, not blue) |
| `--color-focus-bg`      | `#e8f5e9` | Active chord-slot background               |
| `--color-toggle-active` | `#2e7d32` | Active string/distance toggle              |

### Gold (Attention)

Gold draws the eye to recommendations and the current question without implying
right/wrong.

| Token                        | Value               | Usage                      |
| ---------------------------- | ------------------- | -------------------------- |
| `--color-highlight`          | `#EAB308`           | Current fretboard question |
| `--color-recommended`        | `#D4A017`           | Recommendation badges      |
| `--color-toggle-recommended` | `hsl(44, 80%, 46%)` | Recommended toggle glow    |

### Error (Red)

Red is reserved strictly for incorrect answers and expired countdowns.

| Token                | Value     | Usage                               |
| -------------------- | --------- | ----------------------------------- |
| `--color-error`      | `#f44336` | Incorrect answer, expired countdown |
| `--color-error-bg`   | `#ffebee` | Wrong chord-slot background         |
| `--color-error-text` | `#c62828` | Text on error backgrounds           |

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

### Heatmap (Gold to Green)

Gold-to-green sequential scale: gold = "needs attention", green = "mastered".
Monotonically decreasing lightness ensures grayscale readability. Text switches
to white on levels 3–5 (L ≤ 50%) via `heatmapNeedsLightText()`.

| Token            | Value                | Meaning              |
| ---------------- | -------------------- | -------------------- |
| `--heatmap-none` | `hsl(30, 4%, 85%)`  | No data (unseen)     |
| `--heatmap-1`    | `hsl(44, 65%, 58%)` | Needs work (<20%)    |
| `--heatmap-2`    | `hsl(54, 45%, 52%)` | Fading (>20%)        |
| `--heatmap-3`    | `hsl(68, 30%, 46%)` | Getting there (>40%) |
| `--heatmap-4`    | `hsl(90, 38%, 38%)` | Solid (>60%)         |
| `--heatmap-5`    | `hsl(122, 46%, 33%)`| Automatic (>80%)     |

### Fretboard SVG

Circle-based design — one `<circle class="fb-pos">` per position with inline
fill color. No text inside circles; hover card shows note details.

| Element                    | Color                | Usage                                 |
| -------------------------- | -------------------- | ------------------------------------- |
| `.fb-pos` (default)        | `hsl(30, 5%, 90%)`   | Dormant position circles              |
| `.fb-pos` (quiz highlight) | `hsl(50, 100%, 50%)` | Active question — vivid yellow        |
| `.fb-pos` (tap correct)    | `hsl(122, 46%, 33%)` | Found position — matches heatmap-5    |
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

### Font Families

| Token            | Value                                    | Usage      |
| ---------------- | ---------------------------------------- | ---------- |
| `--font-display` | `'DM Serif Display', Georgia, serif`     | Home title |
| *(body)*         | `system-ui, -apple-system, sans-serif`   | Everything else |

DM Serif Display is embedded as a base64 `@font-face` at build time
(`main.ts` reads `src/DMSerifDisplay-latin.woff2`). Latin subset only, ~24KB
woff2. No external font requests — fully offline-compatible.

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

Uses `--color-brand` for active state (same green as all active elements).

### Home Screen

Full-screen mode selector. Title uses `--font-display` (DM Serif Display) with
a 32×3px green accent bar beneath it (`.home-title::after`).

Mode cards have a 3px green (`--color-brand`) left border, 10px radius, 1px
`--color-border-lighter` border, and a right-facing chevron (`::after`
pseudo-element). Card title is `--text-base` semibold; description is
`--text-sm` muted.

Section labels use `--text-sm`, bold, `--color-text-muted`, Title Case (no
`text-transform`). A thin horizontal rule extends from the label text to the
right edge via `::after` with `flex: 1`. Groups are spaced 2rem apart.

Footer: "Settings" as a text link (`.text-link`), version right-aligned,
separated by 1px `--color-border-lighter` rule.

Groups:

- **Fretboard:** Guitar Fretboard, Ukulele Fretboard, Speed Tap
- **Theory Lookup:** Note ↔ Semitones, Interval ↔ Semitones
- **Calculation:** Semitone Math, Interval Math
- **Keys & Chords:** Key Signatures, Scale Degrees, Diatonic Chords, Chord
  Spelling

### Text Link

Reusable `.text-link` class for inline link-styled interactive elements. Muted
color, no border/background, underline on hover. 44px min-height for touch
targets.

```css
color: var(--color-text-muted);
font-size: var(--text-sm);
text-decoration: none;
/* underline on hover, color darkens to --color-text */
```

### Mode Top Bar

Each mode screen has a simple top bar: ← back button + mode title. Hidden during
active quiz and calibration phases.

### Practice Card

Consolidated single card containing: status → recommendation → scope toggles →
Start Quiz CTA. Uses `--color-surface` background, 8px radius.

### Quiz Session Info

During active quiz: full-width countdown bar (4px, depletes over 60s, turns gold
in last 10s) + single compact info row (context, time, count, × close).

### Quiz Area

Active quiz area gets `--color-surface` background via phase class on the mode
screen container. Lighter border (1px `--color-border-lighter`) and reduced
padding during active state.

### Round Complete Stats

Three stats in a row: correct (x/y), median time, fluent (x/y). Round number in
heading.

---

## Layout Patterns

### Vertical centering for quiz content

Quiz content should center vertically in the available viewport height to
prevent top-stacking on larger screens. The quiz area container uses flex
column with `justify-content: center` and a min-height.

```css
.quiz-area {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: calc(100dvh - <header-height>);
}
```

**Rationale:** On phones the content fills naturally, but on tablets and
desktop the quiz prompt and buttons stack at the top with large empty space
below. Centering creates balanced whitespace above and below. The countdown
bar and session info stay pinned at the top as flex-shrink: 0 chrome.

### Stat card surface

Round-complete stats and similar summary blocks should live inside a card
surface to provide visual containment. Reuses existing tokens.

```css
background: var(--color-bg);
border: 1px solid var(--color-border-lighter);
border-radius: 12px;
padding: var(--space-5);
max-width: 360px;
margin: 0 auto;
```

**Rationale:** Floating stats on the surface background feel unfinished.
The card uses the same 12px radius as `.quiz-area.active` and the same
`--color-border-lighter` border for consistency.

### Two-row answer layout

Modes with 12 answers that map to the chromatic scale use a two-row layout:
top row for "accidental" items (5 buttons), bottom row for "natural" items
(7 buttons). The 14-column grid from `.note-buttons` is the reference
implementation; interval mode follows the same shell.

```css
.two-row-answers {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.two-row-top,
.two-row-bottom {
  display: grid;
  grid-template-columns: repeat(14, 1fr);
  column-gap: 2px;
}
/* Bottom: 7 buttons each spanning 2 of 14 sub-columns */
/* Top: 5 buttons at piano black-key offsets */
```

**Rationale:** The piano mental model is already established by the note
buttons. Intervals map 1:1 to semitones, so the same spatial layout
reinforces the semitone-to-interval association. The gap between P4 and P5
(no top-row button) mirrors the E-F piano gap.

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
