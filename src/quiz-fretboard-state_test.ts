import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  NOTES,
  NATURAL_NOTES,
  STRING_OFFSETS,
  GUITAR,
  UKULELE,
  noteMatchesInput,
} from "./music-data.js";
import {
  toggleFretboardString,
  createFretboardHelpers,
  computeNotePrioritization,
} from "./quiz-fretboard-state.js";


// ---------------------------------------------------------------------------
// Guitar helpers (backward compat — uses legacy STRING_OFFSETS)
// ---------------------------------------------------------------------------

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
  it("single string, filter=all: returns all 13 frets", () => {
    const items = fb.getFretboardEnabledItems(new Set([5]), "all");
    assert.equal(items.length, 13);
    assert.equal(items[0], "5-0");
    assert.equal(items[12], "5-12");
  });

  it("single string, filter=natural: returns only natural-note frets", () => {
    const items = fb.getFretboardEnabledItems(new Set([5]), "natural");
    // Low E string: E F F# G G# A A# B C C# D D# E
    // Naturals: E(0) F(1) G(3) A(5) B(7) C(8) D(10) E(12) = 8
    assert.equal(items.length, 8);
    assert.ok(items.includes("5-0"));  // E
    assert.ok(items.includes("5-1"));  // F
    assert.ok(!items.includes("5-2")); // F# (not natural)
    assert.ok(items.includes("5-3"));  // G
  });

  it("single string, filter=sharps-flats: returns only accidental frets", () => {
    const items = fb.getFretboardEnabledItems(new Set([5]), "sharps-flats");
    // Low E string: E F F# G G# A A# B C C# D D# E
    // Accidentals: F#(2) G#(4) A#(6) C#(9) D#(11) = 5
    assert.equal(items.length, 5);
    assert.ok(items.includes("5-2"));  // F#
    assert.ok(items.includes("5-4"));  // G#
    assert.ok(!items.includes("5-0")); // E (natural)
    assert.ok(!items.includes("5-1")); // F (natural)
  });

  it("multiple strings", () => {
    const items = fb.getFretboardEnabledItems(new Set([0, 5]), "all");
    assert.equal(items.length, 26); // 2 * 13
  });

  it("all 6 strings, filter=all: returns 78 items", () => {
    const items = fb.getFretboardEnabledItems(new Set([0, 1, 2, 3, 4, 5]), "all");
    assert.equal(items.length, 78); // 6 * 13
  });
});

describe("getItemIdsForString", () => {
  it("string 5, filter=all: 13 items", () => {
    const items = fb.getItemIdsForString(5, "all");
    assert.equal(items.length, 13);
  });

  it("string 5, filter=natural: 8 natural notes", () => {
    const items = fb.getItemIdsForString(5, "natural");
    assert.equal(items.length, 8);
  });

  it("string 5, filter=sharps-flats: 5 accidental notes", () => {
    const items = fb.getItemIdsForString(5, "sharps-flats");
    assert.equal(items.length, 5);
  });

  it("items have correct format", () => {
    const items = fb.getItemIdsForString(3, "all");
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

// ---------------------------------------------------------------------------
// Ukulele helpers
// ---------------------------------------------------------------------------

const uke = createFretboardHelpers({
  notes: NOTES,
  naturalNotes: NATURAL_NOTES,
  stringOffsets: UKULELE.stringOffsets,
  fretCount: UKULELE.fretCount,
  noteMatchesInput,
});

// UKULELE.stringOffsets = [9, 4, 0, 7]
// string 0 = A (offset 9)
// string 1 = E (offset 4)
// string 2 = C (offset 0)
// string 3 = G (offset 7)

describe("ukulele getNoteAtPosition", () => {
  it("string 0 (A) fret 0 = A", () => {
    assert.equal(uke.getNoteAtPosition(0, 0), "A");
  });

  it("string 1 (E) fret 0 = E", () => {
    assert.equal(uke.getNoteAtPosition(1, 0), "E");
  });

  it("string 2 (C) fret 0 = C", () => {
    assert.equal(uke.getNoteAtPosition(2, 0), "C");
  });

  it("string 3 (G) fret 0 = G", () => {
    assert.equal(uke.getNoteAtPosition(3, 0), "G");
  });

  it("string 2 (C) fret 4 = E", () => {
    // C + 4 semitones = E
    assert.equal(uke.getNoteAtPosition(2, 4), "E");
  });

  it("string 3 (G) fret 5 = C", () => {
    // G + 5 semitones = C
    assert.equal(uke.getNoteAtPosition(3, 5), "C");
  });

  it("string 0 (A) fret 12 = A (wraps around)", () => {
    assert.equal(uke.getNoteAtPosition(0, 12), "A");
  });

  it("all strings at fret 0 match UKULELE offsets", () => {
    const expectedNames = ["A", "E", "C", "G"];
    for (let s = 0; s < 4; s++) {
      assert.equal(uke.getNoteAtPosition(s, 0), expectedNames[s],
        `string ${s} fret 0 should be ${expectedNames[s]}`);
    }
  });
});

describe("ukulele getFretboardEnabledItems", () => {
  it("single string, filter=all: returns 13 frets", () => {
    const items = uke.getFretboardEnabledItems(new Set([2]), "all");
    assert.equal(items.length, 13);
    assert.equal(items[0], "2-0");
    assert.equal(items[12], "2-12");
  });

  it("all 4 strings, filter=all: returns 52 items", () => {
    const items = uke.getFretboardEnabledItems(new Set([0, 1, 2, 3]), "all");
    assert.equal(items.length, 52); // 4 * 13
  });

  it("single string, filter=natural: correct count", () => {
    // C string: C C# D D# E F F# G G# A A# B C
    // Naturals: C(0) D(2) E(4) F(5) G(7) A(9) B(11) C(12) = 8
    const items = uke.getFretboardEnabledItems(new Set([2]), "natural");
    assert.equal(items.length, 8);
  });
});

describe("ukulele parseFretboardItem", () => {
  it("parses '2-0' to C string fret 0 = C", () => {
    const q = uke.parseFretboardItem("2-0");
    assert.equal(q.currentString, 2);
    assert.equal(q.currentFret, 0);
    assert.equal(q.currentNote, "C");
  });

  it("parses '3-2' to G string fret 2 = A", () => {
    const q = uke.parseFretboardItem("3-2");
    assert.equal(q.currentString, 3);
    assert.equal(q.currentFret, 2);
    assert.equal(q.currentNote, "A");
  });
});

// ---------------------------------------------------------------------------
// fretCount parameter
// ---------------------------------------------------------------------------

describe("createFretboardHelpers fretCount", () => {
  it("exposes fretCount from config", () => {
    assert.equal(fb.fretCount, 13); // default
    assert.equal(uke.fretCount, 13); // explicit
  });

  it("custom fretCount limits enabled items", () => {
    const small = createFretboardHelpers({
      notes: NOTES,
      naturalNotes: NATURAL_NOTES,
      stringOffsets: [0],
      fretCount: 5,
      noteMatchesInput,
    });
    const items = small.getFretboardEnabledItems(new Set([0]), "all");
    assert.equal(items.length, 5);
    assert.equal(items[4], "0-4");
  });
});

// ---------------------------------------------------------------------------
// Instrument config structure
// ---------------------------------------------------------------------------

describe("instrument configs", () => {
  it("GUITAR has expected shape", () => {
    assert.equal(GUITAR.id, "fretboard");
    assert.equal(GUITAR.stringCount, 6);
    assert.equal(GUITAR.fretCount, 13);
    assert.equal(GUITAR.stringOffsets.length, 6);
    assert.equal(GUITAR.stringNames.length, 6);
  });

  it("UKULELE has expected shape", () => {
    assert.equal(UKULELE.id, "ukulele");
    assert.equal(UKULELE.stringCount, 4);
    assert.equal(UKULELE.fretCount, 13);
    assert.equal(UKULELE.stringOffsets.length, 4);
    assert.equal(UKULELE.stringNames.length, 4);
  });
});

// ---------------------------------------------------------------------------
// Note prioritization
// ---------------------------------------------------------------------------

describe("computeNotePrioritization", () => {
  const threshold = 0.7;

  it("suggests 'natural' when no data (all unseen)", () => {
    const stats = [
      { masteredCount: 0, dueCount: 0, unseenCount: 8, totalCount: 8 },
    ];
    const result = computeNotePrioritization(stats, threshold);
    assert.equal(result.suggestedFilter, "natural");
    assert.equal(result.naturalMasteryRatio, 0);
  });

  it("suggests 'natural' when below threshold", () => {
    // 3 mastered out of 6 seen = 0.5, below 0.7
    const stats = [
      { masteredCount: 3, dueCount: 3, unseenCount: 2, totalCount: 8 },
    ];
    const result = computeNotePrioritization(stats, threshold);
    assert.equal(result.suggestedFilter, "natural");
    assert.ok(result.naturalMasteryRatio < threshold);
  });

  it("suggests 'all' when at threshold", () => {
    // 7 mastered out of 10 seen = 0.7, at threshold
    const stats = [
      { masteredCount: 7, dueCount: 3, unseenCount: 0, totalCount: 10 },
    ];
    const result = computeNotePrioritization(stats, threshold);
    assert.equal(result.suggestedFilter, "all");
    assert.ok(result.naturalMasteryRatio >= threshold);
  });

  it("suggests 'all' when above threshold", () => {
    // 8 mastered out of 10 seen = 0.8
    const stats = [
      { masteredCount: 8, dueCount: 2, unseenCount: 0, totalCount: 10 },
    ];
    const result = computeNotePrioritization(stats, threshold);
    assert.equal(result.suggestedFilter, "all");
  });

  it("aggregates across multiple strings", () => {
    // String 0: 4/5 mastered, String 1: 3/5 mastered → 7/10 = 0.7
    const stats = [
      { masteredCount: 4, dueCount: 1, unseenCount: 3, totalCount: 8 },
      { masteredCount: 3, dueCount: 2, unseenCount: 3, totalCount: 8 },
    ];
    const result = computeNotePrioritization(stats, threshold);
    assert.equal(result.suggestedFilter, "all");
    assert.equal(result.naturalMasteryRatio, 0.7);
  });

  it("returns correct ratio", () => {
    const stats = [
      { masteredCount: 2, dueCount: 8, unseenCount: 0, totalCount: 10 },
    ];
    const result = computeNotePrioritization(stats, threshold);
    assert.equal(result.naturalMasteryRatio, 0.2);
  });
});
