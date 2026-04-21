// Hook: computes progress + recommendations for all skills on the home screen.
// Returns progress (Map<skillId, SkillProgress>) and ranked recommendations,
// recomputed on mount and on navigate-home.

import { useEffect, useMemo, useState } from 'preact/hooks';
import type { MotorTaskType, StorageAdapter } from '../types.ts';
import { storage } from '../storage.ts';
import {
  createAdaptiveSelector,
  createStorageAdapter,
  deriveScaledConfig,
} from '../adaptive.ts';
import {
  SKILL_PROGRESS_MANIFEST,
  type SkillProgressEntry,
} from '../skill-progress-manifest.ts';
import {
  computeProgressColors,
  type ProgressColorInput,
  type ProgressSegment,
} from '../stats-display.ts';
import {
  computeSkillRecommendation,
  rankSkillRecommendations,
  type SkillRecommendation,
} from '../home-recommendations.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SkillProgress = {
  segments: ProgressSegment[]; // one per level (multi-level) or one per item (single-level), sorted descending by speed
  activeLevelCount: number; // active (non-skipped) groups, for rendering empty bars
};

// ---------------------------------------------------------------------------
// Pure computation (no hooks — testable)
// ---------------------------------------------------------------------------

/**
 * Load skipped level IDs from storage.
 * Convention: key = `{namespace}_enabledGroups_skipped`.
 * Only the current string-ID format is supported; legacy numeric entries
 * are ignored (skipped levels from before the string-ID migration will
 * reappear, which is acceptable).
 */
export function loadSkippedLevels(namespace: string): ReadonlySet<string> {
  try {
    // Legacy storage key — uses old "enabledGroups_skipped" naming.
    const raw = storage.getItem(namespace + '_enabledGroups_skipped');
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    const result = new Set<string>();
    for (const entry of parsed) {
      // New format: [[id, reason], ...] with string ID
      if (Array.isArray(entry) && typeof entry[0] === 'string') {
        result.add(entry[0]);
      }
      // Old numeric format is intentionally ignored here — the home screen
      // shows legacy data best-effort, without conversion.
    }
    return result;
  } catch (_) { /* expected */ }
  return new Set();
}

/** Compute progress for a single skill, filtering out skipped levels.
 *  Returns empty segments if no items have been practiced (not started).
 *  `motorBaseline` should be the baseline for this mode's `motorTaskType`. */
export function computeProgressForSkill(
  entry: SkillProgressEntry,
  storage: StorageAdapter,
  motorBaseline: number | null,
  skippedLevels?: ReadonlySet<string>,
): SkillProgress {
  const cfg = motorBaseline !== null
    ? deriveScaledConfig(motorBaseline)
    : undefined;
  const selector = createAdaptiveSelector(
    storage,
    cfg,
    Math.random,
    entry.getResponseCount ?? null,
  );

  const input: ProgressColorInput = entry.levels.length === 1
    ? { kind: 'items', itemIds: entry.allItemIds() }
    : {
      kind: 'levels',
      levels: entry.levels.map((g) => ({
        id: g.id,
        itemIds: g.getItemIds(),
      })),
      skippedLevels,
    };

  // Count active (non-skipped) groups for rendering empty bars
  const activeLevelCount = skippedLevels
    ? entry.levels.filter((g) => !skippedLevels.has(g.id)).length
    : entry.levels.length;

  // Single-group + skipped → not started
  if (entry.levels.length === 1 && skippedLevels?.has(entry.levels[0].id)) {
    return { segments: [], activeLevelCount: 0 };
  }

  return {
    segments: computeProgressColors(selector, input),
    activeLevelCount,
  };
}

/** Baseline lookup by motor task type. */
export type BaselineReader = (taskType: MotorTaskType) => number | null;

/** Compute progress for all skills. Exported for testing.
 *  `getBaseline` resolves the per-task-type motor baseline; accepts either a
 *  lookup function or a scalar (applied to all skills). */
export function computeAllProgress(
  createStorage: (ns: string) => StorageAdapter = createStorageAdapter,
  getBaseline: BaselineReader | number | null = readMotorBaseline,
  getSkipped: (ns: string) => ReadonlySet<string> = loadSkippedLevels,
): Map<string, SkillProgress> {
  const resolveBaseline: BaselineReader = typeof getBaseline === 'function'
    ? getBaseline
    : () => getBaseline;
  const result = new Map<string, SkillProgress>();
  for (const entry of SKILL_PROGRESS_MANIFEST) {
    const skipped = getSkipped(entry.namespace);
    const baseline = resolveBaseline(entry.motorTaskType ?? 'note-button');
    result.set(
      entry.skillId,
      computeProgressForSkill(
        entry,
        createStorage(entry.namespace),
        baseline,
        skipped,
      ),
    );
  }
  return result;
}

// ---------------------------------------------------------------------------
// Recommendation computation (pure, testable)
// ---------------------------------------------------------------------------

/**
 * Compute cross-skill recommendations for starred skills.
 * Returns the ranked top-N recommendations.
 */
export function computeAllRecommendations(
  starred: ReadonlySet<string>,
  createStorage: (ns: string) => StorageAdapter = createStorageAdapter,
  getBaseline: BaselineReader | number | null = readMotorBaseline,
  getSkipped: (ns: string) => ReadonlySet<string> = loadSkippedLevels,
  definitionOrder?: string[],
): SkillRecommendation[] {
  if (starred.size === 0) return [];

  const resolveBaseline: BaselineReader = typeof getBaseline === 'function'
    ? getBaseline
    : () => getBaseline;
  const config = {};
  const perSkill: SkillRecommendation[] = [];

  for (const entry of SKILL_PROGRESS_MANIFEST) {
    if (!starred.has(entry.skillId)) continue;
    const skipped = getSkipped(entry.namespace);
    const baseline = resolveBaseline(entry.motorTaskType ?? 'note-button');
    perSkill.push(
      computeSkillRecommendation(
        entry,
        createStorage(entry.namespace),
        baseline,
        skipped,
        config,
      ),
    );
  }

  const order = definitionOrder ??
    SKILL_PROGRESS_MANIFEST.map((e) => e.skillId);
  return rankSkillRecommendations(perSkill, order);
}

// ---------------------------------------------------------------------------
// storage helpers
// ---------------------------------------------------------------------------

/** Read motor baseline from storage (with NaN guard). */
function readMotorBaseline(
  taskType: MotorTaskType = 'note-button',
): number | null {
  try {
    const raw = storage.getItem('motorBaseline_' + taskType);
    if (raw) {
      const n = Number(raw);
      if (!isNaN(n) && n > 0) return n;
    }
  } catch (_) { /* expected */ }
  return null;
}

// ---------------------------------------------------------------------------
// Combined result type
// ---------------------------------------------------------------------------

export type HomeData = {
  progress: Map<string, SkillProgress>;
  recommendations: SkillRecommendation[];
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Computes progress and recommendations for all skills.
 * Recomputes when the home screen becomes visible or starred set changes.
 */
export function useHomeProgress(
  starred: ReadonlySet<string>,
): HomeData {
  // Refresh counter bumped when home screen becomes visible.
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const el = document.getElementById('home-screen');
    if (!el) return;

    const observer = new MutationObserver(() => {
      if (!el.classList.contains('hidden')) {
        setRefreshKey((k) => k + 1);
      }
    });

    observer.observe(el, { attributes: true, attributeFilter: ['class'] });

    // Also refresh when the app is foregrounded (e.g. after being
    // backgrounded overnight on iOS).  The visibilitychange event fires
    // in both WKWebView (Capacitor) and regular browsers.
    const onVisible = () => {
      if (
        document.visibilityState === 'visible' &&
        !el.classList.contains('hidden')
      ) {
        setRefreshKey((k) => k + 1);
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Recompute when refreshKey or starred changes.
  // useMemo avoids recomputing on every render while still responding to
  // the triggers we care about.
  const starredKey = useMemo(() => [...starred].sort().join(','), [starred]);

  return useMemo(() => {
    const progress = computeAllProgress(
      createStorageAdapter,
      readMotorBaseline,
    );
    const recommendations = computeAllRecommendations(
      starred,
      createStorageAdapter,
      readMotorBaseline,
    );
    return { progress, recommendations };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, starredKey]);
}
