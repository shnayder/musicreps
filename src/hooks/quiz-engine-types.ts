// Quiz engine types — shared between useQuizEngine and its sub-hooks.
// Extracted to avoid circular imports.

import type { CheckAnswerResult, EngineState } from '../types.ts';

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
  /** Skill id used to partition the per-skill daily rep counter. When set,
   *  each answer bumps `effort_daily_<skillId>` in addition to the global
   *  `effort_daily` counter. */
  skillId?: string;
};

export type QuizEngineHandle = {
  state: EngineState;
  timerPct: number;
  timerText: string;
  timerWarning: boolean;
  timerLastQuestion: boolean;
  start: () => void;
  stop: () => void;
  submitAnswer: (input: string) => void;
  nextQuestion: () => void;
  continueQuiz: () => void;
  updateIdleMessage: () => void;
};
