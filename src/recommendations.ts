// Shared recommendation algorithm: consolidate-before-expanding.
// Extracts the duplicated logic from quiz-fretboard.js, quiz-semitone-math.js,
// and quiz-interval-math.js into a single pure function.
// Pure w.r.t. configuration: callers pass `config.expansionThreshold`.

import type { RecommendationResult, StringRecommendation } from './types.ts';

// Compute which subsets (strings, distance groups) to recommend and enable.
export function computeRecommendations(
  selector: {
    getStringRecommendations(
      indices: number[],
      getItemIds: (index: number) => string[],
    ): StringRecommendation[];
    getLevelAutomaticity(
      itemIds: string[],
      percentile?: number,
    ): { level: number; seen: number };
  },
  allIndices: number[],
  getItemIds: (index: number) => string[],
  config: { expansionThreshold: number },
  options?: {
    sortUnstarted?: (
      a: StringRecommendation,
      b: StringRecommendation,
    ) => number;
  },
): RecommendationResult {
  const sortUnstarted = options && options.sortUnstarted;
  const recs = selector.getStringRecommendations(allIndices, getItemIds);

  const started = recs.filter((r) => r.unseenCount < r.totalCount);
  const unstarted = recs.filter((r) => r.unseenCount === r.totalCount);

  if (started.length === 0) {
    // Fresh start: recommend the first unstarted group so "Use suggestion" works
    if (unstarted.length > 0) {
      const sorted = sortUnstarted
        ? [...unstarted].sort(sortUnstarted)
        : unstarted;
      const first = sorted[0];
      return {
        recommended: new Set([first.string]),
        enabled: new Set([first.string]),
        consolidateIndices: [],
        consolidateWorkingCount: 0,
        expandIndex: first.string,
        expandNewCount: first.totalCount,
      };
    }
    return {
      recommended: new Set(),
      enabled: null,
      consolidateIndices: [],
      consolidateWorkingCount: 0,
      expandIndex: null,
      expandNewCount: 0,
    };
  }

  // Expansion gate: level automaticity of all started items
  const startedItemIds = started.flatMap((r) => getItemIds(r.string));
  const { level } = selector.getLevelAutomaticity(startedItemIds);

  const startedByWork = [...started].sort(
    (a, b) =>
      (b.workingCount + b.unseenCount) - (a.workingCount + a.unseenCount),
  );

  const workCounts = startedByWork.map((r) => r.workingCount + r.unseenCount);
  const medianWork = workCounts[Math.floor(workCounts.length / 2)];
  const recommended = new Set<number>();
  const enabled = new Set<number>();
  const consolidateIndices: number[] = [];
  let consolidateWorkingCount = 0;
  for (const r of startedByWork) {
    if (r.workingCount + r.unseenCount > medianWork) {
      recommended.add(r.string);
      enabled.add(r.string);
      consolidateIndices.push(r.string);
      consolidateWorkingCount += r.workingCount + r.unseenCount;
    }
  }
  if (enabled.size === 0) {
    const r = startedByWork[0];
    recommended.add(r.string);
    enabled.add(r.string);
    consolidateIndices.push(r.string);
    consolidateWorkingCount += r.workingCount + r.unseenCount;
  }

  let expandIndex: number | null = null;
  let expandNewCount: number = 0;
  if (level >= config.expansionThreshold && unstarted.length > 0) {
    const sorted = sortUnstarted
      ? [...unstarted].sort(sortUnstarted)
      : unstarted;
    expandIndex = sorted[0].string;
    expandNewCount = sorted[0].totalCount;
    recommended.add(expandIndex);
    enabled.add(expandIndex);
  }

  return {
    recommended,
    enabled,
    consolidateIndices,
    consolidateWorkingCount,
    expandIndex,
    expandNewCount,
  };
}
