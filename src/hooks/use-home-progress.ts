// Hook: computes progress + recommendations for all modes on the home screen.
// Returns progress (Map<modeId, ModeProgress>) and ranked recommendations,
// recomputed on mount and on navigate-home.

import { useEffect, useMemo, useState } from 'preact/hooks';
import type { StorageAdapter } from '../types.ts';
import { storage } from '../storage.ts';
import {
  createAdaptiveSelector,
  createStorageAdapter,
  deriveScaledConfig,
} from '../adaptive.ts';
import {
  MODE_PROGRESS_MANIFEST,
  type ModeProgressEntry,
} from '../mode-progress-manifest.ts';
import {
  type GroupBarSegment,
  progressBarColors,
  progressBarGroupSegment,
} from '../stats-display.ts';
import {
  computeSkillRecommendation,
  rankSkillRecommendations,
  type SkillRecommendation,
} from '../home-recommendations.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModeProgress = {
  groupColors: string[]; // one HSL string per group, sorted descending by speed
};

// ---------------------------------------------------------------------------
// Pure computation (no hooks — testable)
// ---------------------------------------------------------------------------

/**
 * Load skipped group indices from storage.
 * Convention: key = `{namespace}_enabledGroups_skipped`.
 * Format: [[index, reason], ...] where reason is 'mastered' | 'deferred'.
 */
export function loadSkippedGroups(namespace: string): ReadonlySet<number> {
  try {
    const raw = storage.getItem(namespace + '_enabledGroups_skipped');
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    const result = new Set<number>();
    for (const entry of parsed) {
      // New format: [[index, reason], ...]
      if (Array.isArray(entry) && typeof entry[0] === 'number') {
        result.add(entry[0]);
      } else if (typeof entry === 'number') {
        // Old format: [index, ...]
        result.add(entry);
      }
    }
    return result;
  } catch (_) { /* expected */ }
  return new Set();
}

/** Compute progress for a single mode, filtering out skipped groups.
 *  Returns empty groupColors if no items have been practiced (not started). */
export function computeProgressForMode(
  entry: ModeProgressEntry,
  storage: StorageAdapter,
  motorBaseline: number | null,
  skippedGroups?: ReadonlySet<number>,
): ModeProgress {
  const cfg = motorBaseline !== null
    ? deriveScaledConfig(motorBaseline)
    : undefined;
  const selector = createAdaptiveSelector(storage, cfg);

  // Single-group modes: per-item colors to match the skill screen
  // (which uses progressBarColors for non-group scopes).
  if (entry.groups.length === 1) {
    if (skippedGroups?.has(0)) return { groupColors: [] };
    const ids = entry.allItemIds();
    const anySeen = ids.some((id) => selector.getSpeedScore(id) !== null);
    if (!anySeen) return { groupColors: [] };
    return { groupColors: progressBarColors(selector, ids) };
  }

  // Multi-group modes: one segment per group, then sort.
  const segments: GroupBarSegment[] = [];
  for (let i = 0; i < entry.groups.length; i++) {
    if (skippedGroups?.has(i)) continue;
    segments.push(
      progressBarGroupSegment(selector, entry.groups[i].getItemIds()),
    );
  }

  // All groups skipped or all unseen → not started
  if (segments.length === 0 || segments.every((s) => s.zone === 2)) {
    return { groupColors: [] };
  }

  segments.sort((a, b) => {
    if (a.zone !== b.zone) return a.zone - b.zone;
    return b.speed - a.speed;
  });
  return { groupColors: segments.map((s) => s.color) };
}

/** Compute progress for all modes. Exported for testing. */
export function computeAllProgress(
  createStorage: (ns: string) => StorageAdapter = createStorageAdapter,
  motorBaseline: number | null = null,
  getSkipped: (ns: string) => ReadonlySet<number> = loadSkippedGroups,
): Map<string, ModeProgress> {
  const result = new Map<string, ModeProgress>();
  for (const entry of MODE_PROGRESS_MANIFEST) {
    const skipped = getSkipped(entry.namespace);
    result.set(
      entry.modeId,
      computeProgressForMode(
        entry,
        createStorage(entry.namespace),
        motorBaseline,
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
 * Compute cross-skill recommendations for starred modes.
 * Returns the ranked top-N recommendations.
 */
export function computeAllRecommendations(
  starred: ReadonlySet<string>,
  createStorage: (ns: string) => StorageAdapter = createStorageAdapter,
  motorBaseline: number | null = null,
  getSkipped: (ns: string) => ReadonlySet<number> = loadSkippedGroups,
  definitionOrder?: string[],
): SkillRecommendation[] {
  if (starred.size === 0) return [];

  const config = {};
  const perSkill: SkillRecommendation[] = [];

  for (const entry of MODE_PROGRESS_MANIFEST) {
    if (!starred.has(entry.modeId)) continue;
    const skipped = getSkipped(entry.namespace);
    perSkill.push(
      computeSkillRecommendation(
        entry,
        createStorage(entry.namespace),
        motorBaseline,
        skipped,
        config,
      ),
    );
  }

  const order = definitionOrder ??
    MODE_PROGRESS_MANIFEST.map((e) => e.modeId);
  return rankSkillRecommendations(perSkill, order);
}

// ---------------------------------------------------------------------------
// storage helpers
// ---------------------------------------------------------------------------

/** Read motor baseline from storage (with NaN guard). */
function readMotorBaseline(): number | null {
  try {
    const raw = storage.getItem('motorBaseline_note-button');
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
  progress: Map<string, ModeProgress>;
  recommendations: SkillRecommendation[];
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Computes progress and recommendations for all modes.
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
    return () => observer.disconnect();
  }, []);

  // Recompute when refreshKey or starred changes.
  // useMemo avoids recomputing on every render while still responding to
  // the triggers we care about.
  const starredKey = useMemo(() => [...starred].sort().join(','), [starred]);

  return useMemo(() => {
    const baseline = readMotorBaseline();
    const progress = computeAllProgress(
      createStorageAdapter,
      baseline,
    );
    const recommendations = computeAllRecommendations(
      starred,
      createStorageAdapter,
      baseline,
    );
    return { progress, recommendations };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, starredKey]);
}
