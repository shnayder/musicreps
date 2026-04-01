// Tests for processMultiTap — the pure collection/evaluation logic shared by
// useMultiTapInput. Tests the actual exported function, not a re-implementation.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { MultiTapDef, MultiTapEvalResult } from './types.ts';
import { processMultiTap } from './use-multi-tap-input.ts';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Create a simple multiTap spec for testing. */
function makeDef(_targets: string[]): MultiTapDef<{ targets: string[] }> {
  return {
    getTargets: (q) => q.targets,
    evaluate: (q, tapped) => {
      const targetSet = new Set(q.targets);
      const tappedSet = new Set(tapped);
      const perEntry = tapped.map((pos) => ({
        positionKey: pos,
        correct: targetSet.has(pos),
      }));
      const missed = q.targets.filter((t) => !tappedSet.has(t));
      const correct = perEntry.every((e) => e.correct) && missed.length === 0;
      return { correct, correctAnswer: q.targets.join(' '), perEntry, missed };
    },
  };
}

/** Simulate a sequence of taps, returning final state. */
function simulateTaps(
  targets: string[],
  taps: string[],
): {
  tapped: Set<string>;
  evaluated: MultiTapEvalResult | null;
  submissions: string[];
} {
  const def = makeDef(targets);
  const q = { targets };
  const tapped = new Set<string>();
  let evaluated: MultiTapEvalResult | null = null;
  const submissions: string[] = [];

  for (const tap of taps) {
    const action = processMultiTap(def, q, tapped, tap);
    if (action.kind === 'added') {
      tapped.add(tap);
    } else if (action.kind === 'removed') {
      tapped.delete(tap);
    } else if (action.kind === 'complete') {
      tapped.add(tap);
      evaluated = action.result;
      submissions.push(action.sentinel);
    }
    // 'ignored' → no state change
  }

  return { tapped, evaluated, submissions };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('processMultiTap', () => {
  it('adds a valid tap', () => {
    const def = makeDef(['0-0', '1-5']);
    const action = processMultiTap(
      def,
      { targets: ['0-0', '1-5'] },
      new Set(),
      '0-0',
    );
    assert.equal(action.kind, 'added');
    if (action.kind === 'added') {
      assert.equal(action.progressText, '1 / 2');
    }
  });

  it('deselects an already-tapped position', () => {
    const def = makeDef(['0-0', '1-5']);
    const already = new Set(['0-0']);
    const action = processMultiTap(
      def,
      { targets: ['0-0', '1-5'] },
      already,
      '0-0',
    );
    assert.equal(action.kind, 'removed');
    if (action.kind === 'removed') {
      assert.equal(action.progressText, '0 / 2');
    }
  });

  it('rejects taps when collection is full', () => {
    const def = makeDef(['0-0']);
    const full = new Set(['0-0']);
    const action = processMultiTap(def, { targets: ['0-0'] }, full, '1-5');
    assert.equal(action.kind, 'ignored');
  });

  it('completes with correct sentinel when all targets found', () => {
    const def = makeDef(['0-0', '1-5']);
    const partial = new Set(['0-0']);
    const action = processMultiTap(
      def,
      { targets: ['0-0', '1-5'] },
      partial,
      '1-5',
    );
    assert.equal(action.kind, 'complete');
    if (action.kind === 'complete') {
      assert.equal(action.result.correct, true);
      assert.ok(action.sentinel.startsWith('__correct__:'));
    }
  });

  it('completes with wrong sentinel for wrong taps', () => {
    const def = makeDef(['0-0', '1-5']);
    const partial = new Set(['0-0']);
    const action = processMultiTap(
      def,
      { targets: ['0-0', '1-5'] },
      partial,
      '2-3',
    );
    assert.equal(action.kind, 'complete');
    if (action.kind === 'complete') {
      assert.equal(action.result.correct, false);
      assert.ok(action.sentinel.startsWith('__wrong__:'));
      assert.deepEqual(action.result.missed, ['1-5']);
    }
  });
});

describe('processMultiTap onePerString', () => {
  it('replaces existing tap on same string', () => {
    const def: MultiTapDef<{ targets: string[] }> = {
      ...makeDef(['0-1', '1-2']),
      onePerString: true,
    };
    // Tap string 0 fret 3 first (wrong), then string 0 fret 1 (correct)
    const tapped = new Set(['0-3']);
    const action = processMultiTap(
      def,
      { targets: ['0-1', '1-2'] },
      tapped,
      '0-1',
    );
    // Should replace 0-3 with 0-1 (not add to size)
    assert.equal(action.kind, 'added');
    if (action.kind === 'added') {
      assert.equal(action.progressText, '1 / 2');
    }
  });

  it('does not replace tap on different string', () => {
    const def: MultiTapDef<{ targets: string[] }> = {
      ...makeDef(['0-1', '1-2', '2-3']),
      onePerString: true,
    };
    const tapped = new Set(['0-1']);
    const action = processMultiTap(
      def,
      { targets: ['0-1', '1-2', '2-3'] },
      tapped,
      '1-2',
    );
    assert.equal(action.kind, 'added');
    if (action.kind === 'added') {
      assert.equal(action.progressText, '2 / 3');
    }
  });

  it('completes after replacement fills all slots', () => {
    const def: MultiTapDef<{ targets: string[] }> = {
      ...makeDef(['0-1', '1-2']),
      onePerString: true,
    };
    // Tap 0-3 (wrong for string 0), then 1-2 (string 1), then 0-1 (replaces 0-3)
    const tapped = new Set<string>();
    processMultiTap(def, { targets: ['0-1', '1-2'] }, tapped, '0-3');
    tapped.add('0-3');
    processMultiTap(def, { targets: ['0-1', '1-2'] }, tapped, '1-2');
    tapped.add('1-2');
    // Now replace 0-3 with 0-1
    const action = processMultiTap(
      def,
      { targets: ['0-1', '1-2'] },
      tapped,
      '0-1',
    );
    assert.equal(action.kind, 'complete');
    if (action.kind === 'complete') {
      assert.equal(action.result.correct, true);
    }
  });
});

describe('multi-tap collection (via simulateTaps)', () => {
  it('collects taps into a set', () => {
    const { tapped } = simulateTaps(['0-0', '1-5', '2-3'], ['0-0', '1-5']);
    assert.equal(tapped.size, 2);
    assert.ok(tapped.has('0-0'));
    assert.ok(tapped.has('1-5'));
  });

  it('deselects and reselects via double-tap', () => {
    // tap 0-0, tap 0-0 again (deselect), tap 1-5
    const { tapped } = simulateTaps(
      ['0-0', '1-5', '2-3'],
      ['0-0', '0-0', '1-5'],
    );
    // 0-0 was deselected, only 1-5 remains
    assert.equal(tapped.size, 1);
    assert.ok(!tapped.has('0-0'));
    assert.ok(tapped.has('1-5'));
  });

  it('auto-submits correct sentinel when all targets found', () => {
    const { submissions, evaluated } = simulateTaps(
      ['0-0', '1-5'],
      ['0-0', '1-5'],
    );
    assert.equal(submissions.length, 1);
    assert.ok(submissions[0].startsWith('__correct__:'));
    assert.equal(evaluated!.correct, true);
  });

  it('ignores taps after evaluation', () => {
    const { tapped, submissions } = simulateTaps(
      ['0-0', '1-5'],
      ['0-0', '1-5', '3-7'],
    );
    assert.equal(tapped.size, 2);
    assert.equal(submissions.length, 1);
  });

  it('mixed correct and wrong taps produce correct per-entry results', () => {
    const targets = ['0-0', '1-5', '2-3'];
    const { evaluated } = simulateTaps(targets, ['0-0', '4-4', '2-3']);
    assert.equal(evaluated!.correct, false);
    assert.equal(evaluated!.perEntry[0].correct, true);
    assert.equal(evaluated!.perEntry[1].correct, false);
    assert.equal(evaluated!.perEntry[2].correct, true);
    assert.deepEqual(evaluated!.missed, ['1-5']);
  });
});
