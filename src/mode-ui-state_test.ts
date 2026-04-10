// Tests for pure mode UI state computation functions.

import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  buildRecommendationText,
  computeLevelPercentile,
  computePracticeSummary,
  countAutomatic,
  statusLabelFromLevel,
} from './mode-ui-state.ts';
import type { RecommendationResult } from './types.ts';

// ---------------------------------------------------------------------------
// countAutomatic
// ---------------------------------------------------------------------------

describe('countAutomatic', () => {
  it('returns zero for empty items', () => {
    const result = countAutomatic([], () => null);
    assert.deepStrictEqual(result, { automatic: 0, seen: 0 });
  });

  it('counts seen and automatic correctly', () => {
    const speeds: Record<string, number | null> = {
      'a': 0.95,
      'b': 0.3,
      'c': null,
      'd': 0.91,
    };
    const result = countAutomatic(
      ['a', 'b', 'c', 'd'],
      (id) => speeds[id] ?? null,
    );
    assert.equal(result.seen, 3);
    assert.equal(result.automatic, 2); // a=0.95 and d=0.91 are >= 0.9
  });

  it('uses threshold correctly (0.9 boundary is automatic)', () => {
    const result = countAutomatic(
      ['a'],
      () => 0.9,
    );
    assert.equal(result.automatic, 1); // 0.9 >= 0.9
    assert.equal(result.seen, 1);
  });

  it('below 0.9 is not automatic', () => {
    const result = countAutomatic(
      ['a'],
      () => 0.89,
    );
    assert.equal(result.automatic, 0);
    assert.equal(result.seen, 1);
  });
});

// ---------------------------------------------------------------------------
// computeLevelPercentile
// ---------------------------------------------------------------------------

describe('computeLevelPercentile', () => {
  it('returns 0 level and 0 seen for empty items', () => {
    const result = computeLevelPercentile(() => null, []);
    assert.deepStrictEqual(result, { level: 0, seen: 0 });
  });

  it('treats unseen items (null) as 0', () => {
    const result = computeLevelPercentile(
      () => null,
      ['a', 'b', 'c'],
    );
    assert.equal(result.level, 0);
    assert.equal(result.seen, 0);
  });

  it('picks 2nd lowest for 12 items at p=0.1', () => {
    // 12 items: ceil(12 * 0.1) - 1 = ceil(1.2) - 1 = 2 - 1 = 1 → index 1
    const values: Record<string, number | null> = {};
    for (let i = 0; i < 12; i++) {
      values[`item-${i}`] = 0.1 * i; // 0.0, 0.1, 0.2, ..., 1.1
    }
    const ids = Object.keys(values);
    const result = computeLevelPercentile(
      (id) => values[id] ?? null,
      ids,
    );
    // sorted: 0.0, 0.1, 0.2, ... → index 1 = 0.1
    assert.ok(Math.abs(result.level - 0.1) < 0.001);
    assert.equal(result.seen, 12); // item-0 has value=0.0, non-null → seen
  });

  it('counts seen items correctly (non-null values)', () => {
    const values: Record<string, number | null> = {
      'a': 0.9,
      'b': null,
      'c': 0.5,
      'd': null,
    };
    const result = computeLevelPercentile(
      (id) => values[id] ?? null,
      ['a', 'b', 'c', 'd'],
    );
    assert.equal(result.seen, 2); // a and c
  });

  it('compresses unseen + slow items into low level', () => {
    // 2 unseen + 4 slow (value=0.1) + 6 fast (value=0.9)
    const ids: string[] = [];
    const values: Record<string, number | null> = {};
    for (let i = 0; i < 2; i++) {
      ids.push(`unseen-${i}`);
      values[`unseen-${i}`] = null;
    }
    for (let i = 0; i < 4; i++) {
      ids.push(`slow-${i}`);
      values[`slow-${i}`] = 0.1;
    }
    for (let i = 0; i < 6; i++) {
      ids.push(`fast-${i}`);
      values[`fast-${i}`] = 0.9;
    }
    const result = computeLevelPercentile(
      (id) => values[id] ?? null,
      ids,
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
  it('returns Automatic for >= 0.9', () => {
    assert.equal(statusLabelFromLevel(0.9), 'Automatic');
    assert.equal(statusLabelFromLevel(1.0), 'Automatic');
  });

  it('returns Solid for >= 0.7', () => {
    assert.equal(statusLabelFromLevel(0.7), 'Solid');
    assert.equal(statusLabelFromLevel(0.89), 'Solid');
  });

  it('returns Learning for >= 0.3', () => {
    assert.equal(statusLabelFromLevel(0.3), 'Learning');
    assert.equal(statusLabelFromLevel(0.69), 'Learning');
  });

  it('returns Hesitant for > 0 and < 0.3', () => {
    assert.equal(statusLabelFromLevel(0.01), 'Hesitant');
    assert.equal(statusLabelFromLevel(0.29), 'Hesitant');
  });

  it('returns Starting for 0', () => {
    assert.equal(statusLabelFromLevel(0), 'Starting');
  });
});

// ---------------------------------------------------------------------------
// buildRecommendationText
// ---------------------------------------------------------------------------

describe('buildRecommendationText', () => {
  function label(id: string): string {
    return 'Group ' + id;
  }

  it('returns empty string when no recommendations', () => {
    const result: RecommendationResult = {
      recommended: new Set<string>(),
      enabled: null,
      expandIndex: null,
      expandNewCount: 0,
      levelRecs: [],
    };
    assert.equal(buildRecommendationText(result, label), '');
  });

  it('builds review text', () => {
    const result: RecommendationResult = {
      recommended: new Set(['0', '1']),
      enabled: null,
      expandIndex: null,
      expandNewCount: 0,
      levelRecs: [
        { groupId: '0', type: 'review' },
        { groupId: '1', type: 'review' },
      ],
    };
    const text = buildRecommendationText(result, label);
    assert.equal(text, 'review Group 0, Group 1');
  });

  it('builds practice text', () => {
    const result: RecommendationResult = {
      recommended: new Set(['0']),
      enabled: null,
      expandIndex: null,
      expandNewCount: 0,
      levelRecs: [{ groupId: '0', type: 'practice' }],
    };
    const text = buildRecommendationText(result, label);
    assert.equal(text, 'practice Group 0');
  });

  it('builds expand text', () => {
    const result: RecommendationResult = {
      recommended: new Set(['2']),
      enabled: null,
      expandIndex: '2',
      expandNewCount: 8,
      levelRecs: [{ groupId: '2', type: 'expand' }],
    };
    const text = buildRecommendationText(result, label);
    assert.equal(text, 'start Group 2');
  });

  it('builds automate text', () => {
    const result: RecommendationResult = {
      recommended: new Set(['0', '1']),
      enabled: null,
      expandIndex: null,
      expandNewCount: 0,
      levelRecs: [
        { groupId: '0', type: 'automate' },
        { groupId: '1', type: 'automate' },
      ],
    };
    const text = buildRecommendationText(result, label);
    assert.equal(text, 'practice Group 0, Group 1');
  });

  it('combines review + practice + expand + extra parts', () => {
    const result: RecommendationResult = {
      recommended: new Set(['0', '1', '2']),
      enabled: null,
      expandIndex: '2',
      expandNewCount: 1,
      levelRecs: [
        { groupId: '0', type: 'review' },
        { groupId: '1', type: 'practice' },
        { groupId: '2', type: 'expand' },
      ],
    };
    const text = buildRecommendationText(result, label, ['naturals first']);
    assert.ok(text.includes('review Group 0'));
    assert.ok(text.includes('practice Group 1'));
    assert.ok(text.includes('start Group 2'));
    assert.ok(text.includes('naturals first'));
    assert.ok(!text.includes('new item')); // no item count suffix
  });

  it('deduplicates groups across rec types (highest priority wins)', () => {
    const result: RecommendationResult = {
      recommended: new Set(['0', '1']),
      enabled: null,
      expandIndex: null,
      expandNewCount: 0,
      levelRecs: [
        { groupId: '0', type: 'review' },
        { groupId: '1', type: 'review' },
        { groupId: '0', type: 'practice' },
        { groupId: '1', type: 'practice' },
      ],
    };
    const text = buildRecommendationText(result, label);
    // Each group should appear only once, under review (highest priority).
    assert.equal(text, 'review Group 0, Group 1');
  });

  it('expand text has no item count suffix', () => {
    const result: RecommendationResult = {
      recommended: new Set(['0']),
      enabled: null,
      expandIndex: '0',
      expandNewCount: 1,
      levelRecs: [{ groupId: '0', type: 'expand' }],
    };
    const text = buildRecommendationText(result, label);
    assert.equal(text, 'start Group 0');
  });
});

// ---------------------------------------------------------------------------
// computePracticeSummary
// ---------------------------------------------------------------------------

describe('computePracticeSummary', () => {
  function makeSelector(speeds: Record<string, number | null>) {
    return {
      getSpeedScore: (id: string) => speeds[id] ?? null,
      getFreshness: () => 1.0 as number | null,
      getRecall: () => null as number | null,
      getStats: () => null,
      getWeight: () => 1,
      getLevelSpeed: () => ({ level: 0, seen: 0 }),
      getLevelFreshness: () => ({ level: 0, seen: 0 }),
      getGroupRecommendations: () => [],
      checkAllAutomatic: () => false,
      checkNeedsReview: () => false,
      recordResponse: () => {},
      selectNext: () => '',
      updateConfig: () => {},
      getConfig: () => ({}) as ReturnType<typeof makeSelector>['getConfig'],
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

  it('computes status from level speed', () => {
    const result = computePracticeSummary({
      allItemIds: ['a', 'b', 'c', 'd', 'e'],
      selector: makeSelector({
        'a': 0.95,
        'b': 0.85,
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
    // Level speed: values = [0.95, 0.85, 0.6, 0.3, 0] sorted = [0, 0.3, 0.6, 0.85, 0.95]
    // p=0.1: index = ceil(5*0.1)-1 = ceil(0.5)-1 = 0 → level = 0 → "Starting"
    assert.equal(result.statusLabel, 'Starting');
    assert.equal(result.statusDetail, '1/5 positions automatic');
  });

  it('passes through mastery state', () => {
    const result = computePracticeSummary({
      allItemIds: ['a'],
      selector: makeSelector({
        'a': 0.95,
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
      recommended: new Set(['0']),
      enabled: null,
      expandIndex: null,
      expandNewCount: 0,
      levelRecs: [{ groupId: '0', type: 'practice' }],
    };
    const result = computePracticeSummary({
      allItemIds: ['a'],
      // deno-lint-ignore no-explicit-any
      selector: makeSelector({ 'a': 0.2 }) as any,
      itemNoun: 'items',
      recommendation: rec,
      recommendationText: 'practice Group 0',
      masteryText: '',
      showMastery: false,
    });
    assert.equal(result.showRecommendationButton, true);
    assert.equal(result.recommendationText, 'practice Group 0');
  });
});
