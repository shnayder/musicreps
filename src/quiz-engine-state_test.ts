import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  initialEngineState,
  engineStart,
  engineNextQuestion,
  engineSubmitAnswer,
  engineTimedOut,
  engineStop,
  engineUpdateIdleMessage,
  engineUpdateMasteryAfterAnswer,
  engineUpdateProgress,
  engineRouteKey,
  engineCalibrationIntro,
  engineCalibrating,
  engineCalibrationResults,
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

  it("hides start/stop/heatmap/stats buttons (X close replaces stop)", () => {
    const s = engineStart(initialEngineState());
    assert.equal(s.showStartBtn, false);
    assert.equal(s.showStopBtn, false);
    assert.equal(s.showHeatmapBtn, false);
    assert.equal(s.showStatsControls, false);
  });

  it("activates quiz area", () => {
    const s = engineStart(initialEngineState());
    assert.equal(s.quizActive, true);
  });

  it("initializes session tracking", () => {
    const s = engineStart(initialEngineState());
    assert.equal(s.questionCount, 0);
    assert.equal(typeof s.quizStartTime, "number");
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

  it("increments question count", () => {
    const started = engineStart(initialEngineState());
    assert.equal(started.questionCount, 0);
    const q1 = engineNextQuestion(started, "A", 1000);
    assert.equal(q1.questionCount, 1);
    const q2 = engineNextQuestion(q1, "B", 2000);
    assert.equal(q2.questionCount, 2);
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
    assert.equal(s.timeDisplayText, "1.2s");
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

describe("engineUpdateProgress", () => {
  const active = engineNextQuestion(engineStart(initialEngineState()), "item-1", 1000);

  it("sets mastered and total counts", () => {
    const s = engineUpdateProgress(active, 5, 10);
    assert.equal(s.masteredCount, 5);
    assert.equal(s.totalEnabledCount, 10);
  });

  it("preserves other state", () => {
    const s = engineUpdateProgress(active, 3, 7);
    assert.equal(s.phase, "active");
    assert.equal(s.currentItemId, "item-1");
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

describe("engineCalibrationIntro", () => {
  it("sets phase to calibration-intro", () => {
    const s = engineCalibrationIntro(initialEngineState());
    assert.equal(s.phase, "calibration-intro");
  });

  it("hides all quiz controls", () => {
    const s = engineCalibrationIntro(initialEngineState());
    assert.equal(s.showStartBtn, false);
    assert.equal(s.showStopBtn, false);
    assert.equal(s.showHeatmapBtn, false);
    assert.equal(s.showStatsControls, false);
    assert.equal(s.showMastery, false);
  });

  it("shows quiz area but disables answers", () => {
    const s = engineCalibrationIntro(initialEngineState());
    assert.equal(s.quizActive, true);
    assert.equal(s.answersEnabled, false);
  });

  it("sets calibration heading and explanation", () => {
    const s = engineCalibrationIntro(initialEngineState());
    assert.equal(s.feedbackText, "Quick Speed Check");
    assert.ok(s.hintText.includes("tap speed"));
  });
});

describe("engineCalibrating", () => {
  it("sets phase to calibrating", () => {
    const s = engineCalibrating(engineCalibrationIntro(initialEngineState()));
    assert.equal(s.phase, "calibrating");
  });

  it("enables answer buttons", () => {
    const s = engineCalibrating(engineCalibrationIntro(initialEngineState()));
    assert.equal(s.answersEnabled, true);
  });

  it("sets trial instruction text", () => {
    const s = engineCalibrating(engineCalibrationIntro(initialEngineState()));
    assert.equal(s.feedbackText, "Speed check!");
    assert.ok(s.hintText.includes("highlighted button"));
  });
});

describe("engineCalibrationResults", () => {
  it("sets phase to calibration-results", () => {
    const intro = engineCalibrationIntro(initialEngineState());
    const running = engineCalibrating(intro);
    const s = engineCalibrationResults(running, 600);
    assert.equal(s.phase, "calibration-results");
  });

  it("stores baseline in state", () => {
    const s = engineCalibrationResults(engineCalibrating(engineCalibrationIntro(initialEngineState())), 750);
    assert.equal(s.calibrationBaseline, 750);
  });

  it("disables answers and sets heading", () => {
    const s = engineCalibrationResults(engineCalibrating(engineCalibrationIntro(initialEngineState())), 600);
    assert.equal(s.answersEnabled, false);
    assert.equal(s.feedbackText, "Speed Check Complete");
    assert.equal(s.hintText, "");
  });
});

describe("engineStop from calibration", () => {
  it("returns to idle from calibration-intro", () => {
    const s = engineStop(engineCalibrationIntro(initialEngineState()));
    assert.deepEqual(s, initialEngineState());
  });

  it("returns to idle from calibrating", () => {
    const s = engineStop(engineCalibrating(engineCalibrationIntro(initialEngineState())));
    assert.deepEqual(s, initialEngineState());
  });

  it("returns to idle from calibration-results", () => {
    const s = engineStop(engineCalibrationResults(engineCalibrating(engineCalibrationIntro(initialEngineState())), 600));
    assert.deepEqual(s, initialEngineState());
  });
});

describe("engineRouteKey", () => {
  const idle = initialEngineState();
  const active = engineNextQuestion(engineStart(initialEngineState()), "item-1", 1000);
  const answered = engineSubmitAnswer(active, true, "C", 500);
  const calibIntro = engineCalibrationIntro(initialEngineState());
  const calibRunning = engineCalibrating(calibIntro);
  const calibResults = engineCalibrationResults(calibRunning, 600);

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

  it("calibration-intro + Escape returns stop", () => {
    assert.deepEqual(engineRouteKey(calibIntro, "Escape"), { action: "stop" });
  });

  it("calibration-intro + other keys return ignore", () => {
    assert.deepEqual(engineRouteKey(calibIntro, " "), { action: "ignore" });
    assert.deepEqual(engineRouteKey(calibIntro, "c"), { action: "ignore" });
  });

  it("calibrating + Escape returns stop", () => {
    assert.deepEqual(engineRouteKey(calibRunning, "Escape"), { action: "stop" });
  });

  it("calibrating + other keys return ignore", () => {
    assert.deepEqual(engineRouteKey(calibRunning, "c"), { action: "ignore" });
  });

  it("calibration-results + Escape returns stop", () => {
    assert.deepEqual(engineRouteKey(calibResults, "Escape"), { action: "stop" });
  });

  it("calibration-results + other keys return ignore", () => {
    assert.deepEqual(engineRouteKey(calibResults, " "), { action: "ignore" });
  });
});

describe("engineTimedOut", () => {
  const active = engineNextQuestion(engineStart(initialEngineState()), "item-1", 1000);

  it("sets answered to true and disables answers", () => {
    const s = engineTimedOut(active, "C", 3000);
    assert.equal(s.answered, true);
    assert.equal(s.answersEnabled, false);
  });

  it("sets timedOut flag", () => {
    const s = engineTimedOut(active, "C", 3000);
    assert.equal(s.timedOut, true);
  });

  it("shows timeout feedback text", () => {
    const s = engineTimedOut(active, "C", 3000);
    assert.equal(s.feedbackText, "Time\u2019s up \u2014 C");
  });

  it("uses incorrect feedback class", () => {
    const s = engineTimedOut(active, "C", 3000);
    assert.equal(s.feedbackClass, "feedback incorrect");
  });

  it("shows deadline in time display", () => {
    const s = engineTimedOut(active, "C", 3000);
    assert.equal(s.timeDisplayText, "limit: 3.0s");
  });

  it("formats fractional deadline correctly", () => {
    const s = engineTimedOut(active, "D#", 2450);
    assert.equal(s.timeDisplayText, "limit: 2.5s");
    assert.equal(s.feedbackText, "Time\u2019s up \u2014 D#");
  });

  it("shows hint for advancing", () => {
    const s = engineTimedOut(active, "C", 3000);
    assert.equal(s.hintText, "Tap anywhere or press Space for next");
  });
});

describe("engineSubmitAnswer time format", () => {
  const active = engineNextQuestion(engineStart(initialEngineState()), "item-1", 1000);

  it("formats response time in seconds", () => {
    const s = engineSubmitAnswer(active, true, "C", 1234);
    assert.equal(s.timeDisplayText, "1.2s");
  });

  it("formats fast response time", () => {
    const s = engineSubmitAnswer(active, true, "C", 800);
    assert.equal(s.timeDisplayText, "0.8s");
  });

  it("sets timedOut to false on normal answer", () => {
    const s = engineSubmitAnswer(active, true, "C", 1000);
    assert.equal(s.timedOut, false);
  });
});

describe("timedOut in initial and next-question state", () => {
  it("initial state has timedOut false", () => {
    assert.equal(initialEngineState().timedOut, false);
  });

  it("next question resets timedOut", () => {
    const active = engineStart(initialEngineState());
    const q = engineNextQuestion(active, "item-1", 1000);
    assert.equal(q.timedOut, false);
  });
});
