import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildStatsLegend,
  computeReviewPill,
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
// progressBarColors (speed-only encoding)
// ---------------------------------------------------------------------------

describe('progressBarColors', () => {
  it('sorts seen items by speed descending', () => {
    const selector = {
      getSpeedScore(id: string) {
        return ({ a: 0.2, b: 0.9, c: 0.5 } as Record<string, number>)[id] ??
          null;
      },
    };
    const colors = progressBarColors(selector, ['a', 'b', 'c']);
    assert.equal(colors.length, 3);
    // b (speed 0.9) → hue 80 first, a (speed 0.2) → hue 40 last
    assert.ok(colors[0].startsWith('hsl(80,'), `first: ${colors[0]}`);
    assert.ok(colors[2].startsWith('hsl(40,'), `last: ${colors[2]}`);
  });

  it('uses speed-only color at full saturation', () => {
    const selector = {
      getSpeedScore(_id: string) {
        return 0.95;
      },
    };
    const colors = progressBarColors(selector, ['a']);
    assert.ok(colors[0].startsWith('hsl(125,'), `color: ${colors[0]}`);
    assert.ok(colors[0].includes('48%'), `full sat: ${colors[0]}`);
  });

  it('ignores freshness — stale items keep speed color', () => {
    // Even with low freshness, the bar shows speed color (not stale orange)
    const selector = {
      getSpeedScore(_id: string) {
        return 0.95;
      },
    };
    const colors = progressBarColors(selector, ['a']);
    assert.ok(
      colors[0].startsWith('hsl(125,'),
      `should be speed color: ${colors[0]}`,
    );
  });

  it('sorts: seen by speed → unseen', () => {
    const selector = {
      getSpeedScore(id: string) {
        return ({ f: 0.5, s: 0.9 } as Record<string, number>)[id] ?? null;
      },
    };
    const colors = progressBarColors(selector, ['u', 'f', 's']);
    assert.equal(colors.length, 3);
    // s (speed 0.9, hue 80) first, f (speed 0.5, hue 48) second, u unseen last
    assert.ok(colors[0].startsWith('hsl(80,'), `fastest first: ${colors[0]}`);
    assert.ok(colors[1].startsWith('hsl(48,'), `slower second: ${colors[1]}`);
    assert.equal(colors[2], NONE);
  });

  it('puts unseen items last', () => {
    const selector = {
      getSpeedScore(id: string) {
        return id === 'seen' ? 0.5 : null;
      },
    };
    const colors = progressBarColors(selector, ['unseen', 'seen']);
    assert.equal(colors.length, 2);
    assert.ok(!colors[0].includes('86%'), 'first should not be grey');
    assert.equal(colors[1], NONE);
  });

  it('produces visually monotonic hues', () => {
    const speeds = [0.95, 0.85, 0.6, 0.4, 0.1];
    const selector = {
      getSpeedScore(id: string) {
        return speeds[parseInt(id)] ?? null;
      },
    };
    const ids = speeds.map((_, i) => String(i));
    const colors = progressBarColors(selector, ids);
    const hues = colors.map((c) => parseInt(c.match(/hsl\((\d+)/)?.[1] ?? '0'));
    for (let i = 1; i < hues.length; i++) {
      assert.ok(
        hues[i] <= hues[i - 1],
        `hue[${i}]=${hues[i]} > hue[${i - 1}]=${hues[i - 1]}: not monotonic`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// computeReviewPill
// ---------------------------------------------------------------------------

describe('computeReviewPill', () => {
  it('returns null for unseen items', () => {
    const selector = {
      getStats: () => null,
      getFreshness: () => null,
    };
    assert.equal(computeReviewPill(selector, ['a', 'b']), null);
  });

  it('returns "Review soon" when avg freshness < 0.5', () => {
    const now = Date.now();
    const selector = {
      getStats: () => ({
        recentTimes: [1000],
        ewma: 1000,
        sampleCount: 5,
        lastSeen: now,
        stability: 4,
        lastCorrectAt: now - 5 * 3600000,
      }),
      getFreshness: () => 0.3,
    };
    assert.equal(computeReviewPill(selector, ['a']), 'Review soon');
  });

  it('returns "Review soon" when ≤24h remaining', () => {
    const selector = {
      getStats: () => ({
        recentTimes: [1000],
        ewma: 1000,
        sampleCount: 5,
        lastSeen: Date.now(),
        stability: 30,
        lastCorrectAt: Date.now(),
      }),
      getFreshness: () => 0.7,
    };
    // stability=30h, freshness=0.7 → remaining = 30*(1+log2(0.7)) ≈ 30*0.485 ≈ 14.6h
    assert.equal(computeReviewPill(selector, ['a']), 'Review soon');
  });

  it('returns "Review in Xd" for moderate stability', () => {
    const selector = {
      getStats: () => ({
        recentTimes: [1000],
        ewma: 1000,
        sampleCount: 5,
        lastSeen: Date.now(),
        stability: 168,
        lastCorrectAt: Date.now(),
      }),
      getFreshness: () => 1.0,
    };
    // stability=168h (7d), freshness=1.0 → remaining = 168h = 7d
    const pill = computeReviewPill(selector, ['a']);
    assert.ok(pill?.startsWith('Review in '), `pill: ${pill}`);
    assert.ok(pill?.endsWith('d'), `should be days: ${pill}`);
  });

  it('returns "Review in Xw" for high stability', () => {
    const selector = {
      getStats: () => ({
        recentTimes: [1000],
        ewma: 1000,
        sampleCount: 5,
        lastSeen: Date.now(),
        stability: 720,
        lastCorrectAt: Date.now(),
      }),
      getFreshness: () => 1.0,
    };
    // stability=720h (30d), freshness=1.0 → remaining = 720h ≈ 30d ≈ 4w
    const pill = computeReviewPill(selector, ['a']);
    assert.ok(pill?.startsWith('Review in '), `pill: ${pill}`);
    assert.ok(pill?.endsWith('w'), `should be weeks: ${pill}`);
  });
});
