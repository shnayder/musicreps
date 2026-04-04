// OTA updater — background update checker for native (Capacitor) builds.
// Fetches version.json from the release endpoint, downloads new versions,
// verifies SHA-256, writes to the filesystem, and registers with the
// native OTAUpdate plugin. Updates apply on next app restart.

// deno-lint-ignore-file no-explicit-any

// Override via data-release-base on #home-screen for testing (e.g. "/release-staging")
const DEFAULT_RELEASE_BASE = 'https://shnayder.github.io/musicreps/release';
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

function getReleaseBase(): string {
  const el = document.getElementById('home-screen');
  return el?.dataset.releaseBase || DEFAULT_RELEASE_BASE;
}

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
}

export interface OTAState {
  status: string;
  version: string;
  path: string;
  attempts: number;
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

  // 2. Compare to current version (including already-downloaded-but-not-applied)
  const state = await deps.getState();
  const knownVersion = state.version || deps.getRunningVersion();

  if (manifest.version === knownVersion) return 'up-to-date';

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

function productionDeps(): UpdateDeps | null {
  const plugin = getOTAPlugin();
  const fs = getFilesystemPlugin();
  if (!plugin || !fs) return null;

  const base = getReleaseBase();
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

  const deps = productionDeps();
  if (!deps) {
    console.log('[OTA] plugin not available, skipping');
    return;
  }

  try {
    const result = await checkForUpdateCore(deps);
    const messages: Record<string, string> = {
      'fetch-failed': '[OTA] version.json fetch failed',
      'up-to-date': '[OTA] up to date',
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

  // Debug hook: window.__otaForceCheck() bypasses throttle
  (window as any).__otaForceCheck = () => {
    lastCheckTime = 0;
    return checkForUpdate();
  };
}
