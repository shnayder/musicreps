// Pure computation functions for mode UI state.
// No DOM, no side effects — just data in, data out. Testable.

import type {
  AdaptiveSelector,
  PracticeSummaryState,
  RecommendationResult,
} from './types.ts';

// ---------------------------------------------------------------------------
// Practice summary computation
// ---------------------------------------------------------------------------

/** Count how many items have automaticity above threshold ("fluent"). */
export function countFluent(
  itemIds: string[],
  getAutomaticity: (id: string) => number | null,
  threshold: number,
): { fluent: number; seen: number } {
  let fluent = 0;
  let seen = 0;
  for (let i = 0; i < itemIds.length; i++) {
    const auto = getAutomaticity(itemIds[i]);
    if (auto !== null) {
      seen++;
      if (auto > threshold) fluent++;
    }
  }
  return { fluent, seen };
}

/**
 * Compute "level automaticity" — the p-th percentile of per-item automaticity
 * values (unseen items contribute 0). Compresses the group's item distribution
 * into one number that reflects the weakest items.
 *
 * For 12 items at p=0.1: index = ceil(1.2)-1 = 1 → 2nd lowest value.
 * For 48 items: index = ceil(4.8)-1 = 4 → 5th lowest.
 */
export function computeLevelAutomaticity(
  itemIds: string[],
  getAutomaticity: (id: string) => number | null,
  percentile: number = 0.1,
): { level: number; seen: number } {
  if (itemIds.length === 0) return { level: 0, seen: 0 };
  let seen = 0;
  const values: number[] = [];
  for (let i = 0; i < itemIds.length; i++) {
    const auto = getAutomaticity(itemIds[i]);
    if (auto !== null) {
      seen++;
      values.push(auto);
    } else {
      values.push(0);
    }
  }
  values.sort((a, b) => a - b);
  const rawIndex = Math.ceil(values.length * percentile) - 1;
  const index = Math.min(values.length - 1, Math.max(0, rawIndex));
  return { level: values[index], seen };
}

/** Compute the status label from level automaticity. */
export function statusLabelFromLevel(level: number): string {
  if (level >= 0.8) return 'Automatic';
  if (level >= 0.2) return 'Getting faster';
  return 'Slow';
}

/**
 * Build recommendation rationale text from a RecommendationResult.
 * Works for any group-based mode — caller provides group label function.
 *
 * @param getGroupLabel Maps a group/string index to a display label.
 * @param extraParts Additional suggestions (e.g., note filter for fretboard).
 */
export function buildRecommendationText(
  result: RecommendationResult,
  getGroupLabel: (index: number) => string,
  extraParts?: string[],
): string {
  if (result.recommended.size === 0) return '';

  // Review mode: simple text for polishing across all groups
  if (result.reviewMode) {
    return 'review all \u2014 polish across ' +
      result.consolidateIndices.length + ' group' +
      (result.consolidateIndices.length !== 1 ? 's' : '');
  }

  const parts: string[] = [];

  if (result.consolidateIndices.length > 0) {
    const labels = result.consolidateIndices
      .slice()
      .sort((a, b) => a - b)
      .map(getGroupLabel);
    // Use "refresh" when all consolidation groups are stale
    const allStale = result.staleIndices !== undefined &&
      result.staleIndices.length === result.consolidateIndices.length &&
      result.consolidateIndices.length > 0;
    const verb = allStale ? 'refresh' : 'solidify';
    const suffix = allStale
      ? 'skills getting stale'
      : result.consolidateWorkingCount + ' item' +
        (result.consolidateWorkingCount !== 1 ? 's' : '') +
        ' to work on';
    parts.push(verb + ' ' + labels.join(', ') + ' \u2014 ' + suffix);
  }

  if (result.expandIndex !== null) {
    parts.push(
      'start ' + getGroupLabel(result.expandIndex) +
        ' \u2014 ' + result.expandNewCount + ' new item' +
        (result.expandNewCount !== 1 ? 's' : ''),
    );
  }

  if (extraParts) {
    for (let i = 0; i < extraParts.length; i++) {
      parts.push(extraParts[i]);
    }
  }

  return parts.length > 0 ? parts.join(', ') : '';
}

/**
 * Compute the full practice summary state. Pure function — no DOM.
 *
 * @param allItemIds All items in the mode (not just enabled).
 * @param selector Adaptive selector (for automaticity lookups).
 * @param itemNoun "positions" for fretboard, "items" for everything else.
 * @param recommendation Precomputed recommendation result (null for no-group modes).
 * @param recommendationText Precomputed recommendation text (from buildRecommendationText).
 * @param masteryText Engine mastery text.
 * @param showMastery Engine mastery visibility.
 */
export function computePracticeSummary(opts: {
  allItemIds: string[];
  selector: AdaptiveSelector;
  itemNoun: string;
  recommendation: RecommendationResult | null;
  recommendationText: string;
  masteryText: string;
  showMastery: boolean;
}): PracticeSummaryState {
  const threshold = opts.selector.getConfig().automaticityThreshold;
  const { fluent } = countFluent(
    opts.allItemIds,
    (id) => opts.selector.getAutomaticity(id),
    threshold,
  );
  const total = opts.allItemIds.length;

  const { level, seen } = computeLevelAutomaticity(
    opts.allItemIds,
    (id) => opts.selector.getAutomaticity(id),
  );

  let statusLabel: string;
  let statusDetail: string;

  if (seen === 0) {
    statusLabel = 'Not started';
    statusDetail = total + ' ' + opts.itemNoun + ' to learn';
  } else {
    statusLabel = statusLabelFromLevel(level);
    statusDetail = fluent + '/' + total + ' ' + opts.itemNoun + ' fluent';
  }

  const hasRec = opts.recommendation !== null &&
    opts.recommendation.recommended.size > 0;

  return {
    statusLabel,
    statusDetail,
    recommendationText: opts.recommendationText,
    showRecommendationButton: hasRec,
    masteryText: opts.masteryText,
    showMastery: opts.showMastery,
    enabledItemCount: total,
  };
}
