// Tests for the storage abstraction (src/storage.ts).
// The web backend lazily resolves localStorage with an in-memory fallback,
// so these tests work in any JS context (browser, Deno, Node).

import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { initStorage, storage } from './storage.ts';

// isNative() checks window.Capacitor — in Deno, window is undefined,
// so we must create it on globalThis to exercise the native path.
// deno-lint-ignore no-explicit-any
const g = globalThis as any;

function mockNative() {
  if (typeof window === 'undefined') g.window = g;
  g.window.Capacitor = { isNativePlatform: () => true };
}
function unmockNative() {
  delete g.window.Capacitor;
}

describe('initStorage (native path)', () => {
  it('throws when called on native without Preferences plugin', async () => {
    mockNative();
    try {
      await assert.rejects(
        () => initStorage(),
        (err: Error) => {
          assert.match(err.message, /without Preferences plugin/);
          return true;
        },
      );
    } finally {
      unmockNative();
    }
  });

  it('initializes with a mock Preferences plugin', async () => {
    const data = new Map([['test_key', 'test_val']]);
    const mock = {
      keys: () => Promise.resolve({ keys: [...data.keys()] }),
      get: (o: { key: string }) =>
        Promise.resolve({ value: data.get(o.key) ?? null }),
      set: () => Promise.resolve(),
      remove: () => Promise.resolve(),
    };
    mockNative();
    try {
      await initStorage(mock);
      assert.equal(storage.getItem('test_key'), 'test_val');
    } finally {
      unmockNative();
      // Re-init as web to restore module state for subsequent tests.
      await initStorage();
    }
  });
});

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
