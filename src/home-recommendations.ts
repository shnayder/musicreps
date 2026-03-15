// Cross-skill recommendation engine for the home screen.
// Classifies each starred skill and ranks the top 3 for display.

import {
  computeRecommendations,
  detectStaleGroups,
  type RecommendationSelector,
  STALE_FRESHNESS_THRESHOLD,
  STALE_SPEED_THRESHOLD,
} from './recommendations.ts';
import type { ModeProgressEntry } from './mode-progress-manifest.ts';
import type { StorageAdapter } from './types.ts';
import { createAdaptiveSelector, deriveScaledConfig } from './adaptive.ts';

// Re-export for consumers that import from here.
export { STALE_FRESHNESS_THRESHOLD, STALE_SPEED_THRESHOLD };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SkillRecommendationType =
  | 'review'
  | 'keep-practicing'
  | 'learn-next'
  | 'not-started'
  | 'automatic';

export type SkillRecommendation = {
  modeId: string;
  type: SkillRecommendationType;
  /** Higher = more urgent within the same type. */
  urgency: number;
  /** Short cue label for the card, or empty string if none. */
  cueLabel: string;
  /** Specific detail with level info, e.g. "Review level 1, 3". */
  detail: string;
};

// ---------------------------------------------------------------------------
// Per-skill classification
// ---------------------------------------------------------------------------

/** Build the "not-started" result for a mode. */
function notStarted(modeId: string): SkillRecommendation {
  return { modeId, type: 'not-started', urgency: 0, cueLabel: '', detail: '' };
}

/**
 * Classify a single skill's recommendation state.
 * Uses the same computeRecommendations pipeline as in-mode display, plus
 * broader stale detection across ALL started groups (not just consolidation).
 */
export function computeSkillRecommendation(
  entry: ModeProgressEntry,
  storage: StorageAdapter,
  motorBaseline: number | null,
  skippedGroups: ReadonlySet<number>,
  config: { maxWorkItems?: number },
): SkillRecommendation {
  const cfg = motorBaseline !== null
    ? deriveScaledConfig(motorBaseline)
    : undefined;
  const selector = createAdaptiveSelector(storage, cfg);

  // Build active group indices (all minus skipped).
  const allIndices: number[] = [];
  for (let i = 0; i < entry.groups.length; i++) {
    if (!skippedGroups.has(i)) allIndices.push(i);
  }
  if (allIndices.length === 0) return notStarted(entry.modeId);

  const getItemIds = (idx: number) => entry.groups[idx].getItemIds();

  // Check if any items have been seen at all.
  const allItemIds = allIndices.flatMap(getItemIds);
  const { seen } = selector.getLevelSpeed(allItemIds);
  if (seen === 0) return notStarted(entry.modeId);

  const result = computeRecommendations(
    selector as RecommendationSelector,
    allIndices,
    getItemIds,
    config,
  );

  // Broader stale detection: check ALL started groups, not just consolidation.
  const staleIndices = findStaleGroups(selector, allIndices, getItemIds);

  return classifySkill(entry, result, staleIndices);
}

/** Find stale group indices across all started groups. */
function findStaleGroups(
  selector: ReturnType<typeof createAdaptiveSelector>,
  allIndices: number[],
  getItemIds: (idx: number) => string[],
): number[] {
  const startedIndices = allIndices.filter((idx) => {
    const ids = getItemIds(idx);
    return ids.some((id) => selector.getSpeedScore(id) !== null);
  });

  return detectStaleGroups(
    startedIndices,
    getItemIds,
    selector.getSpeedScore,
    (id) => selector.getFreshness(id),
  ) ?? [];
}

/** Format group labels: "E A" or "E A, D G". */
function groupLabelText(
  indices: number[],
  labels: string[],
): string {
  return indices.map((i) => labels[i] ?? `level ${i + 1}`).join(', ');
}

/** Classify a skill based on recommendation result and stale groups. */
function classifySkill(
  entry: ModeProgressEntry,
  result: ReturnType<typeof computeRecommendations>,
  staleIndices: number[],
): SkillRecommendation {
  const modeId = entry.modeId;
  const singleGroup = entry.groups.length <= 1;
  const labels = entry.groups.map((g) => g.label);

  if (staleIndices.length > 0) {
    const detail = singleGroup
      ? 'Review'
      : `Review ${groupLabelText(staleIndices, labels)}`;
    return {
      modeId,
      type: 'review',
      urgency: staleIndices.length,
      cueLabel: 'Review',
      detail,
    };
  }
  if (result.consolidateWorkingCount > 0 && !result.reviewMode) {
    const detail = singleGroup
      ? 'Keep practicing'
      : `Keep practicing ${groupLabelText(result.consolidateIndices, labels)}`;
    return {
      modeId,
      type: 'keep-practicing',
      urgency: result.consolidateWorkingCount,
      cueLabel: 'Keep practicing',
      detail,
    };
  }
  if (result.expandIndex !== null) {
    const detail = singleGroup
      ? 'Learn next level'
      : `Learn ${
        labels[result.expandIndex] ?? `level ${result.expandIndex + 1}`
      }`;
    return {
      modeId,
      type: 'learn-next',
      urgency: 0,
      cueLabel: 'Learn next level',
      detail,
    };
  }
  return { modeId, type: 'automatic', urgency: 0, cueLabel: '', detail: '' };
}

// ---------------------------------------------------------------------------
// Cross-skill ranking
// ---------------------------------------------------------------------------

const TYPE_PRIORITY: Record<SkillRecommendationType, number> = {
  'review': 0,
  'keep-practicing': 1,
  'learn-next': 2,
  'not-started': 3,
  'automatic': 4,
};

/**
 * Rank skill recommendations and return the top N (default 3).
 * Priority: review > get-faster > learn-next. Within a tier, higher urgency
 * wins. "not-started" and "automatic" are excluded unless cold-start applies.
 *
 * @param definitionOrder Mode IDs in definition order, used for cold-start
 *   tie-breaking when all skills are not-started.
 */
export function rankSkillRecommendations(
  recommendations: SkillRecommendation[],
  definitionOrder: string[],
  maxCount: number = 3,
): SkillRecommendation[] {
  // Filter to actionable types.
  const actionable = recommendations.filter(
    (r) =>
      r.type === 'review' || r.type === 'keep-practicing' ||
      r.type === 'learn-next',
  );

  if (actionable.length > 0) {
    actionable.sort((a, b) => {
      const pd = TYPE_PRIORITY[a.type] - TYPE_PRIORITY[b.type];
      if (pd !== 0) return pd;
      return b.urgency - a.urgency;
    });
    return actionable.slice(0, maxCount);
  }

  // Cold start: all not-started → recommend first in definition order.
  const allNotStarted = recommendations.every((r) => r.type === 'not-started');
  if (allNotStarted && recommendations.length > 0) {
    // Find the first not-started skill in definition order.
    for (const modeId of definitionOrder) {
      const rec = recommendations.find((r) => r.modeId === modeId);
      if (rec) {
        return [{
          ...rec,
          type: 'learn-next',
          cueLabel: 'Learn next level',
          detail: 'Get started',
        }];
      }
    }
  }

  // All automatic → empty (triggers "all done" state).
  return [];
}
