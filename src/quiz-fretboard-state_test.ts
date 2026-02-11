import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  NOTES,
  NATURAL_NOTES,
  STRING_OFFSETS,
  noteMatchesInput,
} from "./music-data.js";
import {
  toggleFretboardString,
  createFretboardHelpers,
} from "./quiz-fretboard-state.js";

const fb = createFretboardHelpers({
  notes: NOTES,
  naturalNotes: NATURAL_NOTES,
  stringOffsets: STRING_OFFSETS,
  noteMatchesInput,
});

// STRING_OFFSETS = [4, 11, 7, 2, 9, 4]
// string 0 = high e (offset 4 = E)
// string 1 = B (offset 11 = B)
// string 2 = G (offset 7 = G)
// string 3 = D (offset 2 = D)
// string 4 = A (offset 9 = A)
// string 5 = low E (offset 4 = E)

describe("getNoteAtPosition", () => {
  it("string 5 (low E) fret 0 = E", () => {
    assert.equal(fb.getNoteAtPosition(5, 0), "E");
  });

  it("string 5 fret 1 = F", () => {
    assert.equal(fb.getNoteAtPosition(5, 1), "F");
  });

  it("string 5 fret 3 = G", () => {
    assert.equal(fb.getNoteAtPosition(5, 3), "G");
  });

  it("string 5 fret 12 = E (wraps around)", () => {
    assert.equal(fb.getNoteAtPosition(5, 12), "E");
  });

  it("string 0 (high e) fret 0 = E", () => {
    assert.equal(fb.getNoteAtPosition(0, 0), "E");
  });

  it("string 1 (B) fret 0 = B", () => {
    assert.equal(fb.getNoteAtPosition(1, 0), "B");
  });

  it("string 2 (G) fret 0 = G", () => {
    assert.equal(fb.getNoteAtPosition(2, 0), "G");
  });

  it("string 3 (D) fret 0 = D", () => {
    assert.equal(fb.getNoteAtPosition(3, 0), "D");
  });

  it("string 4 (A) fret 0 = A", () => {
    assert.equal(fb.getNoteAtPosition(4, 0), "A");
  });

  it("all strings at fret 0 match STRING_OFFSETS", () => {
    const expectedNames = ["E", "B", "G", "D", "A", "E"];
    for (let s = 0; s < 6; s++) {
      assert.equal(fb.getNoteAtPosition(s, 0), expectedNames[s],
        `string ${s} fret 0 should be ${expectedNames[s]}`);
    }
  });
});

describe("parseFretboardItem", () => {
  it("parses '0-0' to string=0, fret=0, note=E", () => {
    const q = fb.parseFretboardItem("0-0");
    assert.equal(q.currentString, 0);
    assert.equal(q.currentFret, 0);
    assert.equal(q.currentNote, "E");
  });

  it("parses '5-3' to string=5, fret=3, note=G", () => {
    const q = fb.parseFretboardItem("5-3");
    assert.equal(q.currentString, 5);
    assert.equal(q.currentFret, 3);
    assert.equal(q.currentNote, "G");
  });

  it("parses '3-7' correctly", () => {
    const q = fb.parseFretboardItem("3-7");
    assert.equal(q.currentString, 3);
    assert.equal(q.currentFret, 7);
    // D string (offset 2) + 7 = 9 = A
    assert.equal(q.currentNote, "A");
  });

  it("parses '5-1' to F (low E + 1)", () => {
    const q = fb.parseFretboardItem("5-1");
    assert.equal(q.currentNote, "F");
  });
});

describe("checkFretboardAnswer", () => {
  it("correct natural note", () => {
    const result = fb.checkFretboardAnswer("C", "c");
    assert.equal(result.correct, true);
    assert.equal(result.correctAnswer, "C");
  });

  it("correct sharp note", () => {
    const result = fb.checkFretboardAnswer("C#", "c#");
    assert.equal(result.correct, true);
  });

  it("correct flat equivalent (Db matches C#)", () => {
    const result = fb.checkFretboardAnswer("C#", "db");
    assert.equal(result.correct, true);
  });

  it("incorrect note", () => {
    const result = fb.checkFretboardAnswer("C", "d");
    assert.equal(result.correct, false);
    assert.equal(result.correctAnswer, "C");
  });

  it("case insensitive", () => {
    const result = fb.checkFretboardAnswer("G", "G");
    assert.equal(result.correct, true);
  });
});

describe("getFretboardEnabledItems", () => {
  it("single string, naturalsOnly=false: returns all 13 frets", () => {
    const items = fb.getFretboardEnabledItems(new Set([5]), false);
    assert.equal(items.length, 13);
    assert.equal(items[0], "5-0");
    assert.equal(items[12], "5-12");
  });

  it("single string, naturalsOnly=true: returns only natural-note frets", () => {
    const items = fb.getFretboardEnabledItems(new Set([5]), true);
    // Low E string: E F F# G G# A A# B C C# D D# E
    // Naturals: E(0) F(1) G(3) A(5) B(7) C(8) D(10) E(12) = 8
    assert.equal(items.length, 8);
    assert.ok(items.includes("5-0"));  // E
    assert.ok(items.includes("5-1"));  // F
    assert.ok(!items.includes("5-2")); // F# (not natural)
    assert.ok(items.includes("5-3"));  // G
  });

  it("multiple strings", () => {
    const items = fb.getFretboardEnabledItems(new Set([0, 5]), false);
    assert.equal(items.length, 26); // 2 * 13
  });

  it("all 6 strings, naturalsOnly=false: returns 78 items", () => {
    const items = fb.getFretboardEnabledItems(new Set([0, 1, 2, 3, 4, 5]), false);
    assert.equal(items.length, 78); // 6 * 13
  });
});

describe("getItemIdsForString", () => {
  it("string 5, naturalsOnly=false: 13 items", () => {
    const items = fb.getItemIdsForString(5, false);
    assert.equal(items.length, 13);
  });

  it("string 5, naturalsOnly=true: 8 natural notes", () => {
    const items = fb.getItemIdsForString(5, true);
    assert.equal(items.length, 8);
  });

  it("items have correct format", () => {
    const items = fb.getItemIdsForString(3, false);
    assert.ok(items.every(id => id.startsWith("3-")));
  });
});

describe("toggleFretboardString", () => {
  it("adds a string not in the set", () => {
    const result = toggleFretboardString(new Set([5]), 3);
    assert.ok(result.has(5));
    assert.ok(result.has(3));
    assert.equal(result.size, 2);
  });

  it("removes a string in the set (if more than one)", () => {
    const result = toggleFretboardString(new Set([3, 5]), 3);
    assert.ok(!result.has(3));
    assert.ok(result.has(5));
    assert.equal(result.size, 1);
  });

  it("does not remove the last string", () => {
    const result = toggleFretboardString(new Set([5]), 5);
    assert.ok(result.has(5));
    assert.equal(result.size, 1);
  });

  it("returns a new Set (immutable)", () => {
    const original = new Set([5]);
    const result = toggleFretboardString(original, 3);
    assert.notEqual(result, original);
    assert.equal(original.size, 1); // original unchanged
  });
});
