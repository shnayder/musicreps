# Visual Design Guide

Reference document for Fretboard Trainer's visual design system. All values
are defined as CSS custom properties in `src/styles.css` `:root`. See the live
color reference at `guides/design/colors.html`.

**Related:** [layout-and-ia.md](layout-and-ia.md) covers screen layout,
content hierarchy, and information architecture — *where things go and why*.

---

## Design Principles

Aligned with the product vision in `guides/vision.md`:

1. **Drill-first aesthetic** — nothing distracts from drilling. Chrome fades
   away during quiz; visual weight goes to the question and answer buttons.
2. **Warmth over sterility** — inviting, like a good practice space. Warm
   neutrals, sage brand, no cold gray wireframe feel.
3. **Feedback clarity** — correct/wrong instantly recognizable via distinct
   semantic colors (green/red). Never use brand or heatmap colors for feedback.
4. **Information density** — stats scannable at a glance, not decorative.
   Heatmaps use accessible color scale; tables compact but readable.
5. **Mobile-primary** — thumb-friendly 48px touch targets, no hover-dependent
   interactions. All hover states are enhancements, not requirements.

---

## Color System

### Color Design Principles

These principles govern all color decisions and should be applied when
modifying the palette or adding new color tokens:

1. **Bright ends, faded middle** — the heatmap scale has vivid, high-saturation
   colors at both extremes ("needs work" and "automatic") with muted, lower-
   saturation tones in the middle. This makes the endpoints pop and draws
   attention to items that are either struggling or mastered.
2. **Warm-to-cool sequential hue** — the heatmap transitions from warm
   terracotta (hue ~15°) to cool sage (hue ~88°), a ~73° arc. This provides
   good perceptual separation without relying on red/green as the sole
   differentiator (colorblind-safe).
3. **Monotonically decreasing lightness** — heatmap levels go from L=68% down
   to L=33%. This ensures the scale reads correctly in grayscale and for users
   with color vision deficiencies. Text switches to white for L ≤ 50%.
4. **Sage brand is earthy, not neon** — the brand color sits at moderate
   saturation (35%) and lightness (45%), evoking a natural, focused practice
   space rather than a flashy game.
5. **Semantic colors are sacrosanct** — green = correct, red = wrong, blue =
   focus. These never change and are never used for decorative or brand purposes.
   Brand color is never used for correct/wrong feedback.
6. **Warm neutral chrome** — text, surfaces, and borders use warm-shifted
   grays (`hsl(30, …)`) to avoid a sterile wireframe feel.

### Brand

Sage green — natural, earthy feel. Distinct from feedback colors, works on
light and dark backgrounds.

| Token | Value | Usage |
|-------|-------|-------|
| `--color-brand` | `hsl(90, 35%, 45%)` | Start Quiz CTA, active stats toggle, focus outlines |
| `--color-brand-dark` | `hsl(90, 35%, 35%)` | CTA hover, nav active text |
| `--color-brand-bg` | `hsl(90, 25%, 94%)` | Nav active item background |

**Rules:**
- Brand color for CTAs and identity elements only
- Never use brand color for correct/wrong feedback (use `--color-success`/`--color-error`)

### Top Bar

| Token | Value | Usage |
|-------|-------|-------|
| `--color-topbar-bg` | `hsl(100, 15%, 22%)` | Dark top bar background |
| `--color-topbar-text` | `hsl(90, 10%, 95%)` | Top bar text, hamburger icon |

### Semantic Colors

These are unchanged from the original design:

| Token | Value | Usage |
|-------|-------|-------|
| `--color-success` | `#4CAF50` | Active toggles, progress bar, countdown |
| `--color-success-dark` | `#388E3C` | Calibration target border |
| `--color-success-bg` | `#e8f5e9` | Mastery message background |
| `--color-success-text` | `#2e7d32` | Text on success backgrounds |
| `--color-error` | `#f44336` | Incorrect answer, expired countdown |
| `--color-error-bg` | `#ffebee` | Wrong chord-slot background |
| `--color-error-text` | `#c62828` | Text on error backgrounds |
| `--color-focus` | `#2196F3` | Active chord-slot border |
| `--color-focus-bg` | `#e3f2fd` | Active chord-slot background |
| `--color-recommended` | `#FF9800` | Orange glow on suggested toggles |
| `--color-highlight` | `#FFD700` | Current fretboard question (SVG) |

### Text (Warm Neutrals)

Subtle warmth instead of pure grays — shifted `hsl(30, …)` for cohesion.

| Token | Value | Usage |
|-------|-------|-------|
| `--color-text` | `hsl(30, 5%, 20%)` | Primary text, headings |
| `--color-text-muted` | `hsl(30, 3%, 40%)` | Labels, hints, secondary |
| `--color-text-light` | `hsl(30, 3%, 60%)` | Tertiary, close buttons |

### Surfaces & Backgrounds

| Token | Value | Usage |
|-------|-------|-------|
| `--color-bg` | `#fff` | Page background, button default |
| `--color-surface` | `hsl(30, 10%, 96%)` | Quiz card bg, toggles, table headers |
| `--color-surface-hover` | `hsl(30, 8%, 93%)` | Button/nav hover state |
| `--color-surface-alt` | `hsl(30, 8%, 92%)` | Progress bar bg, countdown bg |
| `--color-surface-pressed` | `hsl(30, 5%, 82%)` | Button `:active` state |
| `--color-surface-accent` | `hsl(30, 8%, 90%)` | Accidental note button bg |

### Borders

| Token | Value | Usage |
|-------|-------|-------|
| `--color-border` | `hsl(30, 5%, 60%)` | Toggle borders, chord-slot borders |
| `--color-border-light` | `hsl(30, 5%, 80%)` | Table borders, toggle separator |
| `--color-border-lighter` | `hsl(30, 5%, 86%)` | Section dividers |

### Heatmap (Terracotta to Sage)

Warm-to-cool sequential scale. High saturation at both ends ("bright ends,
faded middle") for visual pop at the extremes. Monotonically decreasing
lightness ensures grayscale readability. Text switches to white on levels
3–5 (L ≤ 50%) via `heatmapNeedsLightText()`.

| Token | Value | Meaning |
|-------|-------|---------|
| `--heatmap-none` | `hsl(60, 5%, 93%)` | No data |
| `--heatmap-1` | `hsl(15, 55%, 68%)` | Needs work (terracotta) |
| `--heatmap-2` | `hsl(35, 55%, 58%)` | Fading (amber) |
| `--heatmap-3` | `hsl(55, 45%, 50%)` | Getting there (olive) |
| `--heatmap-4` | `hsl(72, 42%, 42%)` | Solid (olive-sage) |
| `--heatmap-5` | `hsl(88, 52%, 33%)` | Automatic (deep sage) |

### Fretboard SVG

| Token | Value | Usage |
|-------|-------|-------|
| `--color-fretboard-line` | `hsl(30, 5%, 30%)` | Fret lines, string lines, note circle borders |

SVG colors are applied via CSS rules (`.fretboard line`, `.note-circle`,
`.note-text`) which override inline presentation attributes.

---

## Typography Scale

7 tokens consolidating 15+ previous `font-size` values:

| Token | Size | Maps to |
|-------|------|---------|
| `--text-xs` | 0.75rem | Legend labels, progress text, tiny stats |
| `--text-sm` | 0.85rem | Session stats, settings, table text, calibration |
| `--text-base` | 1rem | Body, buttons, nav items, hints |
| `--text-md` | 1.125rem | Answer buttons, note buttons, chord slots |
| `--text-lg` | 1.3rem | Mode title |
| `--text-xl` | 1.5rem | Hamburger, settings gear, feedback, close buttons |
| `--text-2xl` | 2rem | Quiz prompts |

Font weights: 400 (normal), 500 (medium — buttons/labels), 600 (semibold —
headings, CTA).

---

## Spacing Scale

6 tokens consolidating 9+ gap/padding values:

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 0.125rem (2px) | Toggle gaps |
| `--space-2` | 0.25rem (4px) | Button grid gaps, tight padding |
| `--space-3` | 0.5rem (8px) | Standard gap, small padding |
| `--space-4` | 0.75rem (12px) | Section gaps, nav padding |
| `--space-5` | 1rem (16px) | Body padding, section spacing |
| `--space-6` | 1.5rem (24px) | Large section gaps |

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

Same as before: `--color-surface` inactive, `--color-success` active. Now
with transition and hover states.

### Stats Toggle (Recall / Speed)

Uses `--color-brand` for active state instead of `--color-success`, providing
visual distinction from content toggles.

### Quiz Area Card

Active quiz area gets `--color-surface` background, 12px border-radius, and
`--space-5` padding for visual containment.

### Navigation Drawer

Grouped by mode category with uppercase labels. Active item uses brand sage
left-border and `--color-brand-bg` background.

Groups:
- **Fretboard:** Fretboard, Speed Tap
- **Theory Lookup:** Note ↔ Semitones, Interval ↔ Semitones
- **Calculation:** Semitone Math, Interval Math
- **Keys & Chords:** Key Signatures, Scale Degrees, Diatonic Chords, Chord Spelling

### Top Bar Icons

Hamburger (☰) and settings gear (⚙) must share the same `font-size`,
`padding`, and `min-width`/`min-height` so the top bar height stays constant
regardless of which icons are visible. Both use `--text-xl`,
`padding: var(--space-2) var(--space-3)`, and 44×44px minimum touch targets.
When the gear hides during an active quiz, use `visibility: hidden` (not
`display: none`) so it reserves space and prevents layout shift.

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
- Nav drawer slide: `0.2s ease`

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
