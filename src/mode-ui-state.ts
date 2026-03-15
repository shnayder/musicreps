// Pure computation functions for mode UI state.
// No DOM, no side effects — just data in, data out. Testable.

import type {
  AdaptiveSelector,
  PracticeSummaryState,
  RecommendationResult,
} from './types.ts';
import { computeLevelPercentile } from './adaptive.ts';

// ---------------------------------------------------------------------------
// Practice summary computation
// ---------------------------------------------------------------------------

/** Count how many items have speed score ≥ 0.9 ("automatic"). */
export function countAutomatic(
  itemIds: string[],
  getSpeedScore: (id: string) => number | null,
): { automatic: number; seen: number } {
  let automatic = 0;
  let seen = 0;
  for (let i = 0; i < itemIds.length; i++) {
    const speed = getSpeedScore(itemIds[i]);
    if (speed !== null) {
      seen++;
      if (speed >= 0.9) automatic++;
    }
  }
  return { automatic, seen };
}

// Re-export for consumers that import from mode-ui-state.
export { computeLevelPercentile } from './adaptive.ts';

/** Compute the status label from P10(speed). */
export function statusLabelFromLevel(level: number): string {
  if (level >= 0.9) return 'Automatic';
  if (level >= 0.7) return 'Solid';
  if (level >= 0.3) return 'Learning';
  return 'Hesitant';
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
 * @param selector Adaptive selector (for speed/freshness lookups).
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
  const { automatic } = countAutomatic(
    opts.allItemIds,
    (id) => opts.selector.getSpeedScore(id),
  );
  const total = opts.allItemIds.length;

  const { level, seen } = computeLevelPercentile(
    (id) => opts.selector.getSpeedScore(id),
    opts.allItemIds,
  );

  let statusLabel: string;
  let statusDetail: string;

  if (seen === 0) {
    statusLabel = 'Not started';
    statusDetail = total + ' ' + opts.itemNoun + ' to learn';
  } else {
    statusLabel = statusLabelFromLevel(level);
    statusDetail = automatic + '/' + total + ' ' + opts.itemNoun + ' automatic';
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
