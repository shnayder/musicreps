// useMultiTapInput — handles multi-tap quiz modes.
// Manages a set of tapped positions (no duplicates), evaluates on explicit
// Check action, and resets on question change.
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
  | { kind: 'added' }
  | { kind: 'removed' };

/** Extract the string index from a position key ("string-fret" → string). */
function stringOf(posKey: string): string {
  return posKey.split('-')[0];
}

/**
 * Remove any existing tap on the same string as positionKey (mutates `set`).
 * Used by onePerString mode to enforce one note per string.
 */
function removeExistingOnString(set: Set<string>, positionKey: string): void {
  const tapString = stringOf(positionKey);
  for (const existing of set) {
    if (stringOf(existing) === tapString) {
      set.delete(existing);
      return;
    }
  }
}

/**
 * Process a tap against the current collection state (pure function).
 * Tapping a selected position deselects it; tapping an unselected position
 * adds it. Does not trigger evaluation — the caller uses handleCheck for that.
 */
export function processMultiTap<Q>(
  _multiTap: MultiTapDef<Q>,
  _q: Q,
  tapped: ReadonlySet<string>,
  positionKey: string,
): TapAction {
  // Deselect: tapping an already-selected position removes it
  if (tapped.has(positionKey)) {
    return { kind: 'removed' };
  }

  return { kind: 'added' };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export type MultiTapInputHandle = {
  /** Set of tapped position keys (for rendering highlights). */
  tappedPositions: ReadonlySet<string>;
  /** Evaluation results after all taps submitted (null during collection). */
  evaluated: MultiTapEvalResult | null;
  /** Handle a tap on a position. */
  handleTap: (positionKey: string) => void;
  /** Manually trigger evaluation of collected taps. */
  handleCheck: () => void;
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
  const evaluatedRef = useRef<MultiTapEvalResult | null>(null);
  const prevItemRef = useRef<string | null>(null);

  const resetAll = useCallback(() => {
    tappedRef.current = new Set();
    setTappedPositions(new Set());
    evaluatedRef.current = null;
    setEvaluated(null);
  }, []);

  const handleTap = useCallback((positionKey: string) => {
    if (!def.multiTap || !currentQRef.current) return;
    // Don't accept more taps after evaluation
    if (evaluatedRef.current) return;

    const action = processMultiTap(
      def.multiTap,
      currentQRef.current,
      tappedRef.current,
      positionKey,
    );

    if (action.kind === 'removed') {
      const next = new Set(tappedRef.current);
      next.delete(positionKey);
      tappedRef.current = next;
      setTappedPositions(next);
      return;
    }

    // For 'added': rebuild the set. When onePerString is active, an old tap
    // on the same string needs to be removed before adding the new one.
    const next = new Set(tappedRef.current);
    if (def.multiTap.onePerString) {
      removeExistingOnString(next, positionKey);
    }
    next.add(positionKey);
    tappedRef.current = next;
    setTappedPositions(next);
  }, [def]);

  const handleCheck = useCallback(() => {
    if (!def.multiTap || !currentQRef.current) return;
    if (evaluatedRef.current) return; // already evaluated (e.g. double-click)
    const tapped = tappedRef.current;
    if (tapped.size === 0) return;

    const result = def.multiTap.evaluate(
      currentQRef.current,
      [...tapped],
    );
    evaluatedRef.current = result;
    setEvaluated(result);
    const sentinel = (result.correct ? '__correct__' : '__wrong__') +
      ':' + result.correctAnswer;
    submitRef.current(sentinel);
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
    handleTap,
    handleCheck,
    resetOnItemChange,
  };
}
