// Cross-skill recommendation engine for the home screen.
// Classifies each starred skill and ranks the top 3 for display.

import {
  computeRecommendations,
  type RecommendationSelector,
} from './recommendations.ts';
import type { SkillProgressEntry } from './skill-progress-manifest.ts';
import type { StorageAdapter } from './types.ts';
import { createAdaptiveSelector, deriveScaledConfig } from './adaptive.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SkillRecommendationType =
  | 'review'
  | 'practice'
  | 'start'
  | 'not-started'
  | 'automatic';

export type SkillRecommendation = {
  skillId: string;
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

/** Build the "not-started" result for a skill. */
function notStarted(skillId: string): SkillRecommendation {
  return { skillId, type: 'not-started', urgency: 0, cueLabel: '', detail: '' };
}

/** Format level labels from an array of level IDs and a label map. */
function levelLabelText(
  levelIds: string[],
  labelMap: Map<string, string>,
): string {
  return levelIds.map((id) => labelMap.get(id) ?? id).join(', ');
}

/**
 * Classify a single skill's recommendation state.
 * Uses the same computeRecommendations pipeline as in-skill display.
 */
export function computeSkillRecommendation(
  entry: SkillProgressEntry,
  storage: StorageAdapter,
  motorBaseline: number | null,
  skippedLevels: ReadonlySet<string>,
  config: { maxWorkItems?: number },
): SkillRecommendation {
  const cfg = motorBaseline !== null
    ? deriveScaledConfig(motorBaseline)
    : undefined;
  const selector = createAdaptiveSelector(
    storage,
    cfg,
    Math.random,
    entry.getResponseCount ?? null,
  );

  // Build active level IDs (all minus skipped).
  const allLevelIds: string[] = entry.levels
    .filter((g) => !skippedLevels.has(g.id))
    .map((g) => g.id);
  if (allLevelIds.length === 0) return notStarted(entry.skillId);

  // O(1) lookups by level ID.
  const levelById = new Map(entry.levels.map((g) => [g.id, g]));
  const getItemIds = (id: string) => levelById.get(id)?.getItemIds() ?? [];

  // Check if any items have been seen at all.
  const allItemIds = allLevelIds.flatMap(getItemIds);
  const { seen } = selector.getLevelSpeed(allItemIds);
  if (seen === 0) return notStarted(entry.skillId);

  // Preserve definition order for unstarted tie-breaking.
  const idOrder = new Map(entry.levels.map((g, i) => [g.id, i]));
  const result = computeRecommendations(
    selector as RecommendationSelector,
    allLevelIds,
    getItemIds,
    config,
    {
      sortUnstarted: (a, b) =>
        (idOrder.get(a.levelId) ?? 0) - (idOrder.get(b.levelId) ?? 0),
    },
  );

  return classifySkill(entry, result);
}

/** Classify a skill based on its levelRec types. */
function classifySkill(
  entry: SkillProgressEntry,
  result: ReturnType<typeof computeRecommendations>,
): SkillRecommendation {
  const skillId = entry.skillId;
  const singleLevel = entry.levels.length <= 1;
  const resolve = (v: string | (() => string)) =>
    typeof v === 'function' ? v() : v;
  const labelMap = new Map(
    entry.levels.map((g) => [g.id, resolve(g.longLabel ?? g.label)]),
  );

  if (result.levelRecs.length === 0) {
    return { skillId, type: 'automatic', urgency: 0, cueLabel: '', detail: '' };
  }

  // Review and practice are a single tier (interleaved by level order),
  // so check for any review recs rather than just the first rec type.
  const reviewIds = result.levelRecs
    .filter((r) => r.type === 'review')
    .map((r) => r.levelId);

  if (reviewIds.length > 0) {
    const detail = singleLevel
      ? 'Review'
      : `Review ${levelLabelText(reviewIds, labelMap)}`;
    return {
      skillId,
      type: 'review',
      urgency: reviewIds.length,
      cueLabel: 'Review',
      detail,
    };
  }

  const firstType = result.levelRecs[0].type;

  if (firstType === 'practice' || firstType === 'automate') {
    const practiceIds = result.levelRecs
      .filter((r) => r.type === 'practice' || r.type === 'automate')
      .map((r) => r.levelId);
    const detail = singleLevel
      ? 'Practice'
      : `Practice ${levelLabelText(practiceIds, labelMap)}`;
    return {
      skillId,
      type: 'practice',
      urgency: practiceIds.length,
      cueLabel: 'Practice',
      detail,
    };
  }

  if (firstType === 'expand') {
    const expandId = result.expandIndex;
    const detail = singleLevel
      ? 'Start'
      : `Start ${
        expandId ? (labelMap.get(expandId) ?? expandId) : 'next level'
      }`;
    return {
      skillId,
      type: 'start',
      urgency: 0,
      cueLabel: 'Start',
      detail,
    };
  }

  return { skillId, type: 'automatic', urgency: 0, cueLabel: '', detail: '' };
}

// ---------------------------------------------------------------------------
// Cross-skill ranking
// ---------------------------------------------------------------------------

const TYPE_PRIORITY: Record<SkillRecommendationType, number> = {
  'review': 0,
  'practice': 1,
  'start': 2,
  'not-started': 3,
  'automatic': 4,
};

/**
 * Rank skill recommendations and return the top N (default 3).
 * Priority: review > practice > start.
 * Within a tier, higher urgency wins. "not-started" and "automatic" are
 * excluded unless cold-start applies.
 *
 * @param definitionOrder Skill IDs in definition order, used for cold-start
 *   tie-breaking when all skills are not-started.
 */
export function rankSkillRecommendations(
  recommendations: SkillRecommendation[],
  definitionOrder: string[],
  maxCount: number = 3,
): SkillRecommendation[] {
  // Filter to actionable types.
  const actionable = recommendations.filter(
    (r) => r.type === 'review' || r.type === 'practice' || r.type === 'start',
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
    for (const skillId of definitionOrder) {
      const rec = notStarted.find((r) => r.skillId === skillId);
      if (rec) {
        return [{
          ...rec,
          type: 'start',
          cueLabel: 'Ready to start',
          detail: 'Ready to start',
        }];
      }
    }
  }

  // All automatic → empty (triggers "all done" state).
  return [];
}
