// Page-level quiz fixtures: compose leaf fixtures into full EngineState +
// timer overrides. Used by take-screenshots.ts to inject state via
// __fixture__ events.
//
// IMPORTANT: composites should use buildActiveState (which runs real engine
// transitions) and only override fields the engine can't produce — timer
// state (external to EngineState), roundTimerExpired, and hintText when it
// differs from the default. Do NOT redundantly re-set feedback fields that
// engineSubmitAnswer already computed; that masks bugs.

import type { EngineState, FixtureDetail } from '../types.ts';
import {
  engineNextQuestion,
  engineRoundComplete,
  engineStart,
  engineSubmitAnswer,
  engineUpdateProgress,
  initialEngineState,
} from '../quiz-engine-state.ts';
import { feedbackCorrect, feedbackWrong } from './feedback.ts';
import { timerAlmostExpired, timerExpired, timerMidRound } from './timer.ts';
import { sessionEarlyRound, sessionLateRound } from './session.ts';
// Round-complete data is in round-complete.ts; used by preview.tsx directly.

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildActiveState(
  itemId: string,
  opts: {
    correct?: boolean;
    correctAnswer?: string;
    masteredCount?: number;
    totalEnabledCount?: number;
    questionCount?: number;
  } = {},
): EngineState {
  const init = initialEngineState();
  let s = engineStart(init);
  s = engineNextQuestion(s, itemId, Date.now());
  if (opts.correct !== undefined) {
    s = engineSubmitAnswer(
      s,
      opts.correct,
      opts.correctAnswer ?? 'D#',
      'Space for next',
    );
  }
  if (opts.questionCount !== undefined) {
    s = { ...s, questionCount: opts.questionCount };
  }
  if (
    opts.masteredCount !== undefined || opts.totalEnabledCount !== undefined
  ) {
    s = engineUpdateProgress(
      s,
      opts.masteredCount ?? s.masteredCount,
      opts.totalEnabledCount ?? s.totalEnabledCount,
    );
  }
  return s;
}

// ---------------------------------------------------------------------------
// Quiz active: awaiting answer
// ---------------------------------------------------------------------------

export function quizActive(itemId: string): FixtureDetail {
  return {
    engineState: buildActiveState(itemId, {
      masteredCount: sessionEarlyRound.fluent,
      totalEnabledCount: sessionEarlyRound.total,
      questionCount: 7,
    }),
    timerPct: timerMidRound.pct,
    timerText: timerMidRound.text,
    timerWarning: timerMidRound.warning,
    timerLastQuestion: timerMidRound.lastQuestion,
  };
}

// ---------------------------------------------------------------------------
// Quiz active: correct feedback
// ---------------------------------------------------------------------------

export function quizCorrectFeedback(itemId: string): FixtureDetail {
  return {
    engineState: buildActiveState(itemId, {
      correct: true,
      correctAnswer: feedbackCorrect.displayAnswer,
      masteredCount: sessionEarlyRound.fluent,
      totalEnabledCount: sessionEarlyRound.total,
      questionCount: 14,
    }),
    timerPct: 55,
    timerText: '0:28',
    timerWarning: false,
    timerLastQuestion: false,
  };
}

// ---------------------------------------------------------------------------
// Quiz active: wrong feedback
// ---------------------------------------------------------------------------

export function quizWrongFeedback(itemId: string): FixtureDetail {
  return {
    engineState: buildActiveState(itemId, {
      correct: false,
      correctAnswer: feedbackWrong.displayAnswer,
      masteredCount: sessionLateRound.fluent,
      totalEnabledCount: sessionLateRound.total,
      questionCount: 22,
    }),
    timerPct: 38,
    timerText: '0:18',
    timerWarning: false,
    timerLastQuestion: false,
  };
}

// ---------------------------------------------------------------------------
// Quiz active: correct feedback with 1s left (timer warning)
// ---------------------------------------------------------------------------

export function quizFeedbackTimerLow(itemId: string): FixtureDetail {
  return {
    engineState: buildActiveState(itemId, {
      correct: true,
      correctAnswer: feedbackCorrect.displayAnswer,
      masteredCount: sessionLateRound.fluent,
      totalEnabledCount: sessionLateRound.total,
      questionCount: 18,
    }),
    timerPct: timerAlmostExpired.pct,
    timerText: timerAlmostExpired.text,
    timerWarning: timerAlmostExpired.warning,
    timerLastQuestion: timerAlmostExpired.lastQuestion,
  };
}

// ---------------------------------------------------------------------------
// Quiz active: timer expired, awaiting answer ("Last question" shown)
// ---------------------------------------------------------------------------

export function quizLastQuestionAwaiting(itemId: string): FixtureDetail {
  const s = buildActiveState(itemId, {
    masteredCount: sessionLateRound.fluent,
    totalEnabledCount: sessionLateRound.total,
    questionCount: 19,
  });
  return {
    engineState: { ...s, roundTimerExpired: true },
    timerPct: timerExpired.pct,
    timerText: timerExpired.text,
    timerWarning: timerExpired.warning,
    timerLastQuestion: timerExpired.lastQuestion,
  };
}

// ---------------------------------------------------------------------------
// Quiz active: answered the last question (feedback + "Continue" button)
// The user must manually press Continue to see round-complete.
// hintText overridden because the engine sets it via a separate setState
// call in submitAnswer, not via engineSubmitAnswer.
// ---------------------------------------------------------------------------

export function quizLastQuestionAnswered(itemId: string): FixtureDetail {
  const s = buildActiveState(itemId, {
    correct: false,
    correctAnswer: feedbackWrong.displayAnswer,
    masteredCount: sessionLateRound.fluent,
    totalEnabledCount: sessionLateRound.total,
    questionCount: 19,
  });
  return {
    engineState: {
      ...s,
      roundTimerExpired: true,
      hintText: 'Space to continue',
    },
    timerPct: timerExpired.pct,
    timerText: timerExpired.text,
    timerWarning: timerExpired.warning,
    timerLastQuestion: timerExpired.lastQuestion,
  };
}

// ---------------------------------------------------------------------------
// Quiz active: feedback showing when timer expires ("Time is up" + Continue)
// The user answered, then the round timer ran out while on the feedback screen.
// ---------------------------------------------------------------------------

export function quizFeedbackTimerExpired(itemId: string): FixtureDetail {
  const s = buildActiveState(itemId, {
    correct: true,
    correctAnswer: feedbackCorrect.displayAnswer,
    masteredCount: sessionLateRound.fluent,
    totalEnabledCount: sessionLateRound.total,
    questionCount: 18,
  });
  return {
    engineState: {
      ...s,
      roundTimerExpired: true,
      hintText: 'Space to continue',
    },
    timerPct: timerExpired.pct,
    timerText: timerExpired.text,
    timerWarning: timerExpired.warning,
    timerLastQuestion: timerExpired.lastQuestion,
  };
}

// ---------------------------------------------------------------------------
// Round complete: good round
// ---------------------------------------------------------------------------

export function quizRoundComplete(
  variant: 'good' | 'rough' = 'good',
): FixtureDetail {
  const init = initialEngineState();
  let s = engineStart(init);
  // Simulate answering questions before round completes
  const answered = variant === 'good' ? 18 : 9;
  const correct = variant === 'good' ? 16 : 5;
  s = {
    ...s,
    roundAnswered: answered,
    roundCorrect: correct,
    questionCount: answered,
  };
  s = engineRoundComplete(s);
  const fluent = variant === 'good' ? 12 : 3;
  const total = variant === 'good' ? 18 : 24;
  s = engineUpdateProgress(s, fluent, total);
  s = {
    ...s,
    roundDurationMs: variant === 'good' ? 63000 : 62000,
    roundResponseTimes: Array(answered).fill(
      variant === 'good' ? 900 : 2800,
    ),
  };
  return {
    engineState: s,
    timerPct: 0,
    timerText: '0:00',
    timerWarning: false,
    timerLastQuestion: false,
  };
}

// ---------------------------------------------------------------------------
// Speed Check (calibration) fixtures
// ---------------------------------------------------------------------------

export function speedCheckIntro(): FixtureDetail {
  return { calibration: { phase: 'intro' } };
}

export function speedCheckTesting(): FixtureDetail {
  return {
    calibration: {
      phase: 'running',
      trialProgress: '5 / 10',
      targetNote: 'E',
    },
  };
}

export function speedCheckResults(): FixtureDetail {
  return { calibration: { phase: 'results', baseline: 520 } };
}
