// useMultiTapInput — handles multi-tap quiz modes.
// Manages a set of tapped positions (no duplicates), evaluates all at once
// after the expected count is reached, and resets on question change.
// Parallel to useSequentialInput but with set semantics (order doesn't matter).

import { useCallback, useRef, useState } from 'preact/hooks';
import type { ModeDefinition, MultiTapEvalResult } from './types.ts';

export type MultiTapInputHandle = {
  /** Set of tapped position keys (for rendering highlights). */
  tappedPositions: ReadonlySet<string>;
  /** Evaluation results after all taps submitted (null during collection). */
  evaluated: MultiTapEvalResult | null;
  /** Progress text during collection (e.g., "3 / 8"). */
  progressText: string;
  /** Handle a tap on a position. */
  handleTap: (positionKey: string) => void;
  /** Reset state on question change. */
  resetOnItemChange: (currentItemId: string | null) => void;
};

export function useMultiTapInput<Q>(
  def: ModeDefinition<Q>,
  currentQRef: { current: Q | null },
  submitRef: { current: (input: string) => void },
): MultiTapInputHandle {
  const [tappedPositions, setTappedPositions] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const tappedRef = useRef<Set<string>>(new Set());
  const [evaluated, setEvaluated] = useState<MultiTapEvalResult | null>(null);
  const [progressText, setProgressText] = useState('');
  const prevItemRef = useRef<string | null>(null);

  const resetAll = useCallback(() => {
    tappedRef.current = new Set();
    setTappedPositions(new Set());
    setEvaluated(null);
    setProgressText('');
  }, []);

  const handleTap = useCallback((positionKey: string) => {
    if (!def.multiTap || !currentQRef.current) return;
    const q = currentQRef.current;
    const targets = def.multiTap.getTargets(q);
    const tapped = tappedRef.current;

    // Reject duplicates and taps after evaluation
    if (tapped.has(positionKey) || tapped.size >= targets.length) return;

    const next = new Set(tapped);
    next.add(positionKey);
    tappedRef.current = next;
    setTappedPositions(next);
    setProgressText(next.size + ' / ' + targets.length);

    if (next.size === targets.length) {
      const result = def.multiTap.evaluate(q, [...next]);
      setEvaluated(result);
      const sentinel = result.correct ? '__correct__' : '__wrong__';
      submitRef.current(sentinel + ':' + result.correctAnswer);
    }
  }, [def]);

  const resetOnItemChange = useCallback((currentItemId: string | null) => {
    if (currentItemId !== prevItemRef.current) {
      prevItemRef.current = currentItemId;
      resetAll();
    }
  }, [resetAll]);

  return {
    tappedPositions,
    evaluated,
    progressText,
    handleTap,
    resetOnItemChange,
  };
}
