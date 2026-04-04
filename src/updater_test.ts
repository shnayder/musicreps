import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkForUpdateCore,
  type OTAState,
  sha256Hex,
  type UpdateDeps,
  type VersionManifest,
} from './updater.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HTML_CONTENT = '<html><body>Hello</body></html>';

function htmlHash(): Promise<string> {
  return sha256Hex(HTML_CONTENT);
}

function makeState(overrides: Partial<OTAState> = {}): OTAState {
  return { status: 'none', version: '', path: '', attempts: 0, ...overrides };
}

function makeManifest(
  overrides: Partial<VersionManifest> = {},
): Promise<VersionManifest> {
  return htmlHash().then((hash) => ({
    version: 'v2',
    sha256: hash,
    timestamp: '2026-01-01T00:00:00Z',
    ...overrides,
  }));
}

function makeDeps(overrides: Partial<UpdateDeps> = {}): UpdateDeps {
  return {
    fetchManifest: () => makeManifest(),
    fetchHtml: () => Promise.resolve(HTML_CONTENT),
    getState: () => Promise.resolve(makeState()),
    getRunningVersion: () => 'v1',
    writeUpdate: () => Promise.resolve(),
    registerUpdate: () => Promise.resolve(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// sha256Hex
// ---------------------------------------------------------------------------

describe('sha256Hex', () => {
  it('produces a 64-char hex string', async () => {
    const hash = await sha256Hex('hello');
    assert.equal(hash.length, 64);
    assert.match(hash, /^[0-9a-f]+$/);
  });

  it('is deterministic', async () => {
    const a = await sha256Hex('test input');
    const b = await sha256Hex('test input');
    assert.equal(a, b);
  });

  it('differs for different inputs', async () => {
    const a = await sha256Hex('aaa');
    const b = await sha256Hex('bbb');
    assert.notEqual(a, b);
  });
});

// ---------------------------------------------------------------------------
// checkForUpdateCore
// ---------------------------------------------------------------------------

describe('checkForUpdateCore', () => {
  it('returns up-to-date when versions match (bundled)', async () => {
    const deps = makeDeps({
      fetchManifest: () => makeManifest({ version: 'v1' }),
      getRunningVersion: () => 'v1',
    });
    assert.equal(await checkForUpdateCore(deps), 'up-to-date');
  });

  it('returns up-to-date when OTA state version matches', async () => {
    const deps = makeDeps({
      fetchManifest: () => makeManifest({ version: 'v2' }),
      getState: () =>
        Promise.resolve(makeState({ status: 'ready', version: 'v2' })),
      getRunningVersion: () => 'v1',
    });
    assert.equal(await checkForUpdateCore(deps), 'up-to-date');
  });

  it('returns up-to-date when healthy OTA version matches', async () => {
    const deps = makeDeps({
      fetchManifest: () => makeManifest({ version: 'v2' }),
      getState: () =>
        Promise.resolve(makeState({ status: 'healthy', version: 'v2' })),
    });
    assert.equal(await checkForUpdateCore(deps), 'up-to-date');
  });

  it('returns fetch-failed when manifest fetch fails', async () => {
    const deps = makeDeps({
      fetchManifest: () => Promise.resolve(null),
    });
    assert.equal(await checkForUpdateCore(deps), 'fetch-failed');
  });

  it('returns download-failed when HTML fetch fails', async () => {
    const deps = makeDeps({
      fetchHtml: () => Promise.resolve(null),
    });
    assert.equal(await checkForUpdateCore(deps), 'download-failed');
  });

  it('returns hash-mismatch when SHA-256 does not match', async () => {
    const deps = makeDeps({
      fetchManifest: () => makeManifest({ sha256: 'badhash'.padEnd(64, '0') }),
    });
    assert.equal(await checkForUpdateCore(deps), 'hash-mismatch');
  });

  it('downloads and registers when new version available', async () => {
    let writtenHtml = '';
    let writtenDir = '';
    let registeredVersion = '';
    let registeredDir = '';

    const deps = makeDeps({
      writeUpdate: (html, dir) => {
        writtenHtml = html;
        writtenDir = dir;
        return Promise.resolve();
      },
      registerUpdate: (dir, version) => {
        registeredDir = dir;
        registeredVersion = version;
        return Promise.resolve();
      },
    });

    const result = await checkForUpdateCore(deps);
    assert.equal(result, 'update-registered');
    assert.equal(writtenHtml, HTML_CONTENT);
    assert.equal(writtenDir, 'ota/current');
    assert.equal(registeredDir, 'ota/current');
    assert.equal(registeredVersion, 'v2');
  });

  it('uses bundled version when OTA state has no version', async () => {
    let registered = false;
    const deps = makeDeps({
      fetchManifest: () => makeManifest({ version: 'v2' }),
      getState: () =>
        Promise.resolve(makeState({ status: 'none', version: '' })),
      getRunningVersion: () => 'v1',
      registerUpdate: () => {
        registered = true;
        return Promise.resolve();
      },
    });
    assert.equal(await checkForUpdateCore(deps), 'update-registered');
    assert.ok(registered);
  });

  it('propagates errors from writeUpdate', async () => {
    const deps = makeDeps({
      writeUpdate: () => Promise.reject(new Error('disk full')),
    });
    await assert.rejects(() => checkForUpdateCore(deps), /disk full/);
  });
});
