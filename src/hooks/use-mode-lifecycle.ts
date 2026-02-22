// useModeLifecycle — shared hook for navigation activate/deactivate.
//
// Every quiz mode registers the same pattern with the navigation system:
//   activate  → sync motor baseline + update idle message
//   deactivate → stop engine (if running) + mode-specific cleanup + clear calibration
//
// Modes pass any extra cleanup (noteHandler.reset, timeout clearing, etc.)
// via the optional `onDeactivate` callback.

import { useLayoutEffect } from 'preact/hooks';
import type { ModeHandle } from '../types.ts';
import type { QuizEngineHandle } from './use-quiz-engine.ts';
import type { LearnerModel } from './use-learner-model.ts';

/**
 * Register a mode's activate/deactivate handle with the navigation system.
 *
 * @param onMount     Navigation registration callback (from mode props).
 * @param engine      Quiz engine handle (for stop + updateIdleMessage).
 * @param learner     Learner model (for syncBaseline).
 * @param setCalibrating  State setter to clear calibration on deactivate.
 * @param onDeactivate Optional mode-specific cleanup (e.g. noteHandler.reset,
 *                     clearing pending timeouts). Called after engine stop,
 *                     before clearing calibration. Should be a stable
 *                     reference (wrap in useCallback if needed).
 */
export function useModeLifecycle(
  onMount: (handle: ModeHandle) => void,
  engine: QuizEngineHandle,
  learner: LearnerModel,
  setCalibrating: (v: boolean) => void,
  onDeactivate?: () => void,
): void {
  useLayoutEffect(() => {
    onMount({
      activate() {
        learner.syncBaseline();
        engine.updateIdleMessage();
      },
      deactivate() {
        if (engine.state.phase !== 'idle') engine.stop();
        onDeactivate?.();
        setCalibrating(false);
      },
    });
  }, [engine, learner, onDeactivate]);
}
