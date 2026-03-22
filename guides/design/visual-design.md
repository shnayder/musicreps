# Visual Design Guide

Current-state reference for Music Reps' design system — colors, typography,
spacing, and component patterns. All values are defined as CSS custom properties
in `src/styles.css` `:root`.

### Design reference pages

Live HTML pages for visual iteration. Build-generated pages use the same Preact
components and HTML helpers as production — rebuild (`deno task build`) or
refresh the dev server after edits. Hand-written pages link directly to
`src/styles.css` so CSS changes are visible on refresh with no rebuild.

| Page                                               | Contents                                                                                       | Source                                        |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------- |
| [components-preview.html](components-preview.html) | Preact UI components with mock data, token reference (spacing, type, radius), live color system | **Build-generated** from `src/ui/preview.tsx` |

**Component preview** (`components-preview.html`) is the primary tool for
iterating on component design. It renders real Preact components (`NoteButtons`,
`PracticeCard`, `StatsGrid`, `RoundComplete`, etc.) with shared fixture data
from `src/fixtures/`, so changes to `src/ui/*.tsx` are immediately visible
after a rebuild. The **Colors** tab shows live palette ramps, semantic token
swatches, pairings, heatmap scale, and component token reference — all read
from `getComputedStyle`. The **Design System** tab includes spacing, type scale,
border radius, and shadows. Available at `localhost:8001/preview` during dev.

**Screenshots** replace the old static moments page. The Playwright script
(`scripts/take-screenshots.ts`) captures deterministic screenshots by
dispatching fixture events to the running app. Push to a `/ui/` branch to
generate screenshots in CI.

For visual design principles (drill-first aesthetic, warmth, feedback clarity,
information density, mobile-primary), see
[design-principles.md](../design-principles.md). For layout and screen structure
principles, see [layout-and-ia.md](layout-and-ia.md).

---

## Color System

### Three-Layer Token Architecture

Colors use a three-layer architecture designed for dark mode readiness and
systematic naming:

**Layer 1: Primitives** — raw color scales derived from anchor hues
(`--hue-neutral`, `--hue-brand`, `--hue-success`, `--hue-error`,
`--hue-notice`). Change one hue to shift an entire family. Naming:
`--{family}-{step}` (e.g., `--neutral-400`, `--brand-600`).

**Layer 2: Semantic tokens** — map primitives to meaning. To switch
light → dark, change these mappings (not the palette). Every color family
follows a consistent modifier pattern:

| Modifier | Purpose | Example |
|----------|---------|---------|
| *(base)* | Primary accent | `--color-brand`, `--color-error` |
| `-bg` | Background tint | `--color-brand-bg` |
| `-border` | Bordered elements | `--color-brand-border` |
| `-text` | Text on `-bg` | `--color-brand-text` |
| `-dark` | Darker variant | `--color-brand-dark` |

Families: **brand**, **success**, **error**, **notice** (gold/attention),
**accent**, **text** (trio), **surface** (5 levels), **border** (trio).
`--color-on-brand`, `--color-on-success`, `--color-on-error` provide text
colors for filled backgrounds (white in light mode, flips in dark mode).
`--color-chrome` is the segmented control / toolbar fill.

**Layer 3: Component tokens** — `--_` prefixed CSS private custom properties
defined on component root selectors, always referencing semantic tokens:

```css
.component {
  --_bg: var(--color-surface);
  --_text: var(--color-text);
  background: var(--_bg);
  color: var(--_text);
}
.component.active { --_bg: var(--color-brand); --_text: var(--color-on-brand); }
```

Components with `--_` tokens: **ActionButton** (`.page-action-btn`),
**AnswerButton** (`.answer-btn`), **Toggle** (`.string-toggle`,
`.distance-toggle`, `.notes-toggle`, `.level-toggle-btn`),
**SequentialSlot** (`.seq-slot`), **SkillCard** (`.skill-card` → `--_accent`).

**Live reference:** The preview page's **Colors** tab (`localhost:8001/preview`)
shows all palette ramps, semantic swatches, pairings, heatmap scale, and
component token mapping tables with resolved values.

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

### Using the Color System

**Always reference CSS custom properties.** If no variable covers the case,
extend the system with a new token — don't hardcode raw HSL or hex values.
One-off experiments during active iteration are fine, but finalized code should
use variables so the palette stays maintainable and discoverable.

**Semantic color families** follow a consistent pattern: an accent color plus
bg, border, and text variants. Currently three families exist:

| Family        | Accent               | `-bg`   | `-border` | `-text`  |
| ------------- | -------------------- | ------- | --------- | -------- |
| Brand/Success | `--color-brand`      | `-bg`   | —         | `-text`  |
| Error         | `--color-error`      | `-bg`   | —         | `-text`  |
| Recommended   | `--color-notice`| `-bg`   | `-border` | `-text`  |
| Accent        | `--color-accent`     | —       | —         | `-muted` |

When adding a new semantic color, follow this pattern: define the accent first,
then add `-bg`, `-border`, and `-text` variants as needed.

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
| `--color-focus`         | `#2e7d32` | Focus ring (legacy — see accent below)     |
| `--color-focus-bg`      | `#e8f5e9` | Focus background (legacy)                  |
| `--color-toggle-active` | `hsl(0, 0%, 32%)`  | Active string/distance toggle (neutral)   |

### Accent (Blue)

Warm blue for interactive "current input" states — visually distinct from
success green and neutral filled slots. Used for the active chord-slot
underline and available as a general-purpose accent throughout the app.

| Token                  | Value                  | Usage                                       |
| ---------------------- | ---------------------- | ------------------------------------------- |
| `--color-accent`       | `hsl(220, 65%, 50%)`  | Active chord-slot underline, input focus     |
| `--color-accent-muted` | `hsl(220, 40%, 65%)`  | Lighter variant for secondary accent states  |

### Gold (Attention)

Gold draws the eye to recommendations and the current question without implying
right/wrong. The recommended family has a full set of semantic variants for
card surfaces (suggestion card).

| Token                       | Value                | Usage                                   |
| --------------------------- | -------------------- | --------------------------------------- |
| `--color-highlight`         | `#EAB308`            | Current fretboard question              |
| `--color-notice`       | `#D4A017`            | Accent: suggestion card header & border |
| `--color-notice-bg`    | `hsl(44, 70%, 96%)`  | Suggestion card background              |
| `--color-notice-border`| `hsl(44, 60%, 80%)`  | Suggestion card border                  |
| `--color-notice-text`  | `hsl(44, 80%, 25%)`  | Dark gold text on recommended surfaces  |

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
| `--color-surface-raised`     | `hsl(30, 8%, 92%)`  | Progress bar bg, countdown bg        |
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
| `--heatmap-1`    | `hsl(40, 60%, 58%)` | Needs work (≤30%)    |
| `--heatmap-2`    | `hsl(48, 50%, 52%)` | Fading (>30%)        |
| `--heatmap-3`    | `hsl(60, 40%, 46%)` | Getting there (>55%) |
| `--heatmap-4`    | `hsl(80, 35%, 40%)` | Solid (>75%)         |
| `--heatmap-5`    | `hsl(125, 48%, 33%)`| Automatic (>90%)     |

### Fretboard SVG

Circle-based design — one `<circle class="fb-pos">` per position with inline
fill color. No text inside circles; hover card shows note details.

| Element                    | Color                | Usage                                 |
| -------------------------- | -------------------- | ------------------------------------- |
| `.fb-pos` (default)        | `hsl(30, 5%, 90%)`   | Dormant position circles              |
| `.fb-pos` (quiz highlight) | `hsl(50, 100%, 50%)` | Active question — vivid yellow        |
| `.fb-pos` (tap correct)    | `hsl(125, 48%, 33%)` | Found position — matches heatmap-5    |
| `.fb-string`               | `hsl(30, 8%, 72%)`   | String lines                          |
| `.fb-fret`                 | `hsl(30, 5%, 82%)`   | Fret lines                            |
| `.fb-nut`                  | `hsl(30, 8%, 48%)`   | Nut bar at fret 0                     |
| `.fb-marker`               | `hsl(30, 5%, 62%)`   | Inlay dots (3, 5, 7, 9, double at 12) |

Heatmap colors on fretboard circles match the `--heatmap-*` scale above. No fret
numbers — dropped for legibility at mobile sizes.

---

## Typography

Three-layer system paralleling colors: **palette** (raw tokens) →
**semantic roles** (what the text IS) → **component mapping** (where it's
used). See `plans/design-docs/2026-03-21-typography-system-redesign.md` for
the full design rationale.

### Layer 1: Palette

| Category | Tokens |
|---|---|
| Sizes | `--text-xs` (0.75rem) through `--text-3xl` (3rem) |
| Weights | `--font-normal` (400), `--font-medium` (500), `--font-semibold` (600), `--font-bold` (700) |
| Line heights | `--leading-none` (1), `--leading-tight` (1.2), `--leading-snug` (1.4), `--leading-normal` (1.5) |
| Families | `--font-body` (system sans), `--font-display` (DM Serif Display, embedded) |

### Layer 2: Semantic Roles (17 roles)

Each role defines 4 custom properties: `--type-{role}-size`, `-weight`,
`-leading`, `-color`. Both `.text-*` classes and bespoke classes reference
these — never palette tokens directly.

**Display** — big, high-emphasis hero text

| Role | Size | Weight | Leading | Color |
|------|------|--------|---------|-------|
| `display-brand` | 2xl | normal | tight | text |

`display-brand` also has `--type-display-brand-family: var(--font-display)`.

**Heading** — structural hierarchy

| Role | Size | Weight | Leading | Color |
|------|------|--------|---------|-------|
| `heading-page` | lg | semibold | tight | text |
| `heading-section` | base | semibold | tight | text |
| `heading-subsection` | base | semibold | tight | muted |

**Body** — readable content

| Role | Size | Weight | Leading | Color |
|------|------|--------|---------|-------|
| `body` | base | normal | normal | text |
| `body-secondary` | sm | normal | snug | muted |

**Label** — short functional identifiers

| Role | Size | Weight | Leading | Color |
|------|------|--------|---------|-------|
| `label` | sm | medium | none | muted |
| `label-tag` | xs | semibold | none | muted |

**Quiz** — drill-specific content text

| Role | Size | Weight | Leading | Color |
|------|------|--------|---------|-------|
| `quiz-instruction` | base | semibold | normal | muted |
| `quiz-prompt` | 2xl | semibold | tight | text |
| `quiz-response` | lg | semibold | none | text |
| `quiz-feedback` | xl | normal | none | text |

**Supporting** — tertiary/helper text

| Role | Size | Weight | Leading | Color |
|------|------|--------|---------|-------|
| `supporting` | xs | normal | snug | text-light |

**Metric** — data values

| Role | Size | Weight | Leading | Color |
|------|------|--------|---------|-------|
| `metric-hero` | 3xl | bold | none | brand |
| `metric-primary` | md | semibold | none | text |
| `metric-info` | base | medium | none | text |

**Status** — state communication

| Role | Size | Weight | Leading | Color |
|------|------|--------|---------|-------|
| `status` | sm | normal | snug | text |

Status color variants: `.status-success`, `.status-error`, `.status-notice`,
`.status-empty` (italic).

### Intensity Tiers

Roles at the same tier should have matched visual weight even when they
differ in size, color, or weight. Like `color.error` and `color.info` at
the same saturation — different hues, same intensity.

| Tier | Roles | Characteristic |
|------|-------|----------------|
| Hero | `display-brand`, `metric-hero` | Largest, highest emphasis |
| Primary | `heading-page`, `quiz-prompt`, `quiz-feedback` | Screen-level focal points |
| Section | `heading-section`, `heading-subsection`, `metric-primary` | Organizes content |
| Content | `body`, `body-secondary`, `label`, `quiz-instruction`, `metric-info`, `status` | Same visual weight, differentiated by weight/color |
| Tertiary | `supporting`, `label-tag` | Smallest, lowest emphasis |

When adding or adjusting a role, check that it sits at the right tier.
Roles in the same tier should feel equally prominent when placed side by
side — if one jumps out, its recipe is at the wrong tier.

### Layer 3: Component Mapping

Bespoke classes reference `--type-*` role properties for typography and add
their own layout. **No typography overrides** — every bespoke class uses its
role's recipe exactly.

### Structural Components

#### ActionButton

```tsx
<ActionButton variant='primary' onClick={start}>Practice</ActionButton>
<ActionButton variant='secondary' onClick={stop}>Stop</ActionButton>
```

`.page-action-btn` with variant class. For flow-initiating/stopping buttons.

#### Text

```tsx
<Text role='heading-page' as='h1'>Guitar Fretboard</Text>
<Text role='heading-subsection' as='div'>Speed check</Text>
<Text role='label'>Response time</Text>
<Text role='metric-primary'>{value}</Text>
<Text role='supporting'>Explanation text</Text>
<Text role='quiz-prompt'>C#</Text>
```

Maps content role to typography recipe. For all non-interactive content text.

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

## Elevation (Shadows)

4 elevation tokens for box-shadow. Use for physical-feeling depth, not for
outlines or glows (those stay literal).

| Token            | Value                              | Usage                          |
| ---------------- | ---------------------------------- | ------------------------------ |
| `--shadow-sm`    | `0 1px 4px rgba(0,0,0,0.1)`       | Pressed/active state           |
| `--shadow-md`    | `0 2px 8px rgba(0,0,0,0.12)`      | Default elevation (CTA, cards) |
| `--shadow-lg`    | `0 4px 12px rgba(0,0,0,0.12)`     | Popover, skip menu             |
| `--shadow-hover` | `0 3px 12px rgba(0,0,0,0.18)`     | Hover lift                     |

---

## Transitions

Duration tokens for transition timing. Easing functions (`ease`, `linear`) stay
literal because CSS `transition` shorthand doesn't support variable substitution
for the timing function alone.

| Token               | Value  | Usage                                 |
| ------------------- | ------ | ------------------------------------- |
| `--duration-fast`   | 0.1s   | Transform scale, quick micro-feedback |
| `--duration-base`   | 0.15s  | Color/background/border changes       |
| `--duration-slow`   | 0.3s   | Progress bar width                    |
| `--duration-linear` | 0.2s   | Countdown bar (linear easing)         |

---

## Opacity States

Semantic opacity tokens for interactive states. `opacity: 1` resets and hover
micro-interactions stay literal.

| Token                | Value | Usage                                |
| -------------------- | ----- | ------------------------------------ |
| `--opacity-disabled` | 0.5   | Disabled buttons (note, answer)      |
| `--opacity-dimmed`   | 0.4   | Skipped toggles, dimmed split-notes  |
| `--opacity-pressed`  | 0.8   | Active/pressed state                 |
| `--opacity-subtle`   | 0.3   | Skipped progress bars, hidden accidentals |

---

## Z-Index Scale

| Token          | Value | Usage                       |
| -------------- | ----- | --------------------------- |
| `--z-raised`   | 1     | Stacking above siblings     |
| `--z-popover`  | 100   | Skip menu, floating panels  |

---

## Touch Target

| Token                | Value | Usage                                      |
| -------------------- | ----- | ------------------------------------------ |
| `--size-touch-target` | 44px  | WCAG AA minimum for close/nav buttons      |

---

## Button Variant Taxonomy

Every interactive element falls into one of these categories. Each has a
distinct visual treatment — don't reuse styles across roles. See
[layout-and-ia.md](layout-and-ia.md#one-interaction-grammar) (principle #14).

| Variant | Role | Visual treatment | Class / component |
|---------|------|-----------------|-------------------|
| **Primary action** | Initiate flow (Practice, Keep Going, Start, Done) | Filled brand green, white text, `--font-semibold` | `<ActionButton variant='primary'>` |
| **Secondary action** | Cancel / alternative (Stop) | Outlined, `--color-border`, muted text, `--font-normal` | `<ActionButton variant='secondary'>` |
| **Small action** | Tertiary / utility (Redo speed check, Accept suggestion) | Outlined, smaller font, lighter border — visually quieter than secondary | `.baseline-rerun-btn`, `.suggestion-card-accept` |
| **Answer** | Quiz response | White bg, 2px `--color-text-muted` border, equal visual weight across all options | `.answer-btn`, `.note-btn` |
| **Toggle** | Multi-select filter (strings, groups, notes) | `--color-surface` inactive → `--color-toggle-active` active, 36px min size | `.string-toggle`, `.distance-toggle` |
| **Tab** | View switching | Underline active, `--color-brand` indicator, no fill | `.mode-tab`, `.home-tab` |
| **Text link** | Tertiary navigation | Muted text, underline on hover, no background | `.text-link` |
| **Close** | Dismiss / navigate back | × icon, `--color-text-light`, `--size-touch-target` min size | `.mode-close-btn`, `.quiz-header-close` |

**When to use ActionButton vs raw button:** Use `<ActionButton>` for
primary/secondary flow actions (start, stop, continue, done). Use raw `<button>`
with a specific class for everything else — answer buttons have feedback
semantics, toggles have pressed state, tabs have ARIA roles, and small actions
have intentionally quieter styling.

---

## Info Hierarchy Pattern

When displaying a metric with context, use the **label: value / explanation**
pattern. The value is visually dominant; the label is quieter; the explanation
is smallest.

```
{label}         {value}         ← Text role: label + metric
{explanation}                   ← Text role: caption
[action]                        ← Small action button (optional)
```

This pattern appears in:
- **BaselineInfo** — "Response time: 0.5s / Timing thresholds are based on..."
- **Round complete stats** — "This round: 8/10 correct"
- **Practice status** — "Status: Building..."

Use `<Text role='label'>`, `<Text role='metric'>`, and `<Text role='caption'>`
to encode the hierarchy structurally.

---

## Screen Patterns

### Home Screen

Full-screen mode selector. Title uses `--font-display` (DM Serif Display) with
a 32×3px green accent bar beneath it (`.home-title::after`).

Mode cards have a 3px green (`--color-brand`) left border, `--radius-md`, 1px
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

Consolidated single card containing: mastery status → suggestion card →
scope toggles → Practice CTA. Uses `--color-bg` background, `--radius-md`.
When a recommendation exists, a gold suggestion card (`.suggestion-card`)
appears at the top of the Practice Settings zone with an "Accept" button
that pre-fills the scope toggles.

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
border-radius: var(--radius-lg);
padding: var(--space-5);
max-width: 360px;
margin: 0 auto;
```

**Rationale:** Floating stats on the surface background feel unfinished.
The card uses `--radius-lg` (same as `.quiz-area.active`) and the same
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

### Viewport queries vs. component sizing

Component-level sizing (grids, max-widths) should not vary by viewport width.
Components may render in different contexts — the component preview page, a
screenshot viewport, or the actual app — so viewport-conditional sizing creates
mismatches. Use the container's own `max-width` constraint instead.

Reserve `@media` viewport queries for **structural layout** (body padding, phase
margins) and **typography scaling**, not for component internals like button grid
columns or answer-area widths.

---

## Interaction Patterns

### Hover (Desktop)

Darken background slightly. No layout shift.

```css
transition: background var(--duration-base) ease, border-color var(--duration-base) ease;
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

- Color changes: `var(--duration-base)` ease
- Layout/size: `var(--duration-fast)` ease (transform scale)
- Progress bar: `var(--duration-slow)` ease (width)
- Countdown bar: `var(--duration-linear)` linear

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
