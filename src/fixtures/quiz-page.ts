// Page-level quiz fixtures: compose leaf fixtures into full EngineState +
// timer overrides. Used by take-screenshots.ts to inject state via
// __fixture__ events.

import type { EngineState } from '../types.ts';
import type { SpeedCheckFixture } from '../ui/speed-check.tsx';
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

/** Shape dispatched via __fixture__ custom event. */
export type FixtureDetail = {
  engineState?: Partial<EngineState>;
  timerPct?: number;
  timerText?: string;
  timerWarning?: boolean;
  timerLastQuestion?: boolean;
  calibration?: SpeedCheckFixture;
};

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
  const s = buildActiveState(itemId, {
    correct: true,
    correctAnswer: feedbackCorrect.displayAnswer,
    masteredCount: sessionEarlyRound.fluent,
    totalEnabledCount: sessionEarlyRound.total,
    questionCount: 14,
  });
  return {
    engineState: {
      ...s,
      feedbackText: feedbackCorrect.text,
      feedbackClass: feedbackCorrect.className,
      feedbackCorrect: feedbackCorrect.correct,
      feedbackDisplayAnswer: feedbackCorrect.displayAnswer,
      timeDisplayText: feedbackCorrect.time,
      hintText: feedbackCorrect.hint,
    },
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
  const s = buildActiveState(itemId, {
    correct: false,
    correctAnswer: feedbackWrong.displayAnswer,
    masteredCount: sessionLateRound.fluent,
    totalEnabledCount: sessionLateRound.total,
    questionCount: 22,
  });
  return {
    engineState: {
      ...s,
      feedbackText: feedbackWrong.text,
      feedbackClass: feedbackWrong.className,
      feedbackCorrect: feedbackWrong.correct,
      feedbackDisplayAnswer: feedbackWrong.displayAnswer,
      hintText: feedbackWrong.hint,
    },
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
      feedbackText: feedbackCorrect.text,
      feedbackClass: feedbackCorrect.className,
      feedbackCorrect: feedbackCorrect.correct,
      feedbackDisplayAnswer: feedbackCorrect.displayAnswer,
      timeDisplayText: feedbackCorrect.time,
      hintText: feedbackCorrect.hint,
    },
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
// Quiz active: answered the last question (feedback + "Last question")
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
      feedbackText: feedbackWrong.text,
      feedbackClass: feedbackWrong.className,
      feedbackCorrect: feedbackWrong.correct,
      feedbackDisplayAnswer: feedbackWrong.displayAnswer,
      hintText: feedbackWrong.hint,
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
  // The RoundComplete component reads derived state from useRoundSummary,
  // not directly from engineState, but the engine phase drives visibility.
  // We store the display data so the screenshot script can verify.
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
