// Adaptive question selector: prioritizes items the user is slower on,
// with exploration boost for unseen items.
//
// This is the single source of truth. Tests import it as an ES module.
// main.ts reads it at build time and strips "export" for browser inlining.

import type {
  AdaptiveConfig,
  AdaptiveSelector,
  ItemStats,
  StorageAdapter,
  StringRecommendation,
} from './types.ts';
import { storage } from './storage.ts';

export const DEFAULT_CONFIG: AdaptiveConfig = {
  minTime: 1000,
  unseenBoost: 3,
  ewmaAlpha: 0.3,
  maxStoredTimes: 10,
  maxResponseTime: 9000,
  // Forgetting model
  initialStability: 4, // hours — half-life after first correct answer
  maxStability: 336, // hours (14 days) — stability ceiling
  stabilityGrowthMax: 0.9, // max additive growth factor (at freshness=0)
  stabilityDecayOnWrong: 0.3, // multiplier on wrong answer
  freshnessThreshold: 0.5, // freshness below this = "due" / "needs review"
  selfCorrectionThreshold: 1500, // ms — response time below this triggers self-correction
  speedTarget: 3000, // ms — response time at which speedScore ≈ 0.5
};

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

export function computeEwma(
  oldEwma: number,
  newTime: number,
  alpha: number,
): number {
  return alpha * newTime + (1 - alpha) * oldEwma;
}

/**
 * Predicted recall using half-life model: P = 2^(-t/S).
 * At t = stability, P = 0.5. Returns null for unseen items.
 */
export function computeRecall(
  stabilityHours: number | null,
  elapsedHours: number | null,
): number | null {
  if (stabilityHours == null || elapsedHours == null) return null;
  if (stabilityHours <= 0) return 0;
  if (elapsedHours <= 0) return 1;
  return Math.pow(2, -elapsedHours / stabilityHours);
}

/**
 * Predicted freshness using half-life model: F = 2^(-t/S).
 * Same formula as computeRecall but takes lastCorrectAt timestamp directly.
 * Returns null for unseen items.
 */
export function computeFreshness(
  stabilityHours: number | null,
  lastCorrectAt: number | null,
  nowMs: number = Date.now(),
): number | null {
  if (stabilityHours == null || lastCorrectAt == null) return null;
  if (stabilityHours <= 0) return 0;
  const elapsedHours = (nowMs - lastCorrectAt) / 3600000;
  if (elapsedHours <= 0) return 1;
  return Math.pow(2, -elapsedHours / stabilityHours);
}

/**
 * Speed score: maps EWMA onto [0, 1].
 * - minTime (1000ms) → 1.0 (fully automatic)
 * - speedTarget (3000ms) → 0.5
 * - Very slow → approaches 0
 * Uses exponential decay so the curve is smooth.
 *
 * For multi-response items (responseCount > 1), timing thresholds are
 * scaled proportionally so the ratios stay the same.
 */
export function computeSpeedScore(
  ewmaMs: number | null,
  cfg: AdaptiveConfig,
  responseCount: number = 1,
): number | null {
  if (ewmaMs == null) return null;
  const effectiveTarget = cfg.speedTarget * responseCount;
  const effectiveMin = cfg.minTime * responseCount;
  const k = Math.LN2 / (effectiveTarget - effectiveMin);
  return Math.exp(-k * Math.max(0, ewmaMs - effectiveMin));
}

// Speed and freshness are independent axes — no combined "automaticity" metric.
// Item classification uses speed thresholds directly:
//   Automatic: speed ≥ 0.9, Solid: ≥ 0.7, Learning: ≥ 0.3, Hesitant: > 0, Starting: = 0
// Freshness determines "needs review": freshness < 0.5

/**
 * Compute new stability after a correct answer.
 * - First correct: initialStability.
 * - Subsequent: freshness-modulated growth. Low freshness (item was due)
 *   provides stronger evidence of retention than high freshness (just saw it).
 *   Formula: newStability = oldStability * (1 + growthMax * (1 - freshness))
 * - Self-correction: if fast answer after long gap, back-calculate
 *   that true stability must be at least elapsedHours * 1.5.
 */
export function updateStability(
  oldStability: number | null,
  responseTimeMs: number,
  elapsedHours: number | null,
  cfg: AdaptiveConfig,
): number {
  if (oldStability == null) {
    return cfg.initialStability;
  }

  // Freshness at review time: how much retention remained?
  const freshness = (elapsedHours != null && elapsedHours > 0)
    ? Math.pow(2, -elapsedHours / oldStability)
    : 1; // within-session review = full freshness

  // Growth is modulated by freshness: reviewing a due item (freshness ~0.5)
  // grows more than reviewing a fresh item (freshness ~1.0).
  const growthFactor = 1 + cfg.stabilityGrowthMax * (1 - freshness);
  let newStability = oldStability * growthFactor;

  // Self-correction: fast answer after long gap means true half-life is long
  if (
    elapsedHours !== null && elapsedHours > 0 &&
    responseTimeMs < cfg.selfCorrectionThreshold
  ) {
    newStability = Math.max(newStability, elapsedHours * 1.5);
  }

  return Math.min(newStability, cfg.maxStability);
}

/**
 * Compute new stability after a wrong answer.
 * Reduces stability but floors at initialStability.
 */
export function computeStabilityAfterWrong(
  oldStability: number | null,
  cfg: AdaptiveConfig,
): number {
  if (oldStability == null) return cfg.initialStability;
  return Math.max(
    cfg.initialStability,
    oldStability * cfg.stabilityDecayOnWrong,
  );
}

/**
 * Compute selection weight for an item.
 * - Unseen items get unseenBoost (high weight for exploration).
 * - Seen items get ewma / minTime (slower = heavier),
 *   scaled by recall factor (low recall = more weight).
 */
export function computeWeight(
  stats: ItemStats | null,
  cfg: AdaptiveConfig,
): number {
  if (!stats) {
    return cfg.unseenBoost;
  }
  const speedWeight = Math.max(stats.ewma, cfg.minTime) / cfg.minTime;
  // If we have stability data, factor in recall
  if (stats.stability != null && stats.lastCorrectAt != null) {
    const elapsedHours = (Date.now() - stats.lastCorrectAt) / 3600000;
    const recall = computeRecall(stats.stability, elapsedHours);
    // recallWeight: 1.0 (perfect recall) to 2.0 (fully forgotten)
    const recallWeight = recall != null ? 1 + (1 - recall) : 1;
    return speedWeight * recallWeight;
  }
  return speedWeight;
}

/**
 * Weighted random selection. rand should be in [0, 1).
 * Injected for deterministic testing.
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

/**
 * Derive a scaled config from a motor baseline measurement.
 * The default config assumes baseline = 1000ms. This scales all
 * absolute timing thresholds proportionally to the measured baseline.
 */
export function deriveScaledConfig(
  motorBaseline: number,
  baseCfg: AdaptiveConfig = DEFAULT_CONFIG,
): AdaptiveConfig {
  const scale = motorBaseline / 1000;
  return {
    ...baseCfg,
    minTime: Math.round(baseCfg.minTime * scale),
    speedTarget: Math.round(baseCfg.speedTarget * scale),
    selfCorrectionThreshold: Math.round(
      baseCfg.selfCorrectionThreshold * scale,
    ),
    maxResponseTime: Math.round(baseCfg.maxResponseTime * scale),
  };
}

/**
 * Compute median of a numeric array (non-mutating — copies and sorts internally).
 */
export function computeMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

// ---------------------------------------------------------------------------
// Standalone functions extracted from the selector (pure, testable)
// ---------------------------------------------------------------------------

/** Scale config timing thresholds for multi-response items. */
export function scaleConfigForResponseCount(
  cfg: AdaptiveConfig,
  responseCount: number,
): AdaptiveConfig {
  if (responseCount <= 1) return cfg;
  return {
    ...cfg,
    minTime: cfg.minTime * responseCount,
    speedTarget: cfg.speedTarget * responseCount,
    maxResponseTime: cfg.maxResponseTime * responseCount,
    selfCorrectionThreshold: cfg.selfCorrectionThreshold * responseCount,
  };
}

/** Record a correct response, updating EWMA, stability, and sample count. */
export function recordCorrectResponse(
  storage: StorageAdapter,
  cfg: AdaptiveConfig,
  itemCfg: AdaptiveConfig,
  itemId: string,
  clamped: number,
  now: number,
): void {
  const existing = storage.getStats(itemId);
  const elapsedHours = existing?.lastCorrectAt
    ? (now - existing.lastCorrectAt) / 3600000
    : null;
  if (existing) {
    storage.saveStats(itemId, {
      recentTimes: [...existing.recentTimes, clamped].slice(
        -cfg.maxStoredTimes,
      ),
      ewma: computeEwma(existing.ewma, clamped, cfg.ewmaAlpha),
      sampleCount: existing.sampleCount + 1,
      lastSeen: now,
      stability: updateStability(
        existing.stability ?? null,
        clamped,
        elapsedHours,
        itemCfg,
      ),
      lastCorrectAt: now,
    });
  } else {
    storage.saveStats(itemId, {
      recentTimes: [clamped],
      ewma: clamped,
      sampleCount: 1,
      lastSeen: now,
      stability: cfg.initialStability,
      lastCorrectAt: now,
    });
  }
}

/** Record a wrong response, reducing stability without touching EWMA. */
export function recordWrongResponse(
  storage: StorageAdapter,
  cfg: AdaptiveConfig,
  itemCfg: AdaptiveConfig,
  itemId: string,
  now: number,
): void {
  const existing = storage.getStats(itemId);
  if (existing) {
    storage.saveStats(itemId, {
      ...existing,
      lastSeen: now,
      stability: computeStabilityAfterWrong(existing.stability ?? null, cfg),
    });
  } else {
    storage.saveStats(itemId, {
      recentTimes: [],
      ewma: itemCfg.maxResponseTime,
      sampleCount: 0,
      lastSeen: now,
      stability: cfg.initialStability,
      lastCorrectAt: null,
    });
  }
}

/**
 * Compute the p-th percentile of a per-item metric (unseen items contribute 0).
 * Used for both level speed and level freshness — pass the appropriate getter.
 */
export function computeLevelPercentile(
  getMetric: (id: string) => number | null,
  itemIds: string[],
  percentile: number = 0.1,
): { level: number; seen: number } {
  if (itemIds.length === 0) return { level: 0, seen: 0 };
  let seen = 0;
  const values: number[] = [];
  for (let i = 0; i < itemIds.length; i++) {
    const val = getMetric(itemIds[i]);
    if (val !== null) {
      seen++;
      values.push(val);
    } else {
      values.push(0);
    }
  }
  values.sort((a, b) => a - b);
  const rawIndex = Math.ceil(values.length * percentile) - 1;
  const index = Math.min(values.length - 1, Math.max(0, rawIndex));
  return { level: values[index], seen };
}

/**
 * Classify items per group by speed score, sorted by needsWork descending.
 * Automatic: speed ≥ 0.9, Working: seen but speed < 0.9, Unseen: no data.
 */
export function computeStringRecommendations(
  getSpeedScore: (id: string) => number | null,
  stringIndices: number[],
  getItemIds: (index: number) => string[],
): StringRecommendation[] {
  const results = stringIndices.map((s) => {
    const items = getItemIds(s);
    let workingCount = 0;
    let unseenCount = 0;
    let automaticCount = 0;
    for (const id of items) {
      const speed = getSpeedScore(id);
      if (speed === null) {
        unseenCount++;
      } else if (speed >= 0.9) {
        automaticCount++;
      } else {
        workingCount++;
      }
    }
    return {
      string: s,
      workingCount,
      unseenCount,
      automaticCount,
      totalCount: items.length,
    };
  });
  results.sort((a, b) =>
    (b.workingCount + b.unseenCount) - (a.workingCount + a.unseenCount) ||
    a.string - b.string
  );
  return results;
}

/**
 * Check if all items have speed score ≥ 0.9 (automatic).
 */
export function checkAllItemsAutomatic(
  getSpeedScore: (id: string) => number | null,
  items: string[],
): boolean {
  for (const id of items) {
    const speed = getSpeedScore(id);
    if (speed === null || speed < 0.9) return false;
  }
  return items.length > 0;
}

/**
 * Check if previously-fast material needs review.
 * Returns true only when ALL items had high prior speed (≥ 0.5) but at least
 * one item's freshness has dropped below the freshness threshold (0.5).
 */
export function checkItemsNeedReview(
  storage: StorageAdapter,
  getSpeedScore: (id: string) => number | null,
  getFreshness: (id: string) => number | null,
  cfg: AdaptiveConfig,
  items: string[],
): boolean {
  if (items.length === 0) return false;
  let hasDecayedItem = false;
  for (const id of items) {
    const stats = storage.getStats(id);
    if (!stats || stats.lastCorrectAt == null || stats.sampleCount < 2) {
      return false;
    }
    const speed = getSpeedScore(id);
    if (speed == null || speed < 0.5) return false;
    const fresh = getFreshness(id);
    if (fresh !== null && fresh < cfg.freshnessThreshold) {
      hasDecayedItem = true;
    }
  }
  return hasDecayedItem;
}

// ---------------------------------------------------------------------------
// Per-item metric helpers (used by selector factory methods)
// ---------------------------------------------------------------------------

function getItemRecall(
  storage: StorageAdapter,
  itemId: string,
  nowMs?: number,
): number | null {
  const stats = storage.getStats(itemId);
  if (!stats || stats.stability == null || stats.lastCorrectAt == null) {
    return null;
  }
  const now = nowMs ?? Date.now();
  return computeRecall(stats.stability, (now - stats.lastCorrectAt) / 3600000);
}

function getItemSpeedScore(
  storage: StorageAdapter,
  scaledCfg: AdaptiveConfig,
  itemId: string,
): number | null {
  const stats = storage.getStats(itemId);
  if (!stats) return null;
  const speed = computeSpeedScore(stats.ewma, scaledCfg);
  if (speed == null && stats.sampleCount > 0) return 0;
  return speed;
}

function getItemFreshness(
  storage: StorageAdapter,
  itemId: string,
  nowMs?: number,
): number | null {
  const stats = storage.getStats(itemId);
  if (!stats) return null;
  return computeFreshness(
    stats.stability ?? null,
    stats.lastCorrectAt ?? null,
    nowMs,
  );
}

// ---------------------------------------------------------------------------
// Selector factory (storage-injected — works with localStorage or Map)
// ---------------------------------------------------------------------------

export function createAdaptiveSelector(
  storage: StorageAdapter,
  cfg: AdaptiveConfig = DEFAULT_CONFIG,
  randomFn: () => number = Math.random,
  responseCountFn: ((itemId: string) => number) | null = null,
): AdaptiveSelector {
  const getResponseCount = (itemId: string): number =>
    responseCountFn ? responseCountFn(itemId) : 1;
  const scaledCfg = (itemId: string): AdaptiveConfig =>
    scaleConfigForResponseCount(cfg, getResponseCount(itemId));

  function recordResponse(
    itemId: string,
    timeMs: number,
    correct: boolean = true,
  ): void {
    const itemCfg = scaledCfg(itemId);
    const clamped = Math.min(timeMs, itemCfg.maxResponseTime);
    const now = Date.now();
    if (correct) {
      recordCorrectResponse(storage, cfg, itemCfg, itemId, clamped, now);
    } else recordWrongResponse(storage, cfg, itemCfg, itemId, now);
  }

  function selectNext(validItems: string[]): string {
    if (validItems.length === 0) {
      throw new Error('validItems cannot be empty');
    }
    if (validItems.length === 1) {
      storage.setLastSelected(validItems[0]);
      return validItems[0];
    }
    const lastSelected = storage.getLastSelected();
    const weights = validItems.map((id) =>
      id === lastSelected ? 0 : getWeight(id)
    );
    const selected = selectWeighted(validItems, weights, randomFn());
    storage.setLastSelected(selected);
    return selected;
  }

  function getStats(itemId: string): ItemStats | null {
    return storage.getStats(itemId);
  }

  function getWeight(itemId: string): number {
    return computeWeight(storage.getStats(itemId), scaledCfg(itemId));
  }

  function getRecall(itemId: string, nowMs?: number): number | null {
    return getItemRecall(storage, itemId, nowMs);
  }

  const getSpeedScore = (itemId: string): number | null =>
    getItemSpeedScore(storage, scaledCfg(itemId), itemId);
  const getFreshness = (itemId: string, nowMs?: number): number | null =>
    getItemFreshness(storage, itemId, nowMs);

  return {
    recordResponse,
    selectNext,
    getStats,
    getWeight,
    getRecall,
    getSpeedScore,
    getFreshness,
    getLevelSpeed: (itemIds, percentile) =>
      computeLevelPercentile(getSpeedScore, itemIds, percentile),
    getLevelFreshness: (itemIds, percentile, nowMs) =>
      computeLevelPercentile(
        (id) => getFreshness(id, nowMs),
        itemIds,
        percentile,
      ),
    getStringRecommendations: (stringIndices, getItemIds) =>
      computeStringRecommendations(
        getSpeedScore,
        stringIndices,
        getItemIds,
      ),
    checkAllAutomatic: (items) => checkAllItemsAutomatic(getSpeedScore, items),
    checkNeedsReview: (items) =>
      checkItemsNeedReview(
        storage,
        getSpeedScore,
        getFreshness,
        cfg,
        items,
      ),
    updateConfig: (newCfg: Partial<AdaptiveConfig>) => {
      cfg = { ...cfg, ...newCfg };
    },
    getConfig: () => cfg,
  };
}

// ---------------------------------------------------------------------------
// In-memory storage (for tests)
// ---------------------------------------------------------------------------

export function createMemoryStorage(): StorageAdapter {
  const stats = new Map<string, ItemStats>();
  const deadlines = new Map<string, number>();
  let lastSelected: string | null = null;

  return {
    getStats(itemId: string): ItemStats | null {
      return stats.get(itemId) ?? null;
    },
    saveStats(itemId: string, s: ItemStats): void {
      stats.set(itemId, s);
    },
    getLastSelected(): string | null {
      return lastSelected;
    },
    setLastSelected(itemId: string): void {
      lastSelected = itemId;
    },
    getDeadline(itemId: string): number | null {
      return deadlines.get(itemId) ?? null;
    },
    saveDeadline(itemId: string, deadline: number): void {
      deadlines.set(itemId, deadline);
    },
  };
}

// ---------------------------------------------------------------------------
// Persisted storage (uses storage abstraction — localStorage on web,
// Capacitor Preferences on native)
// ---------------------------------------------------------------------------

export function createLocalStorageAdapter(namespace: string): StorageAdapter {
  const cache: Record<string, ItemStats | number | null> = {};
  const mkKey = (itemId: string): string => `adaptive_${namespace}_${itemId}`;
  const dlKey = (itemId: string): string => `deadline_${namespace}_${itemId}`;
  const lastKey = `adaptive_${namespace}_lastSelected`;

  return {
    getStats(itemId: string): ItemStats | null {
      const k = mkKey(itemId);
      if (!(k in cache)) {
        const data = storage.getItem(k);
        try {
          cache[k] = data ? JSON.parse(data) : null;
        } catch {
          cache[k] = null;
        }
      }
      return cache[k] as ItemStats | null;
    },
    saveStats(itemId: string, stats: ItemStats): void {
      const k = mkKey(itemId);
      cache[k] = stats;
      storage.setItem(k, JSON.stringify(stats));
    },
    getLastSelected(): string | null {
      return storage.getItem(lastKey);
    },
    setLastSelected(itemId: string): void {
      storage.setItem(lastKey, itemId);
    },
    getDeadline(itemId: string): number | null {
      const k = dlKey(itemId);
      if (!(k in cache)) {
        const data = storage.getItem(k);
        cache[k] = data ? Number(data) : null;
      }
      return cache[k] as number | null;
    },
    saveDeadline(itemId: string, deadline: number): void {
      const k = dlKey(itemId);
      cache[k] = deadline;
      storage.setItem(k, String(deadline));
    },
    /** Pre-populate cache to avoid storage reads during gameplay. */
    preload(itemIds: string[]): void {
      for (const itemId of itemIds) {
        this.getStats(itemId);
      }
    },
  };
}
