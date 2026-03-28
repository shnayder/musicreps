// Tests for the storage abstraction (src/storage.ts).
// The web backend lazily resolves localStorage with an in-memory fallback,
// so these tests work in any JS context (browser, Deno, Node).

import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { initStorage, storage } from './storage.ts';

describe('storage (web backend)', () => {
  it('getItem returns null for unknown keys', () => {
    assert.equal(storage.getItem('__test_nonexistent__'), null);
  });

  it('setItem + getItem round-trips a value', () => {
    storage.setItem('__test_key__', 'hello');
    assert.equal(storage.getItem('__test_key__'), 'hello');
    // Clean up
    storage.removeItem('__test_key__');
    assert.equal(storage.getItem('__test_key__'), null);
  });

  it('removeItem removes a key', () => {
    storage.setItem('__test_rm__', 'bye');
    storage.removeItem('__test_rm__');
    assert.equal(storage.getItem('__test_rm__'), null);
  });

  it('initStorage is a no-op on web (resolves immediately)', async () => {
    // Should not throw and should resolve quickly.
    await initStorage();
    // Storage still works after re-init.
    storage.setItem('__test_after_init__', '1');
    assert.equal(storage.getItem('__test_after_init__'), '1');
    storage.removeItem('__test_after_init__');
  });
});
