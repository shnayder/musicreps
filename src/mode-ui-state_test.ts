// Tests for pure mode UI state computation functions.

import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  buildRecommendationText,
  computeLevelAutomaticity,
  computePracticeSummary,
  countFluent,
  statusLabelFromLevel,
} from './mode-ui-state.ts';
import type { RecommendationResult } from './types.ts';

// ---------------------------------------------------------------------------
// countFluent
// ---------------------------------------------------------------------------

describe('countFluent', () => {
  it('returns zero for empty items', () => {
    const result = countFluent([], () => null, 0.5);
    assert.deepStrictEqual(result, { fluent: 0, seen: 0 });
  });

  it('counts seen and fluent correctly', () => {
    const autos: Record<string, number | null> = {
      'a': 0.9,
      'b': 0.3,
      'c': null,
      'd': 0.6,
    };
    const result = countFluent(
      ['a', 'b', 'c', 'd'],
      (id) => autos[id] ?? null,
      0.5,
    );
    assert.equal(result.seen, 3);
    assert.equal(result.fluent, 2); // a=0.9 and d=0.6 are > 0.5
  });

  it('uses threshold correctly (exact boundary is not fluent)', () => {
    const result = countFluent(
      ['a'],
      () => 0.5,
      0.5,
    );
    assert.equal(result.fluent, 0); // 0.5 is not > 0.5
    assert.equal(result.seen, 1);
  });
});

// ---------------------------------------------------------------------------
// computeLevelAutomaticity
// ---------------------------------------------------------------------------

describe('computeLevelAutomaticity', () => {
  it('returns 0 level and 0 seen for empty items', () => {
    const result = computeLevelAutomaticity([], () => null);
    assert.deepStrictEqual(result, { level: 0, seen: 0 });
  });

  it('treats unseen items (null) as automaticity 0', () => {
    const result = computeLevelAutomaticity(
      ['a', 'b', 'c'],
      () => null,
    );
    assert.equal(result.level, 0);
    assert.equal(result.seen, 0);
  });

  it('picks 2nd lowest for 12 items at p=0.1', () => {
    // 12 items: ceil(12 * 0.1) - 1 = ceil(1.2) - 1 = 2 - 1 = 1 → index 1
    const autos: Record<string, number | null> = {};
    for (let i = 0; i < 12; i++) {
      autos[`item-${i}`] = 0.1 * i; // 0.0, 0.1, 0.2, ..., 1.1
    }
    const ids = Object.keys(autos);
    const result = computeLevelAutomaticity(
      ids,
      (id) => autos[id] ?? null,
    );
    // sorted: 0.0, 0.1, 0.2, ... → index 1 = 0.1
    assert.ok(Math.abs(result.level - 0.1) < 0.001);
    assert.equal(result.seen, 12); // item-0 has auto=0.0, non-null → seen
  });

  it('counts seen items correctly (non-null automaticity)', () => {
    const autos: Record<string, number | null> = {
      'a': 0.9,
      'b': null,
      'c': 0.5,
      'd': null,
    };
    const result = computeLevelAutomaticity(
      ['a', 'b', 'c', 'd'],
      (id) => autos[id] ?? null,
    );
    assert.equal(result.seen, 2); // a and c
  });

  it('compresses unseen + slow items into low level', () => {
    // 2 unseen + 4 slow (auto=0.1) + 6 fast (auto=0.9)
    const ids: string[] = [];
    const autos: Record<string, number | null> = {};
    for (let i = 0; i < 2; i++) {
      ids.push(`unseen-${i}`);
      autos[`unseen-${i}`] = null;
    }
    for (let i = 0; i < 4; i++) {
      ids.push(`slow-${i}`);
      autos[`slow-${i}`] = 0.1;
    }
    for (let i = 0; i < 6; i++) {
      ids.push(`fast-${i}`);
      autos[`fast-${i}`] = 0.9;
    }
    const result = computeLevelAutomaticity(
      ids,
      (id) => autos[id] ?? null,
    );
    // 12 items, p=0.1: index 1 → sorted: [0, 0, 0.1, 0.1, 0.1, 0.1, 0.9, ...]
    // index 1 = 0 (the second unseen item)
    assert.equal(result.level, 0);
    assert.equal(result.seen, 10);
  });
});

// ---------------------------------------------------------------------------
// statusLabelFromLevel
// ---------------------------------------------------------------------------

describe('statusLabelFromLevel', () => {
  it('returns Automatic for >= 0.8', () => {
    assert.equal(statusLabelFromLevel(0.8), 'Automatic');
    assert.equal(statusLabelFromLevel(1.0), 'Automatic');
  });

  it('returns Getting faster for >= 0.2', () => {
    assert.equal(statusLabelFromLevel(0.2), 'Getting faster');
    assert.equal(statusLabelFromLevel(0.79), 'Getting faster');
  });

  it('returns Slow for < 0.2', () => {
    assert.equal(statusLabelFromLevel(0), 'Slow');
    assert.equal(statusLabelFromLevel(0.19), 'Slow');
  });
});

// ---------------------------------------------------------------------------
// buildRecommendationText
// ---------------------------------------------------------------------------

describe('buildRecommendationText', () => {
  function label(i: number): string {
    return 'Group ' + i;
  }

  it('returns empty string when no recommendations', () => {
    const result: RecommendationResult = {
      recommended: new Set<number>(),
      enabled: null,
      consolidateIndices: [],
      consolidateWorkingCount: 0,
      expandIndex: null,
      expandNewCount: 0,
    };
    assert.equal(buildRecommendationText(result, label), '');
  });

  it('builds consolidation text', () => {
    const result: RecommendationResult = {
      recommended: new Set([0, 1]),
      enabled: null,
      consolidateIndices: [1, 0],
      consolidateWorkingCount: 5,
      expandIndex: null,
      expandNewCount: 0,
    };
    const text = buildRecommendationText(result, label);
    assert.equal(
      text,
      'solidify Group 0, Group 1 \u2014 5 items to work on',
    );
  });

  it('builds expand text', () => {
    const result: RecommendationResult = {
      recommended: new Set([2]),
      enabled: null,
      consolidateIndices: [],
      consolidateWorkingCount: 0,
      expandIndex: 2,
      expandNewCount: 8,
    };
    const text = buildRecommendationText(result, label);
    assert.equal(text, 'start Group 2 \u2014 8 new items');
  });

  it('combines consolidation + expansion + extra parts', () => {
    const result: RecommendationResult = {
      recommended: new Set([0, 1]),
      enabled: null,
      consolidateIndices: [0],
      consolidateWorkingCount: 3,
      expandIndex: 1,
      expandNewCount: 1,
    };
    const text = buildRecommendationText(result, label, ['naturals first']);
    assert.ok(text.includes('solidify Group 0'));
    assert.ok(text.includes('start Group 1'));
    assert.ok(text.includes('naturals first'));
    assert.ok(text.includes('1 new item')); // singular
    assert.ok(!text.includes('1 new items')); // not plural
  });

  it('builds review mode text', () => {
    const result: RecommendationResult = {
      recommended: new Set([0, 1, 2]),
      enabled: new Set([0, 1, 2]),
      consolidateIndices: [0, 1, 2],
      consolidateWorkingCount: 6,
      expandIndex: null,
      expandNewCount: 0,
      reviewMode: true,
    };
    const text = buildRecommendationText(result, label);
    assert.equal(text, 'review all \u2014 polish across 3 groups');
  });

  it('builds review mode text singular', () => {
    const result: RecommendationResult = {
      recommended: new Set([0]),
      enabled: new Set([0]),
      consolidateIndices: [0],
      consolidateWorkingCount: 2,
      expandIndex: null,
      expandNewCount: 0,
      reviewMode: true,
    };
    const text = buildRecommendationText(result, label);
    assert.equal(text, 'review all \u2014 polish across 1 group');
  });

  it('uses "refresh" when all consolidation groups are stale', () => {
    const result: RecommendationResult = {
      recommended: new Set([0, 1]),
      enabled: null,
      consolidateIndices: [0, 1],
      consolidateWorkingCount: 5,
      expandIndex: null,
      expandNewCount: 0,
      staleIndices: [0, 1],
    };
    const text = buildRecommendationText(result, label);
    assert.ok(text.startsWith('refresh '));
    assert.ok(text.includes('skills getting stale'));
  });

  it('uses "solidify" when only some groups are stale', () => {
    const result: RecommendationResult = {
      recommended: new Set([0, 1]),
      enabled: null,
      consolidateIndices: [0, 1],
      consolidateWorkingCount: 5,
      expandIndex: null,
      expandNewCount: 0,
      staleIndices: [0], // only 1 of 2 stale
    };
    const text = buildRecommendationText(result, label);
    assert.ok(text.startsWith('solidify '));
    assert.ok(text.includes('items to work on'));
  });

  it('uses singular for 1 item to work on', () => {
    const result: RecommendationResult = {
      recommended: new Set([0]),
      enabled: null,
      consolidateIndices: [0],
      consolidateWorkingCount: 1,
      expandIndex: null,
      expandNewCount: 0,
    };
    const text = buildRecommendationText(result, label);
    assert.ok(text.includes('1 item to work on'));
    assert.ok(!text.includes('1 items to work on'));
  });
});

// ---------------------------------------------------------------------------
// computePracticeSummary
// ---------------------------------------------------------------------------

describe('computePracticeSummary', () => {
  function makeSelector(autos: Record<string, number | null>) {
    return {
      getConfig: () => ({ automaticityThreshold: 0.5 }),
      getAutomaticity: (id: string) => autos[id] ?? null,
    };
  }

  it('returns "Not started" when nothing seen', () => {
    const result = computePracticeSummary({
      allItemIds: ['a', 'b', 'c'],
      // deno-lint-ignore no-explicit-any
      selector: makeSelector({}) as any,
      itemNoun: 'items',
      recommendation: null,
      recommendationText: '',
      masteryText: '',
      showMastery: false,
    });
    assert.equal(result.statusLabel, 'Not started');
    assert.equal(result.statusDetail, '3 items to learn');
    assert.equal(result.showRecommendationButton, false);
  });

  it('computes status from level automaticity', () => {
    const result = computePracticeSummary({
      allItemIds: ['a', 'b', 'c', 'd', 'e'],
      selector: makeSelector({
        'a': 0.9,
        'b': 0.8,
        'c': 0.6,
        'd': 0.3,
        'e': null,
        // deno-lint-ignore no-explicit-any
      }) as any,
      itemNoun: 'positions',
      recommendation: null,
      recommendationText: '',
      masteryText: '',
      showMastery: false,
    });
    // Level automaticity: values = [0.9, 0.8, 0.6, 0.3, 0] sorted = [0, 0.3, 0.6, 0.8, 0.9]
    // p=0.1: index = ceil(5*0.1)-1 = ceil(0.5)-1 = 0 → level = 0 → "Slow"
    assert.equal(result.statusLabel, 'Slow');
    assert.equal(result.statusDetail, '3/5 positions fluent');
  });

  it('passes through mastery state', () => {
    const result = computePracticeSummary({
      allItemIds: ['a'],
      selector: makeSelector({
        'a': 0.9,
        // deno-lint-ignore no-explicit-any
      }) as any,
      itemNoun: 'items',
      recommendation: null,
      recommendationText: '',
      masteryText: 'Looks like you\u2019ve got this!',
      showMastery: true,
    });
    assert.equal(result.showMastery, true);
    assert.equal(result.masteryText, 'Looks like you\u2019ve got this!');
  });

  it('sets showRecommendationButton when recommendation has items', () => {
    const rec: RecommendationResult = {
      recommended: new Set([0]),
      enabled: null,
      consolidateIndices: [0],
      consolidateWorkingCount: 3,
      expandIndex: null,
      expandNewCount: 0,
    };
    const result = computePracticeSummary({
      allItemIds: ['a'],
      // deno-lint-ignore no-explicit-any
      selector: makeSelector({ 'a': 0.2 }) as any,
      itemNoun: 'items',
      recommendation: rec,
      recommendationText: 'solidify Group 0',
      masteryText: '',
      showMastery: false,
    });
    assert.equal(result.showRecommendationButton, true);
    assert.equal(result.recommendationText, 'solidify Group 0');
  });
});
