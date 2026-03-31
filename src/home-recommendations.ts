// Cross-skill recommendation engine for the home screen.
// Classifies each starred skill and ranks the top 3 for display.

import {
  computeRecommendations,
  type RecommendationSelector,
} from './recommendations.ts';
import type { ModeProgressEntry } from './mode-progress-manifest.ts';
import type { StorageAdapter } from './types.ts';
import { createAdaptiveSelector, deriveScaledConfig } from './adaptive.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SkillRecommendationType =
  | 'review'
  | 'keep-practicing'
  | 'learn-next'
  | 'automate'
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

/** Format group labels from an array of group IDs and a label map. */
function groupLabelText(
  groupIds: string[],
  labelMap: Map<string, string>,
): string {
  return groupIds.map((id) => labelMap.get(id) ?? id).join(', ');
}

/**
 * Classify a single skill's recommendation state.
 * Uses the same computeRecommendations pipeline as in-mode display.
 */
export function computeSkillRecommendation(
  entry: ModeProgressEntry,
  storage: StorageAdapter,
  motorBaseline: number | null,
  skippedGroups: ReadonlySet<string>,
  config: { maxWorkItems?: number },
): SkillRecommendation {
  const cfg = motorBaseline !== null
    ? deriveScaledConfig(motorBaseline)
    : undefined;
  const selector = createAdaptiveSelector(storage, cfg);

  // Build active group IDs (all minus skipped).
  const allGroupIds: string[] = entry.groups
    .filter((g) => !skippedGroups.has(g.id))
    .map((g) => g.id);
  if (allGroupIds.length === 0) return notStarted(entry.modeId);

  // O(1) lookups by group ID.
  const groupById = new Map(entry.groups.map((g) => [g.id, g]));
  const getItemIds = (id: string) => groupById.get(id)?.getItemIds() ?? [];

  // Check if any items have been seen at all.
  const allItemIds = allGroupIds.flatMap(getItemIds);
  const { seen } = selector.getLevelSpeed(allItemIds);
  if (seen === 0) return notStarted(entry.modeId);

  // Preserve definition order for unstarted tie-breaking.
  const idOrder = new Map(entry.groups.map((g, i) => [g.id, i]));
  const result = computeRecommendations(
    selector as RecommendationSelector,
    allGroupIds,
    getItemIds,
    config,
    {
      sortUnstarted: (a, b) =>
        (idOrder.get(a.groupId) ?? 0) - (idOrder.get(b.groupId) ?? 0),
    },
  );

  return classifySkill(entry, result);
}

/** Classify a skill based on its first levelRec type. */
function classifySkill(
  entry: ModeProgressEntry,
  result: ReturnType<typeof computeRecommendations>,
): SkillRecommendation {
  const modeId = entry.modeId;
  const singleGroup = entry.groups.length <= 1;
  const resolve = (v: string | (() => string)) =>
    typeof v === 'function' ? v() : v;
  const labelMap = new Map(
    entry.groups.map((g) => [g.id, resolve(g.longLabel ?? g.label)]),
  );

  if (result.levelRecs.length === 0) {
    return { modeId, type: 'automatic', urgency: 0, cueLabel: '', detail: '' };
  }

  const firstType = result.levelRecs[0].type;

  if (firstType === 'review') {
    const reviewIds = result.levelRecs
      .filter((r) => r.type === 'review')
      .map((r) => r.groupId);
    const detail = singleGroup
      ? 'Review'
      : `Review ${groupLabelText(reviewIds, labelMap)}`;
    return {
      modeId,
      type: 'review',
      urgency: reviewIds.length,
      cueLabel: 'Review',
      detail,
    };
  }

  if (firstType === 'practice') {
    const practiceIds = result.levelRecs
      .filter((r) => r.type === 'practice')
      .map((r) => r.groupId);
    const detail = singleGroup
      ? 'Keep practicing'
      : `Keep practicing ${groupLabelText(practiceIds, labelMap)}`;
    return {
      modeId,
      type: 'keep-practicing',
      urgency: practiceIds.length,
      cueLabel: 'Keep practicing',
      detail,
    };
  }

  if (firstType === 'expand') {
    const expandId = result.expandIndex;
    const detail = singleGroup
      ? 'Learn next level'
      : `Learn ${
        expandId ? (labelMap.get(expandId) ?? expandId) : 'next level'
      }`;
    return {
      modeId,
      type: 'learn-next',
      urgency: 0,
      cueLabel: 'Learn next level',
      detail,
    };
  }

  if (firstType === 'automate') {
    const automateIds = result.levelRecs
      .filter((r) => r.type === 'automate')
      .map((r) => r.groupId);
    const detail = singleGroup
      ? 'Almost there'
      : `Almost there \u2014 ${groupLabelText(automateIds, labelMap)}`;
    return {
      modeId,
      type: 'automate',
      urgency: automateIds.length,
      cueLabel: 'Almost there',
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
  'automate': 3,
  'not-started': 4,
  'automatic': 5,
};

/**
 * Rank skill recommendations and return the top N (default 3).
 * Priority: review > keep-practicing > learn-next > automate.
 * Within a tier, higher urgency wins. "not-started" and "automatic" are
 * excluded unless cold-start applies.
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
      r.type === 'learn-next' || r.type === 'automate',
  );

  if (actionable.length > 0) {
    actionable.sort((a, b) => {
      const pd = TYPE_PRIORITY[a.type] - TYPE_PRIORITY[b.type];
      if (pd !== 0) return pd;
      return b.urgency - a.urgency;
    });
    return actionable.slice(0, maxCount);
  }

  // Any not-started skills → recommend the first one in definition order.
  // Covers both cold start (all not-started) and mixed (some automatic,
  // some not-started) — avoids a misleading "all done" message.
  const notStarted = recommendations.filter((r) => r.type === 'not-started');
  if (notStarted.length > 0) {
    for (const modeId of definitionOrder) {
      const rec = notStarted.find((r) => r.modeId === modeId);
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
