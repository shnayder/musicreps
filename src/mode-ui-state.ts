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
 * Generates a unified string from `result.levelRecs` — same text shown
 * in both in-skill suggestion card and home screen cue.
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

  const parts: string[] = [];

  // Group levelRecs by type, preserving priority order.
  // Each index appears only under its first (highest-priority) type.
  const seen = new Set<number>();
  const byType: Record<string, number[]> = {};
  for (const rec of result.levelRecs) {
    if (seen.has(rec.index)) continue;
    seen.add(rec.index);
    if (!byType[rec.type]) byType[rec.type] = [];
    byType[rec.type].push(rec.index);
  }

  // Emit each type in priority order.
  if (byType['review']) {
    const labels = byType['review'].sort((a, b) => a - b).map(getGroupLabel);
    parts.push('review ' + labels.join(', '));
  }
  if (byType['practice']) {
    const labels = byType['practice'].sort((a, b) => a - b).map(getGroupLabel);
    parts.push('practice ' + labels.join(', '));
  }
  if (byType['expand'] && result.expandIndex !== null) {
    parts.push(
      'start ' + getGroupLabel(result.expandIndex) +
        ' \u2014 ' + result.expandNewCount + ' new item' +
        (result.expandNewCount !== 1 ? 's' : ''),
    );
  }
  if (byType['automate']) {
    const labels = byType['automate'].sort((a, b) => a - b).map(getGroupLabel);
    parts.push('automate ' + labels.join(', '));
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
