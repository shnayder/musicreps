import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { TARGET_TIME } from "./quiz-engine.js";

describe("quiz-engine constants", () => {
  it("TARGET_TIME is 3000ms", () => {
    assert.equal(TARGET_TIME, 3000);
  });
});

// Note: createQuizEngine requires DOM + global createAdaptiveSelector/
// createLocalStorageAdapter. Full integration tests run in the browser.
// The engine is intentionally thin — most logic lives in adaptive.js
// (well-tested) and the mode configs.
