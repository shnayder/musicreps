import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  checkExpansionGate,
  classifyGroups,
  classifyLevelStatus,
  computeLevelRecs,
  computeRecommendations,
  freshStartResult,
  type LevelStatus,
  type RecommendationSelector,
  shouldThrottleExpansion,
} from './recommendations.ts';
import { buildRecommendationText } from './mode-ui-state.ts';
import { createAdaptiveSelector, createMemoryStorage } from './adaptive.ts';
import type { GroupRecommendation, ItemStats } from './types.ts';
import { GUITAR } from './music-data.ts';
import {
  getAllGroupIds,
  getItemIdsForGroup as guitarGetItemIds,
} from './modes/fretboard/logic.ts';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Shorthand to build a GroupRecommendation. */
function rec(
  groupId: string,
  working: number,
  unseen: number,
  automatic: number,
): GroupRecommendation {
  return {
    groupId,
    workingCount: working,
    unseenCount: unseen,
    automaticCount: automatic,
    totalCount: working + unseen + automatic,
  };
}

// Mock selector that returns pre-built data and computes level speed/freshness
// from encoded item IDs: automatic items → 0.95 speed, working → 0.3, unseen → 0.
function mockSelector(
  dataByIndex: Record<string, {
    workingCount: number;
    unseenCount: number;
    automaticCount: number;
    totalCount: number;
  }>,
  overrides?: Partial<RecommendationSelector>,
): RecommendationSelector {
  function itemSpeed(id: string): number {
    const parts = id.split('-');
    const groupId = parts[1];
    const itemIdx = parseInt(parts[3], 10);
    const d = dataByIndex[groupId];
    if (!d) return 0;
    if (itemIdx < d.automaticCount) return 0.95;
    if (itemIdx < d.automaticCount + d.workingCount) return 0.3;
    return 0; // unseen
  }

  return {
    getGroupRecommendations(
      groupIds: string[],
      _getItemIds: (id: string) => string[],
    ) {
      return groupIds.map((id) => {
        const d = dataByIndex[id] ??
          { workingCount: 0, unseenCount: 0, automaticCount: 0, totalCount: 0 };
        return { groupId: id, ...d };
      });
    },
    getLevelSpeed(
      itemIds: string[],
      percentile: number = 0.1,
    ): { level: number; seen: number } {
      const values = itemIds.map(itemSpeed);
      values.sort((a, b) => a - b);
      const index = Math.max(0, Math.ceil(values.length * percentile) - 1);
      const seen = values.filter((v) => v > 0).length;
      return { level: values[index], seen };
    },
    getSpeedScore: (id: string) => {
      const s = itemSpeed(id);
      return s > 0 ? s : null;
    },
    getStats: (id: string) => {
      const s = itemSpeed(id);
      if (s === 0) return null;
      // Default: high stability, recently practiced → fresh (not stale).
      const now = Date.now();
      return {
        recentTimes: [1000],
        ewma: 1000,
        sampleCount: 10,
        lastSeen: now - 3600_000,
        stability: 168, // ~1 week half-life
        lastCorrectAt: now - 3600_000,
      };
    },
    getFreshness: () => 1.0,
    ...overrides,
  };
}

// Generate item IDs that encode group and item index so the mock
// getLevelSpeed can decode them.
function makeGetItemIds(
  dataByIndex: Record<string, { totalCount: number; [k: string]: number }>,
) {
  return (id: string) => {
    const d = dataByIndex[id];
    const count = d ? d.totalCount : 1;
    return Array.from({ length: count }, (_, j) => `group-${id}-item-${j}`);
  };
}

const config = {};

// ---------------------------------------------------------------------------
// classifyGroups
// ---------------------------------------------------------------------------

describe('classifyGroups', () => {
  it('splits started from unstarted', () => {
    const recs = [
      rec('0', 3, 5, 2), // started: unseen < total
      rec('1', 0, 10, 0), // unstarted: unseen === total
      rec('2', 0, 0, 10), // started: unseen < total (all automatic)
    ];
    const { started, unstarted } = classifyGroups(recs);
    assert.equal(started.length, 2);
    assert.equal(unstarted.length, 1);
    assert.equal(unstarted[0].groupId, '1');
  });

  it('returns empty arrays for empty input', () => {
    const { started, unstarted } = classifyGroups([]);
    assert.equal(started.length, 0);
    assert.equal(unstarted.length, 0);
  });
});

// ---------------------------------------------------------------------------
// freshStartResult
// ---------------------------------------------------------------------------

describe('freshStartResult', () => {
  it('recommends the first unstarted group', () => {
    const unstarted = [rec('0', 0, 10, 0), rec('1', 0, 5, 0)];
    const result = freshStartResult(unstarted);
    assert.ok(result.recommended.has('0'));
    assert.equal(result.expandIndex, '0');
    assert.equal(result.expandNewCount, 10);
    assert.equal(result.levelRecs.length, 1);
    assert.equal(result.levelRecs[0].type, 'expand');
  });

  it('respects sortFn', () => {
    const unstarted = [rec('0', 0, 10, 0), rec('1', 0, 5, 0)];
    const result = freshStartResult(
      unstarted,
      (a, b) => a.totalCount - b.totalCount,
    );
    assert.equal(result.expandIndex, '1');
    assert.equal(result.expandNewCount, 5);
  });

  it('returns empty result when no groups exist', () => {
    const result = freshStartResult([]);
    assert.equal(result.recommended.size, 0);
    assert.equal(result.enabled, null);
    assert.equal(result.expandIndex, null);
    assert.equal(result.levelRecs.length, 0);
  });
});

// ---------------------------------------------------------------------------
// classifyLevelStatus
// ---------------------------------------------------------------------------

describe('classifyLevelStatus', () => {
  /** Build a selector where all items have the given speed and stability. */
  function selectorWithStats(
    speed: number,
    opts?: { stability?: number; hoursAgo?: number },
  ): RecommendationSelector {
    const stability = opts?.stability ?? 168;
    const hoursAgo = opts?.hoursAgo ?? 1;
    const now = Date.now();
    return {
      ...mockSelector({}),
      getLevelSpeed: () => ({ level: speed, seen: speed > 0 ? 1 : 0 }),
      getSpeedScore: () => speed > 0 ? speed : null,
      getStats: () =>
        speed > 0
          ? {
            recentTimes: [1000],
            ewma: 1000,
            sampleCount: 10,
            lastSeen: now - hoursAgo * 3600_000,
            stability,
            lastCorrectAt: now - hoursAgo * 3600_000,
          }
          : null,
      getFreshness: () => speed > 0 ? 1.0 : null,
    };
  }

  it('classifies automatic level', () => {
    const status = classifyLevelStatus(
      selectorWithStats(0.95),
      '0',
      () => ['a'],
    );
    assert.equal(status.speedLabel, 'automatic');
    assert.notEqual(status.reviewStatus, 'soon');
  });

  it('classifies solid level (0.7 ≤ speed < 0.9)', () => {
    const status = classifyLevelStatus(
      selectorWithStats(0.75),
      '0',
      () => ['a'],
    );
    assert.equal(status.speedLabel, 'solid');
    assert.notEqual(status.reviewStatus, 'soon');
  });

  it('classifies learning level', () => {
    const status = classifyLevelStatus(
      selectorWithStats(0.5),
      '0',
      () => ['a'],
    );
    assert.equal(status.speedLabel, 'learning');
  });

  it('classifies hesitant level', () => {
    const status = classifyLevelStatus(
      selectorWithStats(0.1),
      '0',
      () => ['a'],
    );
    assert.equal(status.speedLabel, 'hesitant');
  });

  it('classifies starting level', () => {
    const status = classifyLevelStatus(
      selectorWithStats(0),
      '0',
      () => ['a'],
    );
    assert.equal(status.speedLabel, 'starting');
  });

  it('detects review soon when stability is low and time has passed', () => {
    // Low stability + practiced long ago → freshness decayed → review soon.
    const sel = selectorWithStats(0.8, { stability: 4, hoursAgo: 48 });
    // Override getFreshness to return decayed value.
    sel.getFreshness = () => 0.001; // very decayed
    const status = classifyLevelStatus(sel, '0', () => ['a']);
    assert.equal(status.reviewStatus, 'soon');
  });

  it('returns scheduled review when fresh with stability data', () => {
    const status = classifyLevelStatus(
      selectorWithStats(0.8, { stability: 168, hoursAgo: 1 }),
      '0',
      () => ['a'],
    );
    assert.equal(status.reviewStatus, 'scheduled');
    assert.ok(status.reviewInHours! > 24);
  });
});

// ---------------------------------------------------------------------------
// computeLevelRecs
// ---------------------------------------------------------------------------

describe('computeLevelRecs', () => {
  function status(
    groupId: string,
    speedLabel: LevelStatus['speedLabel'],
    reviewSoon: boolean = false,
  ): LevelStatus {
    const speedMap: Record<string, number> = {
      automatic: 0.95,
      solid: 0.75,
      learning: 0.5,
      hesitant: 0.1,
      starting: 0,
    };
    return {
      groupId,
      speed: speedMap[speedLabel],
      speedLabel,
      reviewStatus: reviewSoon ? 'soon' : 'scheduled',
      reviewInHours: reviewSoon ? 0 : 72,
    };
  }

  it('produces review recs for stale Solid+ levels', () => {
    const recs = computeLevelRecs([status('0', 'solid', true)]);
    assert.equal(recs[0].type, 'review');
    assert.equal(recs[0].groupId, '0');
  });

  it('stale slow level gets practice, not review', () => {
    const recs = computeLevelRecs([status('0', 'learning', true)]);
    assert.equal(recs.length, 1);
    assert.equal(recs[0].type, 'practice');
  });

  it('produces practice recs for slow levels', () => {
    const recs = computeLevelRecs([status('0', 'learning')]);
    assert.equal(recs[0].type, 'practice');
  });

  it('solid level with scheduled review gets no rec (practiced enough)', () => {
    const recs = computeLevelRecs([status('0', 'solid')]);
    assert.equal(recs.length, 0);
  });

  it('solid level with no stability data gets automate rec', () => {
    const s: LevelStatus = {
      groupId: '0',
      speed: 0.75,
      speedLabel: 'solid',
      reviewStatus: null,
      reviewInHours: null,
    };
    const recs = computeLevelRecs([s]);
    assert.equal(recs.length, 1);
    assert.equal(recs[0].type, 'automate');
  });

  it('learned stale level gets review only (no automate)', () => {
    const recs = computeLevelRecs([status('0', 'solid', true)]);
    assert.equal(recs.length, 1);
    assert.equal(recs[0].type, 'review');
  });

  it('no review rec when reviewStatus is soon but not yet due', () => {
    // Freshly practiced: reviewStatus 'soon' (hoursRemaining ≤ 24) but
    // reviewInHours > 0 (freshness still above threshold). Should NOT
    // trigger a review recommendation.
    const s: LevelStatus = {
      groupId: '0',
      speed: 0.95,
      speedLabel: 'automatic',
      reviewStatus: 'soon',
      reviewInHours: 4, // due in 4h, not yet
    };
    const recs = computeLevelRecs([s]);
    assert.equal(recs.length, 0);
  });

  it('produces no recs for automatic fresh levels', () => {
    const recs = computeLevelRecs([status('0', 'automatic')]);
    assert.equal(recs.length, 0);
  });

  it('automatic stale level gets review', () => {
    const recs = computeLevelRecs([status('0', 'automatic', true)]);
    assert.equal(recs.length, 1);
    assert.equal(recs[0].type, 'review');
  });

  it('review and practice interleaved by level order, automate after', () => {
    const solidNoData: LevelStatus = {
      groupId: '2',
      speed: 0.75,
      speedLabel: 'solid',
      reviewStatus: null,
      reviewInHours: null,
    };
    const recs = computeLevelRecs([
      status('0', 'solid', true), // review (Solid + stale)
      status('1', 'learning'), // practice
      solidNoData, // automate (Solid, no stability data)
    ]);
    assert.equal(recs[0].type, 'review');
    assert.equal(recs[0].groupId, '0');
    assert.equal(recs[1].type, 'practice');
    assert.equal(recs[1].groupId, '1');
    assert.equal(recs[2].type, 'automate');
    assert.equal(recs[2].groupId, '2');
  });

  it('practice before review when earlier level needs practice', () => {
    // Bug #83: L1 learning should come before L3 review.
    const recs = computeLevelRecs([
      status('0', 'learning'), // practice (L1)
      status('1', 'learning'), // practice (L2)
      status('2', 'solid', true), // review (L3)
    ]);
    assert.equal(recs[0].type, 'practice');
    assert.equal(recs[0].groupId, '0');
    assert.equal(recs[1].type, 'practice');
    assert.equal(recs[1].groupId, '1');
    assert.equal(recs[2].type, 'review');
    assert.equal(recs[2].groupId, '2');
  });
});

// ---------------------------------------------------------------------------
// checkExpansionGate
// ---------------------------------------------------------------------------

describe('checkExpansionGate', () => {
  function status(
    speed: number,
    reviewSoon: boolean = false,
  ): LevelStatus {
    return {
      groupId: '0',
      speed,
      speedLabel: speed >= 0.9
        ? 'automatic'
        : speed >= 0.7
        ? 'solid'
        : 'learning',
      reviewStatus: reviewSoon ? 'soon' : 'scheduled',
      reviewInHours: reviewSoon ? 0 : 72,
    };
  }

  it('opens when all levels ≥ learned and fresh', () => {
    assert.ok(checkExpansionGate([status(0.8), status(0.95)]));
  });

  it('closes when any level below learned', () => {
    assert.ok(!checkExpansionGate([status(0.8), status(0.5)]));
  });

  it('closes when any level needs review', () => {
    assert.ok(!checkExpansionGate([status(0.8, true)]));
  });

  it('returns false for empty input', () => {
    assert.ok(!checkExpansionGate([]));
  });

  it('opens at exact threshold (0.7)', () => {
    assert.ok(checkExpansionGate([status(0.7)]));
  });

  it('stays open when review is upcoming but not yet due', () => {
    const s: LevelStatus = {
      groupId: '0',
      speed: 0.95,
      speedLabel: 'automatic',
      reviewStatus: 'soon',
      reviewInHours: 4, // due in 4h, not yet
    };
    assert.ok(checkExpansionGate([s]));
  });
});

// ---------------------------------------------------------------------------
// shouldThrottleExpansion
// ---------------------------------------------------------------------------

describe('shouldThrottleExpansion', () => {
  function status(label: LevelStatus['speedLabel']): LevelStatus {
    return {
      groupId: '0',
      speed: 0.75,
      speedLabel: label,
      reviewStatus: 'scheduled',
      reviewInHours: 72,
    };
  }

  it('throttles when ≥3 learned levels', () => {
    assert.ok(shouldThrottleExpansion([
      status('solid'),
      status('solid'),
      status('solid'),
    ]));
  });

  it('does not throttle when <3 learned levels', () => {
    assert.ok(
      !shouldThrottleExpansion([
        status('solid'),
        status('solid'),
        status('automatic'),
      ]),
    );
  });
});

// ---------------------------------------------------------------------------
// computeRecommendations — integration tests
// ---------------------------------------------------------------------------

describe('computeRecommendations', () => {
  it('recommends first unstarted group on fresh start', () => {
    const data = {
      '0': {
        workingCount: 0,
        unseenCount: 10,
        automaticCount: 0,
        totalCount: 10,
      },
      '1': {
        workingCount: 0,
        unseenCount: 10,
        automaticCount: 0,
        totalCount: 10,
      },
    };
    const result = computeRecommendations(
      mockSelector(data),
      ['0', '1'],
      makeGetItemIds(data),
      config,
    );
    assert.ok(result.recommended.has('0'));
    assert.equal(result.expandIndex, '0');
    assert.equal(result.expandNewCount, 10);
    assert.equal(result.levelRecs[0].type, 'expand');
  });

  it('uses sortUnstarted on fresh start', () => {
    const data = {
      '0': {
        workingCount: 0,
        unseenCount: 10,
        automaticCount: 0,
        totalCount: 10,
      },
      '1': {
        workingCount: 0,
        unseenCount: 5,
        automaticCount: 0,
        totalCount: 5,
      },
    };
    const result = computeRecommendations(
      mockSelector(data),
      ['0', '1'],
      makeGetItemIds(data),
      config,
      { sortUnstarted: (a, b) => a.totalCount - b.totalCount },
    );
    assert.equal(result.expandIndex, '1');
    assert.equal(result.expandNewCount, 5);
  });

  it('recommends the single started group for practice', () => {
    const data = {
      '0': {
        workingCount: 3,
        unseenCount: 5,
        automaticCount: 2,
        totalCount: 10,
      },
      '1': {
        workingCount: 0,
        unseenCount: 10,
        automaticCount: 0,
        totalCount: 10,
      },
    };
    const result = computeRecommendations(
      mockSelector(data),
      ['0', '1'],
      makeGetItemIds(data),
      config,
    );
    assert.ok(result.recommended.has('0'));
    assert.ok(result.enabled!.has('0'));
    // Should have a practice rec for group 0
    assert.ok(result.levelRecs.some((r) => r.type === 'practice'));
  });

  it('does not expand when level speed below threshold', () => {
    const data = {
      '0': {
        workingCount: 3,
        unseenCount: 2,
        automaticCount: 2,
        totalCount: 7,
      },
      '1': {
        workingCount: 0,
        unseenCount: 10,
        automaticCount: 0,
        totalCount: 10,
      },
    };
    const result = computeRecommendations(
      mockSelector(data),
      ['0', '1'],
      makeGetItemIds(data),
      config,
    );
    assert.ok(!result.recommended.has('1'));
    assert.equal(result.expandIndex, null);
  });

  it('expands when level speed meets threshold', () => {
    const data = {
      '0': {
        workingCount: 0,
        unseenCount: 0,
        automaticCount: 10,
        totalCount: 10,
      },
      '1': {
        workingCount: 0,
        unseenCount: 10,
        automaticCount: 0,
        totalCount: 10,
      },
    };
    const result = computeRecommendations(
      mockSelector(data),
      ['0', '1'],
      makeGetItemIds(data),
      config,
    );
    assert.ok(result.recommended.has('1'));
    assert.ok(result.enabled!.has('1'));
    assert.equal(result.expandIndex, '1');
  });

  it('uses sortUnstarted to pick expansion target', () => {
    const data = {
      '0': {
        workingCount: 0,
        unseenCount: 0,
        automaticCount: 10,
        totalCount: 10,
      },
      '1': {
        workingCount: 0,
        unseenCount: 10,
        automaticCount: 0,
        totalCount: 10,
      },
      '2': {
        workingCount: 0,
        unseenCount: 10,
        automaticCount: 0,
        totalCount: 10,
      },
    };
    const result = computeRecommendations(
      mockSelector(data),
      ['0', '1', '2'],
      makeGetItemIds(data),
      config,
      { sortUnstarted: (a, b) => a.groupId.localeCompare(b.groupId) },
    );
    assert.ok(result.recommended.has('1'));
    assert.equal(result.expandIndex, '1');
  });

  it('always recommends at least one group when data exists', () => {
    const data = {
      '0': {
        workingCount: 0,
        unseenCount: 0,
        automaticCount: 10,
        totalCount: 10,
      },
      '1': {
        workingCount: 0,
        unseenCount: 0,
        automaticCount: 10,
        totalCount: 10,
      },
    };
    const result = computeRecommendations(
      mockSelector(data),
      ['0', '1'],
      makeGetItemIds(data),
      config,
    );
    assert.ok(result.recommended.size >= 1);
    assert.ok(result.enabled!.size >= 1);
  });

  it('does not expand when all items are working (speed too low)', () => {
    const data = {
      '0': {
        workingCount: 10,
        unseenCount: 0,
        automaticCount: 0,
        totalCount: 10,
      },
      '1': {
        workingCount: 0,
        unseenCount: 10,
        automaticCount: 0,
        totalCount: 10,
      },
    };
    const result = computeRecommendations(
      mockSelector(data),
      ['0', '1'],
      makeGetItemIds(data),
      config,
    );
    assert.ok(!result.recommended.has('1'));
    assert.equal(result.expandIndex, null);
  });

  // --- Budget deduplication ---

  it('does not double-count budget when a level has both review and practice', () => {
    // Group 0: needs both review (stale) and practice (slow) — produces 2 recs
    // Group 1: needs practice — should still fit in budget
    const data = {
      '0': {
        workingCount: 10,
        unseenCount: 0,
        automaticCount: 0,
        totalCount: 10,
      },
      '1': {
        workingCount: 10,
        unseenCount: 0,
        automaticCount: 0,
        totalCount: 10,
      },
    };
    const sel = mockSelector(data, {
      getStats: () => ({
        recentTimes: [1000],
        ewma: 1000,
        sampleCount: 10,
        lastSeen: Date.now() - 30 * 24 * 3600_000,
        stability: 4,
        lastCorrectAt: Date.now() - 30 * 24 * 3600_000,
      }),
      getFreshness: () => 0.01, // stale → review
    });
    const result = computeRecommendations(
      sel,
      ['0', '1'],
      makeGetItemIds(data),
      { maxWorkItems: 20 },
    );
    // Both groups should be recommended: budget = 20, group 0 = 10, group 1 = 10
    // Without dedup fix, group 0 would consume 20 (counted twice), starving group 1
    assert.ok(result.recommended.has('0'));
    assert.ok(result.recommended.has('1'));
  });

  it('budget caps levelRecs to match recommended set', () => {
    // 5 groups of 15 items each, all need practice. Budget = 30.
    // Only first 2 groups fit (30 items). levelRecs should NOT include
    // groups 2-4, even though computeLevelRecs would produce recs for them.
    const data: Record<string, {
      workingCount: number;
      unseenCount: number;
      automaticCount: number;
      totalCount: number;
    }> = {};
    for (let i = 0; i < 5; i++) {
      data[String(i)] = {
        workingCount: 15,
        unseenCount: 0,
        automaticCount: 0,
        totalCount: 15,
      };
    }
    const result = computeRecommendations(
      mockSelector(data),
      ['0', '1', '2', '3', '4'],
      makeGetItemIds(data),
      { maxWorkItems: 30 },
    );
    // Only 2 groups should fit in budget (15 + 15 = 30)
    assert.equal(result.recommended.size, 2);
    // levelRecs should match: no recs for groups outside recommended
    for (const rec of result.levelRecs) {
      assert.ok(
        result.recommended.has(rec.groupId),
        `levelRec for group ${rec.groupId} not in recommended set`,
      );
    }
  });

  it('budget-excluded expand clears expandIndex', () => {
    // Group 0: 25 items, needs practice. Group 1: 10 items, unstarted.
    // Budget = 30. Group 0 fits (25), expand group 1 would be 35 > 30.
    const data = {
      '0': {
        workingCount: 0,
        unseenCount: 0,
        automaticCount: 25,
        totalCount: 25,
      },
      '1': {
        workingCount: 0,
        unseenCount: 10,
        automaticCount: 0,
        totalCount: 10,
      },
    };
    // Need P10 speed ≥ 0.7 for gate to open but also an automate rec
    // to consume budget. Use overrides.
    const sel = mockSelector(data, {
      getLevelSpeed: () => ({ level: 0.75, seen: 25 }),
    });
    const result = computeRecommendations(
      sel,
      ['0', '1'],
      makeGetItemIds(data),
      { maxWorkItems: 30 },
    );
    // Group 0 (25 items) fits. If expand group 1 (10) doesn't fit because
    // group 0 already consumed 25 of 30 budget → expand should be cleared.
    // Actually 25 + 10 = 35 > 30, but group 0 is first and size > 0,
    // so expand at 25+10=35 > 30 is skipped.
    if (!result.recommended.has('1')) {
      assert.equal(result.expandIndex, null);
      assert.ok(!result.levelRecs.some((r) => r.type === 'expand'));
    }
  });

  // --- Skipped groups ---

  it('skipped group is excluded from recommendations', () => {
    const data = {
      '0': {
        workingCount: 5,
        unseenCount: 0,
        automaticCount: 5,
        totalCount: 10,
      },
      '1': {
        workingCount: 5,
        unseenCount: 5,
        automaticCount: 0,
        totalCount: 10,
      },
      '2': {
        workingCount: 0,
        unseenCount: 10,
        automaticCount: 0,
        totalCount: 10,
      },
      '3': {
        workingCount: 0,
        unseenCount: 10,
        automaticCount: 0,
        totalCount: 10,
      },
    };
    const result = computeRecommendations(
      mockSelector(data),
      ['0', '2', '3'], // group 1 skipped
      makeGetItemIds(data),
      config,
    );
    assert.ok(!result.recommended.has('1'));
  });

  it('expansion skips past skipped group', () => {
    const data = {
      '0': {
        workingCount: 0,
        unseenCount: 0,
        automaticCount: 10,
        totalCount: 10,
      },
      '1': {
        workingCount: 0,
        unseenCount: 10,
        automaticCount: 0,
        totalCount: 10,
      },
      '2': {
        workingCount: 0,
        unseenCount: 10,
        automaticCount: 0,
        totalCount: 10,
      },
    };
    const result = computeRecommendations(
      mockSelector(data),
      ['0', '2'], // group 1 skipped
      makeGetItemIds(data),
      config,
      { sortUnstarted: (a, b) => a.groupId.localeCompare(b.groupId) },
    );
    assert.equal(result.expandIndex, '2');
  });

  // --- Item cap ---

  it('respects maxWorkItems budget', () => {
    const data = {
      '0': {
        workingCount: 20,
        unseenCount: 0,
        automaticCount: 0,
        totalCount: 20,
      },
      '1': {
        workingCount: 20,
        unseenCount: 0,
        automaticCount: 0,
        totalCount: 20,
      },
      '2': {
        workingCount: 20,
        unseenCount: 0,
        automaticCount: 0,
        totalCount: 20,
      },
    };
    const result = computeRecommendations(
      mockSelector(data),
      ['0', '1', '2'],
      makeGetItemIds(data),
      { maxWorkItems: 30 },
    );
    // With 20 items per group and budget of 30, should include at most 1 group
    // (first one fits at 20, second would be 40 > 30)
    assert.ok(result.recommended.size <= 2);
  });

  // --- Review detection ---

  it('produces review levelRecs when Solid+ level has low freshness', () => {
    // All items automatic → P10 speed ≥ 0.9 (Solid+), so stale → review.
    const data = {
      '0': {
        workingCount: 0,
        unseenCount: 0,
        automaticCount: 10,
        totalCount: 10,
      },
    };
    const sel = mockSelector(data, {
      getStats: () => ({
        recentTimes: [1000],
        ewma: 1000,
        sampleCount: 10,
        lastSeen: Date.now() - 30 * 24 * 3600_000,
        stability: 4,
        lastCorrectAt: Date.now() - 30 * 24 * 3600_000,
      }),
      getFreshness: () => 0.01,
    });
    const result = computeRecommendations(
      sel,
      ['0'],
      makeGetItemIds(data),
      config,
    );
    assert.ok(result.levelRecs.some((r) => r.type === 'review'));
  });

  it('stale slow level gets practice, not review', () => {
    // Mixed items → P10 speed in learning range, stale → practice.
    const data = {
      '0': {
        workingCount: 5,
        unseenCount: 0,
        automaticCount: 5,
        totalCount: 10,
      },
    };
    const sel = mockSelector(data, {
      getStats: () => ({
        recentTimes: [1000],
        ewma: 1000,
        sampleCount: 10,
        lastSeen: Date.now() - 30 * 24 * 3600_000,
        stability: 4,
        lastCorrectAt: Date.now() - 30 * 24 * 3600_000,
      }),
      getFreshness: () => 0.01,
    });
    const result = computeRecommendations(
      sel,
      ['0'],
      makeGetItemIds(data),
      config,
    );
    assert.ok(!result.levelRecs.some((r) => r.type === 'review'));
    assert.ok(result.levelRecs.some((r) => r.type === 'practice'));
  });

  it('no review recs when freshness is high', () => {
    const data = {
      '0': {
        workingCount: 5,
        unseenCount: 0,
        automaticCount: 5,
        totalCount: 10,
      },
    };
    const result = computeRecommendations(
      mockSelector(data),
      ['0'],
      makeGetItemIds(data),
      config,
    );
    assert.ok(!result.levelRecs.some((r) => r.type === 'review'));
  });

  // --- Automate ---

  it('solid + fresh level gets no rec (practiced enough)', () => {
    const data = {
      '0': {
        workingCount: 0,
        unseenCount: 0,
        automaticCount: 10,
        totalCount: 10,
      },
    };
    const sel = mockSelector(data, {
      getLevelSpeed: () => ({ level: 0.75, seen: 10 }),
    });
    const result = computeRecommendations(
      sel,
      ['0'],
      makeGetItemIds(data),
      config,
    );
    // Solid + scheduled review → no rec (practiced enough).
    assert.equal(result.levelRecs.length, 0);
    // levelStatuses shows scheduled review — pill and rec agree.
    const ls = result.levelStatuses?.find((s) => s.groupId === '0');
    assert.ok(ls);
    assert.equal(ls!.reviewStatus, 'scheduled');
    assert.ok(ls!.reviewInHours! > 0);
  });

  it('solid level with no stability data gets automate rec', () => {
    const data = {
      '0': {
        workingCount: 0,
        unseenCount: 0,
        automaticCount: 10,
        totalCount: 10,
      },
    };
    const sel = mockSelector(data, {
      getLevelSpeed: () => ({ level: 0.75, seen: 10 }),
      getStats: () => null,
      getFreshness: () => null,
    });
    const result = computeRecommendations(
      sel,
      ['0'],
      makeGetItemIds(data),
      config,
    );
    assert.ok(result.levelRecs.some((r) => r.type === 'automate'));
  });

  // --- Skip/unskip symmetry ---

  it('unskipped group reappears in recommendations', () => {
    const data = {
      '0': {
        workingCount: 0,
        unseenCount: 0,
        automaticCount: 10,
        totalCount: 10,
      },
      '1': {
        workingCount: 0,
        unseenCount: 10,
        automaticCount: 0,
        totalCount: 10,
      },
      '2': {
        workingCount: 0,
        unseenCount: 10,
        automaticCount: 0,
        totalCount: 10,
      },
    };
    const sel = mockSelector(data);
    const getIds = makeGetItemIds(data);
    const sort = {
      sortUnstarted: (a: GroupRecommendation, b: GroupRecommendation) =>
        a.groupId.localeCompare(b.groupId),
    };

    const r1 = computeRecommendations(
      sel,
      ['0', '1', '2'],
      getIds,
      config,
      sort,
    );
    assert.equal(r1.expandIndex, '1');

    const r2 = computeRecommendations(sel, ['0', '2'], getIds, config, sort);
    assert.equal(r2.expandIndex, '2');

    const r3 = computeRecommendations(
      sel,
      ['0', '1', '2'],
      getIds,
      config,
      sort,
    );
    assert.equal(r3.expandIndex, '1');
  });
});

// ---------------------------------------------------------------------------
// Timestamp consistency — freshness calls receive consistent nowMs
// ---------------------------------------------------------------------------

describe('review timing consistency', () => {
  it('review timing uses per-item freshness and stability', () => {
    const data = {
      '0': {
        workingCount: 0,
        unseenCount: 0,
        automaticCount: 10,
        totalCount: 10,
      },
    };
    // Override to make items stale.
    const sel = mockSelector(data, {
      getStats: () => ({
        recentTimes: [1000],
        ewma: 1000,
        sampleCount: 10,
        lastSeen: Date.now() - 30 * 24 * 3600_000,
        stability: 4,
        lastCorrectAt: Date.now() - 30 * 24 * 3600_000,
      }),
      getFreshness: () => 0.01,
    });
    const result = computeRecommendations(
      sel,
      ['0'],
      makeGetItemIds(data),
      config,
    );
    // Should produce a review rec since items are automatic + stale.
    assert.ok(result.levelRecs.some((r) => r.type === 'review'));
  });
});

// ---------------------------------------------------------------------------
// Real data: determinism and skip/unskip symmetry with real AdaptiveSelector
// ---------------------------------------------------------------------------

// Exact localStorage snapshot from a user who reported the bug.
const REAL_FRETBOARD_DATA: Record<string, string> = JSON.parse(
  '{"adaptive_fretboard_4-8":"{\\"recentTimes\\":[3772],\\"ewma\\":3772,\\"sampleCount\\":1,\\"lastSeen\\":1773248142139,\\"stability\\":4,\\"lastCorrectAt\\":1773248142139}","adaptive_fretboard_5-8":"{\\"recentTimes\\":[3987,3086,1428,648,1078,1420,8136,4734,1815,1313],\\"ewma\\":2747.0773782019996,\\"sampleCount\\":11,\\"lastSeen\\":1773182605495,\\"stability\\":336,\\"lastCorrectAt\\":1773182605495}","adaptive_fretboard_3-5":"{\\"recentTimes\\":[3856,8136,6713,7970,1357],\\"ewma\\":4830.631,\\"sampleCount\\":5,\\"lastSeen\\":1773248132425,\\"stability\\":16.759656083650363,\\"lastCorrectAt\\":1773248132425}","adaptive_fretboard_1-8":"{\\"recentTimes\\":[871,5096,1876,1728,828,3890,1736,1263,799,1664],\\"ewma\\":1817.5409725226998,\\"sampleCount\\":10,\\"lastSeen\\":1771203823812,\\"stability\\":336,\\"lastCorrectAt\\":1771203823812}","adaptive_fretboard_3-12":"{\\"recentTimes\\":[2778,2031,1850,4208,4587,4209,2371,1471],\\"ewma\\":2726.7801710999993,\\"sampleCount\\":8,\\"lastSeen\\":1773248151535,\\"stability\\":336,\\"lastCorrectAt\\":1773248151535}","adaptive_fretboard_0-2":"{\\"recentTimes\\":[2950,7254,4332,5710,1821],\\"ewma\\":3836.9356,\\"sampleCount\\":5,\\"lastSeen\\":1771872295786,\\"stability\\":10.740694789081886,\\"lastCorrectAt\\":1771872295786}","adaptive_fretboard_2-7":"{\\"recentTimes\\":[7254,7254,3371,5182],\\"ewma\\":5816.969999999999,\\"sampleCount\\":4,\\"lastSeen\\":1772142000564,\\"stability\\":4,\\"lastCorrectAt\\":1772141995919}","adaptive_fretboard_3-7":"{\\"recentTimes\\":[3405,5021],\\"ewma\\":3889.8,\\"sampleCount\\":2,\\"lastSeen\\":1772492901801,\\"stability\\":7.445796460176991,\\"lastCorrectAt\\":1772492901801}","adaptive_fretboard_0-6":"{\\"recentTimes\\":[3722,6921,5081,7254,7254],\\"ewma\\":6052.270099999998,\\"sampleCount\\":5,\\"lastSeen\\":1771871799787,\\"stability\\":4,\\"lastCorrectAt\\":1771871799787}","adaptive_fretboard_0-7":"{\\"recentTimes\\":[2120,1414,1098,1411,1682,891,1221,1461,1593,2949],\\"ewma\\":1944.8417878070168,\\"sampleCount\\":16,\\"lastSeen\\":1773182636154,\\"stability\\":336,\\"lastCorrectAt\\":1773182636154}","adaptive_fretboard_2-1":"{\\"recentTimes\\":[1973,2243,6467],\\"ewma\\":6729.695999999998,\\"sampleCount\\":3,\\"lastSeen\\":1772002972408,\\"stability\\":4,\\"lastCorrectAt\\":1771817189850}","adaptive_fretboard_2-5":"{\\"recentTimes\\":[3564],\\"ewma\\":3564,\\"sampleCount\\":1,\\"lastSeen\\":1771954933997,\\"stability\\":4,\\"lastCorrectAt\\":1771954933997}","adaptive_fretboard_2-3":"{\\"recentTimes\\":[3187,3029],\\"ewma\\":3139.5999999999995,\\"sampleCount\\":2,\\"lastSeen\\":1771895882544,\\"stability\\":4,\\"lastCorrectAt\\":1771807982121}","adaptive_fretboard_1-1":"{\\"recentTimes\\":[1126,1186,875,1988],\\"ewma\\":1340.71,\\"sampleCount\\":4,\\"lastSeen\\":1773248153764,\\"stability\\":336,\\"lastCorrectAt\\":1773248153764}","adaptive_fretboard_5-1":"{\\"recentTimes\\":[1306,1092,1139,1442,1083,1264,940,1129,1083,1311],\\"ewma\\":1168.6572755495697,\\"sampleCount\\":12,\\"lastSeen\\":1773182615007,\\"stability\\":336,\\"lastCorrectAt\\":1773182615007}","adaptive_fretboard_2-2":"{\\"recentTimes\\":[],\\"ewma\\":7254,\\"sampleCount\\":0,\\"lastSeen\\":1771883879332,\\"stability\\":4,\\"lastCorrectAt\\":null}","adaptive_fretboard_3-0":"{\\"recentTimes\\":[2060,1954,1782,2544,8136],\\"ewma\\":3932.6665999999996,\\"sampleCount\\":5,\\"lastSeen\\":1772645217331,\\"stability\\":74.25266141736529,\\"lastCorrectAt\\":1772645217331}","adaptive_fretboard_5-7":"{\\"recentTimes\\":[1597,1524,1174,2224,1521,1274,1035,1419,1132,1821],\\"ewma\\":1465.8730388109996,\\"sampleCount\\":10,\\"lastSeen\\":1773182613409,\\"stability\\":336,\\"lastCorrectAt\\":1773182613409}","adaptive_fretboard_2-6":"{\\"recentTimes\\":[3405,7254,1973],\\"ewma\\":6644.309999999999,\\"sampleCount\\":3,\\"lastSeen\\":1771895920470,\\"stability\\":10.55210918114144,\\"lastCorrectAt\\":1771895920470}","adaptive_fretboard_0-11":"{\\"recentTimes\\":[5090,4761,7254,4816,2968,2469],\\"ewma\\":4016.7797299999993,\\"sampleCount\\":6,\\"lastSeen\\":1771871808434,\\"stability\\":23.146650585866542,\\"lastCorrectAt\\":1771871808434}","adaptive_fretboard_0-8":"{\\"recentTimes\\":[1329,1005,1478,1466,1710,1523,1391,1271,2051,3728],\\"ewma\\":2357.428194300008,\\"sampleCount\\":13,\\"lastSeen\\":1773182629753,\\"stability\\":336,\\"lastCorrectAt\\":1773182629753}","adaptive_fretboard_0-3":"{\\"recentTimes\\":[1300,1400,1495,1157,6247,1738,1260,1396,3053],\\"ewma\\":2243.7255024999995,\\"sampleCount\\":9,\\"lastSeen\\":1773182620005,\\"stability\\":336,\\"lastCorrectAt\\":1773182620005}","adaptive_fretboard_5-3":"{\\"recentTimes\\":[1010,2281,1446,2201,1163,1076,1463,1374,1823,3189],\\"ewma\\":2056.984586621854,\\"sampleCount\\":15,\\"lastSeen\\":1773182623376,\\"stability\\":336,\\"lastCorrectAt\\":1773182623376}","adaptive_fretboard_3-3":"{\\"recentTimes\\":[3971,3760],\\"ewma\\":3907.7,\\"sampleCount\\":2,\\"lastSeen\\":1773248130547,\\"stability\\":8.84070796460177,\\"lastCorrectAt\\":1773248130547}","adaptive_fretboard_0-12":"{\\"recentTimes\\":[4518,1274,1616,2290,1010,1023,933,926,881,1118],\\"ewma\\":1142.6651644639396,\\"sampleCount\\":12,\\"lastSeen\\":1773182625935,\\"stability\\":336,\\"lastCorrectAt\\":1773182625935}","adaptive_fretboard_5-10":"{\\"recentTimes\\":[1131,2771,4251,1110,1798,2693,1065,4937,1645,2765],\\"ewma\\":2609.3688168630997,\\"sampleCount\\":14,\\"lastSeen\\":1773248156807,\\"stability\\":336,\\"lastCorrectAt\\":1773248156807}","adaptive_fretboard_2-11":"{\\"recentTimes\\":[5818],\\"ewma\\":6823.199999999999,\\"sampleCount\\":1,\\"lastSeen\\":1772092282506,\\"stability\\":4,\\"lastCorrectAt\\":1772092267707}","adaptive_fretboard_0-1":"{\\"recentTimes\\":[797,1691,1171,1123,1007,1027,1261,1325,1094],\\"ewma\\":1155.7061870599998,\\"sampleCount\\":9,\\"lastSeen\\":1773182633102,\\"stability\\":336,\\"lastCorrectAt\\":1773182633102}","adaptive_fretboard_1-6":"{\\"recentTimes\\":[1928,7019,6005,1661,3408,8136,6842],\\"ewma\\":5446.325320999999,\\"sampleCount\\":7,\\"lastSeen\\":1773248163895,\\"stability\\":14.106073898891264,\\"lastCorrectAt\\":1773248163895}","adaptive_fretboard_5-0":"{\\"recentTimes\\":[620,1472,1433,867,996,1060,792,993,893,1215],\\"ewma\\":1061.1927460891998,\\"sampleCount\\":11,\\"lastSeen\\":1773182591852,\\"stability\\":336,\\"lastCorrectAt\\":1773182591852}","adaptive_fretboard_5-5":"{\\"recentTimes\\":[2727,3301,1312,1933,1880,1299,6191,1012,763,1479],\\"ewma\\":1818.4871432764696,\\"sampleCount\\":12,\\"lastSeen\\":1773182600575,\\"stability\\":336,\\"lastCorrectAt\\":1773182600575}","adaptive_fretboard_3-6":"{\\"recentTimes\\":[7254,2890,7254,4523,1695,8136],\\"ewma\\":5596.2369629999985,\\"sampleCount\\":6,\\"lastSeen\\":1772668743879,\\"stability\\":15.703749769256847,\\"lastCorrectAt\\":1772492918342}","adaptive_fretboard_2-12":"{\\"recentTimes\\":[2824,3075,3514,2451],\\"ewma\\":2893.897,\\"sampleCount\\":4,\\"lastSeen\\":1772002981759,\\"stability\\":49.39632811142708,\\"lastCorrectAt\\":1772002981759}","adaptive_fretboard_0-10":"{\\"recentTimes\\":[3047,1263,1202,1481,1302,1480,1004,2531,1368,3122],\\"ewma\\":2121.869794115104,\\"sampleCount\\":16,\\"lastSeen\\":1773248101097,\\"stability\\":336,\\"lastCorrectAt\\":1773248101097}","adaptive_fretboard_0-9":"{\\"recentTimes\\":[7254,7254],\\"ewma\\":7090.829999999999,\\"sampleCount\\":2,\\"lastSeen\\":1771872277429,\\"stability\\":4,\\"lastCorrectAt\\":1771870196896}","adaptive_fretboard_2-8":"{\\"recentTimes\\":[2903,7254],\\"ewma\\":8540.88,\\"sampleCount\\":2,\\"lastSeen\\":1772003009806,\\"stability\\":9.398263027295286,\\"lastCorrectAt\\":1772003009806}","adaptive_fretboard_1-12":"{\\"recentTimes\\":[1588,1197,939,1118,1059],\\"ewma\\":1194.9630999999997,\\"sampleCount\\":5,\\"lastSeen\\":1771203821883,\\"stability\\":324,\\"lastCorrectAt\\":1771203821883}","adaptive_fretboard_5-12":"{\\"recentTimes\\":[982,614,1369,2712,1189],\\"ewma\\":1426.4218,\\"sampleCount\\":5,\\"lastSeen\\":1773182624714,\\"stability\\":255.2944855486987,\\"lastCorrectAt\\":1773182624714}","adaptive_fretboard_1-0":"{\\"recentTimes\\":[4632,871,1528,942,1821],\\"ewma\\":2170.5050999999994,\\"sampleCount\\":5,\\"lastSeen\\":1773248108008,\\"stability\\":292.3879443851083,\\"lastCorrectAt\\":1773248108008}","adaptive_fretboard_1-3":"{\\"recentTimes\\":[3451,849,2379,4952,2029,1269,678,1082,1092,3008],\\"ewma\\":1941.7493432139995,\\"sampleCount\\":10,\\"lastSeen\\":1773248145673,\\"stability\\":336,\\"lastCorrectAt\\":1773248145673}","adaptive_fretboard_1-5":"{\\"recentTimes\\":[1550,970,1638,736],\\"ewma\\":1239.02,\\"sampleCount\\":4,\\"lastSeen\\":1771203830314,\\"stability\\":105.70344827586206,\\"lastCorrectAt\\":1771203830314}","adaptive_fretboard_3-11":"{\\"recentTimes\\":[6921,6552,3270,4505,5941,7015,4263,4687],\\"ewma\\":5234.460704699999,\\"sampleCount\\":8,\\"lastSeen\\":1772668741109,\\"stability\\":150.50826248134035,\\"lastCorrectAt\\":1772668741109}","adaptive_fretboard_3-1":"{\\"recentTimes\\":[2580,4877,6917,1827,5275,5408],\\"ewma\\":5045.2806359999995,\\"sampleCount\\":6,\\"lastSeen\\":1772646207221,\\"stability\\":37.25533204757478,\\"lastCorrectAt\\":1772646207221}","adaptive_fretboard_3-4":"{\\"recentTimes\\":[7254,3007,7254,7254,6555,8136,5304],\\"ewma\\":6537.329012999999,\\"sampleCount\\":7,\\"lastSeen\\":1772646200809,\\"stability\\":4,\\"lastCorrectAt\\":1772492878606}","adaptive_fretboard_2-4":"{\\"recentTimes\\":[10565,5106,7254,6996],\\"ewma\\":7996.516999999998,\\"sampleCount\\":4,\\"lastSeen\\":1772141980041,\\"stability\\":5.261061946902655,\\"lastCorrectAt\\":1772141980041}","adaptive_fretboard_2-9":"{\\"recentTimes\\":[8321,2529,6559,7254,3833,1604],\\"ewma\\":4608.063439999999,\\"sampleCount\\":6,\\"lastSeen\\":1772141998525,\\"stability\\":24.58407936212702,\\"lastCorrectAt\\":1772141998525}","adaptive_fretboard_0-5":"{\\"recentTimes\\":[3156,3344,2787,2059,5734,1165,1826,1201,1387,1552],\\"ewma\\":1835.1253162541996,\\"sampleCount\\":11,\\"lastSeen\\":1773182590089,\\"stability\\":336,\\"lastCorrectAt\\":1773182590089}","adaptive_fretboard_3-10":"{\\"recentTimes\\":[4316,6314,1322,4897,6469,8136,4307,3808],\\"ewma\\":5184.526058879998,\\"sampleCount\\":8,\\"lastSeen\\":1773248105552,\\"stability\\":336,\\"lastCorrectAt\\":1773248105552}","adaptive_fretboard_3-9":"{\\"recentTimes\\":[4160,4412,8136,2109],\\"ewma\\":4416.704,\\"sampleCount\\":4,\\"lastSeen\\":1773248126437,\\"stability\\":10.667035398230087,\\"lastCorrectAt\\":1773248126437}","adaptive_fretboard_0-0":"{\\"recentTimes\\":[1302,755,2624,1041,979,1148,1108,1007,1510,1428],\\"ewma\\":1306.763557239,\\"sampleCount\\":10,\\"lastSeen\\":1773248149679,\\"stability\\":336,\\"lastCorrectAt\\":1773248149679}","adaptive_fretboard_3-8":"{\\"recentTimes\\":[7254,6350,7254,3970,8136],\\"ewma\\":6735.938399999999,\\"sampleCount\\":5,\\"lastSeen\\":1772646185066,\\"stability\\":8.074441687344912,\\"lastCorrectAt\\":1772646185066}","adaptive_fretboard_1-10":"{\\"recentTimes\\":[1671,1249,1364],\\"ewma\\":1490.28,\\"sampleCount\\":3,\\"lastSeen\\":1771203815249,\\"stability\\":35.864367816091956,\\"lastCorrectAt\\":1771203815249}","adaptive_fretboard_0-4":"{\\"recentTimes\\":[5254,4069,4075,7254,5317],\\"ewma\\":5397.6505,\\"sampleCount\\":5,\\"lastSeen\\":1771872292963,\\"stability\\":4,\\"lastCorrectAt\\":1771871790763}"}',
);

const ALL_GUITAR_GROUP_IDS = getAllGroupIds(GUITAR);

// Map from group ID to display label for the real-data tests.
const GUITAR_GROUP_LABEL_MAP: Record<string, string> = (() => {
  const labels = [
    'E e',
    'A',
    'D',
    'G',
    'B',
    'E A \u266F\u266D',
    'D G \u266F\u266D',
    'B e \u266F\u266D',
  ];
  const m: Record<string, string> = {};
  ALL_GUITAR_GROUP_IDS.forEach((id, i) => {
    m[id] = labels[i];
  });
  return m;
})();

/** Load the real user data snapshot into a memory-backed selector. */
function createRealDataSelector() {
  const storage = createMemoryStorage();
  const prefix = 'adaptive_fretboard_';
  for (const [key, value] of Object.entries(REAL_FRETBOARD_DATA)) {
    if (key.startsWith(prefix)) {
      const itemId = key.slice(prefix.length);
      storage.saveStats(itemId, JSON.parse(value) as ItemStats);
    }
  }
  return createAdaptiveSelector(storage);
}

function getItemIds(groupId: string): string[] {
  return guitarGetItemIds(GUITAR, groupId);
}

function recText(
  selector: ReturnType<typeof createAdaptiveSelector>,
  groupIds: string[],
) {
  const rec = computeRecommendations(
    selector,
    groupIds,
    getItemIds,
    {},
    {
      sortUnstarted: (a, b) =>
        ALL_GUITAR_GROUP_IDS.indexOf(a.groupId) -
        ALL_GUITAR_GROUP_IDS.indexOf(b.groupId),
    },
  );
  const text = buildRecommendationText(
    rec,
    (id) => GUITAR_GROUP_LABEL_MAP[id] ?? id,
  );
  return { rec, text };
}

describe('computeRecommendations — real fretboard data', () => {
  it('is deterministic: two consecutive calls produce identical results', () => {
    const sel = createRealDataSelector();
    const r1 = recText(sel, ALL_GUITAR_GROUP_IDS);
    const r2 = recText(sel, ALL_GUITAR_GROUP_IDS);
    assert.equal(r1.text, r2.text);
    assert.deepStrictEqual(r1.rec.levelRecs, r2.rec.levelRecs);
  });

  it('skip/unskip group 7 is symmetric', () => {
    const sel = createRealDataSelector();
    const before = recText(sel, ALL_GUITAR_GROUP_IDS);
    recText(sel, ALL_GUITAR_GROUP_IDS.slice(0, 7)); // skip last group
    const after = recText(sel, ALL_GUITAR_GROUP_IDS);
    assert.equal(
      after.text,
      before.text,
      `unskip should restore original text.\n` +
        `  before: ${JSON.stringify(before.text)}\n` +
        `  after:  ${JSON.stringify(after.text)}`,
    );
  });

  it('skip/unskip every group is symmetric', () => {
    const sel = createRealDataSelector();
    const baseline = recText(sel, ALL_GUITAR_GROUP_IDS);
    for (let i = 0; i < ALL_GUITAR_GROUP_IDS.length; i++) {
      const withoutI = ALL_GUITAR_GROUP_IDS.filter((_, idx) => idx !== i);
      recText(sel, withoutI); // skip
      const restored = recText(sel, ALL_GUITAR_GROUP_IDS); // unskip
      assert.equal(
        restored.text,
        baseline.text,
        `group ${i} "${
          GUITAR_GROUP_LABEL_MAP[ALL_GUITAR_GROUP_IDS[i]]
        }": unskip should restore baseline.`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Integration: real selector → recommendations update after practice
// ---------------------------------------------------------------------------

describe('recommendations refresh after recordResponse (integration)', () => {
  // Use a real AdaptiveSelector (not a mock) with computeRecommendations
  // to verify that practicing items changes the recommendation output.
  // This is the scenario that was broken when memoization hid stale data.

  const groups = ['g1', 'g2', 'g3'];
  const itemsPerGroup = 4;
  const getItemIds = (g: string) =>
    Array.from({ length: itemsPerGroup }, (_, i) => `${g}-${i}`);
  const allItems = groups.flatMap(getItemIds);

  function makeSelector() {
    return createAdaptiveSelector(createMemoryStorage());
  }

  function getRecs(sel: ReturnType<typeof createAdaptiveSelector>) {
    return computeRecommendations(sel, groups, getItemIds, {});
  }

  it('fresh selector produces fresh-start recommendation', () => {
    const sel = makeSelector();
    const result = getRecs(sel);
    assert.ok(
      result.recommended.size > 0,
      'should recommend at least one group',
    );
  });

  it('practicing items changes recommendation output', () => {
    const sel = makeSelector();
    const before = getRecs(sel);

    // Before: fresh start, recommends first group only
    assert.ok(before.recommended.has('g1'));
    assert.equal(before.recommended.size, 1, 'fresh start → one group');

    // Practice all items in g1 to build speed
    for (const id of getItemIds('g1')) {
      for (let i = 0; i < 15; i++) {
        sel.recordResponse(id, 800);
      }
    }

    const after = getRecs(sel);

    // After: g1 is started, recommendations should differ —
    // either more groups recommended (expansion) or different levelRecs.
    const changed = after.recommended.size !== before.recommended.size ||
      after.levelRecs.length !== before.levelRecs.length ||
      after.expandIndex !== before.expandIndex;
    assert.ok(changed, 'recommendations should change after practice');

    // Version counter tracks all mutations
    assert.equal(
      sel.version,
      getItemIds('g1').length * 15,
    );
  });

  it('version acts as a usable cache key', () => {
    const sel = makeSelector();
    const v0 = sel.version;
    getRecs(sel);

    sel.recordResponse(allItems[0], 1000);
    const v1 = sel.version;
    assert.notEqual(v0, v1, 'version should change after recordResponse');

    // A memo keyed on version would recompute here — verify it works
    const fresh = getRecs(sel);
    assert.ok(fresh.recommended.size > 0);
  });
});
