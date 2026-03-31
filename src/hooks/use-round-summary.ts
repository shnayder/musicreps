// useRoundSummary — derived display values for the round-complete screen
// and quiz session header. Replaces ~45 identical lines in each mode.

import { useMemo } from 'preact/hooks';
import type { AdaptiveSelector, ItemStats } from '../types.ts';
import type { QuizEngineHandle } from './use-quiz-engine.ts';

// ---------------------------------------------------------------------------
// Stats selector — minimal adapter from AdaptiveSelector to StatsSelector
// ---------------------------------------------------------------------------

export type StatsViewSelector = {
  getStats(id: string): ItemStats | null;
  getSpeedScore(id: string): number | null;
  getFreshness(id: string): number | null;
};

/**
 * Create a memoized stats selector adapter from a learner model.
 * Re-evaluates when the engine phase changes (so stats refresh after answers).
 */
export function useStatsSelector(
  selector: AdaptiveSelector,
  enginePhase: string,
): StatsViewSelector {
  return useMemo((): StatsViewSelector => ({
    getStats: (id: string) => selector.getStats(id),
    getSpeedScore: (id: string) => selector.getSpeedScore(id),
    getFreshness: (id: string) => selector.getFreshness(id),
  }), [selector, enginePhase]);
}

// ---------------------------------------------------------------------------
// Round summary
// ---------------------------------------------------------------------------

export type RoundSummary = {
  /** Accuracy line: "8 correct . 42s". */
  roundCorrect: string;
  /** Rep count: "5 reps". */
  countText: string;
  /** Numeric-only count for compact display: "5". */
  countLabel: string;
};

/**
 * Compute derived display strings for the quiz session header and
 * round-complete screen. Pure computation from engine state.
 *
 * @param engine     Quiz engine handle (for round stats, mastery counts).
 */
export function useRoundSummary(
  engine: QuizEngineHandle,
): RoundSummary {
  const roundCorrect = useMemo(() => {
    const s = engine.state;
    const dur = Math.round((s.roundDurationMs || 0) / 1000);
    return s.roundCorrect + ' correct \u00B7 ' + dur + 's';
  }, [
    engine.state.roundCorrect,
    engine.state.roundDurationMs,
  ]);

  const answerCount = engine.state.roundAnswered;
  const countText = answerCount +
    (answerCount === 1 ? ' rep' : ' reps');
  const countLabel = String(answerCount);

  return { roundCorrect, countText, countLabel };
}
