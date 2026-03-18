// Effort tracking: reads per-mode and global effort stats from localStorage.
// All data derives from existing adaptive_* keys (sampleCount per item)
// plus a new effort_daily counter incremented on each response.

import type { ItemStats } from './types.ts';

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
// Per-mode effort stats (reads existing adaptive_* localStorage keys)
// ---------------------------------------------------------------------------

export type ModeEffort = {
  id: string;
  namespace: string;
  totalReps: number;
  itemsStarted: number;
  totalItems: number;
};

function readItemStats(namespace: string, itemId: string): ItemStats | null {
  const key = `adaptive_${namespace}_${itemId}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function computeModeEffort(mode: ModeInfo): ModeEffort {
  let totalReps = 0;
  let itemsStarted = 0;
  for (const itemId of mode.allItems) {
    const stats = readItemStats(mode.namespace, itemId);
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

export function computeAllModeEfforts(): ModeEffort[] {
  return modes.map(computeModeEffort);
}

// ---------------------------------------------------------------------------
// Daily rep counter
// ---------------------------------------------------------------------------

const DAILY_KEY = 'effort_daily';

export type DailyReps = Record<string, number>;

export function getDailyReps(): DailyReps {
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    ) {
      return parsed;
    }
    return {};
  } catch {
    return {};
  }
}

function saveDailyReps(data: DailyReps): void {
  localStorage.setItem(DAILY_KEY, JSON.stringify(data));
}

export function incrementDailyReps(): void {
  const today = new Date().toISOString().slice(0, 10);
  const data = getDailyReps();
  data[today] = (data[today] || 0) + 1;
  saveDailyReps(data);
}

// ---------------------------------------------------------------------------
// Global aggregations (derived from daily + per-mode)
// ---------------------------------------------------------------------------

export type GlobalEffort = {
  totalReps: number;
  daysActive: number;
  dailyReps: DailyReps;
};

export function computeGlobalEffort(): GlobalEffort {
  const daily = getDailyReps();
  const dates = Object.keys(daily).filter((d) => daily[d] > 0);
  const totalFromDaily = dates.reduce((sum, d) => sum + daily[d], 0);

  // Also sum from per-mode stats (more accurate for historical data
  // before daily tracking was added)
  const modeEfforts = computeAllModeEfforts();
  const totalFromModes = modeEfforts.reduce((s, m) => s + m.totalReps, 0);

  return {
    totalReps: Math.max(totalFromDaily, totalFromModes),
    daysActive: dates.length,
    dailyReps: daily,
  };
}
