// useLevelScope — shared hook for level-based quiz skills.
//
// Combines scope persistence (useScopeState), enabled-item derivation,
// adaptive recommendations (computeRecommendations), and practicing-label
// formatting into a single call.  Six skills use this pattern identically;
// the only variation is the level array, storage key, and label format.
//
// Returns stable ref-backed `getEnabledItems` and `getPracticingLabel`
// functions suitable for engineConfig — they always read current values
// without causing dependency churn on the engineConfig useMemo.

import { useCallback, useMemo, useRef, useState } from 'preact/hooks';
import { storage } from '../storage.ts';
import {
  createScopeLock,
  nextScopeLockState,
  readScope,
  type ScopeLock,
} from '../scope-lock.ts';
import type {
  AdaptiveSelector,
  LevelStatus,
  RecommendationResult,
  ScopeState,
  SuggestionLine,
} from '../types.ts';
import { computeRecommendations } from '../recommendations.ts';
import {
  buildRecommendationLines,
  buildRecommendationText,
} from '../skill-ui-state.ts';
import type { PracticeMode } from '../ui/practice-config.tsx';
import { type ScopeActions, useScopeState } from './use-scope-state.ts';
import { useNotationVersion } from './use-notation-version.ts';

// ---------------------------------------------------------------------------
// Spec & result types
// ---------------------------------------------------------------------------

/** Configuration for a level-based scope hook. */
export type LevelScopeSpec = {
  /** Raw level array from skill logic (must have `.id` and `.label` properties). */
  levels: Array<
    {
      id: string;
      label: string | (() => string);
      longLabel?: string | (() => string);
    }
  >;
  /** Map level ID → item IDs (from mode logic). */
  getItemIdsForLevel: (id: string) => string[];
  /** All valid level IDs (from mode logic). */
  allLevelIds: string[];
  /** storage key for persisting enabled levels. */
  storageKey: string;
  /** Human label for the scope control, e.g. 'Distances', 'Keys'. */
  scopeLabel: string;
  /** Which levels are enabled by default. */
  defaultEnabled: string[];
  /** Adaptive selector — used for recommendation computation. */
  selector: AdaptiveSelector;
  /**
   * Format the "practicing X" label from the current enabled levels.
   * Mode-specific because label derivation varies (some modes flatMap
   * levels to sub-items, others use level labels directly).
   */
  formatLabel: (enabledLevels: ReadonlySet<string>) => string;
};

/** Everything a level-based skill needs from scope + recommendations. */
export type LevelScopeResult = {
  /** Raw scope state (for reading `.kind`). */
  scope: ScopeState;
  /** Scope mutation actions (toggleLevel, setScope, skipGroup, etc.). */
  scopeActions: ScopeActions;
  /** Currently enabled level IDs (reflects active practice mode). */
  enabledLevels: ReadonlySet<string>;
  /** Currently skipped level IDs with skip reason. */
  skippedLevels: ReadonlyMap<string, LevelStatus>;
  /** All item IDs in enabled levels (reflects active practice mode). */
  enabledItems: string[];
  /** Human-readable label for the active scope, e.g. "1–2, 3–4 semitones". */
  practicingLabel: string;
  /** Adaptive recommendation result (memoized). */
  recommendation: RecommendationResult;
  /** Formatted recommendation text for the practice card. */
  recommendationText: string;
  /** Apply the recommendation to the scope (sets enabledLevels). */
  applyRecommendation: () => void;
  /**
   * Stable function returning current enabled items.
   * Ref-backed — identity never changes. Safe for engineConfig without
   * adding scope to the dependency array.
   */
  getEnabledItems: () => string[];
  /**
   * Stable function returning current practicing label.
   * Same ref-backing as getEnabledItems.
   */
  getPracticingLabel: () => string;
  /** Current practice mode: 'suggested' uses recommendation, 'custom' uses user scope. */
  practiceMode: PracticeMode;
  /** Switch between suggested and custom practice modes. */
  setPracticeMode: (mode: PracticeMode) => void;
  /** Level IDs from the recommendation's recommended set. */
  suggestedScope: ReadonlySet<string>;
  /** Structured recommendation lines for the SuggestionLines component. */
  suggestionLines: SuggestionLine[];
  /**
   * Freeze or unfreeze the active scope. While locked, `enabledLevels`,
   * `enabledItems`, `practicingLabel`, `getEnabledItems`, and
   * `getPracticingLabel` all return the snapshot captured at the moment of
   * locking — even if the underlying recommendation changes. Callers lock
   * when a round starts and unlock when the round ends (or when returning
   * to idle) so that the set of levels being practiced stays fixed
   * mid-round.
   */
  setScopeLocked: (locked: boolean) => void;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const EMPTY_SKIPPED: ReadonlyMap<string, LevelStatus> = new Map();

/** Ref-backed stable getter — identity never changes, always reads current. */
function useStableGetter<T>(value: T): () => T {
  const ref = useRef(value);
  ref.current = value;
  return useCallback(() => ref.current, []);
}

/** Resolve a level label that may be a string or a function. */
function resolveLabel(label: string | (() => string)): string {
  return typeof label === 'function' ? label() : label;
}

/** Persisted practice mode toggle (suggested vs custom). */
function usePracticeMode(
  storageKey: string,
): [PracticeMode, (mode: PracticeMode) => void] {
  // Legacy storage key — appends "_practiceMode" to old "enabledGroups" key.
  const pmKey = storageKey + '_practiceMode';
  const [mode, setModeRaw] = useState<PracticeMode>(() => {
    try {
      return storage.getItem(pmKey) === 'custom' ? 'custom' : 'suggested';
    } catch {
      return 'suggested';
    }
  });
  const setMode = useCallback((m: PracticeMode) => {
    setModeRaw(m);
    try {
      storage.setItem(pmKey, m);
    } catch { /* expected */ }
  }, [pmKey]);
  return [mode, setMode];
}

type RecommendationData = {
  recommendation: RecommendationResult;
  suggestedScope: ReadonlySet<string>;
  suggestionLines: SuggestionLine[];
  recommendationText: string;
};

/** Compute recommendations, structured lines, and text from active levels. */
function useRecommendationData(
  spec: LevelScopeSpec,
  activeLevelIds: string[],
  notationVersion: number,
): RecommendationData {
  // Build a stable position map for sortUnstarted tie-breaking.
  const idOrder = useMemo(
    () => new Map(spec.allLevelIds.map((id, i) => [id, i])),
    [spec.allLevelIds],
  );
  const recommendation = useMemo(
    (): RecommendationResult =>
      computeRecommendations(
        spec.selector,
        activeLevelIds,
        spec.getItemIdsForLevel,
        {},
        {
          sortUnstarted: (a, b) =>
            (idOrder.get(a.levelId) ?? 0) - (idOrder.get(b.levelId) ?? 0),
        },
      ),
    [
      spec.selector,
      spec.selector.version,
      activeLevelIds,
      spec.getItemIdsForLevel,
      idOrder,
    ],
  );
  const getLabel = useCallback(
    (id: string) => {
      const g = spec.levels.find((g) => g.id === id);
      if (!g) return id;
      return resolveLabel(g.longLabel ?? g.label);
    },
    [spec.levels, notationVersion],
  );
  const suggestionLines = useMemo(
    () => buildRecommendationLines(recommendation, getLabel),
    [recommendation, getLabel],
  );
  const recommendationText = useMemo(
    () => buildRecommendationText(recommendation, getLabel),
    [recommendation, getLabel],
  );
  return {
    recommendation,
    suggestedScope: recommendation.recommended,
    suggestionLines,
    recommendationText,
  };
}

export function useLevelScope(spec: LevelScopeSpec): LevelScopeResult {
  const notationVersion = useNotationVersion();
  const [practiceMode, setPracticeMode] = usePracticeMode(spec.storageKey);

  // --- Scope state (persisted to storage) — always reflects custom ---
  const [scope, scopeActions] = useScopeState({
    kind: 'levels',
    levels: spec.levels.map((g) => ({
      id: g.id,
      label: resolveLabel(g.label),
      itemIds: spec.getItemIdsForLevel(g.id),
    })),
    defaultEnabled: spec.defaultEnabled,
    storageKey: spec.storageKey,
    label: spec.scopeLabel,
  });

  const customLevels: ReadonlySet<string> = scope.kind === 'levels'
    ? scope.enabledLevels
    : new Set(spec.defaultEnabled);
  const skippedLevels: ReadonlyMap<string, LevelStatus> =
    scope.kind === 'levels' ? scope.skippedLevels : EMPTY_SKIPPED;
  const activeLevelIds = useMemo(
    () => spec.allLevelIds.filter((id) => !skippedLevels.has(id)),
    [spec.allLevelIds, skippedLevels],
  );

  const rec = useRecommendationData(spec, activeLevelIds, notationVersion);

  // --- Active scope: depends on practice mode ---
  const liveEnabledLevels: ReadonlySet<string> =
    practiceMode === 'suggested' && rec.suggestedScope.size > 0
      ? rec.suggestedScope
      : customLevels;

  // --- Lock: freeze active scope during a round -------------------------
  // See scope-lock.ts. The engine calls `setScopeLocked(true)` when a round
  // starts and `setScopeLocked(false)` on return to idle, so the set of
  // levels being practiced stays stable even as `selector.version` bumps
  // cause recommendations to recompute mid-round.
  const liveEnabledLevelsRef = useRef(liveEnabledLevels);
  liveEnabledLevelsRef.current = liveEnabledLevels;
  const [scopeLock, setScopeLock] = useState<ScopeLock<ReadonlySet<string>>>(
    createScopeLock,
  );
  const setScopeLocked = useCallback((locked: boolean) => {
    setScopeLock((prev) =>
      nextScopeLockState(prev, locked, liveEnabledLevelsRef.current)
    );
  }, []);
  const enabledLevels = readScope(scopeLock, liveEnabledLevels);

  const enabledItems = useMemo(() => {
    const items: string[] = [];
    for (const id of spec.allLevelIds) {
      if (enabledLevels.has(id)) items.push(...spec.getItemIdsForLevel(id));
    }
    return items;
  }, [enabledLevels, spec.allLevelIds, spec.getItemIdsForLevel]);

  const practicingLabel = useMemo(
    () => spec.formatLabel(enabledLevels),
    [enabledLevels, spec.formatLabel, notationVersion],
  );

  const applyRecommendation = useCallback(() => {
    if (rec.recommendation.enabled) {
      scopeActions.setScope({
        kind: 'levels',
        enabledLevels: rec.recommendation.enabled,
        skippedLevels,
      });
    }
  }, [rec.recommendation, scopeActions, skippedLevels]);

  return {
    scope,
    scopeActions,
    enabledLevels,
    skippedLevels,
    enabledItems,
    practicingLabel,
    recommendation: rec.recommendation,
    recommendationText: rec.recommendationText,
    applyRecommendation,
    getEnabledItems: useStableGetter(enabledItems),
    getPracticingLabel: useStableGetter(practicingLabel),
    practiceMode,
    setPracticeMode,
    suggestedScope: rec.suggestedScope,
    suggestionLines: rec.suggestionLines,
    setScopeLocked,
  };
}
