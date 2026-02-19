// Per-item adaptive deadline staircase for the spaced repetition timer.
// Pure functions + factory, same pattern as adaptive.js.

import type { AdaptiveConfig, DeadlineConfig, DeadlineTracker, StorageAdapter } from './types.ts';

export const DEFAULT_DEADLINE_CONFIG: DeadlineConfig = {
  decreaseFactor: 0.85, // multiply deadline after correct answer (staircase)
  increaseFactor: 1.4, // multiply deadline after incorrect/timeout
  minDeadlineMargin: 1.3, // multiply minTime by this for deadline floor
  ewmaMultiplier: 2.0, // cold start: ewma * this for items with history
  headroomMultiplier: 1.5, // response-time anchored: responseTime * this
  maxDropFactor: 0.5, // max single-step decrease (never drop below this × current)
};

/**
 * Compute the initial deadline for an item based on its EWMA.
 * - If EWMA exists: ewma * ewmaMultiplier (generous: ~2x average speed)
 * - If no EWMA (unseen): maxDeadline (generous ceiling)
 * Clamped to [minDeadline, maxDeadline].
 */
export function computeInitialDeadline(ewma: number | null, adaptiveCfg: AdaptiveConfig, dlCfg: DeadlineConfig): number {
  const minDeadline = Math.round(adaptiveCfg.minTime * dlCfg.minDeadlineMargin);
  const maxDeadline = adaptiveCfg.maxResponseTime;
  if (ewma != null) {
    return Math.round(
      Math.max(minDeadline, Math.min(maxDeadline, ewma * dlCfg.ewmaMultiplier)),
    );
  }
  return maxDeadline;
}

/**
 * Adjust a deadline after an outcome.
 * - Correct: take the more aggressive of staircase (×0.85) and response-time
 *   anchored (responseTime × 1.5), but never drop more than 50% in one step.
 * - Incorrect/timeout: increase (ease off) by ×1.4.
 * Clamped to [minDeadline, maxDeadline].
 */
export function adjustDeadline(
  currentDeadline: number,
  correct: boolean,
  adaptiveCfg: AdaptiveConfig,
  dlCfg: DeadlineConfig,
  responseTime: number | null,
): number {
  const minDeadline = Math.round(adaptiveCfg.minTime * dlCfg.minDeadlineMargin);
  const maxDeadline = adaptiveCfg.maxResponseTime;

  if (!correct) {
    const adjusted = Math.round(currentDeadline * dlCfg.increaseFactor);
    return Math.max(minDeadline, Math.min(maxDeadline, adjusted));
  }

  // Correct answer: use the more aggressive of staircase and response-anchored
  const staircase = Math.round(currentDeadline * dlCfg.decreaseFactor);
  let target = staircase;
  if (responseTime != null && responseTime > 0) {
    const anchored = Math.round(responseTime * dlCfg.headroomMultiplier);
    target = Math.min(staircase, anchored);
  }
  // Cap max drop per step
  const floor = Math.round(currentDeadline * dlCfg.maxDropFactor);
  const adjusted = Math.max(target, floor);
  return Math.max(minDeadline, Math.min(maxDeadline, adjusted));
}

/**
 * Create a deadline tracker that manages per-item deadlines with persistence.
 */
export function createDeadlineTracker(
  storage: StorageAdapter,
  adaptiveCfg: AdaptiveConfig,
  dlCfg: DeadlineConfig = DEFAULT_DEADLINE_CONFIG,
): DeadlineTracker {
  function scaledAdaptiveCfg(responseCount: number) {
    if (responseCount <= 1) return adaptiveCfg;
    return {
      ...adaptiveCfg,
      minTime: adaptiveCfg.minTime * responseCount,
      maxResponseTime: adaptiveCfg.maxResponseTime * responseCount,
    };
  }

  /**
   * Get the current deadline for an item.
   * Loads from storage if persisted, otherwise cold-starts from EWMA.
   */
  function getDeadline(itemId: string, ewma: number | null, responseCount: number = 1): number {
    const stored = storage.getDeadline(itemId);
    if (stored != null && stored > 0) return stored;
    const initial = computeInitialDeadline(
      ewma,
      scaledAdaptiveCfg(responseCount),
      dlCfg,
    );
    storage.saveDeadline(itemId, initial);
    return initial;
  }

  /**
   * Record an outcome and adjust the item's deadline.
   */
  function recordOutcome(
    itemId: string,
    correct: boolean,
    responseCount: number = 1,
    responseTime: number | null = null,
  ): number | undefined {
    const current = storage.getDeadline(itemId);
    if (current == null) return; // shouldn't happen — getDeadline was called first
    const newDeadline = adjustDeadline(
      current,
      correct,
      scaledAdaptiveCfg(responseCount),
      dlCfg,
      responseTime,
    );
    storage.saveDeadline(itemId, newDeadline);
    return newDeadline;
  }

  /**
   * Update the adaptive config reference (e.g. after motor baseline calibration).
   */
  function updateConfig(newAdaptiveCfg: AdaptiveConfig): void {
    adaptiveCfg = newAdaptiveCfg;
  }

  return { getDeadline, recordOutcome, updateConfig };
}
