// usePracticeSummary — absorbs practice tab boilerplate shared by all 10 modes.
// Owns tab state (practice/progress), summary computation,
// and the stats selector adapter. Each mode calls this once and gets everything
// needed for the PracticeTab component.

import { useMemo, useState } from 'preact/hooks';
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

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export type PracticeSummaryHandle = {
  summary: PracticeSummaryState;
  activeTab: ModeTab;
  setActiveTab: (tab: ModeTab) => void;
  statsSel: StatsViewSelector;
};

/**
 * Compute practice summary state + tab controls for a quiz mode.
 *
 * @param allItems All item IDs in the mode (not just enabled).
 * @param selector Adaptive selector (for speed/freshness lookups).
 * @param engine Quiz engine handle (for mastery text and phase).
 * @param itemNoun "positions" for fretboard, "notes" for speed-tap, "items" for the rest.
 * @param recommendation Precomputed recommendation result (null for no-group modes).
 * @param recommendationText Precomputed recommendation text.
 */
export function usePracticeSummary(opts: {
  allItems: string[];
  selector: AdaptiveSelector;
  engine: QuizEngineHandle;
  itemNoun: string;
  recommendation: RecommendationResult | null;
  recommendationText: string;
}): PracticeSummaryHandle {
  const [activeTab, setActiveTab] = useState<ModeTab>('practice');

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
    statsSel,
  };
}
