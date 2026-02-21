// useRoundSummary — derived display values for the round-complete screen
// and quiz session header. Replaces ~45 identical lines in each mode.

import { useMemo } from 'preact/hooks';
import type { AdaptiveSelector, ItemStats } from '../types.ts';
import type { QuizEngineHandle } from './use-quiz-engine.ts';
import type { LearnerModel } from './use-learner-model.ts';
import { computeMedian } from '../adaptive.ts';

// ---------------------------------------------------------------------------
// Stats selector — minimal adapter from AdaptiveSelector to StatsSelector
// ---------------------------------------------------------------------------

export type StatsViewSelector = {
  getAutomaticity(id: string): number | null;
  getStats(id: string): ItemStats | null;
};

/**
 * Create a memoized stats selector adapter from a learner model.
 * Re-evaluates when the engine phase changes (so stats refresh after answers)
 * or when the stats display mode toggles.
 */
export function useStatsSelector(
  selector: AdaptiveSelector,
  enginePhase: string,
  statsMode: string,
): StatsViewSelector {
  return useMemo((): StatsViewSelector => ({
    getAutomaticity: (id: string) => selector.getAutomaticity(id),
    getStats: (id: string) => selector.getStats(id),
  }), [selector, enginePhase, statsMode]);
}

// ---------------------------------------------------------------------------
// Round summary
// ---------------------------------------------------------------------------

export type RoundSummary = {
  /** Context line: "practicing label · X / Y fluent". */
  roundContext: string;
  /** Accuracy line: "8 / 10 correct · 42s". */
  roundCorrect: string;
  /** Median line: "1.2s median response time" or empty. */
  roundMedian: string;
  /** Baseline info: "Response time baseline: 1.3s". */
  baselineText: string;
  /** Answer count: "5 answers". */
  countText: string;
};

/**
 * Compute derived display strings for the quiz session header and
 * round-complete screen. Pure computation from engine state + learner.
 *
 * @param engine     Quiz engine handle (for round stats, mastery counts).
 * @param learner    Learner model (for motor baseline).
 * @param practicingLabel  What the user is currently practicing, e.g.
 *   "±1–2, ±3–4 semitones" or "all items". Shown in the round context line.
 */
export function useRoundSummary(
  engine: QuizEngineHandle,
  learner: LearnerModel,
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
    return s.roundCorrect + ' / ' + s.roundAnswered + ' correct \u00B7 ' +
      dur + 's';
  }, [
    engine.state.roundCorrect,
    engine.state.roundAnswered,
    engine.state.roundDurationMs,
  ]);

  const roundMedian = useMemo(() => {
    const times = engine.state.roundResponseTimes;
    const median = computeMedian(times);
    return median !== null
      ? (median / 1000).toFixed(1) + 's median response time'
      : '';
  }, [engine.state.roundResponseTimes]);

  const baselineText = learner.motorBaseline
    ? 'Response time baseline: ' +
      (learner.motorBaseline / 1000).toFixed(1) + 's'
    : 'Response time baseline: 1s (default)';

  const answerCount = engine.state.roundAnswered;
  const countText = answerCount +
    (answerCount === 1 ? ' answer' : ' answers');

  return { roundContext, roundCorrect, roundMedian, baselineText, countText };
}
