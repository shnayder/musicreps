// Dev panel data: computes effort stats for display.
// The UI lives in home-screen.tsx as a Preact component (DevPage).

import { createStorageAdapter } from './adaptive.ts';
import {
  computeGlobalEffort,
  computeSkillEffort,
  getDailyReps,
  getRegisteredSkills,
  type SkillEffort,
} from './effort.ts';

export type DevPanelData = {
  modeEfforts: SkillEffort[];
  totalReps: number;
  daysActive: number;
  recentDays: Array<{ date: string; count: number }>;
};

/** Compute current dev panel data from localStorage. */
export function getDevPanelData(): DevPanelData {
  const modes = getRegisteredSkills();
  const modeEfforts = modes.map((m) =>
    computeSkillEffort(m, createStorageAdapter(m.namespace))
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
