import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildStatsLegend,
  getAutomaticityColor,
  getSpeedFreshnessColor,
  getStatsCellColor,
  getStatsCellColorMerged,
  heatmapNeedsLightText,
} from './stats-display.ts';

// Heatmap palette (matches fallback values in stats-display.ts)
const NONE = 'hsl(30, 4%, 85%)';
const L1 = 'hsl(40, 60%, 58%)';
const L5 = 'hsl(125, 48%, 33%)';

// ---------------------------------------------------------------------------
// getAutomaticityColor (legacy, still exported)
// ---------------------------------------------------------------------------

describe('getAutomaticityColor', () => {
  it('returns grey for null', () => {
    assert.equal(getAutomaticityColor(null), NONE);
  });

  it('returns green for high automaticity (>0.8)', () => {
    assert.equal(getAutomaticityColor(0.9), L5);
  });

  it('returns gold for low automaticity (<=0.2)', () => {
    assert.equal(getAutomaticityColor(0.1), L1);
  });
});

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
// getStatsCellColor (new: uses speedScore + freshness)
// ---------------------------------------------------------------------------

describe('getStatsCellColor', () => {
  it('returns combined color when speedScore and freshness available', () => {
    const selector = {
      getSpeedScore: () => 0.95,
      getFreshness: () => 0.8,
      getAutomaticity: () => 0.9,
      getStats: () => null,
    };
    const color = getStatsCellColor(selector, 'test');
    assert.ok(color.startsWith('hsl(125,')); // high speed = green
  });

  it('returns grey when no data', () => {
    const selector = {
      getSpeedScore: () => null,
      getFreshness: () => null,
      getAutomaticity: () => null,
      getStats: () => null,
    };
    assert.equal(getStatsCellColor(selector, 'test'), NONE);
  });

  it('falls back gracefully when getSpeedScore not on selector', () => {
    const selector = {
      getAutomaticity: () => null,
      getStats: () => null,
    };
    // Without getSpeedScore/getFreshness, should return NONE
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
      getAutomaticity: () => 0.9,
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
      getAutomaticity: () => null,
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
      getAutomaticity: () => null,
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
      getAutomaticity: () => null,
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
