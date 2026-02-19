import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  engineCalibrating,
  engineCalibrationIntro,
  engineCalibrationResults,
  engineContinueRound,
  engineNextQuestion,
  engineRoundComplete,
  engineRoundTimerExpired,
  engineRouteKey,
  engineStart,
  engineStop,
  engineSubmitAnswer,
  engineUpdateIdleMessage,
  engineUpdateMasteryAfterAnswer,
  engineUpdateProgress,
  initialEngineState,
} from './quiz-engine-state.js';

describe('initialEngineState', () => {
  it('returns idle phase', () => {
    const s = initialEngineState();
    assert.equal(s.phase, 'idle');
  });

  it('has no current item or answer', () => {
    const s = initialEngineState();
    assert.equal(s.currentItemId, null);
    assert.equal(s.answered, false);
    assert.equal(s.questionStartTime, null);
  });

  it('starts in idle phase with quiz inactive', () => {
    const s = initialEngineState();
    assert.equal(s.quizActive, false);
    assert.equal(s.answersEnabled, false);
  });

  it('has no feedback or mastery', () => {
    const s = initialEngineState();
    assert.equal(s.feedbackText, '');
    assert.equal(s.feedbackClass, 'feedback');
    assert.equal(s.timeDisplayText, '');
    assert.equal(s.hintText, '');
    assert.equal(s.masteryText, '');
    assert.equal(s.showMastery, false);
  });

  it('has round tracking at zero', () => {
    const s = initialEngineState();
    assert.equal(s.roundNumber, 0);
    assert.equal(s.roundAnswered, 0);
    assert.equal(s.roundCorrect, 0);
    assert.equal(s.roundTimerExpired, false);
  });
});

describe('engineStart', () => {
  it('sets phase to active', () => {
    const s = engineStart(initialEngineState());
    assert.equal(s.phase, 'active');
  });

  it('activates quiz area', () => {
    const s = engineStart(initialEngineState());
    assert.equal(s.quizActive, true);
  });

  it('initializes session tracking', () => {
    const s = engineStart(initialEngineState());
    assert.equal(s.questionCount, 0);
    assert.equal(typeof s.quizStartTime, 'number');
  });

  it('hides mastery message', () => {
    const before = {
      ...initialEngineState(),
      showMastery: true,
      masteryText: 'test',
    };
    const s = engineStart(before);
    assert.equal(s.showMastery, false);
  });

  it('initializes round 1', () => {
    const s = engineStart(initialEngineState());
    assert.equal(s.roundNumber, 1);
    assert.equal(s.roundAnswered, 0);
    assert.equal(s.roundCorrect, 0);
    assert.equal(s.roundTimerExpired, false);
  });
});

describe('engineNextQuestion', () => {
  it('sets currentItemId and questionStartTime', () => {
    const s = engineNextQuestion(
      engineStart(initialEngineState()),
      'item-1',
      12345,
    );
    assert.equal(s.currentItemId, 'item-1');
    assert.equal(s.questionStartTime, 12345);
  });

  it('clears answered flag', () => {
    const answered = { ...engineStart(initialEngineState()), answered: true };
    const s = engineNextQuestion(answered, 'item-2', 99999);
    assert.equal(s.answered, false);
  });

  it('increments question count', () => {
    const started = engineStart(initialEngineState());
    assert.equal(started.questionCount, 0);
    const q1 = engineNextQuestion(started, 'A', 1000);
    assert.equal(q1.questionCount, 1);
    const q2 = engineNextQuestion(q1, 'B', 2000);
    assert.equal(q2.questionCount, 2);
  });

  it('clears all feedback fields', () => {
    const withFeedback = {
      ...engineStart(initialEngineState()),
      feedbackText: 'Correct!',
      feedbackClass: 'feedback correct',
      timeDisplayText: '500 ms',
      hintText: 'Tap anywhere',
    };
    const s = engineNextQuestion(withFeedback, 'item-3', 10000);
    assert.equal(s.feedbackText, '');
    assert.equal(s.feedbackClass, 'feedback');
    assert.equal(s.timeDisplayText, '');
    assert.equal(s.hintText, '');
  });

  it('enables answer buttons', () => {
    const s = engineNextQuestion(
      engineStart(initialEngineState()),
      'item-1',
      1000,
    );
    assert.equal(s.answersEnabled, true);
  });
});

describe('engineSubmitAnswer', () => {
  const active = engineNextQuestion(
    engineStart(initialEngineState()),
    'item-1',
    1000,
  );

  it('sets correct feedback for correct answer', () => {
    const s = engineSubmitAnswer(active, true, 'C');
    assert.equal(s.feedbackText, 'Correct!');
    assert.equal(s.feedbackClass, 'feedback correct');
  });

  it('sets incorrect feedback with correct answer', () => {
    const s = engineSubmitAnswer(active, false, 'D#/Eb');
    assert.equal(s.feedbackText, 'Incorrect \u2014 D#/Eb');
    assert.equal(s.feedbackClass, 'feedback incorrect');
  });

  it('sets answered=true and disables answers', () => {
    const s = engineSubmitAnswer(active, true, 'C');
    assert.equal(s.answered, true);
    assert.equal(s.answersEnabled, false);
  });

  it('clears time display', () => {
    const s = engineSubmitAnswer(active, true, 'C');
    assert.equal(s.timeDisplayText, '');
  });

  it('shows hint text', () => {
    const s = engineSubmitAnswer(active, true, 'C');
    assert.equal(s.hintText, 'Tap anywhere or press Space for next');
  });

  it('increments roundAnswered on each answer', () => {
    const s1 = engineSubmitAnswer(active, true, 'C');
    assert.equal(s1.roundAnswered, 1);
    // Simulate next question and answer
    const q2 = engineNextQuestion(s1, 'item-2', 2000);
    const s2 = engineSubmitAnswer(q2, false, 'D');
    assert.equal(s2.roundAnswered, 2);
  });

  it('increments roundCorrect only for correct answers', () => {
    const correct = engineSubmitAnswer(active, true, 'C');
    assert.equal(correct.roundCorrect, 1);

    const q2 = engineNextQuestion(correct, 'item-2', 2000);
    const incorrect = engineSubmitAnswer(q2, false, 'D');
    assert.equal(incorrect.roundCorrect, 1); // still 1
  });
});

describe('engineStop', () => {
  it('returns to idle state', () => {
    const active = engineNextQuestion(
      engineStart(initialEngineState()),
      'item-1',
      1000,
    );
    const s = engineStop(active);
    assert.deepEqual(s, initialEngineState());
  });

  it('clears all quiz state even after answer', () => {
    const active = engineNextQuestion(
      engineStart(initialEngineState()),
      'item-1',
      1000,
    );
    const answered = engineSubmitAnswer(active, true, 'C');
    const s = engineStop(answered);
    assert.equal(s.phase, 'idle');
    assert.equal(s.currentItemId, null);
    assert.equal(s.answered, false);
    assert.equal(s.feedbackText, '');
  });
});

describe('engineUpdateIdleMessage', () => {
  it('returns state unchanged when active', () => {
    const active = engineStart(initialEngineState());
    const s = engineUpdateIdleMessage(active, true, false);
    assert.equal(s.showMastery, false); // engineStart hid it
    assert.equal(s, active); // same reference — no-op
  });

  it('shows mastery text when all mastered', () => {
    const s = engineUpdateIdleMessage(initialEngineState(), true, false);
    assert.equal(s.showMastery, true);
    assert.equal(s.masteryText, 'Looks like you\u2019ve got this!');
  });

  it('shows review text when needs review', () => {
    const s = engineUpdateIdleMessage(initialEngineState(), false, true);
    assert.equal(s.showMastery, true);
    assert.equal(s.masteryText, 'Time to review?');
  });

  it('hides mastery when neither mastered nor needs review', () => {
    const s = engineUpdateIdleMessage(initialEngineState(), false, false);
    assert.equal(s.showMastery, false);
    assert.equal(s.masteryText, '');
  });

  it('mastered takes priority over needs review', () => {
    const s = engineUpdateIdleMessage(initialEngineState(), true, true);
    assert.equal(s.masteryText, 'Looks like you\u2019ve got this!');
  });
});

describe('engineUpdateProgress', () => {
  const active = engineNextQuestion(
    engineStart(initialEngineState()),
    'item-1',
    1000,
  );

  it('sets mastered and total counts', () => {
    const s = engineUpdateProgress(active, 5, 10);
    assert.equal(s.masteredCount, 5);
    assert.equal(s.totalEnabledCount, 10);
  });

  it('preserves other state', () => {
    const s = engineUpdateProgress(active, 3, 7);
    assert.equal(s.phase, 'active');
    assert.equal(s.currentItemId, 'item-1');
  });
});

describe('engineUpdateMasteryAfterAnswer', () => {
  const active = engineNextQuestion(
    engineStart(initialEngineState()),
    'item-1',
    1000,
  );

  it('shows mastery when all mastered', () => {
    const s = engineUpdateMasteryAfterAnswer(active, true);
    assert.equal(s.showMastery, true);
    assert.equal(s.masteryText, 'Looks like you\u2019ve got this!');
  });

  it('hides mastery when not all mastered', () => {
    const s = engineUpdateMasteryAfterAnswer(active, false);
    assert.equal(s.showMastery, false);
  });
});

describe('engineCalibrationIntro', () => {
  it('sets phase to calibration-intro', () => {
    const s = engineCalibrationIntro(initialEngineState());
    assert.equal(s.phase, 'calibration-intro');
  });

  it('hides mastery message', () => {
    const s = engineCalibrationIntro(initialEngineState());
    assert.equal(s.showMastery, false);
  });

  it('shows quiz area but disables answers', () => {
    const s = engineCalibrationIntro(initialEngineState());
    assert.equal(s.quizActive, true);
    assert.equal(s.answersEnabled, false);
  });

  it('sets default calibration heading and explanation (highlight mode)', () => {
    const s = engineCalibrationIntro(initialEngineState());
    assert.equal(s.feedbackText, 'Quick Speed Check');
    assert.ok(s.hintText.includes('tap speed'));
    assert.ok(s.hintText.includes('highlighted button'));
  });

  it('uses hintOverride when provided (search mode)', () => {
    const override =
      'Press the button shown in the prompt \u2014 10 rounds total.';
    const s = engineCalibrationIntro(initialEngineState(), override);
    assert.equal(s.feedbackText, 'Quick Speed Check');
    assert.equal(s.hintText, override);
  });

  it('accepts empty string hintOverride without falling through to default', () => {
    const s = engineCalibrationIntro(initialEngineState(), '');
    assert.equal(s.hintText, '');
  });
});

describe('engineCalibrating', () => {
  it('sets phase to calibrating', () => {
    const s = engineCalibrating(engineCalibrationIntro(initialEngineState()));
    assert.equal(s.phase, 'calibrating');
  });

  it('enables answer buttons', () => {
    const s = engineCalibrating(engineCalibrationIntro(initialEngineState()));
    assert.equal(s.answersEnabled, true);
  });

  it('sets default trial instruction text (highlight mode)', () => {
    const s = engineCalibrating(engineCalibrationIntro(initialEngineState()));
    assert.equal(s.feedbackText, 'Speed check!');
    assert.ok(s.hintText.includes('highlighted button'));
  });

  it('uses hintOverride when provided (search mode)', () => {
    const override = 'Find and press the button';
    const s = engineCalibrating(
      engineCalibrationIntro(initialEngineState()),
      override,
    );
    assert.equal(s.feedbackText, 'Speed check!');
    assert.equal(s.hintText, override);
  });

  it('accepts empty string hintOverride without falling through to default', () => {
    const s = engineCalibrating(
      engineCalibrationIntro(initialEngineState()),
      '',
    );
    assert.equal(s.hintText, '');
  });
});

describe('engineCalibrationResults', () => {
  it('sets phase to calibration-results', () => {
    const intro = engineCalibrationIntro(initialEngineState());
    const running = engineCalibrating(intro);
    const s = engineCalibrationResults(running, 600);
    assert.equal(s.phase, 'calibration-results');
  });

  it('stores baseline in state', () => {
    const s = engineCalibrationResults(
      engineCalibrating(engineCalibrationIntro(initialEngineState())),
      750,
    );
    assert.equal(s.calibrationBaseline, 750);
  });

  it('disables answers and sets heading', () => {
    const s = engineCalibrationResults(
      engineCalibrating(engineCalibrationIntro(initialEngineState())),
      600,
    );
    assert.equal(s.answersEnabled, false);
    assert.equal(s.feedbackText, 'Speed Check Complete');
    assert.equal(s.hintText, '');
  });
});

describe('engineStop from calibration', () => {
  it('returns to idle from calibration-intro', () => {
    const s = engineStop(engineCalibrationIntro(initialEngineState()));
    assert.deepEqual(s, initialEngineState());
  });

  it('returns to idle from calibrating', () => {
    const s = engineStop(
      engineCalibrating(engineCalibrationIntro(initialEngineState())),
    );
    assert.deepEqual(s, initialEngineState());
  });

  it('returns to idle from calibration-results', () => {
    const s = engineStop(
      engineCalibrationResults(
        engineCalibrating(engineCalibrationIntro(initialEngineState())),
        600,
      ),
    );
    assert.deepEqual(s, initialEngineState());
  });
});

describe('engineRouteKey', () => {
  const idle = initialEngineState();
  const active = engineNextQuestion(
    engineStart(initialEngineState()),
    'item-1',
    1000,
  );
  const answered = engineSubmitAnswer(active, true, 'C');
  const calibIntro = engineCalibrationIntro(initialEngineState());
  const calibRunning = engineCalibrating(calibIntro);
  const calibResults = engineCalibrationResults(calibRunning, 600);

  it('idle phase: all keys return ignore', () => {
    assert.deepEqual(engineRouteKey(idle, 'Escape'), { action: 'ignore' });
    assert.deepEqual(engineRouteKey(idle, ' '), { action: 'ignore' });
    assert.deepEqual(engineRouteKey(idle, 'c'), { action: 'ignore' });
  });

  it('active + Escape returns stop', () => {
    assert.deepEqual(engineRouteKey(active, 'Escape'), { action: 'stop' });
  });

  it('active + unanswered + Escape returns stop', () => {
    assert.deepEqual(engineRouteKey(active, 'Escape'), { action: 'stop' });
  });

  it('active + answered + Space returns next', () => {
    assert.deepEqual(engineRouteKey(answered, ' '), { action: 'next' });
  });

  it('active + answered + Enter returns next', () => {
    assert.deepEqual(engineRouteKey(answered, 'Enter'), { action: 'next' });
  });

  it('active + unanswered + letter returns delegate', () => {
    assert.deepEqual(engineRouteKey(active, 'c'), { action: 'delegate' });
  });

  it('active + answered + letter returns ignore', () => {
    assert.deepEqual(engineRouteKey(answered, 'c'), { action: 'ignore' });
  });

  it('active + unanswered + Space returns delegate (not next)', () => {
    assert.deepEqual(engineRouteKey(active, ' '), { action: 'delegate' });
  });

  it('calibration-intro + Escape returns stop', () => {
    assert.deepEqual(engineRouteKey(calibIntro, 'Escape'), { action: 'stop' });
  });

  it('calibration-intro + other keys return ignore', () => {
    assert.deepEqual(engineRouteKey(calibIntro, ' '), { action: 'ignore' });
    assert.deepEqual(engineRouteKey(calibIntro, 'c'), { action: 'ignore' });
  });

  it('calibrating + Escape returns stop', () => {
    assert.deepEqual(engineRouteKey(calibRunning, 'Escape'), {
      action: 'stop',
    });
  });

  it('calibrating + other keys return ignore', () => {
    assert.deepEqual(engineRouteKey(calibRunning, 'c'), { action: 'ignore' });
  });

  it('calibration-results + Escape returns stop', () => {
    assert.deepEqual(engineRouteKey(calibResults, 'Escape'), {
      action: 'stop',
    });
  });

  it('calibration-results + other keys return ignore', () => {
    assert.deepEqual(engineRouteKey(calibResults, ' '), { action: 'ignore' });
  });
});

describe('engineRoundTimerExpired', () => {
  const active = engineNextQuestion(
    engineStart(initialEngineState()),
    'item-1',
    1000,
  );

  it('sets roundTimerExpired to true', () => {
    const s = engineRoundTimerExpired(active);
    assert.equal(s.roundTimerExpired, true);
  });

  it('preserves other state', () => {
    const s = engineRoundTimerExpired(active);
    assert.equal(s.phase, 'active');
    assert.equal(s.currentItemId, 'item-1');
    assert.equal(s.answersEnabled, true);
  });
});

describe('engineRoundComplete', () => {
  const active = engineNextQuestion(
    engineStart(initialEngineState()),
    'item-1',
    1000,
  );
  const withAnswers = engineSubmitAnswer(active, true, 'C');

  it('sets phase to round-complete', () => {
    const s = engineRoundComplete(withAnswers);
    assert.equal(s.phase, 'round-complete');
  });

  it('disables answers and clears current item', () => {
    const s = engineRoundComplete(withAnswers);
    assert.equal(s.answersEnabled, false);
    assert.equal(s.currentItemId, null);
    assert.equal(s.answered, false);
  });

  it('preserves round counts', () => {
    const s = engineRoundComplete(withAnswers);
    assert.equal(s.roundAnswered, 1);
    assert.equal(s.roundCorrect, 1);
    assert.equal(s.roundNumber, 1);
  });

  it('clears feedback', () => {
    const s = engineRoundComplete(withAnswers);
    assert.equal(s.feedbackText, '');
    assert.equal(s.hintText, '');
  });
});

describe('engineContinueRound', () => {
  const active = engineNextQuestion(
    engineStart(initialEngineState()),
    'item-1',
    1000,
  );
  const answered = engineSubmitAnswer(active, true, 'C');
  const roundComplete = engineRoundComplete(answered);

  it('sets phase back to active', () => {
    const s = engineContinueRound(roundComplete);
    assert.equal(s.phase, 'active');
  });

  it('increments round number', () => {
    const s = engineContinueRound(roundComplete);
    assert.equal(s.roundNumber, 2);
  });

  it('resets round counters', () => {
    const s = engineContinueRound(roundComplete);
    assert.equal(s.roundAnswered, 0);
    assert.equal(s.roundCorrect, 0);
    assert.equal(s.roundTimerExpired, false);
  });

  it('preserves session question count', () => {
    const s = engineContinueRound(roundComplete);
    assert.equal(s.questionCount, 1); // from the one question before round complete
  });
});

describe('engineRouteKey in round-complete', () => {
  const active = engineNextQuestion(
    engineStart(initialEngineState()),
    'item-1',
    1000,
  );
  const answered = engineSubmitAnswer(active, true, 'C');
  const roundComplete = engineRoundComplete(answered);

  it('Space returns continue', () => {
    assert.deepEqual(engineRouteKey(roundComplete, ' '), {
      action: 'continue',
    });
  });

  it('Enter returns continue', () => {
    assert.deepEqual(engineRouteKey(roundComplete, 'Enter'), {
      action: 'continue',
    });
  });

  it('Escape returns stop', () => {
    assert.deepEqual(engineRouteKey(roundComplete, 'Escape'), {
      action: 'stop',
    });
  });

  it('other keys return ignore', () => {
    assert.deepEqual(engineRouteKey(roundComplete, 'c'), { action: 'ignore' });
  });
});

describe('engineSubmitAnswer time format', () => {
  const active = engineNextQuestion(
    engineStart(initialEngineState()),
    'item-1',
    1000,
  );

  it('clears time display', () => {
    const s = engineSubmitAnswer(active, true, 'C');
    assert.equal(s.timeDisplayText, '');
  });
});
