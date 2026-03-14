// Tests for cross-skill recommendation engine.

import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  computeSkillRecommendation,
  rankSkillRecommendations,
  type SkillRecommendation,
} from './home-recommendations.ts';
import type { ModeProgressEntry } from './mode-progress-manifest.ts';
import { createMemoryStorage } from './adaptive.ts';
import type { StorageAdapter } from './types.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal mode entry with N groups of M items each. */
function makeEntry(
  modeId: string,
  groupCount: number,
  itemsPerGroup: number = 4,
): ModeProgressEntry {
  const groups: { label: string; getItemIds: () => string[] }[] = [];
  for (let g = 0; g < groupCount; g++) {
    const ids: string[] = [];
    for (let i = 0; i < itemsPerGroup; i++) {
      ids.push(`${modeId}-g${g}-i${i}`);
    }
    groups.push({ label: `Group ${g}`, getItemIds: () => ids });
  }
  return {
    modeId,
    namespace: modeId,
    groups,
    allItemIds: () => groups.flatMap((g) => g.getItemIds()),
  };
}

/** Seed items as fast and recently practiced (automatic). */
function seedAutomatic(storage: StorageAdapter, ids: string[]): void {
  const now = Date.now();
  for (const id of ids) {
    storage.saveStats(id, {
      recentTimes: [700, 750, 800],
      ewma: 750,
      sampleCount: 20,
      lastSeen: now - 3600_000,
      stability: 168, // 1 week half-life
      lastCorrectAt: now - 3600_000,
    });
  }
}

/** Seed items as slow (working, not automatic). */
function seedSlow(storage: StorageAdapter, ids: string[]): void {
  const now = Date.now();
  for (const id of ids) {
    storage.saveStats(id, {
      recentTimes: [3000, 3200, 3400],
      ewma: 3200,
      sampleCount: 5,
      lastSeen: now - 3600_000,
      stability: 8,
      lastCorrectAt: now - 3600_000,
    });
  }
}

/** Seed items as fast but stale (was automatic, now decayed). */
function seedStale(storage: StorageAdapter, ids: string[]): void {
  const now = Date.now();
  for (const id of ids) {
    storage.saveStats(id, {
      recentTimes: [700, 750, 800],
      ewma: 750,
      sampleCount: 20,
      lastSeen: now - 30 * 24 * 3600_000, // 30 days ago
      stability: 4, // short half-life → very decayed
      lastCorrectAt: now - 30 * 24 * 3600_000,
    });
  }
}

const DEFAULT_CONFIG = {};
const NO_SKIPS = new Set<number>();

// ---------------------------------------------------------------------------
// computeSkillRecommendation
// ---------------------------------------------------------------------------

describe('computeSkillRecommendation', () => {
  it('returns not-started when no items seen', () => {
    const entry = makeEntry('test', 3);
    const storage = createMemoryStorage();
    const result = computeSkillRecommendation(
      entry,
      storage,
      null,
      NO_SKIPS,
      DEFAULT_CONFIG,
    );
    assert.equal(result.type, 'not-started');
    assert.equal(result.cueLabel, '');
  });

  it('returns review when groups are stale', () => {
    const entry = makeEntry('test', 3);
    const storage = createMemoryStorage();
    // Seed group 0 as stale (was fast, now decayed)
    seedStale(storage, entry.groups[0].getItemIds());
    const result = computeSkillRecommendation(
      entry,
      storage,
      null,
      NO_SKIPS,
      DEFAULT_CONFIG,
    );
    assert.equal(result.type, 'review');
    assert.equal(result.cueLabel, 'Review');
    assert.ok(result.urgency > 0);
  });

  it('returns get-faster when groups have working items', () => {
    const entry = makeEntry('test', 3);
    const storage = createMemoryStorage();
    // Seed group 0 as slow (working, not automatic)
    seedSlow(storage, entry.groups[0].getItemIds());
    const result = computeSkillRecommendation(
      entry,
      storage,
      null,
      NO_SKIPS,
      DEFAULT_CONFIG,
    );
    assert.equal(result.type, 'get-faster');
    assert.equal(result.cueLabel, 'Get faster');
  });

  it('returns learn-next when expansion gate is open', () => {
    const entry = makeEntry('test', 3);
    const storage = createMemoryStorage();
    // Seed group 0 as automatic → expansion gate should open
    seedAutomatic(storage, entry.groups[0].getItemIds());
    const result = computeSkillRecommendation(
      entry,
      storage,
      null,
      NO_SKIPS,
      DEFAULT_CONFIG,
    );
    assert.equal(result.type, 'learn-next');
    assert.equal(result.cueLabel, 'Learn next level');
  });

  it('returns automatic when all groups mastered', () => {
    const entry = makeEntry('test', 2);
    const storage = createMemoryStorage();
    // Seed all groups as automatic
    for (const g of entry.groups) {
      seedAutomatic(storage, g.getItemIds());
    }
    const result = computeSkillRecommendation(
      entry,
      storage,
      null,
      NO_SKIPS,
      DEFAULT_CONFIG,
    );
    assert.equal(result.type, 'automatic');
  });

  it('single-group mode classifies correctly', () => {
    const entry = makeEntry('test', 1);
    const storage = createMemoryStorage();
    seedSlow(storage, entry.groups[0].getItemIds());
    const result = computeSkillRecommendation(
      entry,
      storage,
      null,
      NO_SKIPS,
      DEFAULT_CONFIG,
    );
    assert.equal(result.type, 'get-faster');
  });

  it('excludes skipped groups', () => {
    const entry = makeEntry('test', 2);
    const storage = createMemoryStorage();
    // Seed group 0 as stale, skip it
    seedStale(storage, entry.groups[0].getItemIds());
    const skipped = new Set([0]);
    const result = computeSkillRecommendation(
      entry,
      storage,
      null,
      skipped,
      DEFAULT_CONFIG,
    );
    // Group 0 is skipped, group 1 is unseen → not-started
    assert.equal(result.type, 'not-started');
  });

  it('review takes priority over get-faster', () => {
    const entry = makeEntry('test', 3);
    const storage = createMemoryStorage();
    // Group 0: stale. Group 1: slow (working).
    seedStale(storage, entry.groups[0].getItemIds());
    seedSlow(storage, entry.groups[1].getItemIds());
    const result = computeSkillRecommendation(
      entry,
      storage,
      null,
      NO_SKIPS,
      DEFAULT_CONFIG,
    );
    assert.equal(result.type, 'review');
  });
});

// ---------------------------------------------------------------------------
// rankSkillRecommendations
// ---------------------------------------------------------------------------

describe('rankSkillRecommendations', () => {
  const order = ['modeA', 'modeB', 'modeC', 'modeD', 'modeE'];

  function rec(
    modeId: string,
    type: SkillRecommendation['type'],
    urgency: number = 0,
  ): SkillRecommendation {
    const labels: Record<string, string> = {
      review: 'Review',
      'get-faster': 'Get faster',
      'learn-next': 'Learn next level',
    };
    return { modeId, type, urgency, cueLabel: labels[type] ?? '' };
  }

  it('returns top 3 by priority', () => {
    const recs = [
      rec('modeA', 'learn-next'),
      rec('modeB', 'review', 2),
      rec('modeC', 'get-faster', 5),
      rec('modeD', 'review', 3),
      rec('modeE', 'learn-next'),
    ];
    const result = rankSkillRecommendations(recs, order);
    assert.equal(result.length, 3);
    // Reviews first (higher urgency first), then get-faster
    assert.equal(result[0].modeId, 'modeD'); // review, urgency 3
    assert.equal(result[1].modeId, 'modeB'); // review, urgency 2
    assert.equal(result[2].modeId, 'modeC'); // get-faster, urgency 5
  });

  it('cold start: all not-started → first in definition order', () => {
    const recs = [
      rec('modeC', 'not-started'),
      rec('modeA', 'not-started'),
      rec('modeB', 'not-started'),
    ];
    const result = rankSkillRecommendations(recs, order);
    assert.equal(result.length, 1);
    assert.equal(result[0].modeId, 'modeA'); // first in definition order
    assert.equal(result[0].type, 'learn-next');
    assert.equal(result[0].cueLabel, 'Learn next level');
  });

  it('all automatic → empty list', () => {
    const recs = [
      rec('modeA', 'automatic'),
      rec('modeB', 'automatic'),
    ];
    const result = rankSkillRecommendations(recs, order);
    assert.equal(result.length, 0);
  });

  it('caps at maxCount', () => {
    const recs = [
      rec('modeA', 'review', 1),
      rec('modeB', 'review', 2),
      rec('modeC', 'review', 3),
      rec('modeD', 'review', 4),
    ];
    const result = rankSkillRecommendations(recs, order, 2);
    assert.equal(result.length, 2);
    assert.equal(result[0].modeId, 'modeD'); // highest urgency
    assert.equal(result[1].modeId, 'modeC');
  });

  it('excludes automatic and not-started from actionable', () => {
    const recs = [
      rec('modeA', 'automatic'),
      rec('modeB', 'not-started'),
      rec('modeC', 'get-faster', 5),
    ];
    const result = rankSkillRecommendations(recs, order);
    assert.equal(result.length, 1);
    assert.equal(result[0].modeId, 'modeC');
  });
});
