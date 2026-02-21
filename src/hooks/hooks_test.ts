// Tests for hook-related pure logic.
// Hooks themselves require a browser environment (localStorage, DOM events),
// so we test the extracted pure functions and type contracts here.
// Full integration tests will run in Phase 5 with the first mode migration.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Import types to verify type contracts compile
import type { QuizEngineConfig } from './use-quiz-engine.ts';
import type { ScopeActions } from './use-scope-state.ts';
import type { LearnerModel } from './use-learner-model.ts';

// Import the pure state machine used by useQuizEngine
import {
  engineContinueRound,
  engineNextQuestion,
  engineRoundComplete,
  engineRoundTimerExpired,
  engineRouteKey,
  engineStart,
  engineStop,
  engineSubmitAnswer,
  engineUpdateIdleMessage,
  engineUpdateProgress,
  initialEngineState,
} from '../quiz-engine-state.ts';

// ---------------------------------------------------------------------------
// Engine state transitions (used by useQuizEngine)
// ---------------------------------------------------------------------------

describe('Engine state transitions (hook foundation)', () => {
  it('initialEngineState returns idle phase', () => {
    const s = initialEngineState();
    assert.equal(s.phase, 'idle');
    assert.equal(s.quizActive, false);
    assert.equal(s.answered, false);
    assert.equal(s.currentItemId, null);
  });

  it('engineStart transitions to active', () => {
    const s = engineStart(initialEngineState());
    assert.equal(s.phase, 'active');
    assert.equal(s.quizActive, true);
    assert.equal(s.roundNumber, 1);
  });

  it('engineNextQuestion sets item and resets answered', () => {
    let s = engineStart(initialEngineState());
    s = engineNextQuestion(s, 'C+3', Date.now());
    assert.equal(s.currentItemId, 'C+3');
    assert.equal(s.answered, false);
    assert.equal(s.answersEnabled, true);
  });

  it('engineSubmitAnswer records correct/incorrect', () => {
    let s = engineStart(initialEngineState());
    s = engineNextQuestion(s, 'C+3', Date.now());
    const correct = engineSubmitAnswer(s, true, 'F');
    assert.equal(correct.answered, true);
    assert.equal(correct.roundCorrect, 1);
    assert.equal(correct.roundAnswered, 1);
    assert.ok(correct.feedbackClass.includes('correct'));

    const wrong = engineSubmitAnswer(s, false, 'F');
    assert.equal(wrong.answered, true);
    assert.equal(wrong.roundCorrect, 0);
    assert.ok(wrong.feedbackClass.includes('incorrect'));
  });

  it('engineRoundTimerExpired marks timer as expired', () => {
    let s = engineStart(initialEngineState());
    s = engineNextQuestion(s, 'C+3', Date.now());
    s = engineRoundTimerExpired(s);
    assert.equal(s.roundTimerExpired, true);
  });

  it('engineRoundComplete transitions to round-complete', () => {
    let s = engineStart(initialEngineState());
    s = engineNextQuestion(s, 'C+3', Date.now());
    s = engineSubmitAnswer(s, true, 'F');
    s = engineRoundComplete(s);
    assert.equal(s.phase, 'round-complete');
  });

  it('engineContinueRound starts new round', () => {
    let s = engineStart(initialEngineState());
    s = engineNextQuestion(s, 'C+3', Date.now());
    s = engineRoundComplete(s);
    s = engineContinueRound(s);
    assert.equal(s.phase, 'active');
    assert.equal(s.roundNumber, 2);
    assert.equal(s.roundAnswered, 0);
    assert.equal(s.roundCorrect, 0);
  });

  it('engineStop returns to idle', () => {
    let s = engineStart(initialEngineState());
    s = engineStop(s);
    assert.equal(s.phase, 'idle');
    assert.equal(s.quizActive, false);
  });

  it('engineUpdateProgress sets mastered/total', () => {
    const s = engineUpdateProgress(initialEngineState(), 5, 12);
    assert.equal(s.masteredCount, 5);
    assert.equal(s.totalEnabledCount, 12);
  });

  it('engineUpdateIdleMessage sets mastery text', () => {
    const s = engineUpdateIdleMessage(initialEngineState(), true, false);
    assert.ok(s.showMastery);
    assert.ok(s.masteryText.length > 0);
  });
});

// ---------------------------------------------------------------------------
// Key routing (used by useQuizEngine)
// ---------------------------------------------------------------------------

describe('engineRouteKey (hook keyboard routing)', () => {
  it('routes Escape to stop during active', () => {
    let s = engineStart(initialEngineState());
    s = engineNextQuestion(s, 'C+3', Date.now());
    const routed = engineRouteKey(s, 'Escape');
    assert.equal(routed.action, 'stop');
  });

  it('routes Space to next when answered', () => {
    let s = engineStart(initialEngineState());
    s = engineNextQuestion(s, 'C+3', Date.now());
    s = engineSubmitAnswer(s, true, 'F');
    const routed = engineRouteKey(s, ' ');
    assert.equal(routed.action, 'next');
  });

  it('delegates to mode when not answered', () => {
    let s = engineStart(initialEngineState());
    s = engineNextQuestion(s, 'C+3', Date.now());
    const routed = engineRouteKey(s, 'a');
    assert.equal(routed.action, 'delegate');
  });

  it('routes Space to continue at round-complete', () => {
    let s = engineStart(initialEngineState());
    s = engineNextQuestion(s, 'C+3', Date.now());
    s = engineRoundComplete(s);
    const routed = engineRouteKey(s, ' ');
    assert.equal(routed.action, 'continue');
  });

  it('ignores keys in idle', () => {
    const routed = engineRouteKey(initialEngineState(), 'a');
    assert.equal(routed.action, 'ignore');
  });
});

// ---------------------------------------------------------------------------
// Type contract verification
// ---------------------------------------------------------------------------

describe('Hook type contracts', () => {
  it('QuizEngineConfig type is valid', () => {
    // Verify the type compiles by constructing a mock
    const _config: QuizEngineConfig = {
      getEnabledItems: () => ['C+1', 'C+2'],
      checkAnswer: (_id, _input) => ({ correct: true, correctAnswer: 'F' }),
    };
    assert.ok(_config);
  });

  it('ScopeActions type is valid', () => {
    const _actions: ScopeActions = {
      toggleGroup: () => {},
      toggleString: () => {},
      setNoteFilter: () => {},
      setScope: () => {},
    };
    assert.ok(_actions);
  });

  it('LearnerModel type is valid', () => {
    // Just verify the type shape compiles
    const _check: keyof LearnerModel = 'selector';
    assert.ok(_check);
  });
});
