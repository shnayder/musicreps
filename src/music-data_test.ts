import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  NOTES,
  INTERVALS,
  NATURAL_NOTES,
  noteByNum,
  intervalByNum,
  noteAdd,
  noteSub,
  noteMatchesInput,
  intervalMatchesInput,
  STRING_OFFSETS,
} from "./music-data.js";

describe("NOTES", () => {
  it("has 12 entries numbered 0–11", () => {
    assert.equal(NOTES.length, 12);
    for (let i = 0; i < 12; i++) {
      assert.equal(NOTES[i].num, i);
    }
  });

  it("each note has name, displayName, num, accepts", () => {
    for (const note of NOTES) {
      assert.ok(note.name);
      assert.ok(note.displayName);
      assert.ok(typeof note.num === "number");
      assert.ok(Array.isArray(note.accepts));
      assert.ok(note.accepts.length > 0);
    }
  });
});

describe("INTERVALS", () => {
  it("has 12 entries numbered 1–12", () => {
    assert.equal(INTERVALS.length, 12);
    for (let i = 0; i < 12; i++) {
      assert.equal(INTERVALS[i].num, i + 1);
    }
  });
});

describe("NATURAL_NOTES", () => {
  it("has 7 natural notes", () => {
    assert.deepEqual(NATURAL_NOTES, ["C", "D", "E", "F", "G", "A", "B"]);
  });
});

describe("noteByNum", () => {
  it("returns correct note for 0–11", () => {
    assert.equal(noteByNum(0).name, "C");
    assert.equal(noteByNum(4).name, "E");
    assert.equal(noteByNum(11).name, "B");
  });

  it("wraps around for values >= 12", () => {
    assert.equal(noteByNum(12).name, "C");
    assert.equal(noteByNum(16).name, "E");
  });

  it("handles negative values", () => {
    assert.equal(noteByNum(-1).name, "B");
    assert.equal(noteByNum(-12).name, "C");
  });
});

describe("intervalByNum", () => {
  it("returns correct interval", () => {
    assert.equal(intervalByNum(1)!.abbrev, "m2");
    assert.equal(intervalByNum(7)!.abbrev, "P5");
    assert.equal(intervalByNum(12)!.abbrev, "P8");
  });

  it("returns null for invalid number", () => {
    assert.equal(intervalByNum(0), null);
    assert.equal(intervalByNum(13), null);
  });
});

describe("noteAdd / noteSub", () => {
  it("adds semitones correctly", () => {
    // C + 4 = E
    assert.equal(noteAdd(0, 4).name, "E");
    // G + 5 = C
    assert.equal(noteAdd(7, 5).name, "C");
  });

  it("subtracts semitones correctly", () => {
    // E - 4 = C
    assert.equal(noteSub(4, 4).name, "C");
    // C - 1 = B
    assert.equal(noteSub(0, 1).name, "B");
  });
});

describe("noteMatchesInput", () => {
  it("matches lowercase note name", () => {
    assert.ok(noteMatchesInput(NOTES[0], "c"));
    assert.ok(noteMatchesInput(NOTES[1], "c#"));
    assert.ok(noteMatchesInput(NOTES[1], "db"));
  });

  it("rejects wrong input", () => {
    assert.ok(!noteMatchesInput(NOTES[0], "d"));
  });
});

describe("intervalMatchesInput", () => {
  it("matches primary abbreviation", () => {
    assert.ok(intervalMatchesInput(INTERVALS[0], "m2"));
  });

  it("matches alt abbreviations for tritone", () => {
    const tt = INTERVALS[5];
    assert.ok(intervalMatchesInput(tt, "TT"));
    assert.ok(intervalMatchesInput(tt, "A4"));
    assert.ok(intervalMatchesInput(tt, "d5"));
  });

  it("rejects wrong input", () => {
    assert.ok(!intervalMatchesInput(INTERVALS[0], "M2"));
  });
});

describe("STRING_OFFSETS", () => {
  it("produces correct notes for open strings", () => {
    // Standard tuning: E B G D A E
    const expected = ["E", "B", "G", "D", "A", "E"];
    for (let i = 0; i < 6; i++) {
      assert.equal(noteByNum(STRING_OFFSETS[i]).name, expected[i]);
    }
  });
});
