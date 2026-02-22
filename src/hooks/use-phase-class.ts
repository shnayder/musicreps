// usePhaseClass — sync engine phase to CSS classes on the container element.
// Replaces identical useEffect blocks in all mode components.

import { useEffect } from 'preact/hooks';
import type { EnginePhase } from '../types.ts';

type PhaseKey = EnginePhase | 'calibration';

const PHASE_CLASSES = [
  'phase-idle',
  'phase-active',
  'phase-round-complete',
  'phase-calibration',
];

/**
 * Set the appropriate phase CSS class on the mode container element.
 * Removes all phase classes and adds the one matching the current phase.
 * Runs as a side effect whenever the phase changes.
 *
 * Maps: 'idle' → 'phase-idle', 'round-complete' → 'phase-round-complete',
 * 'calibration' → 'phase-calibration',
 * everything else (active, etc.) → 'phase-active'.
 *
 * Modes pass `calibrating ? 'calibration' : engine.state.phase` to override
 * the engine phase during speed check.
 *
 * Optional `focusTargets` maps phases to CSS selectors. When the phase changes
 * to a phase with a focus target, focus moves to the first matching element.
 */
/** Default focus targets: idle → Start Quiz, round-complete → Keep Going. */
export const PHASE_FOCUS_TARGETS: Partial<Record<PhaseKey, string>> = {
  idle: '.start-btn',
  'round-complete': '.round-complete-continue',
};

export function usePhaseClass(
  container: HTMLElement,
  phase: PhaseKey,
  focusTargets?: Partial<Record<PhaseKey, string>>,
): void {
  useEffect(() => {
    const cls = phase === 'idle'
      ? 'phase-idle'
      : phase === 'round-complete'
      ? 'phase-round-complete'
      : phase === 'calibration'
      ? 'phase-calibration'
      : 'phase-active';
    container.classList.remove(...PHASE_CLASSES);
    container.classList.add(cls);

    if (focusTargets) {
      const selector = focusTargets[phase];
      if (selector) {
        requestAnimationFrame(() => {
          const el = container.querySelector(selector) as HTMLElement | null;
          if (el) el.focus();
        });
      }
    }
  }, [phase, container, focusTargets]);
}
