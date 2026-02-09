// Adaptive question selector: prioritizes items the user is slower on,
// with exploration boost for unseen items.
//
// This is the single source of truth. Tests import it as an ES module.
// main.ts reads it at build time and strips "export" for browser inlining.

export const DEFAULT_CONFIG = {
  minTime: 1000,
  unseenBoost: 3,
  ewmaAlpha: 0.3,
  maxStoredTimes: 10,
  maxResponseTime: 9000,
  // Forgetting model
  initialStability: 4,       // hours — half-life after first correct answer
  maxStability: 336,         // hours (14 days) — stability ceiling
  stabilityGrowthBase: 2.0,  // multiplier on each correct answer
  stabilityDecayOnWrong: 0.3,// multiplier on wrong answer
  recallThreshold: 0.5,      // P(recall) below this = "due"
  speedBonusMax: 1.5,        // fast answers grow stability up to this extra factor
  selfCorrectionThreshold: 1500, // ms — response time below this triggers self-correction
  automaticityTarget: 3000,      // ms — response time at which speedScore ≈ 0.5
};

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

export function computeEwma(oldEwma, newTime, alpha) {
  return alpha * newTime + (1 - alpha) * oldEwma;
}

/**
 * Predicted recall using half-life model: P = 2^(-t/S).
 * At t = stability, P = 0.5. Returns null for unseen items.
 */
export function computeRecall(stabilityHours, elapsedHours) {
  if (stabilityHours == null || elapsedHours == null) return null;
  if (stabilityHours <= 0) return 0;
  if (elapsedHours <= 0) return 1;
  return Math.pow(2, -elapsedHours / stabilityHours);
}

/**
 * Speed score: maps EWMA onto [0, 1].
 * - minTime (1000ms) → 1.0 (fully automatic)
 * - automaticityTarget (3000ms) → 0.5
 * - Very slow → approaches 0
 * Uses exponential decay so the curve is smooth.
 */
export function computeSpeedScore(ewmaMs, cfg) {
  if (ewmaMs == null) return null;
  const k = Math.LN2 / (cfg.automaticityTarget - cfg.minTime);
  return Math.exp(-k * Math.max(0, ewmaMs - cfg.minTime));
}

/**
 * Automaticity = recall * speedScore.
 * "Do I know this without thinking?" — combines "have I forgotten it?"
 * with "was I ever fast at it?" Returns null for unseen items.
 */
export function computeAutomaticity(recall, speedScore) {
  if (recall == null || speedScore == null) return null;
  return recall * speedScore;
}

/**
 * Compute new stability after a correct answer.
 * - First correct: initialStability.
 * - Subsequent: grow by stabilityGrowthBase * speedFactor.
 * - Self-correction: if fast answer after long gap, back-calculate
 *   that true stability must be at least elapsedHours * 1.5.
 */
export function updateStability(oldStability, responseTimeMs, elapsedHours, cfg) {
  if (oldStability == null) {
    return cfg.initialStability;
  }
  // Speed factor: fast answers grow stability more (0.5 to speedBonusMax)
  const range = cfg.maxResponseTime - cfg.minTime;
  const clamped = Math.max(cfg.minTime, Math.min(responseTimeMs, cfg.maxResponseTime));
  const t = range > 0 ? (cfg.maxResponseTime - clamped) / range : 0.5;
  const speedFactor = 0.5 + t * (cfg.speedBonusMax - 0.5);

  let newStability = oldStability * cfg.stabilityGrowthBase * speedFactor;

  // Self-correction: fast answer after long gap means true half-life is long
  if (elapsedHours > 0 && responseTimeMs < cfg.selfCorrectionThreshold) {
    newStability = Math.max(newStability, elapsedHours * 1.5);
  }

  return Math.min(newStability, cfg.maxStability);
}

/**
 * Compute new stability after a wrong answer.
 * Reduces stability but floors at initialStability.
 */
export function computeStabilityAfterWrong(oldStability, cfg) {
  if (oldStability == null) return cfg.initialStability;
  return Math.max(cfg.initialStability, oldStability * cfg.stabilityDecayOnWrong);
}

/**
 * Compute selection weight for an item.
 * - Unseen items get unseenBoost (high weight for exploration).
 * - Seen items get ewma / minTime (slower = heavier),
 *   scaled by recall factor (low recall = more weight).
 */
export function computeWeight(stats, cfg) {
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
export function selectWeighted(items, weights, rand) {
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
// Selector factory (storage-injected — works with localStorage or Map)
// ---------------------------------------------------------------------------

export function createAdaptiveSelector(
  storage,
  cfg = DEFAULT_CONFIG,
  randomFn = Math.random,
) {
  function recordResponse(itemId, timeMs, correct = true) {
    const clamped = Math.min(timeMs, cfg.maxResponseTime);
    const existing = storage.getStats(itemId);
    const now = Date.now();

    if (correct) {
      const elapsedHours = existing && existing.lastCorrectAt
        ? (now - existing.lastCorrectAt) / 3600000
        : null;
      if (existing) {
        const newEwma = computeEwma(existing.ewma, clamped, cfg.ewmaAlpha);
        const newTimes = [...existing.recentTimes, clamped].slice(
          -cfg.maxStoredTimes,
        );
        const newStability = updateStability(
          existing.stability ?? null, clamped, elapsedHours, cfg,
        );
        storage.saveStats(itemId, {
          recentTimes: newTimes,
          ewma: newEwma,
          sampleCount: existing.sampleCount + 1,
          lastSeen: now,
          stability: newStability,
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
    } else {
      // Wrong answer: reduce stability, update lastSeen, don't touch EWMA
      if (existing) {
        const newStability = computeStabilityAfterWrong(
          existing.stability ?? null, cfg,
        );
        storage.saveStats(itemId, {
          ...existing,
          lastSeen: now,
          stability: newStability,
        });
      } else {
        // First interaction is wrong: create minimal stats
        storage.saveStats(itemId, {
          recentTimes: [],
          ewma: cfg.maxResponseTime,
          sampleCount: 0,
          lastSeen: now,
          stability: cfg.initialStability,
          lastCorrectAt: null,
        });
      }
    }
  }

  function getWeight(itemId) {
    return computeWeight(storage.getStats(itemId), cfg);
  }

  function getStats(itemId) {
    return storage.getStats(itemId);
  }

  function selectNext(validItems) {
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

  function getRecall(itemId) {
    const stats = storage.getStats(itemId);
    if (!stats || stats.stability == null || stats.lastCorrectAt == null) {
      return null;
    }
    const elapsedHours = (Date.now() - stats.lastCorrectAt) / 3600000;
    return computeRecall(stats.stability, elapsedHours);
  }

  function getAutomaticity(itemId) {
    const stats = storage.getStats(itemId);
    if (!stats) return null;
    const recall = getRecall(itemId);
    const speed = computeSpeedScore(stats.ewma, cfg);
    return computeAutomaticity(recall, speed);
  }

  /**
   * Recommend strings to review. Returns array of { string, dueCount, totalCount }
   * sorted by dueCount descending. getItemIds(stringIndex) should return
   * the item IDs for that string.
   */
  function getStringRecommendations(stringIndices, getItemIds) {
    const results = stringIndices.map((s) => {
      const items = getItemIds(s);
      let dueCount = 0;
      for (const id of items) {
        const recall = getRecall(id);
        if (recall === null || recall < cfg.recallThreshold) {
          dueCount++;
        }
      }
      return { string: s, dueCount, totalCount: items.length };
    });
    results.sort((a, b) => b.dueCount - a.dueCount);
    return results;
  }

  return { recordResponse, selectNext, getStats, getWeight, getRecall, getAutomaticity, getStringRecommendations };
}

// ---------------------------------------------------------------------------
// In-memory storage (for tests)
// ---------------------------------------------------------------------------

export function createMemoryStorage() {
  const stats = new Map();
  let lastSelected = null;

  return {
    getStats(itemId) {
      return stats.get(itemId) ?? null;
    },
    saveStats(itemId, s) {
      stats.set(itemId, s);
    },
    getLastSelected() {
      return lastSelected;
    },
    setLastSelected(itemId) {
      lastSelected = itemId;
    },
  };
}

// ---------------------------------------------------------------------------
// localStorage-backed storage (for browser)
// ---------------------------------------------------------------------------

export function createLocalStorageAdapter(namespace) {
  const cache = {};
  const mkKey = (itemId) => `adaptive_${namespace}_${itemId}`;
  const lastKey = `adaptive_${namespace}_lastSelected`;

  return {
    getStats(itemId) {
      const k = mkKey(itemId);
      if (!(k in cache)) {
        const data = localStorage.getItem(k);
        try {
          cache[k] = data ? JSON.parse(data) : null;
        } catch {
          cache[k] = null;
        }
      }
      return cache[k];
    },
    saveStats(itemId, stats) {
      const k = mkKey(itemId);
      cache[k] = stats;
      localStorage.setItem(k, JSON.stringify(stats));
    },
    getLastSelected() {
      return localStorage.getItem(lastKey);
    },
    setLastSelected(itemId) {
      localStorage.setItem(lastKey, itemId);
    },
    /** Pre-populate cache to avoid localStorage reads during gameplay. */
    preload(itemIds) {
      for (const itemId of itemIds) {
        this.getStats(itemId);
      }
    },
  };
}
