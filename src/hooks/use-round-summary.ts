// useRoundSummary — derived display values for the round-complete screen
// and quiz session header. Replaces ~45 identical lines in each mode.

import { useMemo } from 'preact/hooks';
import type { AdaptiveSelector, ItemStats } from '../types.ts';
import type { QuizEngineHandle } from './use-quiz-engine.ts';

// ---------------------------------------------------------------------------
// Stats selector — minimal adapter from AdaptiveSelector to StatsSelector
// ---------------------------------------------------------------------------

export type StatsViewSelector = {
  getAutomaticity(id: string): number | null;
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
    getAutomaticity: (id: string) => selector.getAutomaticity(id),
    getStats: (id: string) => selector.getStats(id),
    getSpeedScore: (id: string) => selector.getSpeedScore(id),
    getFreshness: (id: string) => selector.getFreshness(id),
  }), [selector, enginePhase]);
}

// ---------------------------------------------------------------------------
// Round summary
// ---------------------------------------------------------------------------

export type RoundSummary = {
  /** Context line: "practicing label . X / Y fluent". */
  roundContext: string;
  /** Accuracy line: "8 correct . 42s". */
  roundCorrect: string;
  /** Answer count: "5 answers". */
  countText: string;
};

/**
 * Compute derived display strings for the quiz session header and
 * round-complete screen. Pure computation from engine state.
 *
 * @param engine     Quiz engine handle (for round stats, mastery counts).
 * @param practicingLabel  What the user is currently practicing, e.g.
 *   "+/-1-2, +/-3-4 semitones" or "all items". Shown in the round context line.
 */
export function useRoundSummary(
  engine: QuizEngineHandle,
  practicingLabel: string,
): RoundSummary {
  const roundContext = useMemo(() => {
    const s = engine.state;
    const fluency = s.masteredCount + ' / ' + s.totalEnabledCount + ' fluent';
    return practicingLabel + ' \u00B7 ' + fluency;
  }, [
    engine.state.masteredCount,
    engine.state.totalEnabledCount,
    practicingLabel,
  ]);

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
    (answerCount === 1 ? ' answer' : ' answers');

  return { roundContext, roundCorrect, countText };
}
