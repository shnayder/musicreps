// Effort tracking: reads per-mode and global effort stats.
// All data derives from existing adaptive_* keys (sampleCount per item)
// plus a new effort_daily counter incremented on each response.
//
// Pure functions accept a StorageAdapter for testability; the module-level
// convenience wrappers use localStorage.

import type { StorageAdapter } from './types.ts';
import { storage } from './storage.ts';

// ---------------------------------------------------------------------------
// Mode registry — namespace + allItems for each mode
// ---------------------------------------------------------------------------

export type ModeInfo = {
  id: string;
  namespace: string;
  allItems: string[];
};

// Populated at init time by app.ts
const modes: ModeInfo[] = [];

export function registerModeForEffort(info: ModeInfo): void {
  modes.push(info);
}

export function getRegisteredModes(): readonly ModeInfo[] {
  return modes;
}

// ---------------------------------------------------------------------------
// Per-mode effort stats (reads from a StorageAdapter)
// ---------------------------------------------------------------------------

export type ModeEffort = {
  id: string;
  namespace: string;
  totalReps: number;
  itemsStarted: number;
  totalItems: number;
};

/** Pure: compute effort for a mode from its StorageAdapter. */
export function computeModeEffort(
  mode: ModeInfo,
  storage: StorageAdapter,
): ModeEffort {
  let totalReps = 0;
  let itemsStarted = 0;
  for (const itemId of mode.allItems) {
    const stats = storage.getStats(itemId);
    if (stats && stats.sampleCount > 0) {
      totalReps += stats.sampleCount;
      itemsStarted++;
    }
  }
  return {
    id: mode.id,
    namespace: mode.namespace,
    totalReps,
    itemsStarted,
    totalItems: mode.allItems.length,
  };
}

// ---------------------------------------------------------------------------
// Daily rep counter
// ---------------------------------------------------------------------------

const DAILY_KEY = 'effort_daily';

export type DailyReps = Record<string, number>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Read/write interface for the daily reps store. */
export type DailyRepsStore = {
  read(): string | null;
  write(json: string): void;
};

/** Default store backed by the storage abstraction. */
export function localDailyRepsStore(): DailyRepsStore {
  return {
    read: () => storage.getItem(DAILY_KEY),
    write: (json) => storage.setItem(DAILY_KEY, json),
  };
}

/** Parse raw JSON into a validated DailyReps record. */
export function parseDailyReps(raw: string | null): DailyReps {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)
    ) {
      return {};
    }
    const result: DailyReps = Object.create(null) as DailyReps;
    for (const key of Object.keys(parsed)) {
      if (!DATE_RE.test(key)) continue;
      const val = parsed[key];
      if (typeof val === 'number' && Number.isFinite(val) && val >= 0) {
        result[key] = val;
      }
    }
    return result;
  } catch {
    return {};
  }
}

/** Read daily reps from a store. */
export function getDailyReps(
  store: DailyRepsStore = localDailyRepsStore(),
): DailyReps {
  return parseDailyReps(store.read());
}

function saveDailyReps(
  data: DailyReps,
  store: DailyRepsStore,
): void {
  store.write(JSON.stringify(data));
}

/** Increment today's rep count. */
export function incrementDailyReps(
  store: DailyRepsStore = localDailyRepsStore(),
  now: Date = new Date(),
): void {
  const today = now.toISOString().slice(0, 10);
  const data = getDailyReps(store);
  data[today] = (data[today] || 0) + 1;
  saveDailyReps(data, store);
}

// ---------------------------------------------------------------------------
// Global aggregations (derived from daily + per-mode)
// ---------------------------------------------------------------------------

export type GlobalEffort = {
  totalReps: number;
  daysActive: number;
  dailyReps: DailyReps;
};

/** Pure: compute global effort from mode efforts and daily reps. */
export function computeGlobalEffort(
  modeEfforts: ModeEffort[],
  dailyReps: DailyReps,
): GlobalEffort {
  const dates = Object.keys(dailyReps).filter((d) => dailyReps[d] > 0);
  const totalFromDaily = dates.reduce((sum, d) => sum + dailyReps[d], 0);
  const totalFromModes = modeEfforts.reduce((s, m) => s + m.totalReps, 0);

  return {
    totalReps: Math.max(totalFromDaily, totalFromModes),
    daysActive: dates.length,
    dailyReps,
  };
}
