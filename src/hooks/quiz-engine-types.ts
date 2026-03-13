// Quiz engine types — shared between useQuizEngine and its sub-hooks.
// Extracted to avoid circular imports.

import type { CheckAnswerResult, EngineState } from '../types.ts';
import type { SpeedCheckFixture } from '../ui/speed-check.tsx';

export type QuizEngineConfig = {
  getEnabledItems: () => string[];
  checkAnswer: (itemId: string, input: string) => CheckAnswerResult;
  onAnswer?: (
    itemId: string,
    result: CheckAnswerResult,
    responseTime: number,
  ) => void;
  onStart?: () => void;
  onStop?: () => void;
  handleKey?: (
    e: KeyboardEvent,
    ctx: { submitAnswer: (input: string) => void },
  ) => boolean | void;
  getPracticingLabel?: () => string;
  getExpectedResponseCount?: (itemId: string) => number;
};

export type QuizEngineHandle = {
  state: EngineState;
  timerPct: number;
  timerText: string;
  timerWarning: boolean;
  timerLastQuestion: boolean;
  calibrating: boolean;
  calibrationFixture: SpeedCheckFixture | undefined;
  start: () => void;
  stop: () => void;
  submitAnswer: (input: string) => void;
  nextQuestion: () => void;
  continueQuiz: () => void;
  updateIdleMessage: () => void;
  startCalibration: () => void;
  endCalibration: () => void;
};
