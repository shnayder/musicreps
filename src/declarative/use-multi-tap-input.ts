// useMultiTapInput — handles multi-tap quiz modes.
// Manages a set of tapped positions (no duplicates), evaluates all at once
// after the expected count is reached, and resets on question change.
// Parallel to useSequentialInput but with set semantics (order doesn't matter).

import { useCallback, useRef, useState } from 'preact/hooks';
import type {
  ModeDefinition,
  MultiTapDef,
  MultiTapEvalResult,
} from './types.ts';

// ---------------------------------------------------------------------------
// Pure collection logic — shared by hook and tests
// ---------------------------------------------------------------------------

/** Result of processing a single tap against the collection state. */
export type TapAction =
  | { kind: 'ignored' }
  | { kind: 'added'; progressText: string }
  | { kind: 'removed'; progressText: string }
  | {
    kind: 'complete';
    progressText: string;
    result: MultiTapEvalResult;
    sentinel: string;
  };

/** Extract the string index from a position key ("string-fret" → string). */
function stringOf(posKey: string): string {
  return posKey.split('-')[0];
}

/**
 * Process a tap against the current collection state (pure function).
 * Tapping a selected position deselects it; tapping an unselected position
 * adds it; completing the set triggers evaluation.
 *
 * When `onePerString` is true, tapping a new fret on a string that already
 * has a tap replaces the old one (chord shape behavior: one note per string).
 */
export function processMultiTap<Q>(
  multiTap: MultiTapDef<Q>,
  q: Q,
  tapped: ReadonlySet<string>,
  positionKey: string,
): TapAction {
  const targets = multiTap.getTargets(q);

  // Deselect: tapping an already-selected position removes it
  if (tapped.has(positionKey)) {
    const next = new Set(tapped);
    next.delete(positionKey);
    return {
      kind: 'removed',
      progressText: next.size + ' / ' + targets.length,
    };
  }

  // onePerString: replace any existing tap on the same string
  let next = new Set(tapped);
  if (multiTap.onePerString) {
    const tapString = stringOf(positionKey);
    for (const existing of tapped) {
      if (stringOf(existing) === tapString) {
        next.delete(existing);
        break;
      }
    }
  }

  // Reject taps after collection is full (unless onePerString already freed a slot)
  if (next.size >= targets.length) {
    return { kind: 'ignored' };
  }

  next = new Set(next);
  next.add(positionKey);
  const progressText = next.size + ' / ' + targets.length;

  if (next.size === targets.length) {
    const result = multiTap.evaluate(q, [...next]);
    const sentinel = (result.correct ? '__correct__' : '__wrong__') +
      ':' + result.correctAnswer;
    return { kind: 'complete', progressText, result, sentinel };
  }

  return { kind: 'added', progressText };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

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
    const action = processMultiTap(
      def.multiTap,
      currentQRef.current,
      tappedRef.current,
      positionKey,
    );

    if (action.kind === 'ignored') return;

    if (action.kind === 'removed') {
      const next = new Set(tappedRef.current);
      next.delete(positionKey);
      tappedRef.current = next;
      setTappedPositions(next);
      setProgressText(action.progressText);
      return;
    }

    // For 'added' / 'complete': rebuild the set from processMultiTap's logic.
    // When onePerString is active, an old tap on the same string was removed
    // inside processMultiTap, so we reconstruct the set the same way.
    const next = new Set(tappedRef.current);
    if (def.multiTap.onePerString) {
      const tapString = positionKey.split('-')[0];
      for (const existing of tappedRef.current) {
        if (existing.split('-')[0] === tapString) {
          next.delete(existing);
          break;
        }
      }
    }
    next.add(positionKey);
    tappedRef.current = next;
    setTappedPositions(next);
    setProgressText(action.progressText);

    if (action.kind === 'complete') {
      setEvaluated(action.result);
      submitRef.current(action.sentinel);
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
