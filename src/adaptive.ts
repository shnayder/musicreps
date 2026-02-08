// Adaptive question selector: prioritizes items the user is slower on,
// with exploration boost for unseen items.
//
// The browser-compatible JS version of this logic lives in main.ts (search
// for "Adaptive Selector"). Keep both in sync; tests here verify correctness.

export interface AdaptiveConfig {
  /** Floor for weight computation (ms). Prevents fast items from reaching 0. */
  minTime: number;
  /** Weight multiplier for never-seen items (exploration). */
  unseenBoost: number;
  /** EWMA smoothing factor (0-1). Higher = more weight to recent times. */
  ewmaAlpha: number;
  /** Max recent response times to store per item. */
  maxStoredTimes: number;
  /** Ceiling for recorded response times (ms). Clamps outliers from
   *  distracted/idle responses so they don't poison the EWMA. */
  maxResponseTime: number;
}

export const DEFAULT_CONFIG: AdaptiveConfig = {
  minTime: 1000,
  unseenBoost: 3,
  ewmaAlpha: 0.3,
  maxStoredTimes: 10,
  maxResponseTime: 9000,
};

export interface ItemStats {
  recentTimes: number[];
  ewma: number;
  sampleCount: number;
  lastSeen: number;
}

/** Storage abstraction — implemented by localStorage in the browser, by a
 *  plain Map in tests. */
export interface StatsStorage {
  getStats(itemId: string): ItemStats | null;
  saveStats(itemId: string, stats: ItemStats): void;
  getLastSelected(): string | null;
  setLastSelected(itemId: string): void;
}

// ---------------------------------------------------------------------------
// Pure functions (easily unit-tested)
// ---------------------------------------------------------------------------

export function computeEwma(
  oldEwma: number,
  newTime: number,
  alpha: number,
): number {
  return alpha * newTime + (1 - alpha) * oldEwma;
}

/**
 * Compute selection weight for an item.
 *
 * - Unseen items get `cfg.unseenBoost` (high weight → exploration).
 * - Seen items get `ewma / minTime` — slower items are heavier.
 *
 * Previously, seen items with few samples were multiplied by unseenBoost,
 * which made them *heavier* than truly unseen items, causing the selector
 * to loop over a small set of already-asked notes at startup.
 */
export function computeWeight(
  stats: ItemStats | null,
  cfg: AdaptiveConfig,
): number {
  if (!stats) {
    return cfg.unseenBoost;
  }
  return Math.max(stats.ewma, cfg.minTime) / cfg.minTime;
}

/**
 * Weighted random selection from `items` using pre-computed `weights`.
 * `rand` should be in [0, 1) — injected for deterministic testing.
 */
export function selectWeighted(
  items: string[],
  weights: number[],
  rand: number,
): string {
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight === 0) {
    return items[Math.floor(rand * items.length)];
  }
  let remaining = rand * totalWeight;
  for (let i = 0; i < items.length; i++) {
    remaining -= weights[i];
    if (remaining <= 0) return items[i];
  }
  return items[items.length - 1];
}

// ---------------------------------------------------------------------------
// Selector factory
// ---------------------------------------------------------------------------

export function createAdaptiveSelector(
  storage: StatsStorage,
  cfg: AdaptiveConfig = DEFAULT_CONFIG,
  randomFn: () => number = Math.random,
) {
  function recordResponse(itemId: string, timeMs: number): void {
    const clamped = Math.min(timeMs, cfg.maxResponseTime);
    const existing = storage.getStats(itemId);
    const now = Date.now();

    if (existing) {
      const newEwma = computeEwma(existing.ewma, clamped, cfg.ewmaAlpha);
      const newTimes = [...existing.recentTimes, clamped].slice(
        -cfg.maxStoredTimes,
      );
      storage.saveStats(itemId, {
        recentTimes: newTimes,
        ewma: newEwma,
        sampleCount: existing.sampleCount + 1,
        lastSeen: now,
      });
    } else {
      storage.saveStats(itemId, {
        recentTimes: [clamped],
        ewma: clamped,
        sampleCount: 1,
        lastSeen: now,
      });
    }
  }

  function getWeight(itemId: string): number {
    return computeWeight(storage.getStats(itemId), cfg);
  }

  function getStats(itemId: string): ItemStats | null {
    return storage.getStats(itemId);
  }

  function selectNext(validItems: string[]): string {
    if (validItems.length === 0) {
      throw new Error("validItems cannot be empty");
    }
    if (validItems.length === 1) {
      storage.setLastSelected(validItems[0]);
      return validItems[0];
    }

    const lastSelected = storage.getLastSelected();
    const weights = validItems.map((id) =>
      id === lastSelected ? 0 : getWeight(id),
    );

    const selected = selectWeighted(validItems, weights, randomFn());
    storage.setLastSelected(selected);
    return selected;
  }

  return { recordResponse, selectNext, getStats, getWeight };
}

// ---------------------------------------------------------------------------
// In-memory storage (for tests; also usable as a template)
// ---------------------------------------------------------------------------

export function createMemoryStorage(): StatsStorage {
  const stats = new Map<string, ItemStats>();
  let lastSelected: string | null = null;

  return {
    getStats(itemId: string) {
      return stats.get(itemId) ?? null;
    },
    saveStats(itemId: string, s: ItemStats) {
      stats.set(itemId, s);
    },
    getLastSelected() {
      return lastSelected;
    },
    setLastSelected(itemId: string) {
      lastSelected = itemId;
    },
  };
}
