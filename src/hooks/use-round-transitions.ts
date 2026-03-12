// useRoundTransitions — handles round timer expiry and round completion transitions.
// Extracted from useQuizEngine for clarity.

import { useCallback, useRef } from 'preact/hooks';
import type { EngineState } from '../types.ts';
import {
  engineRoundComplete,
  engineRoundTimerExpired,
} from '../quiz-engine-state.ts';
import type { RoundTimerHandle } from './use-round-timer.ts';
import { LAST_QUESTION_CAP_MS, useRoundTimer } from './use-round-timer.ts';

const ROUND_DURATION_MS = 60000;

/** True when the primary pointer is coarse (phone/tablet). */
const IS_TOUCH_PRIMARY = typeof globalThis.matchMedia === 'function' &&
  globalThis.matchMedia('(pointer: coarse)').matches;

const HINT_CONTINUE = IS_TOUCH_PRIMARY ? '' : 'Space to continue';

export type RoundTransitionHandle = {
  timer: RoundTimerHandle;
  transitionToRoundCompleteRef: { current: () => void };
};

export function useRoundTransitions(
  stateRef: { current: EngineState },
  setState: (fn: (prev: EngineState) => EngineState) => void,
): RoundTransitionHandle {
  const transitionToRoundCompleteRef = useRef<() => void>(null!);

  const handleRoundTimerExpiry = useCallback(() => {
    if (stateRef.current.phase !== 'active') return;
    setState((prev) => {
      const next = engineRoundTimerExpired(prev);
      if (next.answered) {
        timer.roundDurationSnapshotRef.current = ROUND_DURATION_MS;
        timer.setTimerLastQuestion(true);
        return { ...next, hintText: HINT_CONTINUE };
      } else {
        timer.setTimerLastQuestion(true);
        timer.lastQuestionCapRef.current = setTimeout(() => {
          if (stateRef.current.phase === 'active') {
            transitionToRoundCompleteRef.current();
          }
        }, LAST_QUESTION_CAP_MS);
      }
      return next;
    });
  }, []);

  const timer = useRoundTimer(handleRoundTimerExpiry);

  const transitionToRoundComplete = useCallback(() => {
    const roundDurationMs = timer.roundDurationSnapshotRef.current ??
      (timer.roundTimerStartRef.current
        ? Date.now() - timer.roundTimerStartRef.current
        : 0);
    timer.roundDurationSnapshotRef.current = null;
    timer.stopRoundTimer();
    setState((prev) => {
      const s = engineRoundComplete(prev);
      return { ...s, roundDurationMs };
    });
  }, [timer.stopRoundTimer]);
  transitionToRoundCompleteRef.current = transitionToRoundComplete;

  return { timer, transitionToRoundCompleteRef };
}

export { HINT_CONTINUE, ROUND_DURATION_MS };
