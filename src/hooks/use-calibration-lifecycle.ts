// useCalibrationLifecycle — manages calibration state and stop/start/end lifecycle.
// Extracted from useQuizEngine for clarity.

import { useCallback, useState } from 'preact/hooks';
import type { EngineState } from '../types.ts';
import { engineCalibrationIntro, engineStop } from '../quiz-engine-state.ts';
import type { SpeedCheckFixture } from '../types.ts';
import type { RoundTimerHandle } from './use-round-timer.ts';
import type { QuizEngineConfig } from './quiz-engine-types.ts';

export type CalibrationHandle = {
  calibrationFixture: SpeedCheckFixture | undefined;
  setCalibrationFixture: (f: SpeedCheckFixture | undefined) => void;
  stop: () => void;
  startCalibration: () => void;
  endCalibration: () => void;
};

export function useCalibrationLifecycle(
  timer: RoundTimerHandle,
  setState: (fn: EngineState | ((prev: EngineState) => EngineState)) => void,
  configRef: { current: QuizEngineConfig },
): CalibrationHandle {
  const [calibrationFixture, setCalibrationFixture] = useState<
    SpeedCheckFixture | undefined
  >();

  const stop = useCallback(() => {
    timer.stopRoundTimer();
    setState(engineStop);
    setCalibrationFixture(undefined);
    configRef.current.onStop?.();
  }, [timer.stopRoundTimer]);

  const startCalibration = useCallback(() => {
    setCalibrationFixture(undefined);
    setState(engineCalibrationIntro);
  }, []);

  const endCalibration = useCallback(() => {
    setCalibrationFixture(undefined);
    setState(engineStop);
  }, []);

  return {
    calibrationFixture,
    setCalibrationFixture,
    stop,
    startCalibration,
    endCalibration,
  };
}
