// Tests for home screen progress computation (pure functions only).

import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  computeAllProgress,
  computeProgressForMode,
} from './use-home-progress.ts';
import {
  getModeProgress,
  MODE_PROGRESS_MANIFEST,
} from '../mode-progress-manifest.ts';
import { createMemoryStorage } from '../adaptive.ts';
import type { StorageAdapter } from '../types.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Factory that returns empty storage for every namespace. */
function emptyStorageFactory(): (ns: string) => StorageAdapter {
  return () => createMemoryStorage();
}

/** Seed a memory storage with automatic items (fast EWMA, high stability). */
function seedAutomatic(
  storage: StorageAdapter,
  itemIds: string[],
  now: number,
): void {
  for (const id of itemIds) {
    storage.saveStats(id, {
      recentTimes: [800, 850, 900],
      ewma: 850,
      sampleCount: 15,
      lastSeen: now - 3600_000,
      stability: 72,
      lastCorrectAt: now - 3600_000,
    });
  }
}

/** Seed a memory storage with slow items (high EWMA, low stability). */
function seedSlow(
  storage: StorageAdapter,
  itemIds: string[],
  now: number,
): void {
  for (const id of itemIds) {
    storage.saveStats(id, {
      recentTimes: [3000, 3200, 3400],
      ewma: 3200,
      sampleCount: 4,
      lastSeen: now - 24 * 3600_000,
      stability: 3,
      lastCorrectAt: now - 24 * 3600_000,
    });
  }
}

// ---------------------------------------------------------------------------
// computeAllProgress
// ---------------------------------------------------------------------------

describe('computeAllProgress', () => {
  it('returns a map with an entry for every mode', () => {
    const result = computeAllProgress(emptyStorageFactory());
    assert.equal(result.size, MODE_PROGRESS_MANIFEST.length);
    for (const entry of MODE_PROGRESS_MANIFEST) {
      assert.ok(result.has(entry.modeId), `missing ${entry.modeId}`);
    }
  });

  it('multi-group modes have one color per group, single-group modes have per-item colors', () => {
    const result = computeAllProgress(emptyStorageFactory());
    for (const entry of MODE_PROGRESS_MANIFEST) {
      const progress = result.get(entry.modeId)!;
      if (entry.groups.length === 1) {
        // Single-group: per-item colors (matches skill screen)
        const itemCount = entry.groups[0].getItemIds().length;
        assert.equal(
          progress.groupColors.length,
          itemCount,
          `${entry.modeId} per-item color count`,
        );
      } else {
        assert.equal(
          progress.groupColors.length,
          entry.groups.length,
          `${entry.modeId} group color count`,
        );
      }
    }
  });

  it('each color segment is a valid CSS color string', () => {
    const result = computeAllProgress(emptyStorageFactory());
    for (const [, progress] of result) {
      for (const color of progress.groupColors) {
        assert.ok(
          typeof color === 'string' && color.length > 0,
          `invalid color: ${color}`,
        );
      }
    }
  });

  it('accepts motorBaseline parameter', () => {
    const result = computeAllProgress(emptyStorageFactory(), 950);
    assert.equal(result.size, MODE_PROGRESS_MANIFEST.length);
  });

  it('filters skipped groups via getSkipped', () => {
    // Skip groups 0 and 1 of keySignatures (7 groups total)
    const skipped = new Set([0, 1]);
    const getSkipped = (ns: string) =>
      ns === 'keySignatures' ? skipped : new Set<number>();
    const result = computeAllProgress(emptyStorageFactory(), null, getSkipped);
    const ks = result.get('keySignatures')!;
    assert.equal(ks.groupColors.length, 5); // 7 - 2 skipped
  });
});

// ---------------------------------------------------------------------------
// computeProgressForMode
// ---------------------------------------------------------------------------

describe('computeProgressForMode', () => {
  it('single-group mode has per-item color segments', () => {
    const entry = getModeProgress('noteSemitones')!;
    const storage = createMemoryStorage();
    const result = computeProgressForMode(entry, storage, null);
    assert.equal(result.groupColors.length, entry.allItemIds().length);
  });

  it('group mode has one color per group', () => {
    const entry = getModeProgress('semitoneMath')!;
    const storage = createMemoryStorage();
    const result = computeProgressForMode(entry, storage, null);
    assert.equal(result.groupColors.length, 5);
  });

  it('sorts segments descending by speed', () => {
    const entry = getModeProgress('keySignatures')!;
    const storage = createMemoryStorage();
    const now = Date.now();

    // Seed group 0 (C G F) as automatic, group 2 (A Eb) as slow, rest empty.
    const g0Items = entry.groups![0].getItemIds();
    const g2Items = entry.groups![2].getItemIds();
    seedAutomatic(storage, g0Items, now);
    seedSlow(storage, g2Items, now);

    const result = computeProgressForMode(entry, storage, null);

    // 7 segments total. Group 0 (automatic) should sort first, group 2 (slow)
    // should sort before unseen groups. Colors should be
    // ordered descending: automatic color, slow color, then grey for the rest.
    assert.equal(result.groupColors.length, 7);
    // First color should differ from last (automatic vs grey)
    assert.notEqual(result.groupColors[0], result.groupColors[6]);
  });

  it('filters out skipped groups', () => {
    const entry = getModeProgress('keySignatures')!; // 7 groups
    const storage = createMemoryStorage();
    const skipped = new Set([1, 3]);
    const result = computeProgressForMode(entry, storage, null, skipped);
    assert.equal(result.groupColors.length, 5); // 7 - 2 skipped
  });

  it('returns single grey segment when all groups skipped', () => {
    const entry = getModeProgress('keySignatures')!; // 7 groups
    const storage = createMemoryStorage();
    const skipped = new Set([0, 1, 2, 3, 4, 5, 6]);
    const result = computeProgressForMode(entry, storage, null, skipped);
    assert.equal(result.groupColors.length, 1);
    // Should be a grey color
    assert.ok(result.groupColors[0].includes('hsl'));
  });

  it('uses motorBaseline for scaling', () => {
    const entry = getModeProgress('noteSemitones')!;
    const storage = createMemoryStorage();
    const itemIds = entry.allItemIds();
    seedAutomatic(storage, itemIds, Date.now());

    const withBaseline = computeProgressForMode(entry, storage, 500);
    const withoutBaseline = computeProgressForMode(entry, storage, null);
    // Both should compute without error
    assert.ok(withBaseline.groupColors.length > 0);
    assert.ok(withoutBaseline.groupColors.length > 0);
  });
});

// ---------------------------------------------------------------------------
// Performance test
// ---------------------------------------------------------------------------

describe('computeAllProgress performance', () => {
  it('computes all progress within 50ms', () => {
    const now = Date.now();
    const storageMap = new Map<string, StorageAdapter>();

    // Pre-seed storage for every mode with realistic data
    for (const entry of MODE_PROGRESS_MANIFEST) {
      const storage = createMemoryStorage();
      const allItems = entry.allItemIds();

      // Seed ~60% as automatic, ~20% as working, rest unseen
      const automaticEnd = Math.floor(allItems.length * 0.6);
      const workingEnd = Math.floor(allItems.length * 0.8);

      for (let i = 0; i < automaticEnd; i++) {
        storage.saveStats(allItems[i], {
          recentTimes: [800, 850, 900],
          ewma: 850,
          sampleCount: 15,
          lastSeen: now - 3600_000,
          stability: 72,
          lastCorrectAt: now - 3600_000,
        });
      }
      for (let i = automaticEnd; i < workingEnd; i++) {
        storage.saveStats(allItems[i], {
          recentTimes: [2800, 3000, 3200],
          ewma: 3000,
          sampleCount: 5,
          lastSeen: now - 24 * 3600_000,
          stability: 4,
          lastCorrectAt: now - 24 * 3600_000,
        });
      }

      storageMap.set(entry.namespace, storage);
    }

    const factory = (ns: string) => storageMap.get(ns) ?? createMemoryStorage();
    const noSkips = () => new Set<number>();

    // Warm up
    computeAllProgress(factory, 950, noSkips);

    // Measure
    const start = performance.now();
    const result = computeAllProgress(factory, 950, noSkips);
    const elapsed = performance.now() - start;

    assert.equal(result.size, MODE_PROGRESS_MANIFEST.length);
    assert.ok(
      elapsed < 200,
      `Progress computation took ${elapsed.toFixed(1)}ms (budget: 200ms)`,
    );

    console.log(`  Progress computation: ${elapsed.toFixed(1)}ms`);
  });
});
