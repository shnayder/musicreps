// Dev panel data: computes effort stats for display.
// The UI lives in home-screen.tsx as a Preact component (DevPage).

import { createLocalStorageAdapter } from './adaptive.ts';
import {
  computeGlobalEffort,
  computeModeEffort,
  getDailyReps,
  getRegisteredModes,
  type ModeEffort,
} from './effort.ts';

export type DevPanelData = {
  modeEfforts: ModeEffort[];
  totalReps: number;
  daysActive: number;
  recentDays: Array<{ date: string; count: number }>;
};

/** Compute current dev panel data from localStorage. */
export function getDevPanelData(): DevPanelData {
  const modes = getRegisteredModes();
  const modeEfforts = modes.map((m) =>
    computeModeEffort(m, createLocalStorageAdapter(m.namespace))
  );
  const daily = getDailyReps();
  const global = computeGlobalEffort(modeEfforts, daily);
  const recentDays = Object.entries(global.dailyReps)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 14)
    .map(([date, count]) => ({ date, count }));

  return {
    modeEfforts,
    totalReps: global.totalReps,
    daysActive: global.daysActive,
    recentDays,
  };
}
