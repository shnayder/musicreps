// storage.ts — Thin abstraction over localStorage (web) and Capacitor
// Preferences (native).  All reads are synchronous from an in-memory cache.
// On native, writes update the cache and fire-and-forget the async
// Preferences API.  Call `initStorage()` once at startup before rendering.

// ---------------------------------------------------------------------------
// Public interface — drop-in replacement for the localStorage subset we use
// ---------------------------------------------------------------------------

export interface KVStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// ---------------------------------------------------------------------------
// Web backend — lazily resolves localStorage so importing this module is
// safe in non-browser contexts (Deno tests, Node scripts, etc.)
// ---------------------------------------------------------------------------

function getLocalStorage(): Storage | null {
  try {
    return typeof globalThis !== 'undefined'
      // deno-lint-ignore no-explicit-any
      ? ((globalThis as any).localStorage as Storage | undefined) ?? null
      : null;
  } catch {
    return null;
  }
}

/** In-memory fallback when localStorage is unavailable. */
const _fallback = new Map<string, string>();

const webStorage: KVStorage = {
  getItem(key: string): string | null {
    try {
      const ls = getLocalStorage();
      return ls ? ls.getItem(key) : (_fallback.get(key) ?? null);
    } catch {
      return _fallback.get(key) ?? null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      const ls = getLocalStorage();
      if (ls) ls.setItem(key, value);
      else _fallback.set(key, value);
    } catch {
      _fallback.set(key, value);
    }
  },
  removeItem(key: string): void {
    try {
      const ls = getLocalStorage();
      if (ls) ls.removeItem(key);
      else _fallback.delete(key);
    } catch {
      _fallback.delete(key);
    }
  },
};

// ---------------------------------------------------------------------------
// Native backend — in-memory cache + Capacitor Preferences
// ---------------------------------------------------------------------------

type PreferencesPlugin = {
  get(opts: { key: string }): Promise<{ value: string | null }>;
  set(opts: { key: string; value: string }): Promise<void>;
  remove(opts: { key: string }): Promise<void>;
  keys(): Promise<{ keys: string[] }>;
};

let _preferences: PreferencesPlugin | null = null;

/** The native storage cache, accessible for direct cache updates. */
let _nativeCache: Map<string, string> | null = null;

function createNativeStorage(
  prefs: PreferencesPlugin,
  cache: Map<string, string>,
): KVStorage {
  return {
    getItem(key: string): string | null {
      return cache.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      cache.set(key, value);
      prefs.set({ key, value }).catch(() => {});
    },
    removeItem(key: string): void {
      cache.delete(key);
      prefs.remove({ key }).catch(() => {});
    },
  };
}

// ---------------------------------------------------------------------------
// Module-level singleton
// ---------------------------------------------------------------------------

let _storage: KVStorage = webStorage;

/** The active storage backend.  Use this everywhere instead of localStorage. */
export const storage: KVStorage = {
  getItem: (key) => _storage.getItem(key),
  setItem: (key, value) => _storage.setItem(key, value),
  removeItem: (key) => _storage.removeItem(key),
};

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/** Is this a Capacitor native app? */
function isNative(): boolean {
  return !!(
    typeof window !== 'undefined' &&
    // deno-lint-ignore no-explicit-any
    (window as any).Capacitor?.isNativePlatform?.()
  );
}

/**
 * Initialize the storage backend.  Must be called (and awaited) before
 * rendering.  On web this is a no-op.  On native it loads all Preferences
 * keys into the in-memory cache so subsequent reads are synchronous.
 */
export async function initStorage(): Promise<void> {
  if (!isNative()) return; // web — localStorage is already ready

  try {
    // Dynamic import hidden from Deno's static analyzer (resolved at
    // runtime by Capacitor's bundled JS in the native WebView).
    const mod = '@capac' + 'itor/preferences';
    const { Preferences } = await import(/* @vite-ignore */ mod);
    _preferences = Preferences;

    // Bulk-load every key into the cache.
    const { keys } = await Preferences.keys();
    const cache = new Map<string, string>();
    const reads = keys.map(async (key: string) => {
      const { value } = await Preferences.get({ key });
      if (value !== null) cache.set(key, value);
    });
    await Promise.all(reads);

    _nativeCache = cache;
    _storage = createNativeStorage(Preferences, cache);
  } catch (_) {
    // Preferences plugin unavailable — fall back to localStorage.
  }
}

/**
 * One-time migration: copy localStorage entries into Capacitor Preferences.
 * Call after `initStorage()` on first native launch.  Skips keys that already
 * exist in Preferences.  No-op on web or if Preferences failed to load.
 */
export async function migrateFromLocalStorage(): Promise<void> {
  if (!_preferences || !_nativeCache) return;
  const prefs = _preferences;
  const cache = _nativeCache;
  const ls = getLocalStorage();
  if (!ls) return;

  try {
    for (let i = 0; i < ls.length; i++) {
      const key = ls.key(i);
      if (!key) continue;
      // Skip if already in Preferences (from a previous migration or init).
      if (cache.has(key)) continue;
      const value = ls.getItem(key);
      if (value !== null) {
        await prefs.set({ key, value });
        // Update the in-memory cache directly (not via _storage.setItem,
        // which would fire a redundant Preferences.set).
        cache.set(key, value);
      }
    }
  } catch (_) {
    // Partial migration is acceptable — will retry remaining keys on next
    // launch (already-migrated keys are skipped via the cache.has check).
  }
}
