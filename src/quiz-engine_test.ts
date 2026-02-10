import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TARGET_TIME, createNoteKeyHandler, updateModeStats } from "./quiz-engine.js";
import { createMemoryStorage, createAdaptiveSelector } from "./adaptive.js";

describe("quiz-engine constants", () => {
  it("TARGET_TIME is 3000ms", () => {
    assert.equal(TARGET_TIME, 3000);
  });
});

describe("createNoteKeyHandler", () => {
  it("submits natural note immediately when accidentals disabled", () => {
    const submitted: string[] = [];
    const handler = createNoteKeyHandler(
      (input: string) => submitted.push(input),
      () => false,
    );
    const e = { key: "c", preventDefault() {} } as any;
    const handled = handler.handleKey(e);
    assert.ok(handled);
    assert.deepEqual(submitted, ["C"]);
  });

  it("submits sharp when # follows a letter", () => {
    const submitted: string[] = [];
    const handler = createNoteKeyHandler(
      (input: string) => submitted.push(input),
      () => true,
    );
    handler.handleKey({ key: "c", preventDefault() {} } as any);
    assert.equal(submitted.length, 0); // pending
    handler.handleKey({ key: "#", shiftKey: false, preventDefault() {} } as any);
    assert.deepEqual(submitted, ["C#"]);
  });

  it("submits flat when b follows a letter", () => {
    const submitted: string[] = [];
    const handler = createNoteKeyHandler(
      (input: string) => submitted.push(input),
      () => true,
    );
    handler.handleKey({ key: "d", preventDefault() {} } as any);
    handler.handleKey({ key: "b", shiftKey: false, preventDefault() {} } as any);
    assert.deepEqual(submitted, ["Db"]);
  });

  it("ignores non-note keys", () => {
    const submitted: string[] = [];
    const handler = createNoteKeyHandler(
      (input: string) => submitted.push(input),
      () => true,
    );
    const handled = handler.handleKey({ key: "x", preventDefault() {} } as any);
    assert.ok(!handled);
    assert.deepEqual(submitted, []);
  });

  it("reset clears pending state", () => {
    const submitted: string[] = [];
    const handler = createNoteKeyHandler(
      (input: string) => submitted.push(input),
      () => true,
    );
    handler.handleKey({ key: "c", preventDefault() {} } as any);
    handler.reset();
    assert.deepEqual(submitted, []);
  });
});

describe("updateModeStats", () => {
  it("clears stats element", () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);
    selector.recordResponse("a", 2000, true);

    const el = { textContent: "old", innerHTML: "old" } as any;
    updateModeStats(selector, ["a", "b", "c"], el);
    assert.equal(el.textContent, "");
  });

  it("handles missing element gracefully", () => {
    const storage = createMemoryStorage();
    const selector = createAdaptiveSelector(storage);
    // Should not throw
    updateModeStats(selector, ["x", "y"], null as any);
  });
});

// Note: createQuizEngine requires DOM + global createAdaptiveSelector/
// createLocalStorageAdapter. Full integration tests run in the browser.
// The engine is intentionally thin — most logic lives in adaptive.js
// (well-tested) and the mode configs.
