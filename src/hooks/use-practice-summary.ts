// usePracticeSummary — absorbs practice tab boilerplate shared by all modes.
// Owns tab state (practice/progress/about), summary computation,
// and the stats selector adapter. Each mode calls this once and gets everything
// needed for the PracticeTab component.

import { useCallback, useMemo, useState } from 'preact/hooks';
import type {
  AdaptiveSelector,
  PracticeSummaryState,
  RecommendationResult,
} from '../types.ts';
import { computePracticeSummary } from '../mode-ui-state.ts';
import type { StatsViewSelector } from './use-round-summary.ts';
import { useStatsSelector } from './use-round-summary.ts';
import type { QuizEngineHandle } from './use-quiz-engine.ts';
import type { ModeTab } from '../ui/mode-screen.tsx';
import { storage } from '../storage.ts';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export type PracticeSummaryHandle = {
  summary: PracticeSummaryState;
  activeTab: ModeTab;
  setActiveTab: (tab: ModeTab) => void;
  /** Reset tab for mode activation: about on first visit, practice after. */
  resetTabForActivation: () => void;
  statsSel: StatsViewSelector;
};

/**
 * Compute practice summary state + tab controls for a quiz mode.
 *
 * @param modeId Mode identifier — used for the `{modeId}_visited` storage key
 *   that tracks first-visit onboarding (about tab on first open).
 * @param allItems All item IDs in the mode (not just enabled).
 * @param selector Adaptive selector (for speed/freshness lookups).
 * @param engine Quiz engine handle (for mastery text and phase).
 * @param itemNoun "positions" for fretboard, "notes" for speed-tap, "items" for the rest.
 * @param recommendation Precomputed recommendation result (null for no-group modes).
 * @param recommendationText Precomputed recommendation text.
 */
export function usePracticeSummary(opts: {
  modeId: string;
  allItems: string[];
  selector: AdaptiveSelector;
  engine: QuizEngineHandle;
  itemNoun: string;
  recommendation: RecommendationResult | null;
  recommendationText: string;
}): PracticeSummaryHandle {
  const [activeTab, setActiveTab] = useState<ModeTab>('practice');

  const resetTabForActivation = useCallback(() => {
    const key = `${opts.modeId}_visited`;
    if (!storage.getItem(key)) {
      storage.setItem(key, '1');
      // Returning users won't have the _visited key but will have practice
      // data — only show About for genuinely new-to-this-skill users.
      const { seen } = opts.selector.getLevelSpeed(opts.allItems);
      if (seen === 0) {
        setActiveTab('about');
        return;
      }
    }
    // Always open on Practice tab for predictable navigation.
    setActiveTab('practice');
  }, [opts.modeId, opts.selector, opts.allItems]);

  const summary = useMemo(
    () =>
      computePracticeSummary({
        allItemIds: opts.allItems,
        selector: opts.selector,
        itemNoun: opts.itemNoun,
        recommendation: opts.recommendation,
        recommendationText: opts.recommendationText,
        masteryText: opts.engine.state.masteryText,
        showMastery: opts.engine.state.showMastery,
      }),
    [
      opts.selector,
      opts.selector.version,
      opts.recommendation,
      opts.recommendationText,
      opts.engine.state.masteryText,
      opts.engine.state.showMastery,
      opts.engine.state.phase,
      opts.allItems,
      opts.itemNoun,
    ],
  );

  const statsSel = useStatsSelector(
    opts.selector,
    opts.engine.state.phase,
  );

  return {
    summary,
    activeTab,
    setActiveTab,
    resetTabForActivation,
    statsSel,
  };
}
