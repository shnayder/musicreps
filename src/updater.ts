// OTA updater — background update checker for native (Capacitor) builds.
// Fetches version.json from the release endpoint, downloads new versions,
// verifies SHA-256, writes to the filesystem, and registers with the
// native OTAUpdate plugin. Updates apply on next app restart.

// deno-lint-ignore-file no-explicit-any

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

let lastCheckTime = 0;

// ---------------------------------------------------------------------------
// Capacitor plugin bridge (called via Capacitor.Plugins)
// ---------------------------------------------------------------------------

function getOTAPlugin(): any {
  return (globalThis as any).Capacitor?.Plugins?.OTAUpdate;
}

function getFilesystemPlugin(): any {
  return (globalThis as any).Capacitor?.Plugins?.Filesystem;
}

// ---------------------------------------------------------------------------
// SHA-256 verification
// ---------------------------------------------------------------------------

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---------------------------------------------------------------------------
// Core update logic — injectable deps for testability
// ---------------------------------------------------------------------------

export interface VersionManifest {
  version: string;
  sha256: string;
  timestamp: string;
  // When true, bypass the monotonic downgrade gate. Used for emergency
  // rollbacks — publish an older release with this flag so clients on newer
  // builds will accept it.
  allowDowngrade?: boolean;
}

// Parse a release version string like "#456" → 456. Anything else (dev
// builds: "a1b2c3 my-feature", "dev", empty) returns +Infinity so it is
// treated as "newer than any release" and never auto-downgraded.
export function parseReleaseNum(version: string): number {
  const m = /^#(\d+)$/.exec(version);
  return m ? parseInt(m[1], 10) : Number.POSITIVE_INFINITY;
}

export type UpdateDecision =
  | 'apply'
  | 'up-to-date'
  | 'skip-dev'
  | 'skip-downgrade'
  | 'skip-invalid-manifest';

// Decide whether to apply an OTA update given the running version, any
// already-downloaded-but-unapplied state version, and the manifest. The
// "floor" is the highest release number we have locally; we only move
// forward unless the manifest explicitly allows a downgrade.
export function shouldApplyUpdate(
  manifest: VersionManifest,
  runningVersion: string,
  stateVersion: string,
  allowDowngradeOverride = false,
): UpdateDecision {
  // Manifest version must be a well-formed release number. If it isn't
  // (corrupted JSON, legacy string, wrong CDN path), refuse to apply —
  // otherwise +Infinity math would make the broken manifest look newer
  // than every real release.
  const manifestNum = parseReleaseNum(manifest.version);
  if (!Number.isFinite(manifestNum)) return 'skip-invalid-manifest';

  const runningNum = parseReleaseNum(runningVersion);
  // Only a stateVersion that cleanly parses as a release contributes to the
  // floor. An empty string (no OTA cached) or a garbage value (shouldn't
  // happen in prod, but don't let a stray non-release string pin the floor
  // at +Infinity and block all future updates) is ignored.
  const stateNum = parseReleaseNum(stateVersion);
  const floor = Number.isFinite(stateNum)
    ? Math.max(runningNum, stateNum)
    : runningNum;
  const allowDowngrade = manifest.allowDowngrade || allowDowngradeOverride;
  if (manifestNum === floor) return 'up-to-date';
  if (manifestNum > floor) return 'apply';
  if (allowDowngrade) return 'apply';
  // Running version isn't a release build → floor is +Infinity and we'll
  // always land here. Report it distinctly so the log is accurate.
  if (!Number.isFinite(runningNum)) return 'skip-dev';
  return 'skip-downgrade';
}

export interface OTAState {
  status: string;
  version: string;
  path: string;
  attempts: number;
  releaseBase: string;
}

/** Dependencies injected for testing. Production uses real implementations. */
export interface UpdateDeps {
  fetchManifest: () => Promise<VersionManifest | null>;
  fetchHtml: () => Promise<string | null>;
  getState: () => Promise<OTAState>;
  getRunningVersion: () => string;
  writeUpdate: (html: string, dir: string) => Promise<void>;
  registerUpdate: (dir: string, version: string) => Promise<void>;
}

/**
 * Core update check logic. Returns a description of what happened for testing.
 * Exported for tests; production code calls checkForUpdate() instead.
 */
export async function checkForUpdateCore(
  deps: UpdateDeps,
): Promise<string> {
  // 1. Fetch version manifest
  const manifest = await deps.fetchManifest();
  if (!manifest) return 'fetch-failed';

  // 2. Decide whether to apply: only move forward unless manifest or debug
  //    override explicitly permits a downgrade.
  const state = await deps.getState();
  const decision = shouldApplyUpdate(
    manifest,
    deps.getRunningVersion(),
    state.version,
    (globalThis as any).__otaAllowDowngrade === true,
  );
  if (decision !== 'apply') return decision;

  // 3. Download index.html
  const html = await deps.fetchHtml();
  if (!html) return 'download-failed';

  // 4. Verify SHA-256
  const hash = await sha256Hex(html);
  if (hash !== manifest.sha256) return 'hash-mismatch';

  // 5. Write to filesystem
  const dir = 'ota/current';
  await deps.writeUpdate(html, dir);

  // 6. Register with native plugin
  await deps.registerUpdate(dir, manifest.version);
  return 'update-registered';
}

// ---------------------------------------------------------------------------
// Production wiring
// ---------------------------------------------------------------------------

function productionDeps(
  plugin: any,
  fs: any,
  base: string,
): UpdateDeps {
  return {
    fetchManifest: async () => {
      const resp = await fetch(`${base}/version.json`, { cache: 'no-store' });
      if (!resp.ok) return null;
      return resp.json();
    },
    fetchHtml: async () => {
      const resp = await fetch(`${base}/index.html`, { cache: 'no-store' });
      if (!resp.ok) return null;
      return resp.text();
    },
    getState: () => plugin.getState(),
    getRunningVersion: () => {
      const el = document.getElementById('home-screen');
      return el?.dataset.version ?? '';
    },
    writeUpdate: async (html: string, dir: string) => {
      try {
        await fs.mkdir({ path: dir, directory: 'LIBRARY', recursive: true });
      } catch { /* may already exist */ }
      await fs.writeFile({
        path: `${dir}/index.html`,
        data: html,
        directory: 'LIBRARY',
        encoding: 'utf8',
      });
    },
    registerUpdate: (dir: string, version: string) =>
      plugin.setUpdatePath({ path: dir, version }),
  };
}

async function checkForUpdate(): Promise<void> {
  const now = Date.now();
  if (now - lastCheckTime < CHECK_INTERVAL_MS) return;
  lastCheckTime = now;

  const plugin = getOTAPlugin();
  const fs = getFilesystemPlugin();
  if (!plugin || !fs) {
    console.log('[OTA] plugin not available, skipping');
    return;
  }

  const state = await plugin.getState();
  const releaseBase: string = state.releaseBase || '';
  if (!releaseBase) {
    console.log('[OTA] no release base configured, skipping (dev build)');
    return;
  }

  try {
    const deps = productionDeps(plugin, fs, releaseBase);
    const result = await checkForUpdateCore(deps);
    const messages: Record<string, string> = {
      'fetch-failed': '[OTA] version.json fetch failed',
      'up-to-date': '[OTA] up to date',
      'skip-dev':
        '[OTA] running a dev build, skipping (set window.__otaAllowDowngrade to override)',
      'skip-downgrade':
        '[OTA] manifest is older than running build, skipping (set allowDowngrade to override)',
      'skip-invalid-manifest':
        '[OTA] manifest version is not a valid release (#N), refusing to apply',
      'download-failed': '[OTA] index.html download failed',
      'hash-mismatch': '[OTA] hash mismatch, discarding',
      'update-registered':
        '[OTA] update registered, will apply on next restart',
    };
    console.log(messages[result] || `[OTA] ${result}`);
  } catch (err) {
    console.error('[OTA] update check failed:', err);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Tell the native plugin this boot was successful. */
export async function reportHealthy(): Promise<void> {
  const plugin = getOTAPlugin();
  if (!plugin) return;
  try {
    await plugin.reportHealthy();
  } catch (err) {
    console.error('[OTA] reportHealthy failed:', err);
  }
}

/** Schedule background update checks. Call once after boot. */
export function scheduleUpdateCheck(): void {
  // Check shortly after boot
  setTimeout(() => checkForUpdate(), 5000);

  // Check when app returns to foreground
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForUpdate();
    }
  });

  // Debug hooks:
  //   window.__otaForceCheck()       — bypass the 1h throttle
  //   window.__otaAllowDowngrade = true — bypass the monotonic gate
  // Together they let a dev build pull and apply a prod OTA for testing.
  (window as any).__otaForceCheck = () => {
    lastCheckTime = 0;
    return checkForUpdate();
  };
}
