// useQuizEngine — Preact hook wrapping the quiz engine lifecycle.
// Composes extracted sub-hooks: round transitions, engine actions,
// keyboard routing, and fixture injection.
// Components render reactively from the returned state.

import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type {
  AdaptiveSelector,
  EngineState,
  SpeedCheckFixture,
} from '../types.ts';
import { initialEngineState } from '../quiz-engine-state.ts';
import { useRoundTransitions } from './use-round-transitions.ts';
import { useEngineKeyboard } from './use-engine-keyboard.ts';
import { useFixtureInjection } from './use-fixture-injection.ts';
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
): QuizEngineHandle & { calibrationFixture: SpeedCheckFixture | undefined } {
  const [state, setState] = useState<EngineState>(initialEngineState);
  const [calibrationFixture, setCalibrationFixture] = useState<
    SpeedCheckFixture | undefined
  >();

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

  const stop = useCallback(() => {
    timer.stopRoundTimer();
    actions.stopEngine();
    setCalibrationFixture(undefined);
    configRef.current.onStop?.();
  }, [timer.stopRoundTimer, actions.stopEngine]);

  useEngineKeyboard(
    state,
    stateRef,
    configRef,
    stop,
    actions.nextQuestionRef,
    actions.continueQuiz,
    actions.submitAnswer,
  );
  useEffect(() => () => timer.stopRoundTimer(), []);
  useFixtureInjection(
    fixtureTarget,
    setState,
    timer,
    setCalibrationFixture,
  );

  return {
    state,
    timerPct: timer.timerPct,
    timerText: timer.timerText,
    timerWarning: timer.timerWarning,
    timerLastQuestion: timer.timerLastQuestion,
    calibrationFixture,
    start: actions.start,
    stop,
    submitAnswer: actions.submitAnswer,
    nextQuestion: actions.nextQuestion,
    continueQuiz: actions.continueQuiz,
    updateIdleMessage: actions.updateIdleMessage,
  };
}
