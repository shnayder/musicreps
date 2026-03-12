// useQuizEngine — Preact hook wrapping the quiz engine lifecycle.
// Composes extracted sub-hooks: round transitions, engine actions,
// calibration lifecycle, keyboard routing, and fixture injection.
// Components render reactively from the returned state.

import { useEffect, useRef, useState } from 'preact/hooks';
import type { AdaptiveSelector, EngineState } from '../types.ts';
import { isCalibrationPhase } from '../types.ts';
import { initialEngineState } from '../quiz-engine-state.ts';
import { useRoundTransitions } from './use-round-transitions.ts';
import { useEngineKeyboard } from './use-engine-keyboard.ts';
import { useFixtureInjection } from './use-fixture-injection.ts';
import { useCalibrationLifecycle } from './use-calibration-lifecycle.ts';
import { useEngineActions } from './use-engine-actions.ts';

// Re-export types so existing consumers don't break
export type {
  QuizEngineConfig,
  QuizEngineHandle,
} from './quiz-engine-types.ts';
import type {
  QuizEngineConfig,
  QuizEngineHandle,
} from './quiz-engine-types.ts';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useQuizEngine(
  config: QuizEngineConfig,
  selector: AdaptiveSelector,
  fixtureTarget?: HTMLElement,
): QuizEngineHandle {
  const [state, setState] = useState<EngineState>(initialEngineState);

  const stateRef = useRef(state);
  stateRef.current = state;
  const configRef = useRef(config);
  configRef.current = config;
  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  const { timer, transitionToRoundCompleteRef } = useRoundTransitions(
    stateRef,
    setState,
  );
  const actions = useEngineActions(
    stateRef,
    configRef,
    selectorRef,
    setState,
    timer,
    transitionToRoundCompleteRef,
  );
  const cal = useCalibrationLifecycle(timer, setState, configRef);

  useEngineKeyboard(
    state,
    stateRef,
    configRef,
    cal.stop,
    actions.nextQuestionRef,
    actions.continueQuiz,
    actions.submitAnswer,
  );
  useEffect(() => () => timer.stopRoundTimer(), []);
  useFixtureInjection(
    fixtureTarget,
    setState,
    timer,
    cal.setCalibrationFixture,
  );

  return {
    state,
    timerPct: timer.timerPct,
    timerText: timer.timerText,
    timerWarning: timer.timerWarning,
    timerLastQuestion: timer.timerLastQuestion,
    calibrating: isCalibrationPhase(state.phase),
    calibrationFixture: cal.calibrationFixture,
    start: actions.start,
    stop: cal.stop,
    submitAnswer: actions.submitAnswer,
    nextQuestion: actions.nextQuestion,
    continueQuiz: actions.continueQuiz,
    updateIdleMessage: actions.updateIdleMessage,
    startCalibration: cal.startCalibration,
    endCalibration: cal.endCalibration,
  };
}
