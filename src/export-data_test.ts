import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildExport, exportFilename } from './export-data.ts';
import type { KVStorage } from './storage.ts';

function memoryStorage(init: Record<string, string> = {}): KVStorage {
  const m = new Map<string, string>(Object.entries(init));
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => {
      m.set(k, v);
    },
    removeItem: (k) => {
      m.delete(k);
    },
    keys: () => [...m.keys()],
  };
}

describe('buildExport', () => {
  const now = new Date('2026-04-20T14:23:05.123Z');

  it('produces the expected metadata envelope', () => {
    const payload = buildExport({
      appVersion: 'abc1234 main',
      backend: 'web',
      now,
      source: memoryStorage({ a: '1' }),
    });

    assert.equal(payload.schemaVersion, 1);
    assert.equal(payload.exportedAt, '2026-04-20T14:23:05.123Z');
    assert.equal(payload.appVersion, 'abc1234 main');
    assert.equal(payload.backend, 'web');
    assert.equal(payload.keyCount, 1);
  });

  it('parses JSON-valued entries as objects / arrays', () => {
    const payload = buildExport({
      appVersion: 'v1',
      backend: 'web',
      now,
      source: memoryStorage({
        starredSkills: '["fretboard","chordSpelling"]',
        adaptive_fretboard__0_5: '{"seen":42,"ewmaMs":812}',
      }),
    });

    assert.deepEqual(payload.data.starredSkills, [
      'fretboard',
      'chordSpelling',
    ]);
    assert.deepEqual(payload.data.adaptive_fretboard__0_5, {
      seen: 42,
      ewmaMs: 812,
    });
  });

  it('falls back to raw string for non-JSON values', () => {
    const payload = buildExport({
      appVersion: 'v1',
      backend: 'web',
      now,
      source: memoryStorage({ fretboard_notation: 'letter' }),
    });

    assert.equal(payload.data.fretboard_notation, 'letter');
  });

  it('handles an empty store', () => {
    const payload = buildExport({
      appVersion: 'v1',
      backend: 'web',
      now,
      source: memoryStorage(),
    });

    assert.equal(payload.keyCount, 0);
    assert.deepEqual(payload.data, {});
  });

  it('propagates the backend tag', () => {
    const payload = buildExport({
      appVersion: 'v1',
      backend: 'native',
      now,
      source: memoryStorage({ a: '1' }),
    });

    assert.equal(payload.backend, 'native');
  });
});

describe('exportFilename', () => {
  const now = new Date('2026-04-20T14:23:05.000Z');

  it('includes version and local-time timestamp', () => {
    const name = exportFilename('abc1234 main', now);
    assert.match(
      name,
      /^musicreps-export-abc1234-main-\d{8}-\d{6}\.json$/,
    );
  });

  it('sanitizes punctuation in the version', () => {
    const name = exportFilename('1.2.3 #beta (dev)', now);
    assert.match(name, /^musicreps-export-1-2-3-beta-dev-\d{8}-\d{6}\.json$/);
  });

  it('omits version segment when empty', () => {
    const name = exportFilename('', now);
    assert.match(name, /^musicreps-export-\d{8}-\d{6}\.json$/);
  });
});
