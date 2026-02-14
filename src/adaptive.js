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
  expansionThreshold: 0.7,   // fraction of seen items that must be retained before suggesting new strings
  speedBonusMax: 1.5,        // fast answers grow stability up to this extra factor
  selfCorrectionThreshold: 1500, // ms — response time below this triggers self-correction
  automaticityTarget: 3000,      // ms — response time at which speedScore ≈ 0.5
  automaticityThreshold: 0.8,    // automaticity above this = "automatic" (matches stats heatmap)
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
 *
 * For multi-response items (responseCount > 1), timing thresholds are
 * scaled proportionally so the ratios stay the same.
 */
export function computeSpeedScore(ewmaMs, cfg, responseCount = 1) {
  if (ewmaMs == null) return null;
  const effectiveTarget = cfg.automaticityTarget * responseCount;
  const effectiveMin = cfg.minTime * responseCount;
  const k = Math.LN2 / (effectiveTarget - effectiveMin);
  return Math.exp(-k * Math.max(0, ewmaMs - effectiveMin));
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
 * Like computeAutomaticity but returns 0 instead of null when the item
 * has been seen (hasSeen = true) but recall/speed data is incomplete.
 * This shows "needs work" (lowest heatmap level) instead of "no data"
 * for items the user has attempted but never answered correctly.
 */
export function computeAutomaticityForDisplay(recall, speedScore, hasSeen) {
  const value = computeAutomaticity(recall, speedScore);
  if (value == null && hasSeen) return 0;
  return value;
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

/**
 * Derive a scaled config from a motor baseline measurement.
 * The default config assumes baseline = 1000ms. This scales all
 * absolute timing thresholds proportionally to the measured baseline.
 */
export function deriveScaledConfig(motorBaseline, baseCfg = DEFAULT_CONFIG) {
  const scale = motorBaseline / 1000;
  return {
    ...baseCfg,
    minTime: Math.round(baseCfg.minTime * scale),
    automaticityTarget: Math.round(baseCfg.automaticityTarget * scale),
    selfCorrectionThreshold: Math.round(baseCfg.selfCorrectionThreshold * scale),
    maxResponseTime: Math.round(baseCfg.maxResponseTime * scale),
  };
}

/**
 * Compute median of a numeric array (non-mutating — copies and sorts internally).
 */
export function computeMedian(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

// ---------------------------------------------------------------------------
// Selector factory (storage-injected — works with localStorage or Map)
// ---------------------------------------------------------------------------

export function createAdaptiveSelector(
  storage,
  cfg = DEFAULT_CONFIG,
  randomFn = Math.random,
  responseCountFn = null,
) {
  function getResponseCount(itemId) {
    return responseCountFn ? responseCountFn(itemId) : 1;
  }

  function scaledConfig(itemId) {
    const rc = getResponseCount(itemId);
    if (rc <= 1) return cfg;
    return {
      ...cfg,
      minTime: cfg.minTime * rc,
      automaticityTarget: cfg.automaticityTarget * rc,
      maxResponseTime: cfg.maxResponseTime * rc,
      selfCorrectionThreshold: cfg.selfCorrectionThreshold * rc,
    };
  }

  function recordResponse(itemId, timeMs, correct = true) {
    const itemCfg = scaledConfig(itemId);
    const clamped = Math.min(timeMs, itemCfg.maxResponseTime);
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
          existing.stability ?? null, clamped, elapsedHours, itemCfg,
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
          ewma: itemCfg.maxResponseTime,
          sampleCount: 0,
          lastSeen: now,
          stability: cfg.initialStability,
          lastCorrectAt: null,
        });
      }
    }
  }

  function getWeight(itemId) {
    return computeWeight(storage.getStats(itemId), scaledConfig(itemId));
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
    const speed = computeSpeedScore(stats.ewma, scaledConfig(itemId));
    return computeAutomaticityForDisplay(recall, speed, true);
  }

  /**
   * Recommend strings to review. Returns array of
   * { string, dueCount, unseenCount, masteredCount, totalCount }
   * sorted by needsWork (dueCount + unseenCount) descending.
   * getItemIds(stringIndex) should return the item IDs for that string.
   *
   * - unseenCount: items with no recall data (never answered correctly)
   * - dueCount: items with established recall that dropped below threshold
   * - masteredCount: items with recall >= threshold (currently retained)
   */
  function getStringRecommendations(stringIndices, getItemIds) {
    const results = stringIndices.map((s) => {
      const items = getItemIds(s);
      let dueCount = 0;
      let unseenCount = 0;
      let masteredCount = 0;
      for (const id of items) {
        const recall = getRecall(id);
        if (recall === null) {
          unseenCount++;
        } else if (recall < cfg.recallThreshold) {
          dueCount++;
        } else {
          masteredCount++;
        }
      }
      return { string: s, dueCount, unseenCount, masteredCount, totalCount: items.length };
    });
    results.sort((a, b) => (b.dueCount + b.unseenCount) - (a.dueCount + a.unseenCount));
    return results;
  }

  /**
   * Check if all items have recall >= recallThreshold.
   * Returns false if any item is unseen or below threshold.
   */
  function checkAllMastered(items) {
    for (const id of items) {
      const recall = getRecall(id);
      if (recall === null || recall < cfg.recallThreshold) return false;
    }
    return items.length > 0;
  }

  /**
   * Check if all items have automaticity > automaticityThreshold.
   * This is the "fully automatic" bar — both remembered AND fast.
   * Matches the "Automatic (>80%)" band in the stats heatmap.
   */
  function checkAllAutomatic(items) {
    for (const id of items) {
      const auto = getAutomaticity(id);
      if (auto === null || auto <= cfg.automaticityThreshold) return false;
    }
    return items.length > 0;
  }

  /**
   * Check if previously-mastered material needs review.
   * Returns true only when ALL items had high prior skill (speedScore >= 0.5,
   * i.e. answering at or below the automaticity target, with at least 2
   * correct answers as evidence) but at least one item's recall has since
   * decayed below threshold.
   */
  function checkNeedsReview(items) {
    if (items.length === 0) return false;
    let hasDueItem = false;
    for (const id of items) {
      const stats = storage.getStats(id);
      if (!stats || stats.lastCorrectAt == null || stats.sampleCount < 2) return false;
      const rc = getResponseCount(id);
      const speed = computeSpeedScore(stats.ewma, cfg, rc);
      if (speed == null || speed < 0.5) return false;
      const recall = getRecall(id);
      if (recall !== null && recall < cfg.recallThreshold) hasDueItem = true;
    }
    return hasDueItem;
  }

  function updateConfig(newCfg) {
    cfg = { ...cfg, ...newCfg };
  }

  function getConfig() {
    return cfg;
  }

  return { recordResponse, selectNext, getStats, getWeight, getRecall, getAutomaticity, getStringRecommendations, checkAllMastered, checkAllAutomatic, checkNeedsReview, updateConfig, getConfig };
}

// ---------------------------------------------------------------------------
// In-memory storage (for tests)
// ---------------------------------------------------------------------------

export function createMemoryStorage() {
  const stats = new Map();
  const deadlines = new Map();
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
    getDeadline(itemId) {
      return deadlines.get(itemId) ?? null;
    },
    saveDeadline(itemId, deadline) {
      deadlines.set(itemId, deadline);
    },
  };
}

// ---------------------------------------------------------------------------
// localStorage-backed storage (for browser)
// ---------------------------------------------------------------------------

export function createLocalStorageAdapter(namespace) {
  const cache = {};
  const mkKey = (itemId) => `adaptive_${namespace}_${itemId}`;
  const dlKey = (itemId) => `deadline_${namespace}_${itemId}`;
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
    getDeadline(itemId) {
      const k = dlKey(itemId);
      if (!(k in cache)) {
        const data = localStorage.getItem(k);
        cache[k] = data ? Number(data) : null;
      }
      return cache[k];
    },
    saveDeadline(itemId, deadline) {
      const k = dlKey(itemId);
      cache[k] = deadline;
      localStorage.setItem(k, String(deadline));
    },
    /** Pre-populate cache to avoid localStorage reads during gameplay. */
    preload(itemIds) {
      for (const itemId of itemIds) {
        this.getStats(itemId);
      }
    },
  };
}
