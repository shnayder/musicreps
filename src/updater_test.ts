import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkForUpdateCore,
  type OTAState,
  parseReleaseNum,
  sha256Hex,
  shouldApplyUpdate,
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

async function makeManifest(
  overrides: Partial<VersionManifest> = {},
): Promise<VersionManifest> {
  const hash = await htmlHash();
  return {
    version: '#2',
    sha256: hash,
    timestamp: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeDeps(overrides: Partial<UpdateDeps> = {}): UpdateDeps {
  return {
    fetchManifest: () => makeManifest(),
    fetchHtml: () => Promise.resolve(HTML_CONTENT),
    getState: () => Promise.resolve(makeState()),
    getRunningVersion: () => '#1',
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
      fetchManifest: () => makeManifest({ version: '#1' }),
      getRunningVersion: () => '#1',
    });
    assert.equal(await checkForUpdateCore(deps), 'up-to-date');
  });

  it('returns up-to-date when OTA state version matches', async () => {
    const deps = makeDeps({
      fetchManifest: () => makeManifest({ version: '#2' }),
      getState: () =>
        Promise.resolve(makeState({ status: 'ready', version: '#2' })),
      getRunningVersion: () => '#1',
    });
    assert.equal(await checkForUpdateCore(deps), 'up-to-date');
  });

  it('returns up-to-date when healthy OTA version matches', async () => {
    const deps = makeDeps({
      fetchManifest: () => makeManifest({ version: '#2' }),
      getState: () =>
        Promise.resolve(makeState({ status: 'healthy', version: '#2' })),
    });
    assert.equal(await checkForUpdateCore(deps), 'up-to-date');
  });

  it('skips downgrade when manifest is older than running build', async () => {
    const deps = makeDeps({
      fetchManifest: () => makeManifest({ version: '#5' }),
      getRunningVersion: () => '#10',
    });
    assert.equal(await checkForUpdateCore(deps), 'skip-downgrade');
  });

  it('reports skip-dev on dev build (non-release running version)', async () => {
    const deps = makeDeps({
      fetchManifest: () => makeManifest({ version: '#100' }),
      getRunningVersion: () => 'a1b2c3 my-feat',
    });
    assert.equal(await checkForUpdateCore(deps), 'skip-dev');
  });

  it('applies downgrade when manifest has allowDowngrade', async () => {
    const deps = makeDeps({
      fetchManifest: () =>
        makeManifest({ version: '#5', allowDowngrade: true }),
      getRunningVersion: () => '#10',
    });
    assert.equal(await checkForUpdateCore(deps), 'update-registered');
  });

  it('honors OTA state version as the floor', async () => {
    const deps = makeDeps({
      fetchManifest: () => makeManifest({ version: '#7' }),
      getState: () =>
        Promise.resolve(makeState({ status: 'ready', version: '#8' })),
      getRunningVersion: () => '#5',
    });
    assert.equal(await checkForUpdateCore(deps), 'skip-downgrade');
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
    assert.equal(registeredVersion, '#2');
  });

  it('uses bundled version when OTA state has no version', async () => {
    let registered = false;
    const deps = makeDeps({
      fetchManifest: () => makeManifest({ version: '#2' }),
      getState: () =>
        Promise.resolve(makeState({ status: 'none', version: '' })),
      getRunningVersion: () => '#1',
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

// ---------------------------------------------------------------------------
// parseReleaseNum / shouldApplyUpdate (pure)
// ---------------------------------------------------------------------------

describe('parseReleaseNum', () => {
  it('parses "#N" to N', () => {
    assert.equal(parseReleaseNum('#455'), 455);
    assert.equal(parseReleaseNum('#1'), 1);
  });

  it('returns +Infinity for non-release strings', () => {
    assert.equal(parseReleaseNum('a1b2c3 my-feat'), Infinity);
    assert.equal(parseReleaseNum('dev'), Infinity);
    assert.equal(parseReleaseNum(''), Infinity);
    assert.equal(parseReleaseNum('#1.2'), Infinity);
    assert.equal(parseReleaseNum('v2'), Infinity);
  });
});

describe('shouldApplyUpdate', () => {
  const mani = (version: string, allowDowngrade = false): VersionManifest => ({
    version,
    sha256: '',
    timestamp: '',
    ...(allowDowngrade ? { allowDowngrade: true } : {}),
  });

  it('applies strictly newer release', () => {
    assert.equal(shouldApplyUpdate(mani('#456'), '#455', ''), 'apply');
  });

  it('reports up-to-date at the floor', () => {
    assert.equal(shouldApplyUpdate(mani('#455'), '#455', ''), 'up-to-date');
  });

  it('skips older release', () => {
    assert.equal(
      shouldApplyUpdate(mani('#454'), '#455', ''),
      'skip-downgrade',
    );
  });

  it('applies older release when allowDowngrade is set', () => {
    assert.equal(shouldApplyUpdate(mani('#454', true), '#455', ''), 'apply');
  });

  it('never auto-downgrades a dev running build', () => {
    assert.equal(
      shouldApplyUpdate(mani('#455'), 'a1b2c3 my-feat', ''),
      'skip-dev',
    );
  });

  it('ignores a garbage state version (defensive)', () => {
    // A non-release stateVersion must NOT pin the floor at +Infinity and
    // block all future updates. Fall back to the running version as floor.
    assert.equal(
      shouldApplyUpdate(mani('#456'), '#455', 'corrupted'),
      'apply',
    );
  });

  it('dev build + allowDowngrade override applies', () => {
    assert.equal(
      shouldApplyUpdate(mani('#455'), 'a1b2c3 my-feat', '', true),
      'apply',
    );
  });

  it('state version raises the floor', () => {
    assert.equal(shouldApplyUpdate(mani('#460'), '#455', '#458'), 'apply');
    assert.equal(
      shouldApplyUpdate(mani('#457'), '#455', '#458'),
      'skip-downgrade',
    );
  });
});
