import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  getAutomaticityColor,
  getSpeedHeatmapColor,
  getStatsCellColor,
  getStatsCellColorMerged,
  buildStatsLegend,
} from "./stats-display.js";

// ---------------------------------------------------------------------------
// getAutomaticityColor
// ---------------------------------------------------------------------------

describe("getAutomaticityColor", () => {
  it("returns grey for null", () => {
    assert.equal(getAutomaticityColor(null), "#ddd");
  });

  it("returns green for high automaticity (>0.8)", () => {
    assert.equal(getAutomaticityColor(0.9), "hsl(120, 60%, 65%)");
  });

  it("returns yellow-green for 0.6-0.8", () => {
    assert.equal(getAutomaticityColor(0.7), "hsl(80, 60%, 65%)");
  });

  it("returns yellow for 0.4-0.6", () => {
    assert.equal(getAutomaticityColor(0.5), "hsl(50, 60%, 65%)");
  });

  it("returns orange for 0.2-0.4", () => {
    assert.equal(getAutomaticityColor(0.3), "hsl(30, 60%, 65%)");
  });

  it("returns red for low automaticity (<=0.2)", () => {
    assert.equal(getAutomaticityColor(0.1), "hsl(0, 60%, 65%)");
  });

  it("returns red for zero", () => {
    assert.equal(getAutomaticityColor(0), "hsl(0, 60%, 65%)");
  });
});

// ---------------------------------------------------------------------------
// getSpeedHeatmapColor
// ---------------------------------------------------------------------------

describe("getSpeedHeatmapColor", () => {
  it("returns grey for null", () => {
    assert.equal(getSpeedHeatmapColor(null), "#ddd");
  });

  it("returns green for fast (<1500ms)", () => {
    assert.equal(getSpeedHeatmapColor(1000), "hsl(120, 60%, 65%)");
  });

  it("returns yellow-green for 1500-3000ms", () => {
    assert.equal(getSpeedHeatmapColor(2000), "hsl(80, 60%, 65%)");
  });

  it("returns yellow for 3000-4500ms", () => {
    assert.equal(getSpeedHeatmapColor(4000), "hsl(50, 60%, 65%)");
  });

  it("returns orange for 4500-6000ms", () => {
    assert.equal(getSpeedHeatmapColor(5000), "hsl(30, 60%, 65%)");
  });

  it("returns red for slow (>=6000ms)", () => {
    assert.equal(getSpeedHeatmapColor(7000), "hsl(0, 60%, 65%)");
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
    assert.equal(getStatsCellColor(selector, "test", "retention"), "hsl(120, 60%, 65%)");
  });

  it("delegates to getSpeedHeatmapColor in speed mode", () => {
    const selector = {
      getAutomaticity: () => null,
      getStats: () => ({ ewma: 2000 }),
    };
    assert.equal(getStatsCellColor(selector, "test", "speed"), "hsl(80, 60%, 65%)");
  });

  it("returns grey for speed mode with no stats", () => {
    const selector = {
      getAutomaticity: () => null,
      getStats: () => null,
    };
    assert.equal(getStatsCellColor(selector, "test", "speed"), "#ddd");
  });

  it("returns grey for retention mode with null automaticity", () => {
    const selector = {
      getAutomaticity: () => null,
      getStats: () => null,
    };
    assert.equal(getStatsCellColor(selector, "test", "retention"), "#ddd");
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
    assert.equal(getStatsCellColorMerged(selector, ["A+3", "A-3"], "retention"), "#ddd");
  });

  it("returns grey when no items have data (speed)", () => {
    const selector = {
      getAutomaticity: () => null,
      getStats: () => null,
    };
    assert.equal(getStatsCellColorMerged(selector, ["A+3", "A-3"], "speed"), "#ddd");
  });

  it("averages automaticity across both directions (retention)", () => {
    const data: Record<string, number | null> = { "C+3": 0.9, "C-3": 0.7 };
    const selector = {
      getAutomaticity: (id: string) => data[id] ?? null,
      getStats: () => null,
    };
    // average = 0.8, which is exactly the >0.8 boundary → falls to 0.6-0.8 bucket
    // Actually 0.8 is NOT > 0.8, so it's the 0.6-0.8 bucket
    assert.equal(getStatsCellColorMerged(selector, ["C+3", "C-3"], "retention"), "hsl(80, 60%, 65%)");
  });

  it("uses only available direction when one is unseen (retention)", () => {
    const data: Record<string, number | null> = { "C+3": 0.9, "C-3": null };
    const selector = {
      getAutomaticity: (id: string) => data[id] ?? null,
      getStats: () => null,
    };
    // Only C+3 has data (0.9), so result = 0.9 → >0.8 bucket = green
    assert.equal(getStatsCellColorMerged(selector, ["C+3", "C-3"], "retention"), "hsl(120, 60%, 65%)");
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
    assert.equal(getStatsCellColorMerged(selector, ["C+3", "C-3"], "speed"), "hsl(80, 60%, 65%)");
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
    // Only C+3 has data (1000ms) → <1500 bucket = green
    assert.equal(getStatsCellColorMerged(selector, ["C+3", "C-3"], "speed"), "hsl(120, 60%, 65%)");
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

  it("returns speed legend with time range labels", () => {
    const html = buildStatsLegend("speed");
    assert.ok(html.includes("1.5"));
    assert.ok(html.includes("6s"));
    assert.ok(html.includes("No data"));
    assert.ok(!html.includes("Automatic")); // no retention labels
  });
});
