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
  pickAccidentalName,
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

// ---------------------------------------------------------------------------
// Accidental convention tests (see guides/accidental-conventions.md)
// ---------------------------------------------------------------------------

describe("pickAccidentalName", () => {
  it("returns natural notes unchanged regardless of useFlats", () => {
    assert.equal(pickAccidentalName("C", false), "C");
    assert.equal(pickAccidentalName("C", true), "C");
    assert.equal(pickAccidentalName("D", false), "D");
    assert.equal(pickAccidentalName("E", true), "E");
  });

  it("returns sharp form when useFlats is false", () => {
    assert.equal(pickAccidentalName("C#/Db", false), "C#");
    assert.equal(pickAccidentalName("D#/Eb", false), "D#");
    assert.equal(pickAccidentalName("F#/Gb", false), "F#");
    assert.equal(pickAccidentalName("G#/Ab", false), "G#");
    assert.equal(pickAccidentalName("A#/Bb", false), "A#");
  });

  it("returns flat form when useFlats is true", () => {
    assert.equal(pickAccidentalName("C#/Db", true), "Db");
    assert.equal(pickAccidentalName("D#/Eb", true), "Eb");
    assert.equal(pickAccidentalName("F#/Gb", true), "Gb");
    assert.equal(pickAccidentalName("G#/Ab", true), "Ab");
    assert.equal(pickAccidentalName("A#/Bb", true), "Bb");
  });
});

describe("directional accidental convention", () => {
  // Rule 4: ascending = sharps, descending = flats

  it("ascending uses sharps for all accidental notes", () => {
    for (const note of NOTES) {
      const name = pickAccidentalName(note.displayName, false);
      if (note.displayName.includes("/")) {
        assert.ok(name.includes("#"), `ascending: expected sharp for ${note.name}, got ${name}`);
      }
    }
  });

  it("descending uses flats for all accidental notes", () => {
    for (const note of NOTES) {
      const name = pickAccidentalName(note.displayName, true);
      if (note.displayName.includes("/")) {
        assert.ok(name.includes("b"), `descending: expected flat for ${note.name}, got ${name}`);
      }
    }
  });

  // Semitone math: ascending direction
  it("ascending semitone math: C + 1 = C#", () => {
    const answer = noteAdd(0, 1);
    assert.equal(pickAccidentalName(answer.displayName, false), "C#");
  });

  it("ascending semitone math: D + 3 = F#", () => {
    const answer = noteAdd(2, 4);
    assert.equal(pickAccidentalName(answer.displayName, false), "F#");
  });

  it("ascending semitone math: G + 1 = G#", () => {
    const answer = noteAdd(7, 1);
    assert.equal(pickAccidentalName(answer.displayName, false), "G#");
  });

  it("ascending semitone math: A + 1 = A#", () => {
    const answer = noteAdd(9, 1);
    assert.equal(pickAccidentalName(answer.displayName, false), "A#");
  });

  // Semitone math: descending direction
  it("descending semitone math: D - 1 = Db", () => {
    const answer = noteSub(2, 1);
    assert.equal(pickAccidentalName(answer.displayName, true), "Db");
  });

  it("descending semitone math: E - 1 = Eb", () => {
    const answer = noteSub(4, 1);
    assert.equal(pickAccidentalName(answer.displayName, true), "Eb");
  });

  it("descending semitone math: A - 1 = Ab", () => {
    const answer = noteSub(9, 1);
    assert.equal(pickAccidentalName(answer.displayName, true), "Ab");
  });

  it("descending semitone math: B - 1 = Bb", () => {
    const answer = noteSub(11, 1);
    assert.equal(pickAccidentalName(answer.displayName, true), "Bb");
  });

  // Natural-note answers are unaffected by direction
  it("natural answers unaffected: C + 4 = E (ascending)", () => {
    const answer = noteAdd(0, 4);
    assert.equal(pickAccidentalName(answer.displayName, false), "E");
  });

  it("natural answers unaffected: D - 2 = C (descending)", () => {
    const answer = noteSub(2, 2);
    assert.equal(pickAccidentalName(answer.displayName, true), "C");
  });

  // Question note display follows direction too
  it("ascending question shows sharp form of starting note", () => {
    const note = NOTES[1]; // C#/Db
    assert.equal(pickAccidentalName(note.displayName, false), "C#");
  });

  it("descending question shows flat form of starting note", () => {
    const note = NOTES[1]; // C#/Db
    assert.equal(pickAccidentalName(note.displayName, true), "Db");
  });

  // Tritone (symmetric interval) follows direction
  it("ascending tritone: C + 6 = F#", () => {
    const answer = noteAdd(0, 6);
    assert.equal(pickAccidentalName(answer.displayName, false), "F#");
  });

  it("descending tritone: C - 6 = Gb", () => {
    const answer = noteSub(0, 6);
    assert.equal(pickAccidentalName(answer.displayName, true), "Gb");
  });

  // Octave boundary wrap-around
  it("ascending wrap: B + 1 = C (natural, no conflict)", () => {
    const answer = noteAdd(11, 1);
    assert.equal(answer.name, "C");
  });

  it("descending wrap: C - 1 = B (natural, no conflict)", () => {
    const answer = noteSub(0, 1);
    assert.equal(answer.name, "B");
  });

  // All 12 ascending from each accidental note
  it("ascending from each accidental: question and answer both use sharps", () => {
    const accidentalNotes = NOTES.filter(n => n.displayName.includes("/"));
    for (const note of accidentalNotes) {
      for (let s = 1; s <= 11; s++) {
        const answer = noteAdd(note.num, s);
        const qName = pickAccidentalName(note.displayName, false);
        const aName = pickAccidentalName(answer.displayName, false);
        assert.ok(!qName.includes("b"), `ascending q: ${note.name}+${s}, qName=${qName}`);
        assert.ok(!aName.includes("b"), `ascending a: ${note.name}+${s}=${answer.name}, aName=${aName}`);
      }
    }
  });

  // All 12 descending from each accidental note
  it("descending from each accidental: question and answer both use flats", () => {
    const accidentalNotes = NOTES.filter(n => n.displayName.includes("/"));
    for (const note of accidentalNotes) {
      for (let s = 1; s <= 11; s++) {
        const answer = noteSub(note.num, s);
        const qName = pickAccidentalName(note.displayName, true);
        const aName = pickAccidentalName(answer.displayName, true);
        assert.ok(!qName.includes("#"), `descending q: ${note.name}-${s}, qName=${qName}`);
        assert.ok(!aName.includes("#"), `descending a: ${note.name}-${s}=${answer.name}, aName=${aName}`);
      }
    }
  });
});

describe("directional convention agrees with letter-name arithmetic", () => {
  // For interval math, verify that the directional convention produces
  // the same result as proper letter-name interval arithmetic in all
  // cases where both give a standard (non-double-accidental) answer.

  const INTERVAL_LETTER_OFFSETS: Record<number, number> = {
    1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8: 5, 9: 5, 10: 6, 11: 6,
  };

  function letterArithmetic(startName: string, semitones: number, direction: "+" | "-"): string {
    const start = parseSpelledNote(startName);
    const startLetterIdx = LETTER_NAMES.indexOf(start.letter);
    const startSemitone = spelledNoteSemitone(startName);
    const letterOffset = INTERVAL_LETTER_OFFSETS[semitones];

    let targetLetterIdx: number, targetSemitone: number;
    if (direction === "+") {
      targetLetterIdx = (startLetterIdx + letterOffset) % 7;
      targetSemitone = (startSemitone + semitones) % 12;
    } else {
      targetLetterIdx = (startLetterIdx - letterOffset + 7) % 7;
      targetSemitone = ((startSemitone - semitones) % 12 + 12) % 12;
    }
    const targetLetter = LETTER_NAMES[targetLetterIdx];
    const naturalSemitone = (({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }) as Record<string, number>)[targetLetter];
    let acc = ((targetSemitone - naturalSemitone + 12) % 12);
    if (acc > 6) acc -= 12;
    return spelledNoteName(targetLetter, acc);
  }

  // "Enharmonic naturals" like E#, Fb, Cb, B# are correct letter arithmetic
  // but the readability rule (rule 5) makes directional convention prefer
  // the natural spelling. Skip these when comparing.
  function isEnharmonicNatural(name: string): boolean {
    return ["E#", "Fb", "Cb", "B#"].includes(name);
  }

  // For accidental starting notes, directional convention and letter
  // arithmetic agree (the starting note's accidental biases the result).
  // For natural starting notes they can diverge (e.g., C + m2 = Db by
  // letter arithmetic but C# by directional convention), which is fine —
  // the directional convention is simpler and the UI has no separate
  // C# and Db buttons anyway.

  it("ascending from accidental notes: matches letter arithmetic", () => {
    const accidentalNotes = NOTES.filter(n => n.displayName.includes("/"));
    let agreements = 0;
    for (const note of accidentalNotes) {
      for (let s = 1; s <= 11; s++) {
        const startSpelling = pickAccidentalName(note.displayName, false); // sharp form
        const letterResult = letterArithmetic(startSpelling, s, "+");
        const parsed = parseSpelledNote(letterResult);
        if (Math.abs(parsed.accidental) >= 2) continue;
        if (isEnharmonicNatural(letterResult)) continue;
        const semitone = spelledNoteSemitone(letterResult);
        const noteEntry = NOTES[semitone];
        const directionalResult = pickAccidentalName(noteEntry.displayName, false);
        assert.equal(directionalResult, letterResult,
          `${startSpelling}+${s}: directional=${directionalResult}, letter=${letterResult}`);
        agreements++;
      }
    }
    assert.ok(agreements > 25, `expected many agreements, got ${agreements}`);
  });

  it("descending from accidental notes: matches letter arithmetic", () => {
    const accidentalNotes = NOTES.filter(n => n.displayName.includes("/"));
    let agreements = 0;
    for (const note of accidentalNotes) {
      for (let s = 1; s <= 11; s++) {
        const startSpelling = pickAccidentalName(note.displayName, true); // flat form
        const letterResult = letterArithmetic(startSpelling, s, "-");
        const parsed = parseSpelledNote(letterResult);
        if (Math.abs(parsed.accidental) >= 2) continue;
        if (isEnharmonicNatural(letterResult)) continue;
        const semitone = spelledNoteSemitone(letterResult);
        const noteEntry = NOTES[semitone];
        const directionalResult = pickAccidentalName(noteEntry.displayName, true);
        assert.equal(directionalResult, letterResult,
          `${startSpelling}-${s}: directional=${directionalResult}, letter=${letterResult}`);
        agreements++;
      }
    }
    assert.ok(agreements > 25, `expected many agreements, got ${agreements}`);
  });

  it("all cases: directional and letter arithmetic give same pitch (semitone-equivalent)", () => {
    for (const note of NOTES) {
      for (let s = 1; s <= 11; s++) {
        // Ascending
        const sharpStart = pickAccidentalName(note.displayName, false);
        const letterAsc = letterArithmetic(sharpStart, s, "+");
        const directAsc = noteAdd(note.num, s);
        assert.equal(spelledNoteSemitone(letterAsc), directAsc.num,
          `${sharpStart}+${s}: letter=${letterAsc}(${spelledNoteSemitone(letterAsc)}) vs direct=${directAsc.name}(${directAsc.num})`);

        // Descending
        const flatStart = pickAccidentalName(note.displayName, true);
        const letterDesc = letterArithmetic(flatStart, s, "-");
        const directDesc = noteSub(note.num, s);
        assert.equal(spelledNoteSemitone(letterDesc) % 12, directDesc.num,
          `${flatStart}-${s}: letter=${letterDesc}(${spelledNoteSemitone(letterDesc)}) vs direct=${directDesc.name}(${directDesc.num})`);
      }
    }
  });
});

describe("key-signature consistency (rule 2)", () => {
  it("sharp keys produce only sharps in their scales", () => {
    const sharpKeys = MAJOR_KEYS.filter(k => k.accidentalType === "sharps");
    for (const key of sharpKeys) {
      for (let d = 1; d <= 7; d++) {
        const note = getScaleDegreeNote(key.root, d);
        assert.ok(!note.includes("b"),
          `${key.root} major degree ${d} = ${note} should not have flats`);
      }
    }
  });

  it("flat keys produce only flats in their scales", () => {
    const flatKeys = MAJOR_KEYS.filter(k => k.accidentalType === "flats");
    for (const key of flatKeys) {
      for (let d = 1; d <= 7; d++) {
        const note = getScaleDegreeNote(key.root, d);
        assert.ok(!note.includes("#"),
          `${key.root} major degree ${d} = ${note} should not have sharps`);
      }
    }
  });

  it("C major (no accidentals) produces all naturals", () => {
    for (let d = 1; d <= 7; d++) {
      const note = getScaleDegreeNote("C", d);
      assert.ok(note.length === 1, `C major degree ${d} = ${note} should be natural`);
    }
  });
});

describe("harmonic/chordal context (rule 1)", () => {
  it("most chord tones have single accidentals (double only when theory requires it)", () => {
    const doubleAccidentals: string[] = [];
    for (const root of CHORD_ROOTS) {
      for (const chordType of CHORD_TYPES) {
        const tones = getChordTones(root, chordType);
        for (const tone of tones) {
          const parsed = parseSpelledNote(tone);
          if (Math.abs(parsed.accidental) >= 2) {
            doubleAccidentals.push(`${root}${chordType.symbol}: ${tone}`);
          }
        }
      }
    }
    // A few are unavoidable in strict letter-name spelling (e.g., Db dim b5 = Abb)
    assert.ok(doubleAccidentals.length <= 10,
      `too many double accidentals: ${doubleAccidentals.join(", ")}`);
  });

  it("D major chord third is F# not Gb", () => {
    const major = CHORD_TYPES.find(t => t.name === "major")!;
    const tones = getChordTones("D", major);
    assert.equal(tones[1], "F#");
  });

  it("Ab major chord third is C not B#", () => {
    const major = CHORD_TYPES.find(t => t.name === "major")!;
    const tones = getChordTones("Ab", major);
    assert.equal(tones[1], "C");
  });

  it("Eb minor chord b3 is Gb not F#", () => {
    const minor = CHORD_TYPES.find(t => t.name === "minor")!;
    const tones = getChordTones("Eb", minor);
    assert.equal(tones[1], "Gb");
  });

  it("Bb major chord fifth is F not E#", () => {
    const major = CHORD_TYPES.find(t => t.name === "major")!;
    const tones = getChordTones("Bb", major);
    assert.equal(tones[2], "F");
  });

  it("F# major chord uses sharps throughout", () => {
    const major = CHORD_TYPES.find(t => t.name === "major")!;
    const tones = getChordTones("F#", major);
    assert.deepEqual(tones, ["F#", "A#", "C#"]);
  });

  it("Db major chord uses flats throughout", () => {
    const major = CHORD_TYPES.find(t => t.name === "major")!;
    const tones = getChordTones("Db", major);
    assert.deepEqual(tones, ["Db", "F", "Ab"]);
  });
});
