# Progress & Recall Display — Design Direction

**Date:** 2026-02-23
**Status:** Design direction decided, needs implementation plan

## Problem

The current heatmap has two toggleable views (retention / speed) showing a
single dimension at a time. Retention view already combines speed and recall via
the automaticity metric (`recall × speedScore`), but the user can't distinguish
between:

- **New** — never practiced this item
- **Rusty** — was fast once, recall has decayed
- **Building** — actively practicing, still slow

All three show as low-automaticity orange/gold. The two-view toggle also means
the user never sees the full picture at once.

## Decisions

### Single combined view (no toggle)

Replace the retention/speed toggle with a single view encoding both dimensions.
The speed and recency information are complementary, not alternatives — the user
shouldn't have to choose which to see.

### Two dimensions: speed and freshness

| Dimension     | Source data                           | What it communicates               |
| ------------- | ------------------------------------- | ---------------------------------- |
| **Speed**     | EWMA response time → speedScore [0,1] | How fast you answer (skill level)  |
| **Freshness** | `lastCorrectAt` → elapsed time        | How recently you practiced         |

The interaction between them tells the real story:

| Speed \ Freshness | Fresh                  | Aging                        | Stale                     |
| ----------------- | ---------------------- | ---------------------------- | ------------------------- |
| **Fast**          | Automatic — nailing it | Fading — was fast, may decay | Faded — possibly rusty    |
| **Slow**          | Building — working on it | Still slow, slipping away   | Rusty — slow and neglected |
| **Unseen**        | —                      | —                            | New — haven't tried yet   |

### Visual encoding: hue + saturation fade

Speed maps to **hue** (the existing green → gold scale). Freshness maps to
**saturation** — vivid colors when freshly practiced, fading continuously toward
grey as time passes.

```
  Fresh          Aging          Stale
  ┌──────┐      ┌──────┐      ┌──────┐
  │██████│      │▓▓▓▓▓▓│      │░░░░░░│   Fast (green)
  └──────┘      └──────┘      └──────┘
  ┌──────┐      ┌──────┐      ┌──────┐
  │██████│      │▓▓▓▓▓▓│      │░░░░░░│   Slow (gold/orange)
  └──────┘      └──────┘      └──────┘
                               ┌──────┐
                               │      │   Unseen (grey)
                               └──────┘
```

Why this works:

- **Natural metaphor** — "fading" literally fades. A grid of vivid greens with
  grey patches communicates "you've been neglecting this area" without labels.
- **Emotional communication** — vivid cells = active, grey cells = dormant.
  The eye is drawn to both the vivid successes and the grey gaps.
- **Convergence to grey is a feature** — "I can't tell if this was fast or slow
  anymore" honestly communicates "it's been so long that the old data is stale."
- **Preserves existing color palette** — the green → gold hue scale is unchanged;
  only saturation modulation is added.

### Continuous fade with labeled reference points

Freshness fades continuously rather than in discrete buckets. The legend shows
three labeled reference points along the continuous scale:

- **Fresh** — practiced very recently
- **Aging** — starting to fade
- **Stale** — long since practiced

These labels give vocabulary for thinking about the scale without implying hard
thresholds. The actual fade is smooth and proportional to elapsed time relative
to the item's stability (half-life).

### Labels for the combined states

| State         | When                        | Visual impression  |
| ------------- | --------------------------- | ------------------ |
| **Automatic** | Fast + fresh                | Vivid green        |
| **Fading**    | Fast + stale                | Muted/grey-green   |
| **Building**  | Slow + fresh                | Vivid gold/orange  |
| **Rusty**     | Slow + stale                | Muted/grey-orange  |
| **New**       | Never seen                  | Grey               |

### Freshness granularity

- **Grid cells**: per-item freshness (reads `lastCorrectAt` directly — no
  aggregation needed, data already exists)
- **Recommendations**: per-group freshness (aggregate worst-case or average
  within a group to decide what to suggest next)

The grid is the detailed map; the recommendations are the summary. They
reinforce each other — you see the faded patch on the grid, and the
recommendation says "these are fading, practice them."

### Legend design

The legend becomes a small 2D visual rather than a linear strip:

- **Horizontal axis**: speed (slow → fast), shown as hue from gold to green
- **Vertical axis or fade overlay**: freshness (fresh → stale), shown as
  saturation from vivid to grey
- **Three labeled reference points** along the freshness axis: Fresh / Aging /
  Stale
- **Speed labels** at endpoints: still deciding exact wording

Alternatively, a single gradient bar with the saturation fade shown as a
secondary annotation — needs visual prototyping to determine which is clearer
at the small sizes used in practice.

## Implementation notes

### Freshness computation

The freshness signal needs a decay function. Two candidates:

1. **Stability-relative**: `freshness = 2^(-elapsed / stability)` — same
   formula as recall. Items with high stability (long half-life) fade slowly;
   newly-learned items fade quickly. This is theoretically elegant but couples
   the visual to the learning model.

2. **Fixed-reference**: `freshness = 2^(-elapsed / referencePeriod)` — fade on
   a fixed timescale (e.g., 7-day half-life). Simpler, more predictable
   visually. An item practiced yesterday looks the same regardless of its
   stability.

Decision: go with stability-relative. The whole point of the learning model is to estimate what the user remembers, so the visuals should reflect that.

### CSS implementation

The existing heatmap colors are HSL values in CSS custom properties. Saturation
modulation can be done by:

- Computing the HSL color for speed as before
- Multiplying saturation by the freshness factor (1.0 = full, 0.0 = grey)
- This naturally converges all colors toward `hsl(*, 0%, L%)` (grey) as
  freshness drops

The `getStatsCellColor` function in `stats-display.ts` already computes colors
per cell — it would gain a freshness parameter and interpolate saturation.

### What this replaces

- The retention/speed toggle disappears
- `getAutomaticityColor` and `getSpeedHeatmapColor` merge into a single
  function that takes both speed score and freshness
- The legend changes from a 1D strip to a 2D representation
- Practice summary labels ("Needs work", "Fading", etc.) already partially
  align with the new vocabulary

## Open questions

- **Fretboard variant**: dot + ring encoding (speed as fill, freshness as ring
  thickness/opacity) may work better than saturation fade for the fretboard SVG
  where items are already circles. Worth prototyping both.
- **Legend layout**: 2D swatch grid vs. annotated gradient bar vs. something
  else — needs visual exploration.
- **Exact fade timescale**: how many days until "fully stale" (near-grey)? Can we show this to the user in some useful form? Simplest may be "last practiced {time} ago"
  - **Text readability**: as colors fade toward grey, the dark-text/light-text
  threshold from `heatmapNeedsLightText` needs to account for the reduced
  saturation.
