import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  createScopeLock,
  nextScopeLockState,
  readScope,
} from './scope-lock.ts';

describe('scope-lock', () => {
  it('starts unlocked and reads live', () => {
    const lock = createScopeLock<ReadonlySet<string>>();
    assert.equal(lock.locked, false);
    assert.equal(lock.snapshot, null);
    const live = new Set(['a', 'b']);
    assert.equal(readScope(lock, live), live);
  });

  it('captures the live value on rising edge', () => {
    const prev = createScopeLock<ReadonlySet<string>>();
    const live = new Set(['a', 'b']);
    const next = nextScopeLockState(prev, true, live);
    assert.equal(next.locked, true);
    assert.equal(next.snapshot, live);
  });

  it('keeps the snapshot stable when live changes while locked', () => {
    let lock = createScopeLock<ReadonlySet<string>>();
    const initial = new Set(['a', 'b']);
    lock = nextScopeLockState(lock, true, initial);

    // Live value changes underneath (e.g. rec.suggestedScope mutates).
    const mutated = new Set(['c']);
    assert.equal(readScope(lock, mutated), initial);
  });

  it('re-locking while locked is a no-op (snapshot preserved)', () => {
    let lock = createScopeLock<ReadonlySet<string>>();
    const first = new Set(['a', 'b']);
    lock = nextScopeLockState(lock, true, first);
    const second = new Set(['c']);
    const again = nextScopeLockState(lock, true, second);
    // Must be the same reference: nextScopeLockState returns `prev` unchanged.
    assert.equal(again, lock);
    assert.equal(readScope(again, second), first);
  });

  it('unlock clears the snapshot and exposes live again', () => {
    let lock = createScopeLock<ReadonlySet<string>>();
    lock = nextScopeLockState(lock, true, new Set(['a']));
    lock = nextScopeLockState(lock, false, new Set(['a']));
    assert.equal(lock.locked, false);
    assert.equal(lock.snapshot, null);
    const live = new Set(['x']);
    assert.equal(readScope(lock, live), live);
  });

  it('re-locking after unlock captures the new live value', () => {
    let lock = createScopeLock<ReadonlySet<string>>();
    lock = nextScopeLockState(lock, true, new Set(['a']));
    lock = nextScopeLockState(lock, false, new Set(['a']));
    const newLive = new Set(['x', 'y']);
    lock = nextScopeLockState(lock, true, newLive);
    assert.equal(readScope(lock, new Set(['mutated'])), newLive);
  });

  it('unlocking while already unlocked is a no-op', () => {
    const prev = createScopeLock<ReadonlySet<string>>();
    const next = nextScopeLockState(prev, false, new Set(['a']));
    assert.equal(next, prev);
  });
});
