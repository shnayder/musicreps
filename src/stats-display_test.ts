import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  getAutomaticityColor,
  getSpeedHeatmapColor,
  getStatsCellColor,
  getStatsCellColorMerged,
  buildStatsLegend,
} from "./stats-display.js";

// Heatmap palette (matches fallback values in stats-display.js)
const NONE = "hsl(30, 4%, 85%)";
const L1 = "hsl(12, 48%, 65%)";
const L2 = "hsl(30, 48%, 58%)";
const L3 = "hsl(50, 40%, 50%)";
const L4 = "hsl(72, 38%, 42%)";
const L5 = "hsl(90, 45%, 35%)";

// ---------------------------------------------------------------------------
// getAutomaticityColor
// ---------------------------------------------------------------------------

describe("getAutomaticityColor", () => {
  it("returns grey for null", () => {
    assert.equal(getAutomaticityColor(null), NONE);
  });

  it("returns sage for high automaticity (>0.8)", () => {
    assert.equal(getAutomaticityColor(0.9), L5);
  });

  it("returns olive-sage for 0.6-0.8", () => {
    assert.equal(getAutomaticityColor(0.7), L4);
  });

  it("returns olive for 0.4-0.6", () => {
    assert.equal(getAutomaticityColor(0.5), L3);
  });

  it("returns amber for 0.2-0.4", () => {
    assert.equal(getAutomaticityColor(0.3), L2);
  });

  it("returns terracotta for low automaticity (<=0.2)", () => {
    assert.equal(getAutomaticityColor(0.1), L1);
  });

  it("returns terracotta for zero", () => {
    assert.equal(getAutomaticityColor(0), L1);
  });
});

// ---------------------------------------------------------------------------
// getSpeedHeatmapColor
// ---------------------------------------------------------------------------

describe("getSpeedHeatmapColor", () => {
  it("returns grey for null", () => {
    assert.equal(getSpeedHeatmapColor(null), NONE);
  });

  it("returns sage for fast (<1500ms) with default baseline", () => {
    assert.equal(getSpeedHeatmapColor(1000), L5);
  });

  it("returns olive-sage for 1500-3000ms with default baseline", () => {
    assert.equal(getSpeedHeatmapColor(2000), L4);
  });

  it("returns olive for 3000-4500ms with default baseline", () => {
    assert.equal(getSpeedHeatmapColor(4000), L3);
  });

  it("returns amber for 4500-6000ms with default baseline", () => {
    assert.equal(getSpeedHeatmapColor(5000), L2);
  });

  it("returns terracotta for slow (>=6000ms) with default baseline", () => {
    assert.equal(getSpeedHeatmapColor(7000), L1);
  });

  it("scales thresholds with baseline=1500 (mobile user)", () => {
    // sage: < 1500*1.5 = 2250ms
    assert.equal(getSpeedHeatmapColor(2000, 1500), L5);
    // olive-sage: 2250-4500ms
    assert.equal(getSpeedHeatmapColor(3000, 1500), L4);
    // olive: 4500-6750ms
    assert.equal(getSpeedHeatmapColor(5000, 1500), L3);
    // amber: 6750-9000ms
    assert.equal(getSpeedHeatmapColor(8000, 1500), L2);
    // terracotta: >= 9000ms
    assert.equal(getSpeedHeatmapColor(10000, 1500), L1);
  });

  it("scales thresholds with baseline=700 (fast keyboard user)", () => {
    // sage: < 700*1.5 = 1050ms
    assert.equal(getSpeedHeatmapColor(900, 700), L5);
    // 1200ms is above amber threshold with baseline 700
    assert.equal(getSpeedHeatmapColor(1200, 700), L4);
  });
});

// ---------------------------------------------------------------------------
// getStatsCellColor
// ---------------------------------------------------------------------------

describe("getStatsCellColor", () => {
  it("delegates to getAutomaticityColor in retention mode", () => {
    const selector = {
      getAutomaticity: () => 0.9,
      getStats: () => null,
    };
    assert.equal(getStatsCellColor(selector, "test", "retention"), L5);
  });

  it("delegates to getSpeedHeatmapColor in speed mode", () => {
    const selector = {
      getAutomaticity: () => null,
      getStats: () => ({ ewma: 2000 }),
    };
    assert.equal(getStatsCellColor(selector, "test", "speed"), L4);
  });

  it("passes baseline through to getSpeedHeatmapColor", () => {
    const selector = {
      getAutomaticity: () => null,
      getStats: () => ({ ewma: 2000 }),
    };
    // With baseline=1500, 2000ms is < 2250 (1500*1.5) → sage
    assert.equal(getStatsCellColor(selector, "test", "speed", 1500), L5);
  });

  it("returns grey for speed mode with no stats", () => {
    const selector = {
      getAutomaticity: () => null,
      getStats: () => null,
    };
    assert.equal(getStatsCellColor(selector, "test", "speed"), NONE);
  });

  it("returns grey for retention mode with null automaticity", () => {
    const selector = {
      getAutomaticity: () => null,
      getStats: () => null,
    };
    assert.equal(getStatsCellColor(selector, "test", "retention"), NONE);
  });

  it("returns lowest level for retention mode with zero automaticity (wrong-only item)", () => {
    const selector = {
      getAutomaticity: () => 0,
      getStats: () => ({ ewma: 9000 }),
    };
    assert.equal(getStatsCellColor(selector, "test", "retention"), L1);
  });
});

// ---------------------------------------------------------------------------
// getStatsCellColorMerged
// ---------------------------------------------------------------------------

describe("getStatsCellColorMerged", () => {
  it("falls back to getStatsCellColor when passed a string", () => {
    const selector = {
      getAutomaticity: () => 0.9,
      getStats: () => null,
    };
    assert.equal(
      getStatsCellColorMerged(selector, "C+3" as any, "retention"),
      getStatsCellColor(selector, "C+3", "retention"),
    );
  });

  it("returns grey when no items have data (retention)", () => {
    const selector = {
      getAutomaticity: () => null,
      getStats: () => null,
    };
    assert.equal(getStatsCellColorMerged(selector, ["A+3", "A-3"], "retention"), NONE);
  });

  it("returns grey when no items have data (speed)", () => {
    const selector = {
      getAutomaticity: () => null,
      getStats: () => null,
    };
    assert.equal(getStatsCellColorMerged(selector, ["A+3", "A-3"], "speed"), NONE);
  });

  it("averages automaticity across both directions (retention)", () => {
    const data: Record<string, number | null> = { "C+3": 0.9, "C-3": 0.7 };
    const selector = {
      getAutomaticity: (id: string) => data[id] ?? null,
      getStats: () => null,
    };
    // average = 0.8, which is exactly the >0.8 boundary → falls to 0.6-0.8 bucket
    // Actually 0.8 is NOT > 0.8, so it's the 0.6-0.8 bucket
    assert.equal(getStatsCellColorMerged(selector, ["C+3", "C-3"], "retention"), L4);
  });

  it("uses only available direction when one is unseen (retention)", () => {
    const data: Record<string, number | null> = { "C+3": 0.9, "C-3": null };
    const selector = {
      getAutomaticity: (id: string) => data[id] ?? null,
      getStats: () => null,
    };
    // Only C+3 has data (0.9), so result = 0.9 → >0.8 bucket = sage
    assert.equal(getStatsCellColorMerged(selector, ["C+3", "C-3"], "retention"), L5);
  });

  it("averages ewma across both directions (speed)", () => {
    const data: Record<string, { ewma: number } | null> = {
      "C+3": { ewma: 1000 },
      "C-3": { ewma: 2000 },
    };
    const selector = {
      getAutomaticity: () => null,
      getStats: (id: string) => data[id] ?? null,
    };
    // average = 1500, which is NOT < 1500, so it's the 1500-3000 bucket
    assert.equal(getStatsCellColorMerged(selector, ["C+3", "C-3"], "speed"), L4);
  });

  it("uses only available direction when one is unseen (speed)", () => {
    const data: Record<string, { ewma: number } | null> = {
      "C+3": { ewma: 1000 },
      "C-3": null,
    };
    const selector = {
      getAutomaticity: () => null,
      getStats: (id: string) => data[id] ?? null,
    };
    // Only C+3 has data (1000ms) → <1500 bucket = sage
    assert.equal(getStatsCellColorMerged(selector, ["C+3", "C-3"], "speed"), L5);
  });
});

// ---------------------------------------------------------------------------
// buildStatsLegend
// ---------------------------------------------------------------------------

describe("buildStatsLegend", () => {
  it("returns retention legend with 'Automatic' text", () => {
    const html = buildStatsLegend("retention");
    assert.ok(html.includes("Automatic"));
    assert.ok(html.includes("Needs work"));
    assert.ok(html.includes("No data"));
    assert.ok(!html.includes("1.5s")); // no speed labels
  });

  it("retention legend ignores baseline", () => {
    const html = buildStatsLegend("retention", 2000);
    assert.ok(html.includes("Automatic"));
    assert.ok(!html.includes("3s")); // no speed thresholds
  });

  it("returns speed legend with default thresholds (baseline=1000)", () => {
    const html = buildStatsLegend("speed");
    assert.ok(html.includes("1.5s"));
    assert.ok(html.includes("6s"));
    assert.ok(html.includes("No data"));
    assert.ok(!html.includes("Automatic")); // no retention labels
  });

  it("returns speed legend with scaled thresholds (baseline=1500)", () => {
    const html = buildStatsLegend("speed", 1500);
    // 1500*1.5=2250 → "2.3s", 1500*3=4500 → "4.5s", 1500*6=9000 → "9s"
    assert.ok(html.includes("2.3s"), "should show 2.3s threshold");
    assert.ok(html.includes("4.5s"), "should show 4.5s threshold");
    assert.ok(html.includes("9s"), "should show 9s threshold");
  });
});
