// usePhaseClass — sync engine phase to CSS classes on the container element.
// Replaces identical useEffect blocks in all 10 mode components.

import { useEffect } from 'preact/hooks';
import type { EnginePhase } from '../types.ts';

const PHASE_CLASSES = ['phase-idle', 'phase-active', 'phase-round-complete'];

/**
 * Set the appropriate phase CSS class on the mode container element.
 * Removes all phase classes and adds the one matching the current engine phase.
 * Runs as a side effect whenever the phase changes.
 *
 * Maps: 'idle' → 'phase-idle', 'round-complete' → 'phase-round-complete',
 * everything else (active, calibrating, etc.) → 'phase-active'.
 */
export function usePhaseClass(
  container: HTMLElement,
  phase: EnginePhase,
): void {
  useEffect(() => {
    const cls = phase === 'idle'
      ? 'phase-idle'
      : phase === 'round-complete'
      ? 'phase-round-complete'
      : 'phase-active';
    container.classList.remove(...PHASE_CLASSES);
    container.classList.add(cls);
  }, [phase, container]);
}
