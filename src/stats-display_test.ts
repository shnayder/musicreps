import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildStatsLegend,
  getSpeedFreshnessColor,
  getStatsCellColor,
  getStatsCellColorMerged,
  heatmapNeedsLightText,
  progressBarColors,
} from './stats-display.ts';

// Heatmap palette (matches fallback values in stats-display.ts)
const NONE = 'hsl(30, 5%, 86%)';

// ---------------------------------------------------------------------------
// getSpeedFreshnessColor
// ---------------------------------------------------------------------------

describe('getSpeedFreshnessColor', () => {
  it('returns grey for null speedScore', () => {
    assert.equal(getSpeedFreshnessColor(null, 1.0), NONE);
  });

  it('returns grey for null freshness', () => {
    assert.equal(getSpeedFreshnessColor(0.9, null), NONE);
  });

  it('returns vivid green for high speed + high freshness', () => {
    const color = getSpeedFreshnessColor(0.95, 1.0);
    // Should be close to hsl(125, 48%, 33%) — the automatic level at full freshness
    assert.ok(color.startsWith('hsl(125,'));
    assert.ok(color.includes('48%')); // full saturation
  });

  it('returns desaturated color for low freshness', () => {
    const vivid = getSpeedFreshnessColor(0.9, 1.0);
    const stale = getSpeedFreshnessColor(0.9, 0.0);
    // Stale version should have lower saturation and higher lightness
    const vividSat = parseInt(vivid.match(/,\s*(\d+)%/)![1]);
    const staleSat = parseInt(stale.match(/,\s*(\d+)%/)![1]);
    assert.ok(staleSat < vividSat, 'stale should have lower saturation');
  });

  it('returns gold hue for low speed', () => {
    const color = getSpeedFreshnessColor(0.1, 1.0);
    assert.ok(color.startsWith('hsl(40,'));
  });

  it('returns green hue for high speed', () => {
    const color = getSpeedFreshnessColor(0.95, 1.0);
    assert.ok(color.startsWith('hsl(125,'));
  });
});

// ---------------------------------------------------------------------------
// getStatsCellColor (uses speedScore + freshness)
// ---------------------------------------------------------------------------

describe('getStatsCellColor', () => {
  it('returns combined color when speedScore and freshness available', () => {
    const selector = {
      getSpeedScore: () => 0.95,
      getFreshness: () => 0.8,
      getStats: () => null,
    };
    const color = getStatsCellColor(selector, 'test');
    assert.ok(color.startsWith('hsl(125,')); // high speed = green
  });

  it('returns grey when no data', () => {
    const selector = {
      getSpeedScore: () => null,
      getFreshness: () => null,
      getStats: () => null,
    };
    assert.equal(getStatsCellColor(selector, 'test'), NONE);
  });
});

// ---------------------------------------------------------------------------
// getStatsCellColorMerged
// ---------------------------------------------------------------------------

describe('getStatsCellColorMerged', () => {
  it('falls back to getStatsCellColor when passed a string', () => {
    const selector = {
      getSpeedScore: () => 0.9,
      getFreshness: () => 0.8,
      getStats: () => null,
    };
    assert.equal(
      getStatsCellColorMerged(selector, 'C+3'),
      getStatsCellColor(selector, 'C+3'),
    );
  });

  it('returns grey when no items have data', () => {
    const selector = {
      getSpeedScore: () => null,
      getFreshness: () => null,
      getStats: () => null,
    };
    assert.equal(
      getStatsCellColorMerged(selector, ['A+3', 'A-3']),
      NONE,
    );
  });

  it('averages speed and freshness across items', () => {
    const speedData: Record<string, number | null> = {
      'C+3': 0.9,
      'C-3': 0.7,
    };
    const freshData: Record<string, number | null> = {
      'C+3': 1.0,
      'C-3': 0.6,
    };
    const selector = {
      getSpeedScore: (id: string) => speedData[id] ?? null,
      getFreshness: (id: string) => freshData[id] ?? null,
      getStats: () => null,
    };
    const color = getStatsCellColorMerged(selector, ['C+3', 'C-3']);
    // average speed = 0.8, average freshness = 0.8
    // speed 0.8 is >0.75 so level 3 (hue 80)
    assert.ok(color.startsWith('hsl(80,'));
  });

  it('uses only available items when one is unseen', () => {
    const speedData: Record<string, number | null> = {
      'C+3': 0.9,
      'C-3': null,
    };
    const freshData: Record<string, number | null> = {
      'C+3': 1.0,
      'C-3': null,
    };
    const selector = {
      getSpeedScore: (id: string) => speedData[id] ?? null,
      getFreshness: (id: string) => freshData[id] ?? null,
      getStats: () => null,
    };
    const color = getStatsCellColorMerged(selector, ['C+3', 'C-3']);
    // Only C+3 has data: speed=0.9 (>0.75 → level 3, hue 80), freshness=1.0
    assert.ok(color.startsWith('hsl(80,'));
  });
});

// ---------------------------------------------------------------------------
// buildStatsLegend
// ---------------------------------------------------------------------------

describe('buildStatsLegend', () => {
  it('contains Speed and Last practiced section titles', () => {
    const html = buildStatsLegend();
    assert.ok(html.includes('legend-section-title'));
    assert.ok(html.includes('>Speed<'));
    assert.ok(html.includes('>Last practiced<'));
  });

  it('contains gradient bars with swatches', () => {
    const html = buildStatsLegend();
    assert.ok(html.includes('legend-gradient-bar'));
    assert.ok(html.includes('legend-bar-swatch'));
  });

  it('contains axis labels for both dimensions', () => {
    const html = buildStatsLegend();
    assert.ok(html.includes('legend-axis-labels'));
    assert.ok(html.includes('Automatic'));
    assert.ok(html.includes('Hesitant'));
    assert.ok(html.includes('Recent'));
    assert.ok(html.includes('Long ago'));
  });

  it('speed bar starts with green (fast) and ends with gold (slow)', () => {
    const html = buildStatsLegend();
    // First swatch in speed bar should be hsl(125,...) (green/fast)
    const barMatch = html.match(/legend-gradient-bar">(.*?)<\/div>\s*<\/div>/s);
    assert.ok(barMatch, 'should find gradient bar');
    const firstSwatch = barMatch![1];
    assert.ok(
      firstSwatch.startsWith(
        '<div class="legend-bar-swatch" style="background:hsl(125,',
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// heatmapNeedsLightText
// ---------------------------------------------------------------------------

describe('heatmapNeedsLightText', () => {
  it('returns true for dark background (L <= 50)', () => {
    assert.ok(heatmapNeedsLightText('hsl(125, 48%, 33%)'));
    assert.ok(heatmapNeedsLightText('hsl(80, 35%, 40%)'));
    assert.ok(heatmapNeedsLightText('hsl(60, 40%, 46%)'));
    assert.ok(heatmapNeedsLightText('hsl(48, 50%, 50%)'));
  });

  it('returns false for light background (L > 50)', () => {
    assert.ok(!heatmapNeedsLightText('hsl(40, 60%, 58%)'));
    assert.ok(!heatmapNeedsLightText('hsl(30, 4%, 85%)'));
    assert.ok(!heatmapNeedsLightText('hsl(122, 12%, 70%)'));
  });

  it('returns false for empty/invalid color', () => {
    assert.ok(!heatmapNeedsLightText(''));
    assert.ok(!heatmapNeedsLightText('red'));
  });
});

// ---------------------------------------------------------------------------
// progressBarColors
// ---------------------------------------------------------------------------

describe('progressBarColors', () => {
  it('sorts colors descending by speed * freshness', () => {
    const selector = {
      getSpeedScore(id: string) {
        const scores: Record<string, number> = { a: 0.2, b: 0.9, c: 0.5 };
        return scores[id] ?? null;
      },
      getFreshness(id: string) {
        const scores: Record<string, number> = { a: 1.0, b: 1.0, c: 1.0 };
        return scores[id] ?? null;
      },
    };
    const colors = progressBarColors(selector, ['a', 'b', 'c']);
    assert.equal(colors.length, 3);
    // b (0.9*1.0=0.9) first, c (0.5*1.0=0.5) second, a (0.2*1.0=0.2) third
    // Speed 0.9 → hue 80, speed 0.5 → hue 48, speed 0.2 → hue 40
    assert.ok(
      colors[0].includes('hsl(80,'),
      `first should be hue 80 (speed 0.9): ${colors[0]}`,
    );
    assert.ok(
      colors[2].includes('hsl(40,'),
      `last should be hue 40 (speed 0.2): ${colors[2]}`,
    );
  });

  it('puts unseen items last', () => {
    const selector = {
      getSpeedScore(id: string) {
        if (id === 'seen') return 0.5;
        return null;
      },
      getFreshness(id: string) {
        if (id === 'seen') return 1.0;
        return null;
      },
    };
    const colors = progressBarColors(selector, ['unseen', 'seen']);
    assert.equal(colors.length, 2);
    // 'seen' should come first, 'unseen' (grey) last
    assert.ok(!colors[0].includes('86%'), 'first should not be grey');
    assert.ok(
      colors[1].includes('86%'),
      `last should be grey (unseen): ${colors[1]}`,
    );
  });
});
