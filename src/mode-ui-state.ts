// Pure computation functions for mode UI state.
// No DOM, no side effects — just data in, data out. Testable.

import type {
  AdaptiveSelector,
  PracticeSummaryState,
  RecommendationResult,
  SuggestionLine,
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

// Re-export for consumers that import from mode-ui-state.
export type { SuggestionLine } from './types.ts';

/**
 * Group levelRecs by type, deduplicating group IDs by highest priority.
 * Returns a record mapping rec type to group IDs in priority order.
 */
function groupRecsByType(
  levelRecs: RecommendationResult['levelRecs'],
): Record<string, string[]> {
  const seen = new Set<string>();
  const byType: Record<string, string[]> = {};
  for (const rec of levelRecs) {
    if (seen.has(rec.groupId)) continue;
    seen.add(rec.groupId);
    if (!byType[rec.type]) byType[rec.type] = [];
    byType[rec.type].push(rec.groupId);
  }
  return byType;
}

/**
 * Build structured recommendation lines from a RecommendationResult.
 * Each line has a capitalized verb and array of level labels.
 */
export function buildRecommendationLines(
  result: RecommendationResult,
  getGroupLabel: (groupId: string) => string,
): SuggestionLine[] {
  if (result.recommended.size === 0) return [];

  const byType = groupRecsByType(result.levelRecs);
  const lines: SuggestionLine[] = [];

  if (byType['review']) {
    // Labels come in priority order from levelRecs — no numeric sort needed
    const labels = byType['review'].map(getGroupLabel);
    lines.push({ verb: 'Review', levels: labels });
  }
  if (byType['practice']) {
    const labels = byType['practice'].map(getGroupLabel);
    lines.push({ verb: 'Practice', levels: labels });
  }
  if (byType['expand'] && result.expandIndex !== null) {
    lines.push({
      verb: 'Start',
      levels: [getGroupLabel(result.expandIndex)],
    });
  }
  if (byType['automate']) {
    const labels = byType['automate'].map(getGroupLabel);
    lines.push({ verb: 'Keep practicing', levels: labels });
  }

  return lines;
}

/** Map a SuggestionLine verb back to the flat text verb for buildRecommendationText. */
function flatVerb(line: SuggestionLine): string {
  switch (line.verb) {
    case 'Review':
      return 'review';
    case 'Practice':
      return 'practice';
    case 'Start':
      return 'start';
    case 'Keep practicing':
      return 'automate';
    default:
      return line.verb.toLowerCase();
  }
}

/**
 * Build recommendation rationale text from a RecommendationResult.
 * Generates a unified string from `result.levelRecs` — same text shown
 * in both in-skill suggestion card and home screen cue.
 *
 * @param getGroupLabel Maps a group ID to a display label.
 * @param extraParts Additional suggestions (e.g., note filter for fretboard).
 */
export function buildRecommendationText(
  result: RecommendationResult,
  getGroupLabel: (groupId: string) => string,
  extraParts?: string[],
): string {
  if (result.recommended.size === 0) return '';

  const lines = buildRecommendationLines(result, getGroupLabel);
  const parts = lines.map((line) =>
    flatVerb(line) + ' ' + line.levels.join(', ')
  );

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
