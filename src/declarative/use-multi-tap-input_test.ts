// Tests for processMultiTap — the pure collection/evaluation logic shared by
// useMultiTapInput. Tests the actual exported function, not a re-implementation.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { MultiTapDef } from './types.ts';
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
  });

  it('allows taps beyond target count (no auto-submit)', () => {
    const def = makeDef(['0-0']);
    const full = new Set(['0-0']);
    const action = processMultiTap(def, { targets: ['0-0'] }, full, '1-5');
    // No longer 'ignored' — user can tap freely
    assert.equal(action.kind, 'added');
  });

  it('returns added for all non-duplicate taps (no auto-complete)', () => {
    const def = makeDef(['0-0', '1-5']);
    const partial = new Set(['0-0']);
    const action = processMultiTap(
      def,
      { targets: ['0-0', '1-5'] },
      partial,
      '1-5',
    );
    // No longer auto-completes — just added
    assert.equal(action.kind, 'added');
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
    // Should return added (replacement handled by hook)
    assert.equal(action.kind, 'added');
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
  });
});
