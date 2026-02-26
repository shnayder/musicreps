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
      none: cssVar('--heatmap-none') || 'hsl(30, 4%, 85%)',
      level: [
        cssVar('--heatmap-1') || 'hsl(44, 65%, 58%)',
        cssVar('--heatmap-2') || 'hsl(54, 45%, 52%)',
        cssVar('--heatmap-3') || 'hsl(68, 30%, 46%)',
        cssVar('--heatmap-4') || 'hsl(90, 38%, 38%)',
        cssVar('--heatmap-5') || 'hsl(122, 46%, 33%)',
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
const SPEED_HSL: [number, number, number][] = [
  [44, 65, 58], // heatmap-1: needs work
  [54, 45, 52], // heatmap-2
  [68, 30, 46], // heatmap-3
  [90, 38, 38], // heatmap-4
  [122, 46, 33], // heatmap-5: automatic
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
  const level = speedScore > 0.8
    ? 4
    : speedScore > 0.6
    ? 3
    : speedScore > 0.4
    ? 2
    : speedScore > 0.2
    ? 1
    : 0;
  const [h, s, l] = SPEED_HSL[level];
  const f = FRESHNESS_FLOOR +
    (1 - FRESHNESS_FLOOR) * Math.max(0, Math.min(1, freshness));
  const fadedS = Math.round(s * f);
  const fadedL = Math.round(l + (NEUTRAL_L - l) * (1 - f));
  return `hsl(${h}, ${fadedS}%, ${fadedL}%)`;
}

// Keep legacy exports for any remaining references
export function getAutomaticityColor(auto: number | null): string {
  const c = heatmapColors();
  if (auto === null) return c.none;
  if (auto > 0.8) return c.level[4];
  if (auto > 0.6) return c.level[3];
  if (auto > 0.4) return c.level[2];
  if (auto > 0.2) return c.level[1];
  return c.level[0];
}

// --- Cell color functions (speed x freshness combined view) ---

export function getStatsCellColor(
  selector: {
    getSpeedScore?(id: string): number | null;
    getFreshness?(id: string): number | null;
    getAutomaticity(id: string): number | null;
    getStats(id: string): ItemStats | null;
  },
  itemId: string,
): string {
  const speedScore = selector.getSpeedScore?.(itemId) ?? null;
  const freshness = selector.getFreshness?.(itemId) ?? null;
  return getSpeedFreshnessColor(speedScore, freshness);
}

/**
 * Average stats across multiple item IDs (e.g. both + and - directions).
 * Only items that have data contribute to the average.
 * Returns grey when no items have data.
 */
export function getStatsCellColorMerged(
  selector: {
    getSpeedScore?(id: string): number | null;
    getFreshness?(id: string): number | null;
    getAutomaticity(id: string): number | null;
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
    const sp = selector.getSpeedScore?.(itemIds[i]) ?? null;
    const fr = selector.getFreshness?.(itemIds[i]) ?? null;
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
