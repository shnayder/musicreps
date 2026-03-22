import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createAdaptiveKeyHandler,
  createNoteKeyHandler,
  createSolfegeKeyHandler,
  getCalibrationThresholds,
  noteNarrowingSet,
  numberNarrowingSet,
  pickCalibrationNote,
} from './quiz-engine.ts';
import { getUseSolfege, setUseSolfege } from './music-data.ts';
import { DEFAULT_CONFIG } from './adaptive.ts';

describe('quiz-engine defaults', () => {
  it('default speedTarget is 3000ms', () => {
    assert.equal(DEFAULT_CONFIG.speedTarget, 3000);
  });
});

describe('createNoteKeyHandler', () => {
  it('submits natural note immediately when accidentals disabled', () => {
    const submitted: string[] = [];
    const handler = createNoteKeyHandler(
      (input: string) => submitted.push(input),
      () => false,
    );
    const e = { key: 'c', preventDefault() {} } as any;
    const handled = handler.handleKey(e);
    assert.ok(handled);
    assert.deepEqual(submitted, ['C']);
  });

  it('submits sharp when # follows a letter', () => {
    const submitted: string[] = [];
    const handler = createNoteKeyHandler(
      (input: string) => submitted.push(input),
      () => true,
    );
    handler.handleKey({ key: 'c', preventDefault() {} } as any);
    assert.equal(submitted.length, 0); // pending
    handler.handleKey(
      { key: '#', shiftKey: false, preventDefault() {} } as any,
    );
    assert.deepEqual(submitted, ['C#']);
  });

  it('submits sharp when s follows a letter', () => {
    const submitted: string[] = [];
    const handler = createNoteKeyHandler(
      (input: string) => submitted.push(input),
      () => true,
    );
    handler.handleKey({ key: 'f', preventDefault() {} } as any);
    assert.equal(submitted.length, 0); // pending
    handler.handleKey(
      { key: 's', shiftKey: false, preventDefault() {} } as any,
    );
    assert.deepEqual(submitted, ['F#']);
  });

  it('submits flat when b follows a letter', () => {
    const submitted: string[] = [];
    const handler = createNoteKeyHandler(
      (input: string) => submitted.push(input),
      () => true,
    );
    handler.handleKey({ key: 'd', preventDefault() {} } as any);
    handler.handleKey(
      { key: 'b', shiftKey: false, preventDefault() {} } as any,
    );
    assert.deepEqual(submitted, ['Db']);
  });

  it('ignores non-note keys', () => {
    const submitted: string[] = [];
    const handler = createNoteKeyHandler(
      (input: string) => submitted.push(input),
      () => true,
    );
    const handled = handler.handleKey({ key: 'x', preventDefault() {} } as any);
    assert.ok(!handled);
    assert.deepEqual(submitted, []);
  });

  it('reset clears pending state', () => {
    const submitted: string[] = [];
    const handler = createNoteKeyHandler(
      (input: string) => submitted.push(input),
      () => true,
    );
    handler.handleKey({ key: 'c', preventDefault() {} } as any);
    handler.reset();
    assert.deepEqual(submitted, []);
  });

  it('Enter commits pending note immediately', () => {
    const submitted: string[] = [];
    const handler = createNoteKeyHandler(
      (input: string) => submitted.push(input),
      () => true,
    );
    handler.handleKey({ key: 'c', preventDefault() {} } as any);
    assert.equal(submitted.length, 0); // still pending
    handler.handleKey({ key: 'Enter', preventDefault() {} } as any);
    assert.deepEqual(submitted, ['C']);
  });

  it('Enter does nothing with no pending note', () => {
    const submitted: string[] = [];
    const handler = createNoteKeyHandler(
      (input: string) => submitted.push(input),
      () => true,
    );
    const handled = handler.handleKey(
      { key: 'Enter', preventDefault() {} } as any,
    );
    assert.ok(!handled);
    assert.deepEqual(submitted, []);
  });

  it('getPendingNote returns current buffer state', () => {
    const submitted: string[] = [];
    const handler = createNoteKeyHandler(
      (input: string) => submitted.push(input),
      () => true,
    );
    assert.equal(handler.getPendingNote(), null);
    handler.handleKey({ key: 'c', preventDefault() {} } as any);
    assert.equal(handler.getPendingNote(), 'C');
    handler.handleKey({ key: 'Enter', preventDefault() {} } as any);
    assert.equal(handler.getPendingNote(), null);
  });

  it('onPendingChange fires on pending transitions', () => {
    const submitted: string[] = [];
    const pending: (string | null)[] = [];
    const handler = createNoteKeyHandler(
      (input: string) => submitted.push(input),
      () => true,
      (note) => pending.push(note),
    );
    handler.handleKey({ key: 'c', preventDefault() {} } as any);
    assert.deepEqual(pending, ['C']);
    handler.handleKey({ key: 'Enter', preventDefault() {} } as any);
    assert.deepEqual(pending, ['C', null]);
  });

  it('onPendingChange fires null on accidental commit', () => {
    const pending: (string | null)[] = [];
    const handler = createNoteKeyHandler(
      () => {},
      () => true,
      (note) => pending.push(note),
    );
    handler.handleKey({ key: 'g', preventDefault() {} } as any);
    handler.handleKey(
      { key: '#', shiftKey: false, preventDefault() {} } as any,
    );
    assert.deepEqual(pending, ['G', null]);
  });

  it('onPendingChange fires null on reset', () => {
    const pending: (string | null)[] = [];
    const handler = createNoteKeyHandler(
      () => {},
      () => true,
      (note) => pending.push(note),
    );
    handler.handleKey({ key: 'a', preventDefault() {} } as any);
    handler.reset();
    assert.deepEqual(pending, ['A', null]);
  });
});

describe('getCalibrationThresholds', () => {
  it('returns 5 threshold bands', () => {
    const thresholds = getCalibrationThresholds(600);
    assert.equal(thresholds.length, 5);
  });

  it('scales thresholds from baseline at 1000ms with v4 labels', () => {
    const thresholds = getCalibrationThresholds(1000);
    assert.equal(thresholds[0].label, 'Automatic');
    assert.equal(thresholds[0].maxMs, 1500); // 1.5x
    assert.equal(thresholds[0].colorToken, '--heatmap-5');
    assert.equal(thresholds[1].label, 'Solid');
    assert.equal(thresholds[1].maxMs, 3000); // 3.0x
    assert.equal(thresholds[1].colorToken, '--heatmap-4');
    assert.equal(thresholds[2].label, 'Learning');
    assert.equal(thresholds[2].maxMs, 4500); // 4.5x
    assert.equal(thresholds[2].colorToken, '--heatmap-3');
    assert.equal(thresholds[3].label, 'Hesitant');
    assert.equal(thresholds[3].maxMs, 6000); // 6.0x
    assert.equal(thresholds[3].colorToken, '--heatmap-2');
    assert.equal(thresholds[4].label, 'Starting');
    assert.equal(thresholds[4].maxMs, null);
    assert.equal(thresholds[4].colorToken, '--heatmap-1');
  });

  it('scales proportionally for faster baseline', () => {
    const thresholds = getCalibrationThresholds(500);
    assert.equal(thresholds[0].maxMs, 750); // 500 * 1.5
    assert.equal(thresholds[1].maxMs, 1500); // 500 * 3.0
    assert.equal(thresholds[2].maxMs, 2250); // 500 * 4.5
    assert.equal(thresholds[3].maxMs, 3000); // 500 * 6.0
  });

  it('rounds to whole milliseconds', () => {
    const thresholds = getCalibrationThresholds(333);
    // 333 * 1.5 = 499.5 → 500
    assert.equal(thresholds[0].maxMs, 500);
    // 333 * 3.0 = 999
    assert.equal(thresholds[1].maxMs, 999);
  });

  it('includes meaning descriptions for all bands', () => {
    const thresholds = getCalibrationThresholds(600);
    thresholds.forEach((t) => {
      assert.ok(t.meaning.length > 0, `${t.label} should have a meaning`);
    });
  });
});

describe('createSolfegeKeyHandler', () => {
  it('submits natural note from solfège syllable', () => {
    const submitted: string[] = [];
    const handler = createSolfegeKeyHandler(
      (input: string) => submitted.push(input),
      () => false,
    );
    handler.handleKey({ key: 'd', preventDefault() {} } as any);
    handler.handleKey({ key: 'o', preventDefault() {} } as any);
    assert.deepEqual(submitted, ['C']);
  });

  it('handles all solfège syllables', () => {
    const cases: [string, string, string][] = [
      ['d', 'o', 'C'],
      ['r', 'e', 'D'],
      ['m', 'i', 'E'],
      ['f', 'a', 'F'],
      ['s', 'o', 'G'],
      ['l', 'a', 'A'],
      ['s', 'i', 'B'],
    ];
    for (const [k1, k2, expected] of cases) {
      const submitted: string[] = [];
      const handler = createSolfegeKeyHandler(
        (input: string) => submitted.push(input),
        () => false,
      );
      handler.handleKey({ key: k1, preventDefault() {} } as any);
      handler.handleKey({ key: k2, preventDefault() {} } as any);
      assert.deepEqual(
        submitted,
        [expected],
        `${k1}${k2} should submit ${expected}`,
      );
    }
  });

  it('is case-insensitive', () => {
    const submitted: string[] = [];
    const handler = createSolfegeKeyHandler(
      (input: string) => submitted.push(input),
      () => false,
    );
    handler.handleKey({ key: 'D', preventDefault() {} } as any);
    handler.handleKey({ key: 'O', preventDefault() {} } as any);
    assert.deepEqual(submitted, ['C']);
  });

  it('submits sharp after solfège syllable', () => {
    const submitted: string[] = [];
    const handler = createSolfegeKeyHandler(
      (input: string) => submitted.push(input),
      () => true,
    );
    handler.handleKey({ key: 'd', preventDefault() {} } as any);
    handler.handleKey({ key: 'o', preventDefault() {} } as any);
    assert.equal(submitted.length, 0); // pending for accidental
    handler.handleKey(
      { key: '#', shiftKey: false, preventDefault() {} } as any,
    );
    assert.deepEqual(submitted, ['C#']);
  });

  it('submits flat after solfège syllable', () => {
    const submitted: string[] = [];
    const handler = createSolfegeKeyHandler(
      (input: string) => submitted.push(input),
      () => true,
    );
    handler.handleKey({ key: 'r', preventDefault() {} } as any);
    handler.handleKey({ key: 'e', preventDefault() {} } as any);
    handler.handleKey(
      { key: 'b', shiftKey: false, preventDefault() {} } as any,
    );
    assert.deepEqual(submitted, ['Db']);
  });

  it('ignores non-solfège keys', () => {
    const submitted: string[] = [];
    const handler = createSolfegeKeyHandler(
      (input: string) => submitted.push(input),
      () => true,
    );
    const handled = handler.handleKey({ key: 'x', preventDefault() {} } as any);
    assert.ok(!handled);
    assert.deepEqual(submitted, []);
  });

  it('reset clears pending state', () => {
    const submitted: string[] = [];
    const handler = createSolfegeKeyHandler(
      (input: string) => submitted.push(input),
      () => true,
    );
    handler.handleKey({ key: 'd', preventDefault() {} } as any);
    handler.handleKey({ key: 'o', preventDefault() {} } as any);
    handler.reset();
    // Should not submit after reset even if timeout fires
    assert.deepEqual(submitted, []);
  });

  it('Enter commits pending note immediately', () => {
    const submitted: string[] = [];
    const handler = createSolfegeKeyHandler(
      (input: string) => submitted.push(input),
      () => true,
    );
    handler.handleKey({ key: 'd', preventDefault() {} } as any);
    handler.handleKey({ key: 'o', preventDefault() {} } as any);
    assert.equal(submitted.length, 0); // pending for accidental
    handler.handleKey({ key: 'Enter', preventDefault() {} } as any);
    assert.deepEqual(submitted, ['C']);
  });

  it('Enter clears partial syllable buffer', () => {
    const submitted: string[] = [];
    const handler = createSolfegeKeyHandler(
      (input: string) => submitted.push(input),
      () => false, // no accidentals — immediate submit after resolve
    );
    handler.handleKey({ key: 'd', preventDefault() {} } as any);
    // Buffer has 'd' but syllable not complete
    const handled = handler.handleKey(
      { key: 'Enter', preventDefault() {} } as any,
    );
    assert.ok(handled); // consumed the Enter to clear buffer
    assert.deepEqual(submitted, []); // nothing submitted
    // Handler should work normally after clearing
    handler.handleKey({ key: 'r', preventDefault() {} } as any);
    handler.handleKey({ key: 'e', preventDefault() {} } as any);
    assert.deepEqual(submitted, ['D']);
  });

  it('Enter does nothing with no pending state', () => {
    const submitted: string[] = [];
    const handler = createSolfegeKeyHandler(
      (input: string) => submitted.push(input),
      () => true,
    );
    const handled = handler.handleKey(
      { key: 'Enter', preventDefault() {} } as any,
    );
    assert.ok(!handled);
    assert.deepEqual(submitted, []);
  });

  it('getPendingNote returns current buffer state', () => {
    const handler = createSolfegeKeyHandler(() => {}, () => true);
    assert.equal(handler.getPendingNote(), null);
    handler.handleKey({ key: 'd', preventDefault() {} } as any);
    assert.equal(handler.getPendingNote(), null); // still building syllable
    handler.handleKey({ key: 'o', preventDefault() {} } as any);
    assert.equal(handler.getPendingNote(), 'C'); // resolved to C, pending accidental
    handler.handleKey({ key: 'Enter', preventDefault() {} } as any);
    assert.equal(handler.getPendingNote(), null); // committed
  });

  it('onPendingChange fires on pending transitions', () => {
    const pending: (string | null)[] = [];
    const handler = createSolfegeKeyHandler(
      () => {},
      () => true,
      (note) => pending.push(note),
    );
    handler.handleKey({ key: 'd', preventDefault() {} } as any);
    handler.handleKey({ key: 'o', preventDefault() {} } as any);
    assert.deepEqual(pending, ['C']);
    handler.handleKey({ key: 'Enter', preventDefault() {} } as any);
    assert.deepEqual(pending, ['C', null]);
  });
});

describe('createAdaptiveKeyHandler', () => {
  it('delegates to letter handler when solfège is off', () => {
    const original = getUseSolfege();
    try {
      setUseSolfege(false);
      const submitted: string[] = [];
      const handler = createAdaptiveKeyHandler(
        (input: string) => submitted.push(input),
        () => false,
      );
      handler.handleKey({ key: 'c', preventDefault() {} } as any);
      assert.deepEqual(submitted, ['C']);
    } finally {
      setUseSolfege(original);
    }
  });

  it('delegates to solfège handler when solfège is on', () => {
    const original = getUseSolfege();
    try {
      setUseSolfege(true);
      const submitted: string[] = [];
      const handler = createAdaptiveKeyHandler(
        (input: string) => submitted.push(input),
        () => false,
      );
      handler.handleKey({ key: 'd', preventDefault() {} } as any);
      handler.handleKey({ key: 'o', preventDefault() {} } as any);
      assert.deepEqual(submitted, ['C']);
    } finally {
      setUseSolfege(original);
    }
  });
});

// --- pickCalibrationNote tests ---

describe('pickCalibrationNote', () => {
  it('returns a valid note name', () => {
    const note = pickCalibrationNote(null, () => 0.5);
    const allNotes = [
      'C',
      'D',
      'E',
      'F',
      'G',
      'A',
      'B',
      'C#',
      'D#',
      'F#',
      'G#',
      'A#',
    ];
    assert.ok(allNotes.includes(note), `${note} should be a valid note`);
  });

  it('picks a sharp note when rng < 0.35', () => {
    let call = 0;
    const rng = () => [0.1, 0][call++];
    const note = pickCalibrationNote(null, rng);
    assert.ok(note.includes('#'), `expected a sharp note, got ${note}`);
  });

  it('picks a natural note when rng >= 0.35', () => {
    let call = 0;
    const rng = () => [0.5, 0][call++];
    const note = pickCalibrationNote(null, rng);
    assert.ok(!note.includes('#'), `expected a natural note, got ${note}`);
  });

  it('avoids repeating the previous note', () => {
    // Pool is naturals; first rng picks index 0 (= C = prev), retry picks index 1 (= D)
    let call = 0;
    const rng = () => [0.5, 0, 0.99 / 7][call++];
    const note = pickCalibrationNote('C', rng);
    assert.notEqual(note, 'C');
  });

  it('never returns same note consecutively in 100 trials', () => {
    let prev: string | null = null;
    for (let i = 0; i < 100; i++) {
      const note = pickCalibrationNote(prev);
      if (prev !== null) {
        assert.notEqual(note, prev, `trial ${i}: got consecutive ${note}`);
      }
      prev = note;
    }
  });
});

// --- noteNarrowingSet / numberNarrowingSet tests ---

describe('noteNarrowingSet', () => {
  it('returns null for null input', () => {
    assert.equal(noteNarrowingSet(null), null);
  });

  it('C includes C and C# but no flat enharmonic (Cb not accepted)', () => {
    const result = noteNarrowingSet('C')!;
    assert.ok(result.has('C'));
    assert.ok(result.has('C#'));
    assert.equal(result.size, 2);
  });

  it('F includes F and F# but no flat enharmonic (Fb not accepted)', () => {
    const result = noteNarrowingSet('F')!;
    assert.ok(result.has('F'));
    assert.ok(result.has('F#'));
    assert.equal(result.size, 2);
  });

  it('D includes D, D#, and C# (via Db)', () => {
    const result = noteNarrowingSet('D')!;
    assert.ok(result.has('D'));
    assert.ok(result.has('D#'));
    assert.ok(result.has('C#'), 'Db maps to C# button');
    assert.equal(result.size, 3);
  });

  it('A includes A, A#, and G# (via Ab)', () => {
    const result = noteNarrowingSet('A')!;
    assert.ok(result.has('A'));
    assert.ok(result.has('A#'));
    assert.ok(result.has('G#'), 'Ab maps to G# button');
    assert.equal(result.size, 3);
  });

  it('G includes G, G#, and F# (via Gb)', () => {
    const result = noteNarrowingSet('G')!;
    assert.ok(result.has('G'));
    assert.ok(result.has('G#'));
    assert.ok(result.has('F#'), 'Gb maps to F# button');
    assert.equal(result.size, 3);
  });

  it('E includes E and D# (via Eb) but no E#', () => {
    const result = noteNarrowingSet('E')!;
    assert.ok(result.has('E'));
    assert.ok(result.has('D#'), 'Eb maps to D# button');
    assert.equal(result.size, 2);
  });

  it('B includes B and A# (via Bb) but no B#', () => {
    const result = noteNarrowingSet('B')!;
    assert.ok(result.has('B'));
    assert.ok(result.has('A#'), 'Bb maps to A# button');
    assert.equal(result.size, 2);
  });
});

describe('numberNarrowingSet', () => {
  it('returns null for null input', () => {
    assert.equal(numberNarrowingSet(null, 11), null);
  });

  it('pending digit 1 in 0-11 range', () => {
    const result = numberNarrowingSet(1, 11)!;
    assert.ok(result.has('1'));
    assert.ok(result.has('10'));
    assert.ok(result.has('11'));
    assert.equal(result.size, 3);
  });

  it('pending digit 1 in 1-12 range', () => {
    const result = numberNarrowingSet(1, 12, 1)!;
    assert.ok(result.has('1'));
    assert.ok(result.has('10'));
    assert.ok(result.has('11'));
    assert.ok(result.has('12'));
    assert.equal(result.size, 4);
  });

  it('pending digit 0 in 0-11 range', () => {
    const result = numberNarrowingSet(0, 11)!;
    assert.ok(result.has('0'));
    // 0*10+0=0, 0*10+1=1, ..., 0*10+9=9, all ≤ 11
    assert.equal(result.size, 10);
  });

  it('pending digit 0 in 1-12 range excludes 0', () => {
    const result = numberNarrowingSet(0, 12, 1)!;
    // 0 is below start=1, so excluded; multi-digit: 01=1..09=9 all ≥ 1
    assert.ok(!result.has('0'), '0 should be excluded (below start)');
    const expected = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
    for (const value of expected) {
      assert.ok(result.has(value), `Expected result to contain ${value}`);
    }
    assert.equal(result.size, expected.length);
  });
});

// Note: createQuizEngine requires DOM (document.querySelector etc.).
// Full integration tests run in the browser. The engine is intentionally
// thin — most logic lives in adaptive.js (well-tested) and the mode configs.
