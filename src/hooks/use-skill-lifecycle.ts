// useSkillLifecycle — shared hook for navigation activate/deactivate.
//
// Every quiz skill registers the same pattern with the navigation system:
//   activate  → sync motor baseline + update idle message
//   deactivate → stop engine (if running) + skill-specific cleanup
//
// engine.stop() resets to idle. Calibration is a local overlay managed by the
// skill component — cleared via the `onDeactivate` callback.
// Skills pass any extra cleanup (noteHandler.reset, timeout clearing, etc.)
// via the optional `onDeactivate` callback.

import { useLayoutEffect } from 'preact/hooks';
import type { SkillHandle } from '../types.ts';
import type { QuizEngineHandle } from './use-quiz-engine.ts';
import type { LearnerModel } from './use-learner-model.ts';

/**
 * Register a skill's activate/deactivate handle with the navigation system.
 *
 * @param onMount     Navigation registration callback (from mode props).
 * @param engine      Quiz engine handle (for stop + updateIdleMessage).
 * @param learner     Learner model (for syncBaseline).
 * @param onDeactivate Optional skill-specific cleanup (e.g. noteHandler.reset,
 *                     clearing pending timeouts). Called after engine stop.
 *                     Should be a stable reference (wrap in useCallback if
 *                     needed).
 * @param onActivate  Optional callback run after standard activate logic
 *                     (e.g. tab reset for first-visit onboarding).
 */
export function useSkillLifecycle(
  onMount: (handle: SkillHandle) => void,
  engine: QuizEngineHandle,
  learner: LearnerModel,
  onDeactivate?: () => void,
  onActivate?: () => void,
): void {
  useLayoutEffect(() => {
    onMount({
      activate() {
        learner.syncBaseline();
        engine.updateIdleMessage();
        onActivate?.();
      },
      deactivate() {
        if (engine.state.phase !== 'idle') engine.stop();
        onDeactivate?.();
      },
    });
  }, [onMount, engine, learner, onDeactivate, onActivate]);
}
