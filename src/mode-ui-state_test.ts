// Tests for pure mode UI state computation functions.

import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  buildRecommendationText,
  computePracticeSummary,
  countFluent,
  statusLabelFromPct,
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
// statusLabelFromPct
// ---------------------------------------------------------------------------

describe('statusLabelFromPct', () => {
  it('returns Strong for >= 80%', () => {
    assert.equal(statusLabelFromPct(80), 'Strong');
    assert.equal(statusLabelFromPct(100), 'Strong');
  });

  it('returns Solid for >= 50%', () => {
    assert.equal(statusLabelFromPct(50), 'Solid');
    assert.equal(statusLabelFromPct(79), 'Solid');
  });

  it('returns Building for >= 20%', () => {
    assert.equal(statusLabelFromPct(20), 'Building');
    assert.equal(statusLabelFromPct(49), 'Building');
  });

  it('returns Getting started for < 20%', () => {
    assert.equal(statusLabelFromPct(0), 'Getting started');
    assert.equal(statusLabelFromPct(19), 'Getting started');
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
      consolidateDueCount: 0,
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
      consolidateDueCount: 5,
      expandIndex: null,
      expandNewCount: 0,
    };
    const text = buildRecommendationText(result, label);
    assert.equal(
      text,
      'Suggestion: solidify Group 0, Group 1 \u2014 5 slow items',
    );
  });

  it('builds expand text', () => {
    const result: RecommendationResult = {
      recommended: new Set([2]),
      enabled: null,
      consolidateIndices: [],
      consolidateDueCount: 0,
      expandIndex: 2,
      expandNewCount: 8,
    };
    const text = buildRecommendationText(result, label);
    assert.equal(text, 'Suggestion: start Group 2 \u2014 8 new items');
  });

  it('combines consolidation + expansion + extra parts', () => {
    const result: RecommendationResult = {
      recommended: new Set([0, 1]),
      enabled: null,
      consolidateIndices: [0],
      consolidateDueCount: 3,
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

  it('uses singular for 1 slow item', () => {
    const result: RecommendationResult = {
      recommended: new Set([0]),
      enabled: null,
      consolidateIndices: [0],
      consolidateDueCount: 1,
      expandIndex: null,
      expandNewCount: 0,
    };
    const text = buildRecommendationText(result, label);
    assert.ok(text.includes('1 slow item'));
    assert.ok(!text.includes('1 slow items'));
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

  it('returns "Ready to start" when nothing seen', () => {
    const result = computePracticeSummary({
      allItemIds: ['a', 'b', 'c'],
      // deno-lint-ignore no-explicit-any
      selector: makeSelector({}) as any,
      itemNoun: 'items',
      recommendation: null,
      recommendationText: '',
      sessionSummary: '3 items \u00B7 60s',
      masteryText: '',
      showMastery: false,
    });
    assert.equal(result.statusLabel, 'Ready to start');
    assert.equal(result.statusDetail, '3 items to learn');
    assert.equal(result.sessionSummary, '3 items \u00B7 60s');
    assert.equal(result.showRecommendationButton, false);
  });

  it('computes status correctly when some items fluent', () => {
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
      sessionSummary: '5 positions \u00B7 60s',
      masteryText: '',
      showMastery: false,
    });
    // 3 of 5 fluent = 60%
    assert.equal(result.statusLabel, 'Overall: Solid');
    assert.equal(result.statusDetail, '3 of 5 positions fluent');
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
      sessionSummary: '',
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
      consolidateDueCount: 3,
      expandIndex: null,
      expandNewCount: 0,
    };
    const result = computePracticeSummary({
      allItemIds: ['a'],
      // deno-lint-ignore no-explicit-any
      selector: makeSelector({ 'a': 0.2 }) as any,
      itemNoun: 'items',
      recommendation: rec,
      recommendationText: 'Suggestion: solidify Group 0',
      sessionSummary: '',
      masteryText: '',
      showMastery: false,
    });
    assert.equal(result.showRecommendationButton, true);
    assert.equal(result.recommendationText, 'Suggestion: solidify Group 0');
  });
});
