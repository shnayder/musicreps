// Speed level definitions — single source of truth for label, color, and
// threshold. Used by status labels, speed check results, recommendation
// algorithm, and level progress cards.

/** A speed level with its display properties. */
export type SpeedLevel = {
  /** Internal key (lowercase). */
  key: 'automatic' | 'solid' | 'learning' | 'hesitant' | 'starting';
  /** User-facing label. */
  label: string;
  /** CSS custom property for the heatmap color. */
  colorToken: string;
  /** Minimum speed score for this level (unseen items = 0). */
  minSpeed: number;
  /** Short description shown in speed check results. */
  meaning: string;
};

/**
 * Speed levels in order from fastest to slowest.
 * Thresholds are exclusive lower bounds: a score is classified into the
 * first level whose minSpeed it meets or exceeds.
 */
export const SPEED_LEVELS: SpeedLevel[] = [
  {
    key: 'automatic',
    label: 'Automatic',
    colorToken: '--heatmap-5',
    minSpeed: 0.9,
    meaning: 'Fully memorized \u2014 instant recall',
  },
  {
    key: 'solid',
    label: 'Solid',
    colorToken: '--heatmap-4',
    minSpeed: 0.7,
    meaning: 'Solid recall, minor hesitation',
  },
  {
    key: 'learning',
    label: 'Learning',
    colorToken: '--heatmap-3',
    minSpeed: 0.3,
    meaning: 'Working on it \u2014 needs practice',
  },
  {
    key: 'hesitant',
    label: 'Hesitant',
    colorToken: '--heatmap-2',
    minSpeed: 0,
    meaning: 'Significant hesitation',
  },
  {
    key: 'starting',
    label: 'Starting',
    colorToken: '--heatmap-1',
    minSpeed: -Infinity,
    meaning: 'Not yet learned',
  },
];

/** Look up the speed level for a given speed score. */
export function getSpeedLevel(speed: number): SpeedLevel {
  // speed === 0 means unseen / not started (distinct from hesitant > 0).
  if (speed <= 0) return SPEED_LEVELS[SPEED_LEVELS.length - 1];
  for (const level of SPEED_LEVELS) {
    if (speed >= level.minSpeed) return level;
  }
  return SPEED_LEVELS[SPEED_LEVELS.length - 1];
}

/** Get just the label for a speed score. */
export function speedLabel(speed: number): string {
  return getSpeedLevel(speed).label;
}

/** Get just the color token for a speed score. */
export function speedColorToken(speed: number): string {
  return getSpeedLevel(speed).colorToken;
}
