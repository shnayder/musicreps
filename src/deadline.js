// Per-item adaptive deadline staircase for the spaced repetition timer.
// Pure functions + factory, same pattern as adaptive.js.
// ES module — exports stripped for browser inlining.

export const DEFAULT_DEADLINE_CONFIG = {
  decreaseFactor: 0.85,       // multiply deadline after correct answer
  increaseFactor: 1.4,        // multiply deadline after incorrect/timeout
  minDeadlineMargin: 1.3,     // multiply minTime by this for deadline floor
  ewmaMultiplier: 2.0,        // cold start: ewma * this for items with history
};

/**
 * Compute the initial deadline for an item based on its EWMA.
 * - If EWMA exists: ewma * ewmaMultiplier (generous: ~2x average speed)
 * - If no EWMA (unseen): maxDeadline (generous ceiling)
 * Clamped to [minDeadline, maxDeadline].
 */
export function computeInitialDeadline(ewma, adaptiveCfg, dlCfg) {
  const minDeadline = Math.round(adaptiveCfg.minTime * dlCfg.minDeadlineMargin);
  const maxDeadline = adaptiveCfg.maxResponseTime;
  if (ewma != null) {
    return Math.round(Math.max(minDeadline, Math.min(maxDeadline, ewma * dlCfg.ewmaMultiplier)));
  }
  return maxDeadline;
}

/**
 * Adjust a deadline after an outcome.
 * - Correct: decrease (push harder)
 * - Incorrect/timeout: increase (ease off)
 * Clamped to [minDeadline, maxDeadline].
 */
export function adjustDeadline(currentDeadline, correct, adaptiveCfg, dlCfg) {
  const minDeadline = Math.round(adaptiveCfg.minTime * dlCfg.minDeadlineMargin);
  const maxDeadline = adaptiveCfg.maxResponseTime;
  const factor = correct ? dlCfg.decreaseFactor : dlCfg.increaseFactor;
  const adjusted = Math.round(currentDeadline * factor);
  return Math.max(minDeadline, Math.min(maxDeadline, adjusted));
}

/**
 * Create a deadline tracker that manages per-item deadlines with persistence.
 *
 * @param {object} storage - Storage adapter with getDeadline/saveDeadline
 * @param {object} adaptiveCfg - Adaptive selector config (for minTime, maxResponseTime)
 * @param {object} [dlCfg] - Deadline-specific config
 */
export function createDeadlineTracker(storage, adaptiveCfg, dlCfg = DEFAULT_DEADLINE_CONFIG) {
  function scaledAdaptiveCfg(responseCount) {
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
   * @param {string} itemId
   * @param {number|null} ewma - The item's EWMA from the adaptive selector
   * @param {number} [responseCount=1] - Expected number of physical responses
   * @returns {number} deadline in ms
   */
  function getDeadline(itemId, ewma, responseCount = 1) {
    const stored = storage.getDeadline(itemId);
    if (stored != null && stored > 0) return stored;
    const initial = computeInitialDeadline(ewma, scaledAdaptiveCfg(responseCount), dlCfg);
    storage.saveDeadline(itemId, initial);
    return initial;
  }

  /**
   * Record an outcome and adjust the item's deadline.
   * @param {string} itemId
   * @param {boolean} correct
   * @param {number} [responseCount=1] - Expected number of physical responses
   * @returns {number} the new deadline
   */
  function recordOutcome(itemId, correct, responseCount = 1) {
    const current = storage.getDeadline(itemId);
    if (current == null) return; // shouldn't happen — getDeadline was called first
    const newDeadline = adjustDeadline(current, correct, scaledAdaptiveCfg(responseCount), dlCfg);
    storage.saveDeadline(itemId, newDeadline);
    return newDeadline;
  }

  /**
   * Update the adaptive config reference (e.g. after motor baseline calibration).
   */
  function updateConfig(newAdaptiveCfg) {
    adaptiveCfg = newAdaptiveCfg;
  }

  return { getDeadline, recordOutcome, updateConfig };
}
