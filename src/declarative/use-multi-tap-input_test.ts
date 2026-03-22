// Tests for useMultiTapInput logic — the multi-tap collection/evaluation hook.
// These test the pure behavior: tap handling, de-duplication, auto-submission,
// and reset. Follows the same pattern as the sequential input tests.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { MultiTapDef, MultiTapEvalResult } from './types.ts';

// ---------------------------------------------------------------------------
// Test helpers — simulate the hook's logic without Preact
// ---------------------------------------------------------------------------

/**
 * Simulate multi-tap collection logic (mirrors useMultiTapInput internals).
 * Returns { tapped, evaluated, submissions } after processing all taps.
 */
function simulateTaps(
  targets: string[],
  taps: string[],
): {
  tapped: Set<string>;
  evaluated: MultiTapEvalResult | null;
  submissions: string[];
} {
  const multiTap: MultiTapDef<{ targets: string[] }> = {
    getTargets: (q) => q.targets,
    evaluate: (q, tapped) => {
      const targetSet = new Set(q.targets);
      const perEntry = tapped.map((pos) => ({
        positionKey: pos,
        correct: targetSet.has(pos),
      }));
      const tappedSet = new Set(tapped);
      const missed = q.targets.filter((t) => !tappedSet.has(t));
      const correct = perEntry.every((e) => e.correct) && missed.length === 0;
      return {
        correct,
        correctAnswer: q.targets.join(' '),
        perEntry,
        missed,
      };
    },
    getDisplayAnswer: (q) => q.targets.join(' '),
  };

  const q = { targets };
  const tapped = new Set<string>();
  let evaluated: MultiTapEvalResult | null = null;
  const submissions: string[] = [];

  for (const tap of taps) {
    // Skip duplicates and taps after evaluation
    if (tapped.has(tap) || tapped.size >= targets.length) continue;

    tapped.add(tap);

    if (tapped.size === targets.length) {
      evaluated = multiTap.evaluate(q, [...tapped]);
      const sentinel = evaluated.correct ? '__correct__' : '__wrong__';
      submissions.push(sentinel + ':' + evaluated.correctAnswer);
    }
  }

  return { tapped, evaluated, submissions };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('multi-tap collection', () => {
  it('collects taps into a set', () => {
    const { tapped } = simulateTaps(['0-0', '1-5', '2-3'], ['0-0', '1-5']);
    assert.equal(tapped.size, 2);
    assert.ok(tapped.has('0-0'));
    assert.ok(tapped.has('1-5'));
  });

  it('rejects duplicate taps', () => {
    const { tapped } = simulateTaps(
      ['0-0', '1-5', '2-3'],
      ['0-0', '0-0', '1-5'],
    );
    assert.equal(tapped.size, 2);
  });

  it('auto-submits correct sentinel when all targets found', () => {
    const targets = ['0-0', '1-5'];
    const { submissions, evaluated } = simulateTaps(
      targets,
      ['0-0', '1-5'],
    );
    assert.equal(submissions.length, 1);
    assert.ok(submissions[0].startsWith('__correct__:'));
    assert.notEqual(evaluated, null);
    assert.equal(evaluated!.correct, true);
  });

  it('auto-submits wrong sentinel when taps do not match targets', () => {
    const targets = ['0-0', '1-5'];
    const { submissions, evaluated } = simulateTaps(
      targets,
      ['0-0', '2-3'],
    );
    assert.equal(submissions.length, 1);
    assert.ok(submissions[0].startsWith('__wrong__:'));
    assert.equal(evaluated!.correct, false);
    assert.equal(evaluated!.missed.length, 1);
    assert.equal(evaluated!.missed[0], '1-5');
  });

  it('ignores taps after evaluation', () => {
    const targets = ['0-0', '1-5'];
    const { tapped, submissions } = simulateTaps(
      targets,
      ['0-0', '1-5', '3-7'],
    );
    assert.equal(tapped.size, 2);
    assert.equal(submissions.length, 1);
  });

  it('handles single-target case', () => {
    const { submissions, evaluated } = simulateTaps(['0-0'], ['0-0']);
    assert.equal(submissions.length, 1);
    assert.equal(evaluated!.correct, true);
  });

  it('evaluate shows per-entry results', () => {
    const targets = ['0-0', '1-5', '2-3'];
    const { evaluated } = simulateTaps(targets, ['0-0', '1-5', '2-3']);
    assert.equal(evaluated!.perEntry.length, 3);
    assert.ok(evaluated!.perEntry.every((e) => e.correct));
    assert.equal(evaluated!.missed.length, 0);
  });

  it('mixed correct and wrong taps produce correct per-entry results', () => {
    const targets = ['0-0', '1-5', '2-3'];
    const { evaluated } = simulateTaps(targets, ['0-0', '4-4', '2-3']);
    assert.equal(evaluated!.correct, false);
    const results = evaluated!.perEntry;
    assert.equal(results[0].correct, true); // 0-0 is a target
    assert.equal(results[1].correct, false); // 4-4 is not a target
    assert.equal(results[2].correct, true); // 2-3 is a target
    assert.deepEqual(evaluated!.missed, ['1-5']); // missed target
  });
});
