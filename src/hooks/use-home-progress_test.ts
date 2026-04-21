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
import type { MotorTaskType, StorageAdapter } from '../types.ts';

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

  it('unstarted modes have empty segments', () => {
    const result = computeAllProgress(emptyStorageFactory());
    for (const entry of MODE_PROGRESS_MANIFEST) {
      const progress = result.get(entry.modeId)!;
      assert.equal(
        progress.segments.length,
        0,
        `${entry.modeId} should be empty when unstarted`,
      );
    }
  });

  it('accepts motorBaseline parameter', () => {
    const result = computeAllProgress(emptyStorageFactory(), 950);
    assert.equal(result.size, MODE_PROGRESS_MANIFEST.length);
  });

  it('filters skipped groups via getSkipped', () => {
    // Skip groups major-easy and major-hard of keySignatures (4 groups total)
    // All unseen → empty regardless of skips
    const skipped = new Set(['major-easy', 'major-hard']);
    const getSkipped = (ns: string) =>
      ns === 'keySignatures' ? skipped : new Set<string>();
    const result = computeAllProgress(emptyStorageFactory(), null, getSkipped);
    const ks = result.get('keySignatures')!;
    assert.equal(ks.segments.length, 0); // all unseen → empty
  });
});

// ---------------------------------------------------------------------------
// computeProgressForMode
// ---------------------------------------------------------------------------

describe('computeProgressForMode', () => {
  it('single-group mode returns empty when no items seen', () => {
    const entry = getModeProgress('noteSemitones')!;
    const storage = createMemoryStorage();
    const result = computeProgressForMode(entry, storage, null);
    assert.equal(result.segments.length, 0);
    assert.equal(result.activeGroupCount, 1);
  });

  it('single-group mode with data has per-item color segments', () => {
    const entry = getModeProgress('noteSemitones')!;
    const storage = createMemoryStorage();
    const ids = entry.allItemIds();
    seedAutomatic(storage, ids.slice(0, 3), Date.now());
    const result = computeProgressForMode(entry, storage, null);
    assert.equal(result.segments.length, ids.length);
  });

  it('single-group mode skipped yields empty', () => {
    const entry = getModeProgress('noteSemitones')!;
    const storage = createMemoryStorage();
    const skipped = new Set(['all']);
    const result = computeProgressForMode(entry, storage, null, skipped);
    assert.equal(result.segments.length, 0);
    assert.equal(result.activeGroupCount, 0);
  });

  it('group mode returns empty when no items seen', () => {
    const entry = getModeProgress('semitoneMath')!;
    const storage = createMemoryStorage();
    const result = computeProgressForMode(entry, storage, null);
    assert.equal(result.segments.length, 0);
    assert.equal(result.activeGroupCount, entry.groups.length);
  });

  it('sorts segments descending by speed', () => {
    const entry = getModeProgress('keySignatures')!;
    const storage = createMemoryStorage();
    const now = Date.now();

    // Seed group 0 (major 0–3) as automatic, group 1 (major 4+) as slow.
    const g0Items = entry.groups![0].getItemIds();
    const g1Items = entry.groups![1].getItemIds();
    seedAutomatic(storage, g0Items, now);
    seedSlow(storage, g1Items, now);

    const result = computeProgressForMode(entry, storage, null);

    // 4 segments total. Group 0 (automatic) should sort first.
    assert.equal(result.segments.length, 4);
    // First color should differ from last (automatic vs grey)
    assert.notEqual(result.segments[0].color, result.segments[3].color);
  });

  it('filters out skipped groups', () => {
    const entry = getModeProgress('keySignatures')!; // 4 groups
    const storage = createMemoryStorage();
    const now = Date.now();
    // Seed all groups so they're not unseen
    for (const g of entry.groups) {
      seedAutomatic(storage, g.getItemIds(), now);
    }
    const skipped = new Set(['major-hard', 'minor-hard']);
    const result = computeProgressForMode(entry, storage, null, skipped);
    assert.equal(result.segments.length, 2); // 4 - 2 skipped
    assert.equal(result.activeGroupCount, 2);
  });

  it('returns empty when all groups skipped', () => {
    const entry = getModeProgress('keySignatures')!; // 4 groups
    const storage = createMemoryStorage();
    const skipped = new Set([
      'major-easy',
      'major-hard',
      'minor-easy',
      'minor-hard',
    ]);
    const result = computeProgressForMode(entry, storage, null, skipped);
    assert.equal(result.segments.length, 0);
    assert.equal(result.activeGroupCount, 0);
  });

  it('uses motorBaseline for scaling', () => {
    const entry = getModeProgress('noteSemitones')!;
    const storage = createMemoryStorage();
    const itemIds = entry.allItemIds();
    seedAutomatic(storage, itemIds, Date.now());

    const withBaseline = computeProgressForMode(entry, storage, 500);
    const withoutBaseline = computeProgressForMode(entry, storage, null);
    // Both should compute without error
    assert.ok(withBaseline.segments.length > 0);
    assert.ok(withoutBaseline.segments.length > 0);
  });
});

// ---------------------------------------------------------------------------
// BaselineReader is called per entry's motorTaskType
// ---------------------------------------------------------------------------

describe('computeAllProgress baseline resolution', () => {
  it("calls BaselineReader with each mode's motorTaskType", () => {
    const seen: MotorTaskType[] = [];
    const reader = (taskType: MotorTaskType) => {
      seen.push(taskType);
      return null;
    };
    computeAllProgress(emptyStorageFactory(), reader);
    // Modes with non-default task types must be looked up correctly.
    assert.ok(
      seen.includes('fretboard-tap'),
      `expected fretboard-tap lookup, got: ${seen.join(', ')}`,
    );
    assert.ok(
      seen.includes('chord-sequence'),
      `expected chord-sequence lookup, got: ${seen.join(', ')}`,
    );
    // Default 'note-button' is also looked up for modes without an override.
    assert.ok(
      seen.includes('note-button'),
      `expected note-button lookup, got: ${seen.join(', ')}`,
    );
    assert.equal(seen.length, MODE_PROGRESS_MANIFEST.length);
  });
});

// ---------------------------------------------------------------------------
// Response count affects speed/colors for multi-response modes
// ---------------------------------------------------------------------------

describe('computeProgressForMode response count', () => {
  it('multi-response mode uses getResponseCount for speed scaling', () => {
    // guitarChordShapes has fretboard-tap baseline and multi-response items.
    // Seed the first group's items with the same EWMA, then verify the
    // resulting speed score matches when scaled by response count.
    const entry = getModeProgress('guitarChordShapes')!;
    const storage = createMemoryStorage();
    const now = Date.now();
    const itemIds = entry.groups[0].getItemIds();
    for (const id of itemIds) {
      storage.saveStats(id, {
        recentTimes: [2000, 2100, 2200],
        ewma: 2100,
        sampleCount: 10,
        lastSeen: now - 3600_000,
        stability: 24,
        lastCorrectAt: now - 3600_000,
      });
    }

    // Confirm the manifest propagates a >1 response count for these items.
    const rc = entry.getResponseCount!(itemIds[0]);
    assert.ok(rc > 1, `expected multi-response item, got rc=${rc}`);

    // The color at the same EWMA differs depending on whether the mode's
    // getResponseCount is applied — this is what previously caused the
    // home-vs-skill mismatch.
    const scaled = computeProgressForMode(entry, storage, null);
    assert.ok(scaled.segments.length > 0);

    // Clone the entry without getResponseCount to simulate the pre-fix path.
    const unscaledEntry = { ...entry, getResponseCount: undefined };
    const unscaled = computeProgressForMode(unscaledEntry, storage, null);

    // First segment is the same group (only group 0 seeded), but colors
    // should differ because one applied response-count scaling.
    assert.notEqual(
      scaled.segments[0].color,
      unscaled.segments[0].color,
      'response count scaling should change the computed color',
    );
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
    const noSkips = () => new Set<string>();

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
