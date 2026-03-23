# Color System

Three-layer token architecture for all color decisions. All values defined
as CSS custom properties in `src/styles.css` `:root`.

## Three-Layer Token Architecture

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

## Palette Model

Three colors carry all the meaning:

- **Green** — actions, correctness, brand identity
- **Gold** — attention, recommendations, achievements
- **Red** — errors only

Everything else is warm neutral chrome. This simplicity is intentional: during a
drill, the user should never have to decode what a color means.

## Color Design Principles

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

## Using the Color System

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

## Brand / Success (Green)

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

## Accent (Blue)

Warm blue for interactive "current input" states — visually distinct from
success green and neutral filled slots. Used for the active chord-slot
underline and available as a general-purpose accent throughout the app.

| Token                  | Value                  | Usage                                       |
| ---------------------- | ---------------------- | ------------------------------------------- |
| `--color-accent`       | `hsl(220, 65%, 50%)`  | Active chord-slot underline, input focus     |
| `--color-accent-muted` | `hsl(220, 40%, 65%)`  | Lighter variant for secondary accent states  |

## Gold (Attention)

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

## Error (Red)

Red is reserved strictly for incorrect answers and expired countdowns.

| Token                | Value     | Usage                               |
| -------------------- | --------- | ----------------------------------- |
| `--color-error`      | `#f44336` | Incorrect answer, expired countdown |
| `--color-error-bg`   | `#ffebee` | Wrong chord-slot background         |
| `--color-error-text` | `#c62828` | Text on error backgrounds           |

## Text (Warm Neutrals)

Subtle warmth instead of pure grays — shifted `hsl(30, …)` for cohesion.

| Token                | Value              | Usage                    |
| -------------------- | ------------------ | ------------------------ |
| `--color-text`       | `hsl(30, 5%, 20%)` | Primary text, headings   |
| `--color-text-muted` | `hsl(30, 3%, 40%)` | Labels, hints, secondary |
| `--color-text-light` | `hsl(30, 3%, 60%)` | Tertiary, close buttons  |

## Surfaces & Backgrounds

| Token                     | Value               | Usage                                |
| ------------------------- | ------------------- | ------------------------------------ |
| `--color-bg`              | `#fff`              | Page background, button default      |
| `--color-surface`         | `hsl(30, 10%, 96%)` | Quiz card bg, toggles, table headers |
| `--color-surface-hover`   | `hsl(30, 8%, 93%)`  | Button/nav hover state               |
| `--color-surface-raised`     | `hsl(30, 8%, 92%)`  | Progress bar bg, countdown bg        |
| `--color-surface-pressed` | `hsl(30, 5%, 82%)`  | Button `:active` state               |
| `--color-surface-accent`  | `hsl(30, 8%, 90%)`  | Accidental note button bg            |

## Borders

| Token                    | Value              | Usage                              |
| ------------------------ | ------------------ | ---------------------------------- |
| `--color-border`         | `hsl(30, 5%, 60%)` | Toggle borders, chord-slot borders |
| `--color-border-light`   | `hsl(30, 5%, 80%)` | Table borders, toggle separator    |
| `--color-border-lighter` | `hsl(30, 5%, 86%)` | Section dividers                   |

## Heatmap (Gold to Green)

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

## Fretboard SVG

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
