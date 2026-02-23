import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createAdaptiveKeyHandler,
  createNoteKeyHandler,
  createSolfegeKeyHandler,
  getCalibrationThresholds,
  noteNarrowingSet,
  numberNarrowingSet,
  pickCalibrationButton,
} from './quiz-engine.ts';
import { getUseSolfege, setUseSolfege } from './music-data.ts';
import { DEFAULT_CONFIG } from './adaptive.ts';

describe('quiz-engine defaults', () => {
  it('default automaticityTarget is 3000ms', () => {
    assert.equal(DEFAULT_CONFIG.automaticityTarget, 3000);
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

  it('scales thresholds from baseline at 1000ms', () => {
    const thresholds = getCalibrationThresholds(1000);
    assert.equal(thresholds[0].label, 'Automatic');
    assert.equal(thresholds[0].maxMs, 1500); // 1.5x
    assert.equal(thresholds[1].label, 'Good');
    assert.equal(thresholds[1].maxMs, 3000); // 3.0x
    assert.equal(thresholds[2].label, 'Developing');
    assert.equal(thresholds[2].maxMs, 4500); // 4.5x
    assert.equal(thresholds[3].label, 'Slow');
    assert.equal(thresholds[3].maxMs, 6000); // 6.0x
    assert.equal(thresholds[4].label, 'Very slow');
    assert.equal(thresholds[4].maxMs, null);
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

// --- pickCalibrationButton tests ---

function makeBtn(note: string) {
  return { dataset: { note }, textContent: note } as any;
}

describe('pickCalibrationButton', () => {
  const C = makeBtn('C');
  const D = makeBtn('D');
  const Cs = makeBtn('C#');
  const Fs = makeBtn('F#');

  it('returns a button from the pool', () => {
    const btn = pickCalibrationButton([C, D, Cs], null, () => 0.5);
    assert.ok([C, D, Cs].includes(btn));
  });

  it('picks a sharp button when rng < 0.35', () => {
    // rng returns 0.1 for the sharp/natural decision, 0 for index selection
    let call = 0;
    const rng = () => [0.1, 0][call++];
    const btn = pickCalibrationButton([C, D, Cs, Fs], null, rng);
    assert.ok([Cs, Fs].includes(btn), 'expected a sharp button');
  });

  it('picks a natural button when rng >= 0.35', () => {
    let call = 0;
    const rng = () => [0.5, 0][call++];
    const btn = pickCalibrationButton([C, D, Cs, Fs], null, rng);
    assert.ok([C, D].includes(btn), 'expected a natural button');
  });

  it('avoids repeating the previous button', () => {
    // Pool has only naturals [C, D]; first rng call picks index 0 (= C = prevBtn),
    // second picks index 1 (= D) to break the do-while
    let call = 0;
    const rng = () => [0.5, 0, 0.99][call++];
    const btn = pickCalibrationButton([C, D], C, rng);
    assert.equal(btn, D);
  });

  it('allows repeat when pool has only one button', () => {
    const rng = () => 0.5;
    const btn = pickCalibrationButton([C], C, rng);
    assert.equal(btn, C);
  });

  it('falls back to all buttons when no naturals exist', () => {
    // All sharps, rng >= 0.35 so it would pick naturals, but none exist
    let call = 0;
    const rng = () => [0.5, 0][call++];
    const btn = pickCalibrationButton([Cs, Fs], null, rng);
    assert.ok([Cs, Fs].includes(btn));
  });
});

// --- noteNarrowingSet / numberNarrowingSet tests ---

describe('noteNarrowingSet', () => {
  it('returns null for null input', () => {
    assert.equal(noteNarrowingSet(null), null);
  });

  it('returns note + sharp for notes with adjacent sharp', () => {
    const result = noteNarrowingSet('C');
    assert.ok(result);
    assert.ok(result.has('C'));
    assert.ok(result.has('C#'));
    assert.equal(result.size, 2);
  });

  it('returns only natural for E (no E# in button grid)', () => {
    const result = noteNarrowingSet('E');
    assert.ok(result);
    assert.ok(result.has('E'));
    assert.equal(result.size, 1);
  });

  it('returns only natural for B (no B# in button grid)', () => {
    const result = noteNarrowingSet('B');
    assert.ok(result);
    assert.ok(result.has('B'));
    assert.equal(result.size, 1);
  });

  it('returns note + sharp for all applicable notes', () => {
    for (const note of ['C', 'D', 'F', 'G', 'A']) {
      const result = noteNarrowingSet(note)!;
      assert.equal(result.size, 2, `${note} should have 2 matches`);
      assert.ok(result.has(note + '#'));
    }
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
