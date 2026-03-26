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
**accent**, **text** (trio), **surface** (container + interactive tiers),
**chrome**, **border** (trio). `--color-on-brand`, `--color-on-success`,
`--color-on-error` provide text colors for filled backgrounds (white in light
mode, flips in dark mode).

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

Three color families carry meaning:

- **Green (brand/success)** — brand identity, correct answers, actions,
  active states. Forest green (#2D4C3B) anchors the palette.
- **Amber (notice)** — attention, recommendations, suggestions, stale items.
  Warm gold (#D97706) for banners and highlights.
- **Red (error)** — wrong answers only. Used sparingly.

Everything else is warm neutral chrome (hue 45, cream-to-charcoal). During a
drill, the user should never have to decode what a color means — green is good,
red is wrong, amber means "look here."

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

Additional token groups: **Text** (primary, muted, light), **Surface** (two
tiers — see below), **Chrome**, **Border** (3 levels from strong to lighter).

## Surface Token Architecture

Surfaces use a two-tier model: **container surfaces** define the backdrop for
regions, while **interactive surfaces** handle button/control states within
those containers.

### Container surfaces

Structural backgrounds for page regions. These distinguish content layers and
establish visual hierarchy between areas of the screen.

| Token | Value (light) | Role |
|-------|---------------|------|
| `--color-canvas` | warm gray 95% | Page background (html, body) |
| `--color-card` | white | Primary content containers (practice cards, mode screens, tab panels, answer buttons, fretboard) |
| `--color-well` | warm gray 95% | Inset/recessed areas within cards (practice scope, baseline info) |
| `--color-chrome` | warm gray 93% | Toolbar/navigation surfaces (mode nav, top bar, skill header, session header, home header, footer) |
| `--color-overlay-surface` | white | Floating layers (popovers, dropdowns) |

**Stacking order** (back to front): canvas → card → well (inset) or chrome
(toolbar). Overlays float above everything.

`--color-bg` is a legacy alias for `--color-canvas` — new code should use the
semantic name directly.

### Interactive surfaces

State variants for controls (buttons, toggles) that sit inside containers.
These always reference the neutral palette steps.

| Token | Primitive | Role |
|-------|-----------|------|
| `--color-surface` | `neutral-100` | Default/inactive control background |
| `--color-surface-hover` | `neutral-150` | Hover state |
| `--color-surface-raised` | `neutral-200` | Slightly elevated (progress bar bg, disabled buttons) |
| `--color-surface-accent` | `neutral-250` | Accidental note buttons (sharps/flats) |
| `--color-surface-pressed` | `neutral-350` | Active/pressed state |

### Dark mode notes

To flip to dark mode: invert the container surfaces (canvas → dark, card →
near-black, etc.) and remap the interactive surface primitives to lighter
neutral steps. The two-tier split keeps these changes isolated — container
tokens control the page feel, interactive tokens control control states.

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

## Progress Bar Color Encoding

Progress bars show per-item speed as a segmented bar. Speed and freshness are
**separated** — the bar encodes only speed (hue), and freshness is handled at the
group level through a different visual element.

**Why not encode freshness in the bar?** The original design faded each segment's
saturation/lightness based on item freshness. This produced two problems:

1. **Mottled appearance** — sorting by speed clusters items by hue, but freshness
   variation within each hue band creates inconsistent lightness. The bar looks
   noisy rather than communicating a clear gradient.
2. **Sad stale bars** — when data goes stale, everything fades toward grey. A bar
   of once-mastered items becomes an indistinguishable wall of washed-out tones.

**Three-zone encoding:** Each segment gets one of three colors based on its state:

| Zone | Condition | Color | Meaning |
|------|-----------|-------|---------|
| Fresh | Seen, freshness >= 0.5 | Speed hue (heatmap scale) | Active mastery |
| Stale | Seen, freshness < 0.5 | Notice orange (`--color-notice` family) | Needs review |
| Unseen | No data | `--heatmap-none` (neutral grey) | Not yet practiced |

Segments are sorted: fresh items by speed descending, then stale, then unseen.
This creates a clean left-to-right gradient where items visually migrate from
their speed color into the notice-orange "needs review" zone as they decay.

**Notice orange for staleness** ties the progress bar to the recommendation
system's "review" suggestion cards, which also use the notice color family. The
user learns one color association: orange = come back to this.

**Freshness at the group level** is shown separately (not per-item) because
individual item freshness is noisy and highly correlated within a group. A single
aggregate indicator per group is more useful than 12 faded segments. See the
progress bar redesign plan for indicator options.

## Fretboard SVG

Circle-based design — one `<circle class="fb-pos">` per position with inline
fill color. No text inside circles; hover card shows note details. Heatmap
colors on fretboard circles match the `--heatmap-*` scale. No fret numbers —
dropped for legibility at mobile sizes.

Key elements: dormant positions, quiz highlight (vivid yellow), found positions
(matches heatmap-5), string/fret/nut lines, and inlay markers at frets 3, 5, 7,
9, and double at 12.
