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
  LETTER_NAMES,
  MAJOR_SCALE_STEPS,
  parseSpelledNote,
  spelledNoteName,
  spelledNoteSemitone,
  getScaleDegreeNote,
  findScaleDegree,
  MAJOR_KEYS,
  keySignatureLabel,
  keyBySignatureLabel,
  DIATONIC_CHORDS,
  ROMAN_NUMERALS,
  CHORD_TYPES,
  CHORD_ROOTS,
  getChordTones,
  chordDisplayName,
  spelledNoteMatchesInput,
  spelledNoteMatchesSemitone,
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

// ---------------------------------------------------------------------------
// Letter-name arithmetic tests
// ---------------------------------------------------------------------------

describe("parseSpelledNote", () => {
  it("parses natural notes", () => {
    assert.deepEqual(parseSpelledNote("C"), { letter: "C", accidental: 0 });
    assert.deepEqual(parseSpelledNote("G"), { letter: "G", accidental: 0 });
  });

  it("parses sharps", () => {
    assert.deepEqual(parseSpelledNote("F#"), { letter: "F", accidental: 1 });
    assert.deepEqual(parseSpelledNote("C##"), { letter: "C", accidental: 2 });
  });

  it("parses flats", () => {
    assert.deepEqual(parseSpelledNote("Bb"), { letter: "B", accidental: -1 });
    assert.deepEqual(parseSpelledNote("Ebb"), { letter: "E", accidental: -2 });
  });
});

describe("spelledNoteName", () => {
  it("builds natural note names", () => {
    assert.equal(spelledNoteName("C", 0), "C");
  });

  it("builds sharp note names", () => {
    assert.equal(spelledNoteName("F", 1), "F#");
    assert.equal(spelledNoteName("C", 2), "C##");
  });

  it("builds flat note names", () => {
    assert.equal(spelledNoteName("B", -1), "Bb");
    assert.equal(spelledNoteName("E", -2), "Ebb");
  });
});

describe("spelledNoteSemitone", () => {
  it("computes semitones for naturals", () => {
    assert.equal(spelledNoteSemitone("C"), 0);
    assert.equal(spelledNoteSemitone("D"), 2);
    assert.equal(spelledNoteSemitone("B"), 11);
  });

  it("computes semitones for accidentals", () => {
    assert.equal(spelledNoteSemitone("F#"), 6);
    assert.equal(spelledNoteSemitone("Bb"), 10);
    assert.equal(spelledNoteSemitone("Db"), 1);
  });

  it("enharmonic equivalents have same semitone", () => {
    assert.equal(spelledNoteSemitone("C#"), spelledNoteSemitone("Db"));
    assert.equal(spelledNoteSemitone("F#"), spelledNoteSemitone("Gb"));
  });
});

describe("getScaleDegreeNote", () => {
  it("C major scale is all naturals", () => {
    assert.equal(getScaleDegreeNote("C", 1), "C");
    assert.equal(getScaleDegreeNote("C", 2), "D");
    assert.equal(getScaleDegreeNote("C", 3), "E");
    assert.equal(getScaleDegreeNote("C", 4), "F");
    assert.equal(getScaleDegreeNote("C", 5), "G");
    assert.equal(getScaleDegreeNote("C", 6), "A");
    assert.equal(getScaleDegreeNote("C", 7), "B");
  });

  it("D major has F# and C#", () => {
    assert.equal(getScaleDegreeNote("D", 1), "D");
    assert.equal(getScaleDegreeNote("D", 2), "E");
    assert.equal(getScaleDegreeNote("D", 3), "F#");
    assert.equal(getScaleDegreeNote("D", 4), "G");
    assert.equal(getScaleDegreeNote("D", 5), "A");
    assert.equal(getScaleDegreeNote("D", 6), "B");
    assert.equal(getScaleDegreeNote("D", 7), "C#");
  });

  it("Bb major has Bb and Eb", () => {
    assert.equal(getScaleDegreeNote("Bb", 1), "Bb");
    assert.equal(getScaleDegreeNote("Bb", 2), "C");
    assert.equal(getScaleDegreeNote("Bb", 3), "D");
    assert.equal(getScaleDegreeNote("Bb", 4), "Eb");
    assert.equal(getScaleDegreeNote("Bb", 5), "F");
    assert.equal(getScaleDegreeNote("Bb", 6), "G");
    assert.equal(getScaleDegreeNote("Bb", 7), "A");
  });

  it("F# major has 6 sharps", () => {
    assert.equal(getScaleDegreeNote("F#", 1), "F#");
    assert.equal(getScaleDegreeNote("F#", 2), "G#");
    assert.equal(getScaleDegreeNote("F#", 3), "A#");
    assert.equal(getScaleDegreeNote("F#", 4), "B");
    assert.equal(getScaleDegreeNote("F#", 5), "C#");
    assert.equal(getScaleDegreeNote("F#", 6), "D#");
    assert.equal(getScaleDegreeNote("F#", 7), "E#");
  });

  it("Db major has 5 flats", () => {
    assert.equal(getScaleDegreeNote("Db", 1), "Db");
    assert.equal(getScaleDegreeNote("Db", 2), "Eb");
    assert.equal(getScaleDegreeNote("Db", 3), "F");
    assert.equal(getScaleDegreeNote("Db", 4), "Gb");
    assert.equal(getScaleDegreeNote("Db", 5), "Ab");
    assert.equal(getScaleDegreeNote("Db", 6), "Bb");
    assert.equal(getScaleDegreeNote("Db", 7), "C");
  });
});

describe("findScaleDegree", () => {
  it("finds degrees in C major", () => {
    assert.equal(findScaleDegree("C", "E"), 3);
    assert.equal(findScaleDegree("C", "G"), 5);
  });

  it("finds degrees in D major", () => {
    assert.equal(findScaleDegree("D", "F#"), 3);
    assert.equal(findScaleDegree("D", "A"), 5);
  });

  it("returns 0 for notes not in the scale", () => {
    assert.equal(findScaleDegree("C", "F#"), 0);
  });
});

describe("MAJOR_KEYS", () => {
  it("has 12 keys", () => {
    assert.equal(MAJOR_KEYS.length, 12);
  });

  it("key roots are unique", () => {
    const roots = MAJOR_KEYS.map(k => k.root);
    assert.equal(new Set(roots).size, 12);
  });
});

describe("keySignatureLabel", () => {
  it("C major is 0", () => {
    const c = MAJOR_KEYS.find(k => k.root === "C")!;
    assert.equal(keySignatureLabel(c), "0");
  });

  it("D major is 2#", () => {
    const d = MAJOR_KEYS.find(k => k.root === "D")!;
    assert.equal(keySignatureLabel(d), "2#");
  });

  it("Eb major is 3b", () => {
    const eb = MAJOR_KEYS.find(k => k.root === "Eb")!;
    assert.equal(keySignatureLabel(eb), "3b");
  });
});

describe("keyBySignatureLabel", () => {
  it("finds key by label", () => {
    assert.equal(keyBySignatureLabel("2#")!.root, "D");
    assert.equal(keyBySignatureLabel("3b")!.root, "Eb");
    assert.equal(keyBySignatureLabel("0")!.root, "C");
  });

  it("returns null for invalid label", () => {
    assert.equal(keyBySignatureLabel("8#"), null);
  });
});

describe("getChordTones", () => {
  it("C major = C E G", () => {
    const major = CHORD_TYPES.find(t => t.name === "major")!;
    assert.deepEqual(getChordTones("C", major), ["C", "E", "G"]);
  });

  it("C minor = C Eb G", () => {
    const minor = CHORD_TYPES.find(t => t.name === "minor")!;
    assert.deepEqual(getChordTones("C", minor), ["C", "Eb", "G"]);
  });

  it("Cm7 = C Eb G Bb", () => {
    const min7 = CHORD_TYPES.find(t => t.name === "min7")!;
    assert.deepEqual(getChordTones("C", min7), ["C", "Eb", "G", "Bb"]);
  });

  it("F#dim = F# A C", () => {
    const dim = CHORD_TYPES.find(t => t.name === "dim")!;
    assert.deepEqual(getChordTones("F#", dim), ["F#", "A", "C"]);
  });

  it("C# major 5th is G# not Ab", () => {
    const major = CHORD_TYPES.find(t => t.name === "major")!;
    const tones = getChordTones("C#", major);
    assert.equal(tones[2], "G#");
  });

  it("Eb minor b3 is Gb not F#", () => {
    const minor = CHORD_TYPES.find(t => t.name === "minor")!;
    const tones = getChordTones("Eb", minor);
    assert.equal(tones[1], "Gb");
  });

  it("F#7 b7 is E", () => {
    const dom7 = CHORD_TYPES.find(t => t.name === "dom7")!;
    const tones = getChordTones("F#", dom7);
    assert.equal(tones[3], "E");
  });

  it("Bbmaj7 = Bb D F A", () => {
    const maj7 = CHORD_TYPES.find(t => t.name === "maj7")!;
    assert.deepEqual(getChordTones("Bb", maj7), ["Bb", "D", "F", "A"]);
  });

  it("Ab major = Ab C Eb", () => {
    const major = CHORD_TYPES.find(t => t.name === "major")!;
    assert.deepEqual(getChordTones("Ab", major), ["Ab", "C", "Eb"]);
  });
});

describe("chordDisplayName", () => {
  it("builds display names", () => {
    const major = CHORD_TYPES.find(t => t.name === "major")!;
    const min7 = CHORD_TYPES.find(t => t.name === "min7")!;
    assert.equal(chordDisplayName("C", major), "C");
    assert.equal(chordDisplayName("F#", min7), "F#m7");
  });
});

describe("spelledNoteMatchesInput", () => {
  it("matches exact spelling", () => {
    assert.ok(spelledNoteMatchesInput("F#", "F#"));
    assert.ok(spelledNoteMatchesInput("Bb", "Bb"));
  });

  it("rejects wrong enharmonic", () => {
    assert.ok(!spelledNoteMatchesInput("F#", "Gb"));
    assert.ok(!spelledNoteMatchesInput("Bb", "A#"));
  });

  it("is case insensitive on letter", () => {
    assert.ok(spelledNoteMatchesInput("F#", "f#"));
  });
});

describe("spelledNoteMatchesSemitone", () => {
  it("matches enharmonic equivalents", () => {
    assert.ok(spelledNoteMatchesSemitone("F#", "Gb"));
    assert.ok(spelledNoteMatchesSemitone("Bb", "A#"));
  });

  it("rejects different pitches", () => {
    assert.ok(!spelledNoteMatchesSemitone("F#", "G"));
  });
});

describe("DIATONIC_CHORDS", () => {
  it("has 7 chords", () => {
    assert.equal(DIATONIC_CHORDS.length, 7);
  });

  it("I IV V are major, ii iii vi are minor, vii is diminished", () => {
    assert.equal(DIATONIC_CHORDS[0].quality, "major");
    assert.equal(DIATONIC_CHORDS[1].quality, "minor");
    assert.equal(DIATONIC_CHORDS[2].quality, "minor");
    assert.equal(DIATONIC_CHORDS[3].quality, "major");
    assert.equal(DIATONIC_CHORDS[4].quality, "major");
    assert.equal(DIATONIC_CHORDS[5].quality, "minor");
    assert.equal(DIATONIC_CHORDS[6].quality, "diminished");
  });
});

describe("ROMAN_NUMERALS", () => {
  it("has 7 entries matching DIATONIC_CHORDS", () => {
    assert.equal(ROMAN_NUMERALS.length, 7);
    assert.equal(ROMAN_NUMERALS[0], "I");
    assert.equal(ROMAN_NUMERALS[4], "V");
  });
});

describe("CHORD_ROOTS", () => {
  it("has 12 canonical root names", () => {
    assert.equal(CHORD_ROOTS.length, 12);
    assert.ok(CHORD_ROOTS.includes("Db"));
    assert.ok(CHORD_ROOTS.includes("Eb"));
    assert.ok(CHORD_ROOTS.includes("F#"));
    assert.ok(CHORD_ROOTS.includes("Ab"));
    assert.ok(CHORD_ROOTS.includes("Bb"));
    assert.ok(!CHORD_ROOTS.includes("C#"));
    assert.ok(!CHORD_ROOTS.includes("D#"));
    assert.ok(!CHORD_ROOTS.includes("Gb"));
    assert.ok(!CHORD_ROOTS.includes("G#"));
    assert.ok(!CHORD_ROOTS.includes("A#"));
  });
});
