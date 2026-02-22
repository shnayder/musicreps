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

// Labels for the retention legend (index matches heatmapColors().level)
const RETENTION_LABELS = [
  'Needs work (&lt;20%)',
  'Fading (&gt;20%)',
  'Getting there (&gt;40%)',
  'Solid (&gt;60%)',
  'Automatic (&gt;80%)',
];

export function getAutomaticityColor(auto: number | null): string {
  const c = heatmapColors();
  if (auto === null) return c.none;
  if (auto > 0.8) return c.level[4];
  if (auto > 0.6) return c.level[3];
  if (auto > 0.4) return c.level[2];
  if (auto > 0.2) return c.level[1];
  return c.level[0];
}

export function getSpeedHeatmapColor(
  ms: number | null,
  baseline: number | null | undefined,
): string {
  const c = heatmapColors();
  if (ms === null) return c.none;
  const b = baseline || 1000;
  if (ms < b * 1.5) return c.level[4];
  if (ms < b * 3.0) return c.level[3];
  if (ms < b * 4.5) return c.level[2];
  if (ms < b * 6.0) return c.level[1];
  return c.level[0];
}

export function getStatsCellColor(
  selector: {
    getAutomaticity(id: string): number | null;
    getStats(id: string): ItemStats | null;
  },
  itemId: string,
  statsMode: string,
  baseline: number | null | undefined,
): string {
  if (statsMode === 'retention') {
    return getAutomaticityColor(selector.getAutomaticity(itemId));
  }
  const stats = selector.getStats(itemId);
  return getSpeedHeatmapColor(stats ? stats.ewma : null, baseline);
}

/**
 * Average stats across multiple item IDs (e.g. both + and − directions).
 * Only items that have data contribute to the average.
 * Returns grey when no items have data.
 */
export function getStatsCellColorMerged(
  selector: {
    getAutomaticity(id: string): number | null;
    getStats(id: string): ItemStats | null;
  },
  itemIds: string | string[],
  statsMode: string,
  baseline: number | null | undefined,
): string {
  if (typeof itemIds === 'string') {
    return getStatsCellColor(selector, itemIds, statsMode, baseline);
  }
  if (statsMode === 'retention') {
    let sum = 0, count = 0;
    for (let i = 0; i < itemIds.length; i++) {
      const a = selector.getAutomaticity(itemIds[i]);
      if (a !== null) {
        sum += a;
        count++;
      }
    }
    return getAutomaticityColor(count > 0 ? sum / count : null);
  }
  let sum2 = 0, count2 = 0;
  for (let j = 0; j < itemIds.length; j++) {
    const stats = selector.getStats(itemIds[j]);
    if (stats && stats.ewma != null) {
      sum2 += stats.ewma;
      count2++;
    }
  }
  return getSpeedHeatmapColor(count2 > 0 ? sum2 / count2 : null, baseline);
}

function formatThreshold(ms: number): string {
  const s = ms / 1000;
  return s % 1 === 0 ? s + 's' : s.toFixed(1) + 's';
}

function legendItem(color: string, label: string): string {
  return '<div class="legend-item"><div class="legend-swatch" style="background:' +
    color + '"></div>' + label + '</div>';
}

export function buildStatsLegend(statsMode: string, baseline?: number): string {
  const c = heatmapColors();
  let html = '<div class="heatmap-legend active">';
  html += legendItem(c.none, 'No data');

  if (statsMode === 'retention') {
    for (let i = c.level.length - 1; i >= 0; i--) {
      html += legendItem(c.level[i], RETENTION_LABELS[i]);
    }
  } else {
    const b = baseline || 1000;
    const t1 = formatThreshold(b * 1.5);
    const t2 = formatThreshold(b * 3);
    const t3 = formatThreshold(b * 4.5);
    const t4 = formatThreshold(b * 6);
    html += legendItem(c.level[4], '&lt; ' + t1);
    html += legendItem(c.level[3], t1 + '\u2013' + t2);
    html += legendItem(c.level[2], t2 + '\u2013' + t3);
    html += legendItem(c.level[1], t3 + '\u2013' + t4);
    html += legendItem(c.level[0], '&ge; ' + t4);
  }

  html += '</div>';
  return html;
}
