import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  initialEngineState,
  engineStart,
  engineNextQuestion,
  engineSubmitAnswer,
  engineStop,
  engineUpdateIdleMessage,
  engineUpdateMasteryAfterAnswer,
  engineRouteKey,
} from "./quiz-engine-state.js";

describe("initialEngineState", () => {
  it("returns idle phase", () => {
    const s = initialEngineState();
    assert.equal(s.phase, "idle");
  });

  it("has no current item or answer", () => {
    const s = initialEngineState();
    assert.equal(s.currentItemId, null);
    assert.equal(s.answered, false);
    assert.equal(s.questionStartTime, null);
  });

  it("shows start and heatmap buttons, hides stop", () => {
    const s = initialEngineState();
    assert.equal(s.showStartBtn, true);
    assert.equal(s.showHeatmapBtn, true);
    assert.equal(s.showStopBtn, false);
    assert.equal(s.showStatsControls, true);
  });

  it("has no feedback or mastery", () => {
    const s = initialEngineState();
    assert.equal(s.feedbackText, "");
    assert.equal(s.feedbackClass, "feedback");
    assert.equal(s.timeDisplayText, "");
    assert.equal(s.hintText, "");
    assert.equal(s.masteryText, "");
    assert.equal(s.showMastery, false);
  });

  it("quiz is inactive and answers disabled", () => {
    const s = initialEngineState();
    assert.equal(s.quizActive, false);
    assert.equal(s.answersEnabled, false);
  });
});

describe("engineStart", () => {
  it("sets phase to active", () => {
    const s = engineStart(initialEngineState());
    assert.equal(s.phase, "active");
  });

  it("shows stop button, hides start/heatmap/stats", () => {
    const s = engineStart(initialEngineState());
    assert.equal(s.showStartBtn, false);
    assert.equal(s.showStopBtn, true);
    assert.equal(s.showHeatmapBtn, false);
    assert.equal(s.showStatsControls, false);
  });

  it("activates quiz area", () => {
    const s = engineStart(initialEngineState());
    assert.equal(s.quizActive, true);
  });

  it("hides mastery message", () => {
    const before = { ...initialEngineState(), showMastery: true, masteryText: "test" };
    const s = engineStart(before);
    assert.equal(s.showMastery, false);
  });
});

describe("engineNextQuestion", () => {
  it("sets currentItemId and questionStartTime", () => {
    const s = engineNextQuestion(engineStart(initialEngineState()), "item-1", 12345);
    assert.equal(s.currentItemId, "item-1");
    assert.equal(s.questionStartTime, 12345);
  });

  it("clears answered flag", () => {
    const answered = { ...engineStart(initialEngineState()), answered: true };
    const s = engineNextQuestion(answered, "item-2", 99999);
    assert.equal(s.answered, false);
  });

  it("clears all feedback fields", () => {
    const withFeedback = {
      ...engineStart(initialEngineState()),
      feedbackText: "Correct!",
      feedbackClass: "feedback correct",
      timeDisplayText: "500 ms",
      hintText: "Tap anywhere",
    };
    const s = engineNextQuestion(withFeedback, "item-3", 10000);
    assert.equal(s.feedbackText, "");
    assert.equal(s.feedbackClass, "feedback");
    assert.equal(s.timeDisplayText, "");
    assert.equal(s.hintText, "");
  });

  it("enables answer buttons", () => {
    const s = engineNextQuestion(engineStart(initialEngineState()), "item-1", 1000);
    assert.equal(s.answersEnabled, true);
  });
});

describe("engineSubmitAnswer", () => {
  const active = engineNextQuestion(engineStart(initialEngineState()), "item-1", 1000);

  it("sets correct feedback for correct answer", () => {
    const s = engineSubmitAnswer(active, true, "C", 500);
    assert.equal(s.feedbackText, "Correct!");
    assert.equal(s.feedbackClass, "feedback correct");
  });

  it("sets incorrect feedback with correct answer", () => {
    const s = engineSubmitAnswer(active, false, "D#/Eb", 800);
    assert.equal(s.feedbackText, "Incorrect \u2014 D#/Eb");
    assert.equal(s.feedbackClass, "feedback incorrect");
  });

  it("sets answered=true and disables answers", () => {
    const s = engineSubmitAnswer(active, true, "C", 500);
    assert.equal(s.answered, true);
    assert.equal(s.answersEnabled, false);
  });

  it("shows response time", () => {
    const s = engineSubmitAnswer(active, true, "C", 1234);
    assert.equal(s.timeDisplayText, "1234 ms");
  });

  it("shows hint text", () => {
    const s = engineSubmitAnswer(active, true, "C", 500);
    assert.equal(s.hintText, "Tap anywhere or press Space for next");
  });
});

describe("engineStop", () => {
  it("returns to idle state", () => {
    const active = engineNextQuestion(engineStart(initialEngineState()), "item-1", 1000);
    const s = engineStop(active);
    assert.deepEqual(s, initialEngineState());
  });

  it("clears all quiz state even after answer", () => {
    const active = engineNextQuestion(engineStart(initialEngineState()), "item-1", 1000);
    const answered = engineSubmitAnswer(active, true, "C", 500);
    const s = engineStop(answered);
    assert.equal(s.phase, "idle");
    assert.equal(s.currentItemId, null);
    assert.equal(s.answered, false);
    assert.equal(s.feedbackText, "");
  });
});

describe("engineUpdateIdleMessage", () => {
  it("returns state unchanged when active", () => {
    const active = engineStart(initialEngineState());
    const s = engineUpdateIdleMessage(active, true, false);
    assert.equal(s.showMastery, false); // engineStart hid it
    assert.equal(s, active); // same reference — no-op
  });

  it("shows mastery text when all mastered", () => {
    const s = engineUpdateIdleMessage(initialEngineState(), true, false);
    assert.equal(s.showMastery, true);
    assert.equal(s.masteryText, "Looks like you\u2019ve got this!");
  });

  it("shows review text when needs review", () => {
    const s = engineUpdateIdleMessage(initialEngineState(), false, true);
    assert.equal(s.showMastery, true);
    assert.equal(s.masteryText, "Time to review?");
  });

  it("hides mastery when neither mastered nor needs review", () => {
    const s = engineUpdateIdleMessage(initialEngineState(), false, false);
    assert.equal(s.showMastery, false);
    assert.equal(s.masteryText, "");
  });

  it("mastered takes priority over needs review", () => {
    const s = engineUpdateIdleMessage(initialEngineState(), true, true);
    assert.equal(s.masteryText, "Looks like you\u2019ve got this!");
  });
});

describe("engineUpdateMasteryAfterAnswer", () => {
  const active = engineNextQuestion(engineStart(initialEngineState()), "item-1", 1000);

  it("shows mastery when all mastered", () => {
    const s = engineUpdateMasteryAfterAnswer(active, true);
    assert.equal(s.showMastery, true);
    assert.equal(s.masteryText, "Looks like you\u2019ve got this!");
  });

  it("hides mastery when not all mastered", () => {
    const s = engineUpdateMasteryAfterAnswer(active, false);
    assert.equal(s.showMastery, false);
  });
});

describe("engineRouteKey", () => {
  const idle = initialEngineState();
  const active = engineNextQuestion(engineStart(initialEngineState()), "item-1", 1000);
  const answered = engineSubmitAnswer(active, true, "C", 500);

  it("idle phase: all keys return ignore", () => {
    assert.deepEqual(engineRouteKey(idle, "Escape"), { action: "ignore" });
    assert.deepEqual(engineRouteKey(idle, " "), { action: "ignore" });
    assert.deepEqual(engineRouteKey(idle, "c"), { action: "ignore" });
  });

  it("active + Escape returns stop", () => {
    assert.deepEqual(engineRouteKey(active, "Escape"), { action: "stop" });
  });

  it("active + unanswered + Escape returns stop", () => {
    assert.deepEqual(engineRouteKey(active, "Escape"), { action: "stop" });
  });

  it("active + answered + Space returns next", () => {
    assert.deepEqual(engineRouteKey(answered, " "), { action: "next" });
  });

  it("active + answered + Enter returns next", () => {
    assert.deepEqual(engineRouteKey(answered, "Enter"), { action: "next" });
  });

  it("active + unanswered + letter returns delegate", () => {
    assert.deepEqual(engineRouteKey(active, "c"), { action: "delegate" });
  });

  it("active + answered + letter returns ignore", () => {
    assert.deepEqual(engineRouteKey(answered, "c"), { action: "ignore" });
  });

  it("active + unanswered + Space returns delegate (not next)", () => {
    assert.deepEqual(engineRouteKey(active, " "), { action: "delegate" });
  });
});
