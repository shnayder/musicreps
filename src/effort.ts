// Effort tracking: reads per-skill and global effort stats.
// All data derives from existing adaptive_* keys (sampleCount per item)
// plus a new effort_daily counter incremented on each response.
//
// Pure functions accept a StorageAdapter for testability; the module-level
// convenience wrappers use the shared storage abstraction.

import { createStorageAdapter } from './adaptive.ts';
import type { StorageAdapter } from './types.ts';
import { storage } from './storage.ts';

// ---------------------------------------------------------------------------
// Mode registry — namespace + allItems for each mode
// ---------------------------------------------------------------------------

export type SkillInfo = {
  id: string;
  namespace: string;
  allItems: string[];
};

// Populated at init time by app.ts
const modes: SkillInfo[] = [];

export function registerSkillForEffort(info: SkillInfo): void {
  modes.push(info);
}

export function getRegisteredSkills(): readonly SkillInfo[] {
  return modes;
}

// ---------------------------------------------------------------------------
// Per-mode effort stats (reads from a StorageAdapter)
// ---------------------------------------------------------------------------

export type SkillEffort = {
  id: string;
  namespace: string;
  totalReps: number;
  itemsStarted: number;
  totalItems: number;
};

/** Pure: compute effort for a mode from its StorageAdapter. */
export function computeSkillEffort(
  mode: SkillInfo,
  storage: StorageAdapter,
): SkillEffort {
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

/** Format a Date as YYYY-MM-DD in the user's local timezone.
 *  Use this for all date keys in DailyReps to ensure consistency. */
export function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Increment today's rep count. */
export function incrementDailyReps(
  store: DailyRepsStore = localDailyRepsStore(),
  now: Date = new Date(),
): void {
  const today = toLocalDateString(now);
  const data = getDailyReps(store);
  data[today] = (data[today] || 0) + 1;
  saveDailyReps(data, store);
}

// ---------------------------------------------------------------------------
// Global aggregations (derived from daily + per-skill)
// ---------------------------------------------------------------------------

export type GlobalEffort = {
  totalReps: number;
  daysActive: number;
  dailyReps: DailyReps;
};

/** Pure: compute global effort from skill efforts and daily reps. */
export function computeGlobalEffort(
  skillEfforts: SkillEffort[],
  dailyReps: DailyReps,
): GlobalEffort {
  const dates = Object.keys(dailyReps).filter((d) => dailyReps[d] > 0);
  const totalFromDaily = dates.reduce((sum, d) => sum + dailyReps[d], 0);
  const totalFromSkills = skillEfforts.reduce((s, m) => s + m.totalReps, 0);

  return {
    totalReps: Math.max(totalFromDaily, totalFromSkills),
    daysActive: dates.length,
    dailyReps,
  };
}

/** Convenience: compute global effort from registered skills + daily reps. */
export function getGlobalEffort(): GlobalEffort {
  const modes = getRegisteredSkills();
  const skillEfforts = modes.map((m) =>
    computeSkillEffort(m, createStorageAdapter(m.namespace))
  );
  return computeGlobalEffort(skillEfforts, getDailyReps());
}

/** Convenience: compute effort for a registered skill by ID. */
export function getSkillEffort(modeId: string): SkillEffort | null {
  const mode = getRegisteredSkills().find((m) => m.id === modeId);
  if (!mode) return null;
  return computeSkillEffort(mode, createStorageAdapter(mode.namespace));
}
