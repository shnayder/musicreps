// Shared recommendation algorithm: consolidate-before-expanding.
// Extracts the duplicated logic from quiz-fretboard.js, quiz-semitone-math.js,
// and quiz-interval-math.js into a single pure function.
// Pure w.r.t. configuration: callers pass `config.expansionThreshold`.

/**
 * Compute which subsets (strings, distance groups) to recommend and enable.
 *
 * @param {object} selector - Adaptive selector (provides getStringRecommendations)
 * @param {Array} allIndices - All subset indices (e.g. [0,1,2,3,4,5] for strings)
 * @param {function} getItemIds - (index) => array of item IDs for that subset
 * @param {object} config - Must have expansionThreshold
 * @param {object} [options]
 * @param {function} [options.sortUnstarted] - Comparator for unstarted items.
 *   If provided, sorts unstarted before picking next expansion.
 *   Default: no sort (use first unstarted as-is).
 * @returns {{ recommended: Set, enabled: Set|null, consolidateIndices: number[],
 *             consolidateDueCount: number, expandIndex: number|null, expandNewCount: number }}
 *   recommended: indices to highlight with orange borders
 *   enabled: indices to auto-select, or null if no groups exist
 *   consolidateIndices: group indices needing consolidation work
 *   consolidateDueCount: total items needing work in consolidation groups
 *   expandIndex: group index being added for expansion, or null
 *   expandNewCount: new items in expansion group
 */
export function computeRecommendations(selector, allIndices, getItemIds, config, options) {
  const sortUnstarted = options && options.sortUnstarted;
  const recs = selector.getStringRecommendations(allIndices, getItemIds);

  const started = recs.filter(r => r.unseenCount < r.totalCount);
  const unstarted = recs.filter(r => r.unseenCount === r.totalCount);

  if (started.length === 0) {
    // Fresh start: recommend the first unstarted group so "Use suggestion" works
    if (unstarted.length > 0) {
      const sorted = sortUnstarted ? [...unstarted].sort(sortUnstarted) : unstarted;
      const first = sorted[0];
      return { recommended: new Set([first.string]), enabled: new Set([first.string]),
               consolidateIndices: [], consolidateDueCount: 0,
               expandIndex: first.string, expandNewCount: first.totalCount };
    }
    return { recommended: new Set(), enabled: null,
             consolidateIndices: [], consolidateDueCount: 0,
             expandIndex: null, expandNewCount: 0 };
  }

  const totalSeen = started.reduce((sum, r) => sum + (r.masteredCount + r.dueCount), 0);
  const totalMastered = started.reduce((sum, r) => sum + r.masteredCount, 0);
  const consolidatedRatio = totalSeen > 0 ? totalMastered / totalSeen : 0;

  const startedByWork = [...started].sort(
    (a, b) => (b.dueCount + b.unseenCount) - (a.dueCount + a.unseenCount)
  );

  const workCounts = startedByWork.map(r => r.dueCount + r.unseenCount);
  const medianWork = workCounts[Math.floor(workCounts.length / 2)];
  const recommended = new Set();
  const enabled = new Set();
  const consolidateIndices = [];
  let consolidateDueCount = 0;
  for (const r of startedByWork) {
    if (r.dueCount + r.unseenCount > medianWork) {
      recommended.add(r.string);
      enabled.add(r.string);
      consolidateIndices.push(r.string);
      consolidateDueCount += r.dueCount + r.unseenCount;
    }
  }
  if (enabled.size === 0) {
    const r = startedByWork[0];
    recommended.add(r.string);
    enabled.add(r.string);
    consolidateIndices.push(r.string);
    consolidateDueCount += r.dueCount + r.unseenCount;
  }

  let expandIndex = null;
  let expandNewCount = 0;
  if (consolidatedRatio >= config.expansionThreshold && unstarted.length > 0) {
    const sorted = sortUnstarted ? [...unstarted].sort(sortUnstarted) : unstarted;
    expandIndex = sorted[0].string;
    expandNewCount = sorted[0].totalCount;
    recommended.add(expandIndex);
    enabled.add(expandIndex);
  }

  return { recommended, enabled, consolidateIndices, consolidateDueCount,
           expandIndex, expandNewCount };
}
