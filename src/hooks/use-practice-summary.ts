// usePracticeSummary — absorbs practice tab boilerplate shared by all skills.
// Owns tab state (practice/progress/about), summary computation,
// and the stats selector adapter. Each skill calls this once and gets everything
// needed for the PracticeTab component.

import { useCallback, useMemo, useState } from 'preact/hooks';
import type {
  AdaptiveSelector,
  PracticeSummaryState,
  RecommendationResult,
} from '../types.ts';
import { computePracticeSummary } from '../skill-ui-state.ts';
import type { StatsViewSelector } from './use-round-summary.ts';
import { useStatsSelector } from './use-round-summary.ts';
import type { QuizEngineHandle } from './use-quiz-engine.ts';
import type { SkillTab } from '../ui/skill-screen.tsx';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export type PracticeSummaryHandle = {
  summary: PracticeSummaryState;
  activeTab: SkillTab;
  setActiveTab: (tab: SkillTab) => void;
  /** Reset tab to practice when skill is activated. */
  resetTabForActivation: () => void;
  statsSel: StatsViewSelector;
};

/**
 * Compute practice summary state + tab controls for a quiz skill.
 *
 * @param allItems All item IDs in the skill (not just enabled).
 * @param selector Adaptive selector (for speed/freshness lookups).
 * @param engine Quiz engine handle (for mastery text and phase).
 * @param itemNoun "positions" for fretboard, "notes" for speed-tap, "items" for the rest.
 * @param recommendation Precomputed recommendation result (null for no-level skills).
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
  const [activeTab, setActiveTab] = useState<SkillTab>('practice');

  const resetTabForActivation = useCallback(() => {
    // Always open on Practice tab for predictable navigation.
    setActiveTab('practice');
  }, []);

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
