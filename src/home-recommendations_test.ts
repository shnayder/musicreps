// Tests for cross-skill recommendation engine.

import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  computeSkillRecommendation,
  rankSkillRecommendations,
  type SkillRecommendation,
} from './home-recommendations.ts';
import type { SkillProgressEntry } from './skill-progress-manifest.ts';
import { createMemoryStorage } from './adaptive.ts';
import type { StorageAdapter } from './types.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal mode entry with N groups of M items each. */
function makeEntry(
  skillId: string,
  levelCount: number,
  itemsPerLevel: number = 4,
): SkillProgressEntry {
  const levels: { id: string; label: string; getItemIds: () => string[] }[] =
    [];
  for (let g = 0; g < levelCount; g++) {
    const ids: string[] = [];
    for (let i = 0; i < itemsPerLevel; i++) {
      ids.push(`${skillId}-g${g}-i${i}`);
    }
    const id = `g${g}`;
    levels.push({ id, label: `Level ${g}`, getItemIds: () => ids });
  }
  return {
    skillId,
    namespace: skillId,
    levels,
    allItemIds: () => levels.flatMap((g) => g.getItemIds()),
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
const NO_SKIPS = new Set<string>();

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
    seedStale(storage, entry.levels[0].getItemIds());
    const result = computeSkillRecommendation(
      entry,
      storage,
      null,
      NO_SKIPS,
      DEFAULT_CONFIG,
    );
    assert.equal(result.type, 'review');
    assert.equal(result.cueLabel, 'Review');
    assert.equal(result.detail, 'Review Level 0');
    assert.ok(result.urgency > 0);
  });

  it('returns practice when groups have working items', () => {
    const entry = makeEntry('test', 3);
    const storage = createMemoryStorage();
    // Seed group 0 as slow (working, not automatic)
    seedSlow(storage, entry.levels[0].getItemIds());
    const result = computeSkillRecommendation(
      entry,
      storage,
      null,
      NO_SKIPS,
      DEFAULT_CONFIG,
    );
    assert.equal(result.type, 'practice');
    assert.equal(result.cueLabel, 'Practice');
  });

  it('returns start when expansion gate is open', () => {
    const entry = makeEntry('test', 3);
    const storage = createMemoryStorage();
    // Seed group 0 as automatic → expansion gate should open
    seedAutomatic(storage, entry.levels[0].getItemIds());
    const result = computeSkillRecommendation(
      entry,
      storage,
      null,
      NO_SKIPS,
      DEFAULT_CONFIG,
    );
    assert.equal(result.type, 'start');
    assert.equal(result.cueLabel, 'Start');
    assert.equal(result.detail, 'Start Level 1');
  });

  it('solid + fresh level gets no active rec (practiced enough)', () => {
    const entry = makeEntry('test', 1, 10);
    const storage = createMemoryStorage();
    // Seed items with speed in solid range + good stability → scheduled review.
    const ids = entry.levels[0].getItemIds();
    const now = Date.now();
    for (let i = 0; i < ids.length; i++) {
      const ewma = i < 8 ? 800 : 1800;
      storage.saveStats(ids[i], {
        recentTimes: [ewma],
        ewma,
        sampleCount: 10,
        lastSeen: now - 3600_000,
        stability: 168,
        lastCorrectAt: now - 3600_000,
      });
    }
    const result = computeSkillRecommendation(
      entry,
      storage,
      null,
      NO_SKIPS,
      DEFAULT_CONFIG,
    );
    // Solid + fresh (scheduled review) → no active rec → automatic
    assert.equal(result.type, 'automatic');
  });

  it('returns automatic when all groups mastered', () => {
    const entry = makeEntry('test', 2);
    const storage = createMemoryStorage();
    // Seed all groups as automatic
    for (const g of entry.levels) {
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

  it('single-group mode omits level number in detail', () => {
    const entry = makeEntry('test', 1);
    const storage = createMemoryStorage();
    seedSlow(storage, entry.levels[0].getItemIds());
    const result = computeSkillRecommendation(
      entry,
      storage,
      null,
      NO_SKIPS,
      DEFAULT_CONFIG,
    );
    assert.equal(result.type, 'practice');
    assert.equal(result.detail, 'Practice');
  });

  it('excludes skipped groups', () => {
    const entry = makeEntry('test', 2);
    const storage = createMemoryStorage();
    // Seed group 0 as stale, skip it
    seedStale(storage, entry.levels[0].getItemIds());
    const skipped = new Set(['g0']);
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

  it('review takes priority over practice', () => {
    const entry = makeEntry('test', 3);
    const storage = createMemoryStorage();
    // Group 0: stale. Group 1: slow (working).
    seedStale(storage, entry.levels[0].getItemIds());
    seedSlow(storage, entry.levels[1].getItemIds());
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
    skillId: string,
    type: SkillRecommendation['type'],
    urgency: number = 0,
  ): SkillRecommendation {
    const labels: Record<string, string> = {
      review: 'Review',
      practice: 'Practice',
      start: 'Start',
    };
    return {
      skillId,
      type,
      urgency,
      cueLabel: labels[type] ?? '',
      detail: labels[type] ?? '',
    };
  }

  it('returns top 3 by priority', () => {
    const recs = [
      rec('modeA', 'start'),
      rec('modeB', 'review', 2),
      rec('modeC', 'practice', 5),
      rec('modeD', 'review', 3),
      rec('modeE', 'start'),
    ];
    const result = rankSkillRecommendations(recs, order);
    assert.equal(result.length, 3);
    // Reviews first (higher urgency first), then practice
    assert.equal(result[0].skillId, 'modeD'); // review, urgency 3
    assert.equal(result[1].skillId, 'modeB'); // review, urgency 2
    assert.equal(result[2].skillId, 'modeC'); // practice, urgency 5
  });

  it('cold start: all not-started → first in definition order', () => {
    const recs = [
      rec('modeC', 'not-started'),
      rec('modeA', 'not-started'),
      rec('modeB', 'not-started'),
    ];
    const result = rankSkillRecommendations(recs, order);
    assert.equal(result.length, 1);
    assert.equal(result[0].skillId, 'modeA'); // first in definition order
    assert.equal(result[0].type, 'start');
    assert.equal(result[0].cueLabel, 'Ready to start');
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
    assert.equal(result[0].skillId, 'modeD'); // highest urgency
    assert.equal(result[1].skillId, 'modeC');
  });

  it('excludes automatic and not-started from actionable', () => {
    const recs = [
      rec('modeA', 'automatic'),
      rec('modeB', 'not-started'),
      rec('modeC', 'practice', 5),
    ];
    const result = rankSkillRecommendations(recs, order);
    assert.equal(result.length, 1);
    assert.equal(result[0].skillId, 'modeC');
  });

  it('mixed automatic + not-started recommends first not-started', () => {
    const recs = [
      rec('modeA', 'automatic'),
      rec('modeC', 'not-started'),
      rec('modeB', 'automatic'),
    ];
    const result = rankSkillRecommendations(recs, order);
    assert.equal(result.length, 1);
    assert.equal(result[0].skillId, 'modeC');
    assert.equal(result[0].type, 'start');
    assert.equal(result[0].detail, 'Ready to start');
  });

  it('start is actionable and ranked after practice', () => {
    const recs = [
      rec('modeA', 'start'),
      rec('modeB', 'practice', 2),
    ];
    const result = rankSkillRecommendations(recs, order);
    assert.equal(result.length, 2);
    assert.equal(result[0].skillId, 'modeB'); // practice before start
    assert.equal(result[1].skillId, 'modeA');
  });
});
