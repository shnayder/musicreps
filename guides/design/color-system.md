# Color System

Three-layer token architecture for all color decisions. All values defined as CSS
custom properties in `src/styles.css` `:root`.

**Live reference:** The preview page's **Colors** tab shows all palette ramps,
semantic swatches, pairings, heatmap scale, and component token mapping tables
with resolved values. The CSS is the single source of truth — this guide
describes the architecture and design principles.

## Three-Layer Token Architecture

Colors use a three-layer architecture designed for dark mode readiness and
systematic naming:

**Layer 1: Primitives** — raw color scales derived from anchor hues
(`--hue-neutral`, `--hue-brand`, `--hue-success`, `--hue-error`,
`--hue-notice`). Change one hue to shift an entire family. Naming:
`--{family}-{step}` (e.g., `--neutral-400`, `--brand-600`).

**Layer 2: Semantic tokens** — map primitives to meaning. To switch
light -> dark, change these mappings (not the palette). Every color family
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
**SequentialSlot** (`.seq-slot`), **SkillCard** (`.skill-card` -> `--_accent`).

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
   terracotta to cool sage, a ~73deg arc. This provides good perceptual
   separation without relying on red/green as the sole differentiator
   (colorblind-safe).
3. **Monotonically decreasing lightness** — heatmap levels go from light to
   dark. This ensures the scale reads correctly in grayscale and for users with
   color vision deficiencies. Text switches to white at lower lightness levels
   via `heatmapNeedsLightText()`.
4. **Green is the one active color** — brand, success, focus, and active toggles
   all share the same deep green. This avoids a rainbow of competing hues during
   drills and reinforces a single "go/correct/active" signal.
5. **Gold for attention, red for errors** — gold draws the eye to
   recommendations and highlights without implying right/wrong. Red is reserved
   strictly for incorrect answers and expired countdowns.
6. **Warm neutral chrome** — text, surfaces, and borders use warm-shifted grays
   to avoid a sterile wireframe feel.

## Semantic Color Families

Each family follows the accent + variants pattern. When adding a new semantic
color, define the accent first, then add `-bg`, `-border`, and `-text` variants
as needed.

| Family | Accent | Variants | Role |
|--------|--------|----------|------|
| Brand/Success | `--color-brand` | bg, text, dark | CTAs, correct feedback, toggles, focus |
| Error | `--color-error` | bg, text | Incorrect answers, expired countdown |
| Notice | `--color-notice` | bg, border, text | Recommendations, suggestions |
| Accent | `--color-accent` | muted | Active input states, chord-slot underline |

Additional token groups: **Text** (primary, muted, light), **Surface** (5
levels from bg to pressed), **Border** (3 levels from strong to lighter).

## Using the Color System

**Always reference CSS custom properties.** If no variable covers the case,
extend the system with a new token — don't hardcode raw HSL or hex values.
One-off experiments during active iteration are fine, but finalized code should
use variables so the palette stays maintainable and discoverable.

## Heatmap

Gold-to-green sequential scale: gold = "needs attention", green = "mastered".
Monotonically decreasing lightness ensures grayscale readability. Text switches
to white on darker levels via `heatmapNeedsLightText()`.

| Level | Meaning |
|-------|---------|
| none | No data (unseen) |
| 1 | Needs work (<=30%) |
| 2 | Fading (>30%) |
| 3 | Getting there (>55%) |
| 4 | Solid (>75%) |
| 5 | Automatic (>90%) |

## Fretboard SVG

Circle-based design — one `<circle class="fb-pos">` per position with inline
fill color. No text inside circles; hover card shows note details. Heatmap
colors on fretboard circles match the `--heatmap-*` scale. No fret numbers —
dropped for legibility at mobile sizes.

Key elements: dormant positions, quiz highlight (vivid yellow), found positions
(matches heatmap-5), string/fret/nut lines, and inlay markers at frets 3, 5, 7,
9, and double at 12.
