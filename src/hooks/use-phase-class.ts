// usePhaseClass — sync engine phase to CSS classes on the container element.
// Still needed for: (1) full-bleed flex layout during quiz (phase-active/
// phase-round-complete), (2) navigation's Escape key check
// (reads phase class), (3) focus management (moves focus to .start-btn on
// idle, .page-action-primary on round-complete). Child visibility is now
// handled by Preact conditional rendering, not CSS phase rules.
//
// The 'calibration' presentation phase is set by the mode component (not the
// engine) via the overridePhase parameter when the speed check overlay is
// active.

import { useEffect } from 'preact/hooks';
import type { EnginePhase } from '../types.ts';

/** All presentation phases including calibration (set by mode, not engine). */
export type PresentationPhase = EnginePhase | 'calibration';

const PHASE_CLASSES = [
  'phase-idle',
  'phase-active',
  'phase-round-complete',
  'phase-limit-reached',
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
 * Optional `focusTargets` maps phases to CSS selectors. When the phase changes
 * to a phase with a focus target, focus moves to the first matching element.
 */
/** Default focus targets: idle → Start Quiz, round-complete → Keep Going. */
export const PHASE_FOCUS_TARGETS: Partial<Record<PresentationPhase, string>> = {
  idle: '.start-btn',
  'round-complete': '.page-action-primary',
};

export function usePhaseClass(
  container: HTMLElement,
  phase: PresentationPhase,
  focusTargets?: Partial<Record<PresentationPhase, string>>,
): void {
  useEffect(() => {
    const cls = phase === 'idle'
      ? 'phase-idle'
      : phase === 'round-complete'
      ? 'phase-round-complete'
      : phase === 'limit-reached'
      ? 'phase-limit-reached'
      : phase === 'calibration'
      ? 'phase-calibration'
      : 'phase-active';
    container.classList.remove(...PHASE_CLASSES);
    container.classList.add(cls);

    if (focusTargets) {
      const selector = focusTargets[phase];
      if (selector) {
        requestAnimationFrame(() => {
          if (!container.classList.contains('mode-active')) return;
          const el = container.querySelector(selector) as HTMLElement | null;
          if (el) el.focus();
        });
      }
    }
  }, [phase, container, focusTargets]);
}
