// Tests for processMultiTap — the pure tap toggle logic shared by
// useMultiTapInput. The function only handles add/remove; evaluation
// and onePerString replacement are handled by the hook.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { MultiTapDef } from './types.ts';
import { processMultiTap } from './use-multi-tap-input.ts';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Create a minimal multiTap spec for testing. */
function makeDef(): MultiTapDef<{ targets: string[] }> {
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('processMultiTap', () => {
  it('adds a new tap', () => {
    const action = processMultiTap(
      makeDef(),
      { targets: ['0-0', '1-5'] },
      new Set(),
      '0-0',
    );
    assert.equal(action.kind, 'added');
  });

  it('deselects an already-tapped position', () => {
    const action = processMultiTap(
      makeDef(),
      { targets: ['0-0', '1-5'] },
      new Set(['0-0']),
      '0-0',
    );
    assert.equal(action.kind, 'removed');
  });

  it('allows taps beyond target count (no auto-submit)', () => {
    const action = processMultiTap(
      makeDef(),
      { targets: ['0-0'] },
      new Set(['0-0']),
      '1-5',
    );
    // Tapping a new position on a full set still returns 'added'
    // (evaluation is deferred to handleCheck)
    assert.equal(action.kind, 'added');
  });

  it('adds without auto-completing when all targets tapped', () => {
    const action = processMultiTap(
      makeDef(),
      { targets: ['0-0', '1-5'] },
      new Set(['0-0']),
      '1-5',
    );
    assert.equal(action.kind, 'added');
  });
});
