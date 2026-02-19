import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createAdaptiveKeyHandler,
  createNoteKeyHandler,
  createSolfegeKeyHandler,
  getCalibrationThresholds,
  pickCalibrationButton,
} from './quiz-engine.js';
import { getUseSolfege, setUseSolfege } from './music-data.js';
import { DEFAULT_CONFIG } from './adaptive.js';

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

// Note: createQuizEngine requires DOM (document.querySelector etc.).
// Full integration tests run in the browser. The engine is intentionally
// thin — most logic lives in adaptive.js (well-tested) and the mode configs.
