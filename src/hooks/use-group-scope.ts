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

import { useCallback, useMemo, useRef } from 'preact/hooks';
import type {
  AdaptiveSelector,
  RecommendationResult,
  ScopeState,
} from '../types.ts';
import { computeRecommendations } from '../recommendations.ts';
import { buildRecommendationText } from '../mode-ui-state.ts';
import { type ScopeActions, useScopeState } from './use-scope-state.ts';

// ---------------------------------------------------------------------------
// Spec & result types
// ---------------------------------------------------------------------------

/** Configuration for a group-based scope hook. */
export type GroupScopeSpec = {
  /** Raw group array from mode logic (must have a `.label` property). */
  groups: Array<{ label: string }>;
  /** Map group index → item IDs (from mode logic). */
  getItemIdsForGroup: (index: number) => string[];
  /** All valid group indices, e.g. `[0, 1, 2, ...]` (from mode logic). */
  allGroupIndices: number[];
  /** localStorage key for persisting enabled groups. */
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
  /** Scope mutation actions (toggleGroup, setScope, etc.). */
  scopeActions: ScopeActions;
  /** Currently enabled group indices. */
  enabledGroups: ReadonlySet<number>;
  /** All item IDs in enabled groups (memoized). */
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
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGroupScope(spec: GroupScopeSpec): GroupScopeResult {
  // --- Scope state (persisted to localStorage) ---
  const [scope, scopeActions] = useScopeState({
    kind: 'groups',
    groups: spec.groups.map((g, i) => ({
      index: i,
      label: g.label,
      itemIds: spec.getItemIdsForGroup(i),
    })),
    defaultEnabled: spec.defaultEnabled,
    storageKey: spec.storageKey,
    label: spec.scopeLabel,
    sortUnstarted: (a, b) => a.string - b.string,
  });

  const enabledGroups = scope.kind === 'groups'
    ? scope.enabledGroups
    : new Set(spec.defaultEnabled);

  // --- Enabled items (derived from scope) ---
  const enabledItems = useMemo(() => {
    const items: string[] = [];
    for (const g of enabledGroups) {
      items.push(...spec.getItemIdsForGroup(g));
    }
    return items;
  }, [enabledGroups]);

  // --- Practicing label ---
  const practicingLabel = useMemo(
    () => spec.formatLabel(enabledGroups),
    [enabledGroups],
  );

  // --- Recommendations ---
  const recommendation = useMemo((): RecommendationResult => {
    return computeRecommendations(
      spec.selector,
      spec.allGroupIndices,
      spec.getItemIdsForGroup,
      { expansionThreshold: 0.7 },
      { sortUnstarted: (a, b) => a.string - b.string },
    );
  }, [spec.selector]);

  const recommendationText = useMemo(() => {
    return buildRecommendationText(
      recommendation,
      (i: number) => spec.groups[i].label,
    );
  }, [recommendation]);

  const applyRecommendation = useCallback(() => {
    if (recommendation.enabled) {
      scopeActions.setScope({
        kind: 'groups',
        enabledGroups: recommendation.enabled,
      });
    }
  }, [recommendation, scopeActions]);

  // --- Stable ref-backed functions for engineConfig ---
  const enabledItemsRef = useRef(enabledItems);
  enabledItemsRef.current = enabledItems;

  const practicingLabelRef = useRef(practicingLabel);
  practicingLabelRef.current = practicingLabel;

  const getEnabledItems = useCallback(() => enabledItemsRef.current, []);
  const getPracticingLabel = useCallback(
    () => practicingLabelRef.current,
    [],
  );

  return {
    scope,
    scopeActions,
    enabledGroups,
    enabledItems,
    practicingLabel,
    recommendation,
    recommendationText,
    applyRecommendation,
    getEnabledItems,
    getPracticingLabel,
  };
}
