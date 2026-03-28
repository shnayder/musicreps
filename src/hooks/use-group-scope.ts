// useGroupScope — shared hook for group-based quiz modes.
//
// Combines scope persistence (useScopeState), enabled-item derivation,
// adaptive recommendations (computeRecommendations), and practicing-label
// formatting into a single call.  Six modes use this pattern identically;
// the only variation is the group array, storage key, and label format.
//
// Returns stable ref-backed `getEnabledItems` and `getPracticingLabel`
// functions suitable for engineConfig — they always read current values
// without causing dependency churn on the engineConfig useMemo.

import { useCallback, useMemo, useRef, useState } from 'preact/hooks';
import { storage } from '../storage.ts';
import type {
  AdaptiveSelector,
  GroupStatus,
  RecommendationResult,
  ScopeState,
  SuggestionLine,
} from '../types.ts';
import { computeRecommendations } from '../recommendations.ts';
import {
  buildRecommendationLines,
  buildRecommendationText,
} from '../mode-ui-state.ts';
import type { PracticeMode } from '../ui/practice-config.tsx';
import { type ScopeActions, useScopeState } from './use-scope-state.ts';
import { useNotationVersion } from './use-notation-version.ts';

// ---------------------------------------------------------------------------
// Spec & result types
// ---------------------------------------------------------------------------

/** Configuration for a group-based scope hook. */
export type GroupScopeSpec = {
  /** Raw group array from mode logic (must have a `.label` property). */
  groups: Array<{ label: string | (() => string) }>;
  /** Map group index → item IDs (from mode logic). */
  getItemIdsForGroup: (index: number) => string[];
  /** All valid group indices, e.g. `[0, 1, 2, ...]` (from mode logic). */
  allGroupIndices: number[];
  /** storage key for persisting enabled groups. */
  storageKey: string;
  /** Human label for the scope control, e.g. 'Distances', 'Keys'. */
  scopeLabel: string;
  /** Which groups are enabled by default (e.g. `[0]` or `[0, 1]`). */
  defaultEnabled: number[];
  /** Adaptive selector — used for recommendation computation. */
  selector: AdaptiveSelector;
  /**
   * Format the "practicing X" label from the current enabled groups.
   * Mode-specific because label derivation varies (some modes flatMap
   * groups to sub-items, others use group labels directly).
   */
  formatLabel: (enabledGroups: ReadonlySet<number>) => string;
};

/** Everything a group-based mode needs from scope + recommendations. */
export type GroupScopeResult = {
  /** Raw scope state (for reading `.kind`). */
  scope: ScopeState;
  /** Scope mutation actions (toggleGroup, setScope, skipGroup, etc.). */
  scopeActions: ScopeActions;
  /** Currently enabled group indices (reflects active practice mode). */
  enabledGroups: ReadonlySet<number>;
  /** Currently skipped group indices with skip reason. */
  skippedGroups: ReadonlyMap<number, GroupStatus>;
  /** All item IDs in enabled groups (reflects active practice mode). */
  enabledItems: string[];
  /** Human-readable label for the active scope, e.g. "1–2, 3–4 semitones". */
  practicingLabel: string;
  /** Adaptive recommendation result (memoized). */
  recommendation: RecommendationResult;
  /** Formatted recommendation text for the practice card. */
  recommendationText: string;
  /** Apply the recommendation to the scope (sets enabledGroups). */
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
  /** Group indices from the recommendation's recommended set. */
  suggestedScope: ReadonlySet<number>;
  /** Structured recommendation lines for the SuggestionLines component. */
  suggestionLines: SuggestionLine[];
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const EMPTY_SKIPPED: ReadonlyMap<number, GroupStatus> = new Map();

/** Ref-backed stable getter — identity never changes, always reads current. */
function useStableGetter<T>(value: T): () => T {
  const ref = useRef(value);
  ref.current = value;
  return useCallback(() => ref.current, []);
}

/** Resolve a group label that may be a string or a function. */
function resolveLabel(label: string | (() => string)): string {
  return typeof label === 'function' ? label() : label;
}

/** Persisted practice mode toggle (suggested vs custom). */
function usePracticeMode(
  storageKey: string,
): [PracticeMode, (mode: PracticeMode) => void] {
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
  suggestedScope: ReadonlySet<number>;
  suggestionLines: SuggestionLine[];
  recommendationText: string;
};

/** Compute recommendations, structured lines, and text from active groups. */
function useRecommendationData(
  spec: GroupScopeSpec,
  activeGroupIndices: number[],
  notationVersion: number,
): RecommendationData {
  const recommendation = useMemo(
    (): RecommendationResult =>
      computeRecommendations(
        spec.selector,
        activeGroupIndices,
        spec.getItemIdsForGroup,
        {},
        { sortUnstarted: (a, b) => a.string - b.string },
      ),
    [spec.selector, activeGroupIndices, spec.getItemIdsForGroup],
  );
  const getLabel = useCallback(
    (i: number) => resolveLabel(spec.groups[i].label),
    [spec.groups, notationVersion],
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

export function useGroupScope(spec: GroupScopeSpec): GroupScopeResult {
  const notationVersion = useNotationVersion();
  const [practiceMode, setPracticeMode] = usePracticeMode(spec.storageKey);

  // --- Scope state (persisted to storage) — always reflects custom ---
  const [scope, scopeActions] = useScopeState({
    kind: 'groups',
    groups: spec.groups.map((g, i) => ({
      index: i,
      label: resolveLabel(g.label),
      itemIds: spec.getItemIdsForGroup(i),
    })),
    defaultEnabled: spec.defaultEnabled,
    storageKey: spec.storageKey,
    label: spec.scopeLabel,
    sortUnstarted: (a, b) => a.string - b.string,
  });

  const customGroups = scope.kind === 'groups'
    ? scope.enabledGroups
    : new Set(spec.defaultEnabled);
  const skippedGroups: ReadonlyMap<number, GroupStatus> =
    scope.kind === 'groups' ? scope.skippedGroups : EMPTY_SKIPPED;
  const activeGroupIndices = useMemo(
    () => spec.allGroupIndices.filter((i) => !skippedGroups.has(i)),
    [spec.allGroupIndices, skippedGroups],
  );

  const rec = useRecommendationData(spec, activeGroupIndices, notationVersion);

  // --- Active scope: depends on practice mode ---
  const enabledGroups =
    practiceMode === 'suggested' && rec.suggestedScope.size > 0
      ? rec.suggestedScope
      : customGroups;

  const enabledItems = useMemo(() => {
    const items: string[] = [];
    for (const g of enabledGroups) items.push(...spec.getItemIdsForGroup(g));
    return items;
  }, [enabledGroups, spec.getItemIdsForGroup]);

  const practicingLabel = useMemo(
    () => spec.formatLabel(enabledGroups),
    [enabledGroups, spec.formatLabel, notationVersion],
  );

  const applyRecommendation = useCallback(() => {
    if (rec.recommendation.enabled) {
      scopeActions.setScope({
        kind: 'groups',
        enabledGroups: rec.recommendation.enabled,
        skippedGroups,
      });
    }
  }, [rec.recommendation, scopeActions, skippedGroups]);

  return {
    scope,
    scopeActions,
    enabledGroups,
    skippedGroups,
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
  };
}
