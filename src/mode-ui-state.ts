// Pure computation functions for mode UI state.
// No DOM, no side effects — just data in, data out. Testable.

import type {
  AdaptiveSelector,
  ModeDefinition,
  PracticeSummaryState,
  RecommendationResult,
  ScopeState,
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

/** Compute the status label from a fluency percentage. */
export function statusLabelFromPct(pct: number): string {
  if (pct >= 80) return 'Strong';
  if (pct >= 50) return 'Solid';
  if (pct >= 20) return 'Building';
  return 'Getting started';
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

  const parts: string[] = [];

  if (result.consolidateIndices.length > 0) {
    const labels = result.consolidateIndices
      .slice()
      .sort((a, b) => a - b)
      .map(getGroupLabel);
    parts.push(
      'solidify ' + labels.join(', ') +
        ' \u2014 ' + result.consolidateDueCount + ' slow item' +
        (result.consolidateDueCount !== 1 ? 's' : ''),
    );
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

  return parts.length > 0 ? 'Suggestion: ' + parts.join(', ') : '';
}

/**
 * Compute the full practice summary state. Pure function — no DOM.
 *
 * @param allItemIds All items in the mode (not just enabled).
 * @param selector Adaptive selector (for automaticity lookups).
 * @param itemNoun "positions" for fretboard, "items" for everything else.
 * @param recommendation Precomputed recommendation result (null for no-group modes).
 * @param recommendationText Precomputed recommendation text (from buildRecommendationText).
 * @param sessionSummary Session summary string (from mode definition).
 * @param masteryText Engine mastery text.
 * @param showMastery Engine mastery visibility.
 */
export function computePracticeSummary(opts: {
  allItemIds: string[];
  selector: AdaptiveSelector;
  itemNoun: string;
  recommendation: RecommendationResult | null;
  recommendationText: string;
  sessionSummary: string;
  masteryText: string;
  showMastery: boolean;
}): PracticeSummaryState {
  const threshold = opts.selector.getConfig().automaticityThreshold;
  const { fluent, seen } = countFluent(
    opts.allItemIds,
    (id) => opts.selector.getAutomaticity(id),
    threshold,
  );
  const total = opts.allItemIds.length;

  let statusLabel: string;
  let statusDetail: string;

  if (seen === 0) {
    statusLabel = 'Ready to start';
    statusDetail = total + ' ' + opts.itemNoun + ' to learn';
  } else {
    const pct = total > 0 ? Math.round((fluent / total) * 100) : 0;
    statusLabel = 'Overall: ' + statusLabelFromPct(pct);
    statusDetail = fluent + ' of ' + total + ' ' + opts.itemNoun + ' fluent';
  }

  const hasRec = opts.recommendation !== null &&
    opts.recommendation.recommended.size > 0;

  return {
    statusLabel,
    statusDetail,
    recommendationText: opts.recommendationText,
    showRecommendationButton: hasRec,
    sessionSummary: opts.sessionSummary,
    masteryText: opts.masteryText,
    showMastery: opts.showMastery,
    enabledItemCount: total,
  };
}

/**
 * Compute practice summary from a ModeDefinition + engine state.
 * Convenience wrapper that pulls values from the definition and engine.
 */
export function computePracticeSummaryForMode(
  def: ModeDefinition,
  scope: ScopeState,
  selector: AdaptiveSelector,
  recommendation: RecommendationResult | null,
  recommendationText: string,
  masteryText: string,
  showMastery: boolean,
): PracticeSummaryState {
  const itemNoun = def.scopeSpec.kind === 'fretboard' ? 'positions' : 'items';
  return computePracticeSummary({
    allItemIds: def.allItemIds,
    selector,
    itemNoun,
    recommendation,
    recommendationText,
    sessionSummary: def.getSessionSummary(scope),
    masteryText,
    showMastery,
  });
}
