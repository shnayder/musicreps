// Heatmap scenario data generators for progress tab screenshots.
// Each function generates localStorage key/value pairs matching the
// adaptive_{namespace}_{itemId} format used by createLocalStorageAdapter.
//
// Scenarios create realistic ItemStats distributions so the progress tab
// heatmap shows interesting visual patterns rather than empty/uniform grids.

import type { ItemStats } from '../types.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HOUR = 3600_000;
const DAY = 24 * HOUR;

function makeStats(overrides: Partial<ItemStats>): ItemStats {
  return {
    recentTimes: [],
    ewma: 0,
    sampleCount: 0,
    lastSeen: 0,
    stability: null,
    lastCorrectAt: null,
    ...overrides,
  };
}

function statsEntry(
  namespace: string,
  itemId: string,
  stats: ItemStats,
): [string, string] {
  return [`adaptive_${namespace}_${itemId}`, JSON.stringify(stats)];
}

/** Deterministic pseudo-random from item index — gives varied but repeatable patterns. */
function hashIndex(i: number): number {
  // Simple hash: spread bits to get 0..1
  return ((i * 2654435761) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------------------
// Scenario: just-starting
// ---------------------------------------------------------------------------
// Few items practised (10-15%), most unseen. Practised items are slow and fresh.

export function justStarting(
  namespace: string,
  itemIds: string[],
): Record<string, string> {
  const now = Date.now();
  const result: Record<string, string> = {};
  const practisedCount = Math.max(3, Math.floor(itemIds.length * 0.12));

  for (let i = 0; i < practisedCount; i++) {
    const ewma = 3000 + hashIndex(i) * 3000; // 3000-6000ms (slow)
    const stats = makeStats({
      recentTimes: [ewma],
      ewma,
      sampleCount: 2 + Math.floor(hashIndex(i + 100) * 3),
      lastSeen: now - HOUR * hashIndex(i + 200) * 2,
      stability: 4 + hashIndex(i + 300) * 4, // 4-8 hours
      lastCorrectAt: now - HOUR * hashIndex(i + 400) * 3,
    });
    const [key, value] = statsEntry(namespace, itemIds[i], stats);
    result[key] = value;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Scenario: building
// ---------------------------------------------------------------------------
// Expanding coverage (~40%), mixed speeds. Mix of yesterday and 3 days ago.

export function building(
  namespace: string,
  itemIds: string[],
): Record<string, string> {
  const now = Date.now();
  const result: Record<string, string> = {};
  const practisedCount = Math.floor(itemIds.length * 0.4);

  for (let i = 0; i < practisedCount; i++) {
    const h = hashIndex(i);
    const isRecent = h > 0.4; // ~60% recent, ~40% older
    const ewma = 1500 + h * 3500; // 1500-5000ms (mixed)
    const age = isRecent ? DAY * (0.5 + h) : DAY * (2.5 + h * 2);
    const stability = 8 + h * 40; // 8-48 hours
    const stats = makeStats({
      recentTimes: [ewma * 0.9, ewma, ewma * 1.1],
      ewma,
      sampleCount: 4 + Math.floor(h * 10),
      lastSeen: now - age,
      stability,
      lastCorrectAt: now - age,
    });
    const [key, value] = statsEntry(namespace, itemIds[i], stats);
    result[key] = value;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Scenario: mastered-fresh
// ---------------------------------------------------------------------------
// Most items fast, few weak spots. All recently practised.

export function masteredFresh(
  namespace: string,
  itemIds: string[],
): Record<string, string> {
  const now = Date.now();
  const result: Record<string, string> = {};
  const practisedCount = Math.floor(itemIds.length * 0.85);

  for (let i = 0; i < practisedCount; i++) {
    const h = hashIndex(i);
    const isWeakSpot = h < 0.1; // ~10% weak spots
    const ewma = isWeakSpot ? 3500 + h * 2000 : 800 + h * 1200; // fast vs slow
    const stability = isWeakSpot ? 6 + h * 10 : 48 + h * 200;
    const stats = makeStats({
      recentTimes: [ewma * 0.95, ewma, ewma * 1.05],
      ewma,
      sampleCount: 15 + Math.floor(h * 30),
      lastSeen: now - HOUR * (1 + h * 12), // last 12 hours
      stability,
      lastCorrectAt: now - HOUR * (1 + h * 12),
    });
    const [key, value] = statsEntry(namespace, itemIds[i], stats);
    result[key] = value;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Scenario: mastered-stale
// ---------------------------------------------------------------------------
// Was fast everywhere, but 60+ days since last practice. Very low freshness.

export function masteredStale(
  namespace: string,
  itemIds: string[],
): Record<string, string> {
  const now = Date.now();
  const result: Record<string, string> = {};
  const practisedCount = Math.floor(itemIds.length * 0.9);

  for (let i = 0; i < practisedCount; i++) {
    const h = hashIndex(i);
    const ewma = 900 + h * 1000; // 900-1900ms (was fast)
    const age = DAY * (60 + h * 30); // 60-90 days ago
    const stability = 100 + h * 200; // high stability from prior mastery
    const stats = makeStats({
      recentTimes: [ewma * 0.95, ewma],
      ewma,
      sampleCount: 20 + Math.floor(h * 40),
      lastSeen: now - age,
      stability,
      lastCorrectAt: now - age,
    });
    const [key, value] = statsEntry(namespace, itemIds[i], stats);
    result[key] = value;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Scenario: returned-after-break
// ---------------------------------------------------------------------------
// Stale base (60+ days) + subset refreshed yesterday. Mix of vivid and grey.

export function returnedAfterBreak(
  namespace: string,
  itemIds: string[],
): Record<string, string> {
  const now = Date.now();
  const result: Record<string, string> = {};
  const totalPractised = Math.floor(itemIds.length * 0.8);
  const refreshedCount = Math.floor(totalPractised * 0.3); // 30% refreshed

  for (let i = 0; i < totalPractised; i++) {
    const h = hashIndex(i);
    const isRefreshed = i < refreshedCount;
    const ewma = isRefreshed ? 1000 + h * 1500 : 1200 + h * 1000;
    const age = isRefreshed
      ? HOUR * (6 + h * 18) // refreshed yesterday (6-24 hours ago)
      : DAY * (60 + h * 40); // stale (60-100 days ago)
    const stability = isRefreshed
      ? 24 + h * 72 // boosted by recent practice
      : 80 + h * 150; // old stability
    const stats = makeStats({
      recentTimes: [ewma],
      ewma,
      sampleCount: isRefreshed
        ? 25 + Math.floor(h * 20)
        : 18 + Math.floor(h * 30),
      lastSeen: now - age,
      stability,
      lastCorrectAt: now - age,
    });
    const [key, value] = statsEntry(namespace, itemIds[i], stats);
    result[key] = value;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Group-aware scenarios
// ---------------------------------------------------------------------------
// Per-group state profiles for scenarios where different groups are in
// different learning stages (e.g. first groups mastered, later ones starting).

export type GroupItemProfile = {
  itemIds: string[];
  state: 'unseen' | 'working' | 'mixed' | 'automatic' | 'stale';
  /** Fraction of items seen (default 1.0). */
  seenFraction?: number;
};

export function perGroupScenario(
  namespace: string,
  groups: GroupItemProfile[],
): Record<string, string> {
  const now = Date.now();
  const result: Record<string, string> = {};

  for (const group of groups) {
    if (group.state === 'unseen') continue;
    const { itemIds, state } = group;
    const fraction = group.seenFraction ?? 1.0;
    const seenCount = Math.max(1, Math.floor(itemIds.length * fraction));

    for (let i = 0; i < seenCount; i++) {
      const h = hashIndex(i);
      let ewma: number, stability: number, age: number, samples: number;

      switch (state) {
        case 'working':
          ewma = 3000 + h * 3000; // 3000-6000ms
          stability = 4 + h * 8; // 4-12 hours
          age = HOUR * (1 + h * 4); // 1-5 hours ago
          samples = 3 + Math.floor(h * 5);
          break;
        case 'mixed':
          ewma = 1500 + h * 2500; // 1500-4000ms
          stability = 12 + h * 40; // 12-52 hours
          age = HOUR * (4 + h * 20); // 4-24 hours ago
          samples = 8 + Math.floor(h * 15);
          break;
        case 'automatic':
          ewma = 800 + h * 600; // 800-1400ms
          stability = 48 + h * 200; // 48-248 hours
          age = HOUR * (2 + h * 12); // 2-14 hours ago
          samples = 20 + Math.floor(h * 30);
          break;
        case 'stale':
          ewma = 800 + h * 500; // 800-1300ms (was fast)
          stability = 80 + h * 150; // 80-230 hours
          age = DAY * (50 + h * 40); // 50-90 days ago
          samples = 25 + Math.floor(h * 35);
          break;
      }

      const stats = makeStats({
        recentTimes: [ewma * 0.95, ewma, ewma * 1.05],
        ewma,
        sampleCount: samples,
        lastSeen: now - age,
        stability,
        lastCorrectAt: now - age,
      });
      const [key, value] = statsEntry(namespace, itemIds[i], stats);
      result[key] = value;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Convenience: build item IDs for common modes
// ---------------------------------------------------------------------------

/** Fretboard item IDs: "{string}-{fret}" for given string count and fret count. */
export function fretboardItemIds(
  stringCount: number,
  fretCount: number,
): string[] {
  const ids: string[] = [];
  for (let s = 0; s < stringCount; s++) {
    for (let f = 0; f < fretCount; f++) {
      ids.push(s + '-' + f);
    }
  }
  return ids;
}

/** Semitone math item IDs: "{note}+{n}" and "{note}-{n}" for all notes × distances 1-11. */
export function semitoneMathItemIds(): string[] {
  const notes = [
    'C',
    'C#',
    'D',
    'D#',
    'E',
    'F',
    'F#',
    'G',
    'G#',
    'A',
    'A#',
    'B',
  ];
  const ids: string[] = [];
  for (const note of notes) {
    for (let d = 1; d <= 11; d++) {
      ids.push(note + '+' + d, note + '-' + d);
    }
  }
  return ids;
}
