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
  GroupStatus,
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
  /** Scope mutation actions (toggleGroup, setScope, skipGroup, etc.). */
  scopeActions: ScopeActions;
  /** Currently enabled group indices. */
  enabledGroups: ReadonlySet<number>;
  /** Currently skipped group indices with skip reason. */
  skippedGroups: ReadonlyMap<number, GroupStatus>;
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

const EMPTY_SKIPPED: ReadonlyMap<number, GroupStatus> = new Map();

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

  const skippedGroups: ReadonlyMap<number, GroupStatus> =
    scope.kind === 'groups' ? scope.skippedGroups : EMPTY_SKIPPED;

  // Active indices = all indices minus skipped (for recommendations).
  const activeGroupIndices = useMemo(
    () => {
      const result = spec.allGroupIndices.filter((i) => !skippedGroups.has(i));
      console.log(
        '[REC-DEBUG] activeGroupIndices recomputed:',
        result,
        'skipped:',
        [...skippedGroups.keys()],
      );
      return result;
    },
    [spec.allGroupIndices, skippedGroups],
  );

  // --- Enabled items (derived from scope) ---
  const enabledItems = useMemo(() => {
    const items: string[] = [];
    for (const g of enabledGroups) {
      items.push(...spec.getItemIdsForGroup(g));
    }
    return items;
  }, [enabledGroups, spec.getItemIdsForGroup]);

  // --- Practicing label ---
  const practicingLabel = useMemo(
    () => spec.formatLabel(enabledGroups),
    [enabledGroups, spec.formatLabel],
  );

  // --- Recommendations ---
  const recommendation = useMemo((): RecommendationResult => {
    const result = computeRecommendations(
      spec.selector,
      activeGroupIndices,
      spec.getItemIdsForGroup,
      { expansionThreshold: 0.7 },
      { sortUnstarted: (a, b) => a.string - b.string },
    );
    console.log(
      '[REC-DEBUG] recommendation recomputed:',
      'consolidate:',
      result.consolidateIndices,
      'work:',
      result.consolidateWorkingCount,
      'expand:',
      result.expandIndex,
    );
    return result;
  }, [spec.selector, activeGroupIndices, spec.getItemIdsForGroup]);

  const recommendationText = useMemo(() => {
    const text = buildRecommendationText(
      recommendation,
      (i: number) => spec.groups[i].label,
    );
    console.log(
      '[REC-DEBUG] recommendationText recomputed:',
      JSON.stringify(text),
    );
    return text;
  }, [recommendation]);

  const applyRecommendation = useCallback(() => {
    if (recommendation.enabled) {
      scopeActions.setScope({
        kind: 'groups',
        enabledGroups: recommendation.enabled,
        skippedGroups,
      });
    }
  }, [recommendation, scopeActions, skippedGroups]);

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
    skippedGroups,
    enabledItems,
    practicingLabel,
    recommendation,
    recommendationText,
    applyRecommendation,
    getEnabledItems,
    getPracticingLabel,
  };
}
