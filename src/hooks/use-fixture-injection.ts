// useFixtureInjection — dev/screenshot fixture injection for quiz engine.
// Listens for __fixture__ custom events on the target element and applies
// engine state + timer overrides for deterministic screenshots.

import { useEffect } from 'preact/hooks';
import type { EngineState } from '../types.ts';
import type { FixtureDetail } from '../fixtures/quiz-page.ts';
import type { SpeedCheckFixture } from '../ui/speed-check.tsx';
import type { RoundTimerHandle } from './use-round-timer.ts';

/** True when `?fixtures` is in the page URL. */
const FIXTURES_ENABLED = typeof globalThis.location !== 'undefined' &&
  new URLSearchParams(globalThis.location.search).has('fixtures');

export function useFixtureInjection(
  fixtureTarget: HTMLElement | undefined,
  setState: (fn: (prev: EngineState) => EngineState) => void,
  timer: RoundTimerHandle,
  setCalibrationFixture: (f: SpeedCheckFixture | undefined) => void,
): void {
  useEffect(() => {
    if (!FIXTURES_ENABLED || !fixtureTarget) return;
    const target = fixtureTarget;

    function handleFixture(e: Event) {
      const detail = (e as CustomEvent<FixtureDetail>).detail;
      if (!detail) return;

      if (detail.engineState) {
        setState((prev) => ({ ...prev, ...detail.engineState }));
      }
      if (detail.timerPct !== undefined) timer.setTimerPct(detail.timerPct);
      if (detail.timerText !== undefined) timer.setTimerText(detail.timerText);
      if (detail.timerWarning !== undefined) {
        timer.setTimerWarning(detail.timerWarning);
      }
      if (detail.timerLastQuestion !== undefined) {
        timer.setTimerLastQuestion(detail.timerLastQuestion);
      }

      if (detail.calibration) {
        const calPhase = detail.calibration.phase === 'results'
          ? 'calibration-results' as const
          : detail.calibration.phase === 'running'
          ? 'calibrating' as const
          : 'calibration-intro' as const;
        setState((prev) => ({ ...prev, phase: calPhase }));
        setCalibrationFixture(detail.calibration);
      }

      target.setAttribute('data-fixture-applied', 'true');
    }

    target.addEventListener('__fixture__', handleFixture);
    return () => target.removeEventListener('__fixture__', handleFixture);
  }, [fixtureTarget]);
}
