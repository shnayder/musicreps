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

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---------------------------------------------------------------------------
// Core update logic
// ---------------------------------------------------------------------------

interface VersionManifest {
  version: string;
  sha256: string;
  timestamp: string;
}

async function checkForUpdate(): Promise<void> {
  const now = Date.now();
  if (now - lastCheckTime < CHECK_INTERVAL_MS) return;
  lastCheckTime = now;

  const plugin = getOTAPlugin();
  if (!plugin) {
    console.log('[OTA] plugin not available, skipping');
    return;
  }

  try {
    // 1. Fetch version manifest
    const resp = await fetch(`${getReleaseBase()}/version.json`, {
      cache: 'no-store',
    });
    if (!resp.ok) {
      console.log('[OTA] version.json fetch failed:', resp.status);
      return;
    }
    const manifest: VersionManifest = await resp.json();

    // 2. Compare to current version (including already-downloaded-but-not-applied)
    const state = await plugin.getState();
    const knownVersion = state.version || getRunningVersion();

    if (manifest.version === knownVersion) {
      console.log('[OTA] up to date:', manifest.version);
      return;
    }
    console.log(
      '[OTA] new version available:',
      manifest.version,
      '(current:',
      knownVersion + ')',
    );

    // 3. Download index.html
    const htmlResp = await fetch(`${getReleaseBase()}/index.html`, {
      cache: 'no-store',
    });
    if (!htmlResp.ok) {
      console.log('[OTA] index.html fetch failed:', htmlResp.status);
      return;
    }
    const html = await htmlResp.text();

    // 4. Verify SHA-256
    const hash = await sha256Hex(html);
    if (hash !== manifest.sha256) {
      console.error(
        '[OTA] hash mismatch! expected:',
        manifest.sha256,
        'got:',
        hash,
      );
      return;
    }
    console.log('[OTA] hash verified');

    // 5. Write to filesystem
    const fs = getFilesystemPlugin();
    if (!fs) {
      console.log('[OTA] Filesystem plugin not available');
      return;
    }

    const dir = 'ota/current';
    // Ensure directory exists
    try {
      await fs.mkdir({
        path: dir,
        directory: 'LIBRARY',
        recursive: true,
      });
    } catch {
      // directory may already exist
    }

    await fs.writeFile({
      path: `${dir}/index.html`,
      data: html,
      directory: 'LIBRARY',
      encoding: 'utf8',
    });
    console.log('[OTA] wrote update to filesystem');

    // 6. Register with native plugin using relative path (under Library/)
    await plugin.setUpdatePath({
      path: dir, // e.g. "ota/current" — plugin resolves against Library/
      version: manifest.version,
    });
    console.log('[OTA] update registered, will apply on next restart');
  } catch (err) {
    console.error('[OTA] update check failed:', err);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Get the version string from the running HTML's data-version attribute. */
function getRunningVersion(): string {
  const el = document.getElementById('home-screen');
  return el?.dataset.version ?? '';
}

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
  // deno-lint-ignore no-explicit-any
  (window as any).__otaForceCheck = () => {
    lastCheckTime = 0;
    return checkForUpdate();
  };
}
