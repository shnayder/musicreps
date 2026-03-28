// Stats display helpers: shared color functions, table rendering for lookup
// modes, and heatmap grid rendering for math modes.

import type { ItemStats } from './types.ts';

// --- Heatmap color scale (read from CSS custom properties) ---

let _heatmapColors: { none: string; level: string[] } | null = null;

function cssVar(name: string): string {
  try {
    const val = getComputedStyle(document.documentElement).getPropertyValue(
      name,
    ).trim();
    if (val) return val;
  } catch (_) { /* Node.js / test environment — fall through to default */ }
  return '';
}

function heatmapColors() {
  if (!_heatmapColors) {
    _heatmapColors = {
      none: cssVar('--heatmap-none') || 'hsl(30, 5%, 86%)',
      level: [
        cssVar('--heatmap-1') || 'hsl(40, 60%, 58%)',
        cssVar('--heatmap-2') || 'hsl(48, 50%, 52%)',
        cssVar('--heatmap-3') || 'hsl(60, 40%, 46%)',
        cssVar('--heatmap-4') || 'hsl(80, 35%, 40%)',
        cssVar('--heatmap-5') || 'hsl(125, 48%, 33%)',
      ],
    };
  }
  return _heatmapColors;
}

/**
 * Returns true if white text should be used on this heatmap background.
 * Parses lightness from hsl() strings; dark backgrounds (L <= 50%) get white.
 */
export function heatmapNeedsLightText(color: string): boolean {
  const m = color && color.match(/,\s*(\d+)%\s*\)/);
  return m ? parseInt(m[1], 10) <= 50 : false;
}

// --- Speed x Freshness combined encoding ---

// HSL parameters for each speed level (hue, sat%, light%)
// Green reserved for truly automatic (>0.9); "fast but not instant" is yellow-green.
const SPEED_HSL: [number, number, number][] = [
  [40, 60, 58], // heatmap-1: needs work
  [48, 50, 52], // heatmap-2
  [60, 40, 46], // heatmap-3
  [80, 35, 40], // heatmap-4: fast but figuring it out
  [125, 48, 33], // heatmap-5: automatic
];

const FRESHNESS_FLOOR = 0.25;
const NEUTRAL_L = 78;

/**
 * Combined speed x freshness color: hue encodes speed (gold->green),
 * saturation/lightness encode freshness (vivid->grey).
 */
export function getSpeedFreshnessColor(
  speedScore: number | null,
  freshness: number | null,
): string {
  const c = heatmapColors();
  if (speedScore === null || freshness === null) return c.none;
  const level = speedLevel(speedScore);
  const [h, s, l] = SPEED_HSL[level];
  const f = FRESHNESS_FLOOR +
    (1 - FRESHNESS_FLOOR) * Math.max(0, Math.min(1, freshness));
  const fadedS = Math.round(s * f);
  const fadedL = Math.round(l + (NEUTRAL_L - l) * (1 - f));
  return `hsl(${h}, ${fadedS}%, ${fadedL}%)`;
}

// --- Cell color functions (speed x freshness combined view) ---

export function getStatsCellColor(
  selector: {
    getSpeedScore(id: string): number | null;
    getFreshness(id: string): number | null;
    getStats(id: string): ItemStats | null;
  },
  itemId: string,
): string {
  const speedScore = selector.getSpeedScore(itemId);
  const freshness = selector.getFreshness(itemId);
  return getSpeedFreshnessColor(speedScore, freshness);
}

/**
 * Average stats across multiple item IDs (e.g. both + and - directions).
 * Only items that have data contribute to the average.
 * Returns grey when no items have data.
 */
export function getStatsCellColorMerged(
  selector: {
    getSpeedScore(id: string): number | null;
    getFreshness(id: string): number | null;
    getStats(id: string): ItemStats | null;
  },
  itemIds: string | string[],
): string {
  if (typeof itemIds === 'string') {
    return getStatsCellColor(selector, itemIds);
  }
  let speedSum = 0,
    speedCount = 0,
    freshSum = 0,
    freshCount = 0;
  for (let i = 0; i < itemIds.length; i++) {
    const sp = selector.getSpeedScore(itemIds[i]);
    const fr = selector.getFreshness(itemIds[i]);
    if (sp !== null) {
      speedSum += sp;
      speedCount++;
    }
    if (fr !== null) {
      freshSum += fr;
      freshCount++;
    }
  }
  const avgSpeed = speedCount > 0 ? speedSum / speedCount : null;
  const avgFresh = freshCount > 0 ? freshSum / freshCount : null;
  return getSpeedFreshnessColor(avgSpeed, avgFresh);
}

// --- Progress bar colors (sorted per-item, speed-only) ---

type ProgressSelector = {
  getSpeedScore(id: string): number | null;
};

/** Map a speed score to a discrete level (0–4), matching getSpeedFreshnessColor. */
function speedLevel(sp: number): number {
  return sp > 0.9 ? 4 : sp > 0.75 ? 3 : sp > 0.55 ? 2 : sp > 0.3 ? 1 : 0;
}

/** Speed-only color at full saturation (no freshness fading). */
function speedOnlyColor(sp: number): string {
  const [h, s, l] = SPEED_HSL[speedLevel(sp)];
  return `hsl(${h}, ${s}%, ${l}%)`;
}

const FRESHNESS_THRESHOLD = 0.5;

/**
 * Compute per-item progress bar colors (speed-only encoding):
 * - Seen: speed hue at full saturation (gold → green)
 * - Unseen (no data): neutral grey
 *
 * Sorted: seen by speed desc → unseen.
 */
export function progressBarColors(
  selector: ProgressSelector,
  itemIds: string[],
): string[] {
  const c = heatmapColors();
  const items = itemIds.map((id) => {
    const sp = selector.getSpeedScore(id);
    const zone: 0 | 2 = sp === null ? 2 : 0;
    const color = zone === 2 ? c.none : speedOnlyColor(sp!);
    return { zone, level: sp !== null ? speedLevel(sp) : -1, color };
  });
  items.sort((a, b) => {
    if (a.zone !== b.zone) return a.zone - b.zone;
    return b.level - a.level; // seen zone: green first
  });
  return items.map((item) => item.color);
}

/** Speed-only classification for a group of items. */
export type GroupBarSegment = {
  color: string;
  zone: 0 | 2; // 0 = seen, 2 = unseen
  speed: number; // average speed (for sort within seen zone)
};

/**
 * Speed-only color + metadata for a group of items (one segment per group).
 * Averages speed across seen items:
 * - Seen (any items have speed data): speed-only color at full saturation
 * - Unseen (no seen items): neutral grey
 */
export function progressBarGroupSegment(
  selector: ProgressSelector,
  itemIds: string[],
): GroupBarSegment {
  let speedSum = 0, speedCount = 0;
  for (const id of itemIds) {
    const sp = selector.getSpeedScore(id);
    if (sp !== null) {
      speedSum += sp;
      speedCount++;
    }
  }
  if (speedCount === 0) {
    return { color: heatmapColors().none, zone: 2, speed: 0 };
  }
  const avgSpeed = speedSum / speedCount;
  return { color: speedOnlyColor(avgSpeed), zone: 0, speed: avgSpeed };
}

/** Convenience wrapper returning just the color string. */
export function progressBarGroupColor(
  selector: ProgressSelector,
  itemIds: string[],
): string {
  return progressBarGroupSegment(selector, itemIds).color;
}

// --- Review timing pills ---

type ReviewSelector = {
  getStats(id: string): ItemStats | null;
  getFreshness(id: string): number | null;
};

/** Format hours remaining until review as a human-readable duration. */
function formatReviewDuration(hours: number): string {
  const days = Math.round(hours / 24);
  if (days <= 14) return `${days}d`;
  const weeks = Math.round(days / 7);
  if (weeks <= 12) return `${weeks}w`;
  const months = Math.round(days / 30);
  return `${months}mo`;
}

/**
 * Compute a review-timing pill label for a group of items.
 * Returns null when stability or freshness data is missing (unseen items,
 * or legacy stats without stability/lastCorrectAt). For groups with data:
 * - "Review soon" if avg freshness < threshold or ≤24h remaining
 * - "Review in Xd/Xw/Xmo" based on estimated time until review
 */
export function computeReviewPill(
  selector: ReviewSelector,
  itemIds: string[],
): string | null {
  let stabilitySum = 0, stabilityCount = 0;
  let freshnessSum = 0, freshnessCount = 0;
  for (const id of itemIds) {
    const stats = selector.getStats(id);
    if (stats?.stability != null) {
      stabilitySum += stats.stability;
      stabilityCount++;
    }
    const fr = selector.getFreshness(id);
    if (fr !== null) {
      freshnessSum += fr;
      freshnessCount++;
    }
  }
  if (stabilityCount === 0 || freshnessCount === 0) return null;

  const avgFreshness = freshnessSum / freshnessCount;
  if (avgFreshness < FRESHNESS_THRESHOLD) return 'Review soon';

  const avgStability = stabilitySum / stabilityCount;
  const hoursRemaining = avgStability * (1 + Math.log2(avgFreshness));
  if (hoursRemaining <= 24) return 'Review soon';

  return `Review in ${formatReviewDuration(hoursRemaining)}`;
}

// --- Legend ---

/**
 * Build a stacked gradient-bar legend: Speed on top (fast→slow),
 * Recency below (recent→long ago). Bars are aligned via CSS grid;
 * endpoint labels sit beneath each bar.
 */
export function buildStatsLegend(): string {
  let html = '<div class="heatmap-legend active">';

  // Speed row: gradient bar green→gold (automatic on left, reversed from SPEED_HSL)
  html += '<div class="legend-section">';
  html += '<div class="legend-section-title">Speed</div>';
  html += '<div class="legend-bar-group">';
  html += '<div class="legend-gradient-bar">';
  for (let i = SPEED_HSL.length - 1; i >= 0; i--) {
    const [h, s, l] = SPEED_HSL[i];
    html +=
      `<div class="legend-bar-swatch" style="background:hsl(${h}, ${s}%, ${l}%)"></div>`;
  }
  html += '</div>';
  html +=
    '<div class="legend-axis-labels"><span>Automatic</span><span>Hesitant</span></div>';
  html += '</div>';
  html += '</div>';

  // Recency row: achromatic grey gradient (dark = recent, light = long ago).
  // Uses the same lightness math as the real encoding but with 0% saturation,
  // so it communicates "intensity" without conflating with the speed hue scale.
  const baseL = SPEED_HSL[3][2]; // lightness of "Solid" level as reference
  html += '<div class="legend-section">';
  html += '<div class="legend-section-title">Last practiced</div>';
  html += '<div class="legend-bar-group">';
  html += '<div class="legend-gradient-bar">';
  for (let i = 0; i < 5; i++) {
    const fVal = 1 - (i / 4);
    const f = FRESHNESS_FLOOR + (1 - FRESHNESS_FLOOR) * fVal;
    const fadedL = Math.round(baseL + (NEUTRAL_L - baseL) * (1 - f));
    html +=
      `<div class="legend-bar-swatch" style="background:hsl(0, 0%, ${fadedL}%)"></div>`;
  }
  html += '</div>';
  html +=
    '<div class="legend-axis-labels"><span>Recent</span><span>Long ago</span></div>';
  html += '</div>';
  html += '</div>';

  html += '</div>';
  return html;
}
