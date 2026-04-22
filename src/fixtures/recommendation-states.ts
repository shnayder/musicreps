// Named recommendation states used by both screenshot fixtures and tests.
// Each state produces localStorage data and documents the expected outcome.

import type { ItemStats } from '../types.ts';
import {
  type LevelItemProfile,
  perLevelScenario,
} from './heatmap-scenarios.ts';
import { getItemIdsForLevel, getLevels } from '../skills/fretboard/logic.ts';
import { GUITAR } from '../music-data.ts';
import { ALL_ITEMS as NOTE_SEMI_ITEMS } from '../skills/note-semitones/logic.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RecommendationState = {
  /** Human-readable name for the state. */
  name: string;
  /** What the recommendation UI should show. */
  expectedVerbs: string[];
  /** localStorage data to seed. */
  localStorageData: Record<string, string>;
  /** Mode namespace for this state. */
  namespace: string;
  /** Whether this is a multi-group or single-level mode. */
  kind: 'multi-group' | 'single-level';
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HOUR = 3600_000;

/** Seed all items as truly automatic (ewma well below default minTime=1000ms). */
function seedAllAutomatic(
  namespace: string,
  itemIds: string[],
): Record<string, string> {
  const now = Date.now();
  const result: Record<string, string> = {};
  for (let i = 0; i < itemIds.length; i++) {
    const ewma = 500 + (i % 5) * 80; // 500-820ms, all below 1000ms minTime
    const stats: ItemStats = {
      recentTimes: [ewma * 0.95, ewma, ewma * 1.05],
      ewma,
      sampleCount: 20 + (i % 10),
      lastSeen: now - HOUR * (1 + (i % 4)),
      stability: 100 + (i % 50) * 3,
      lastCorrectAt: now - HOUR * (1 + (i % 4)),
    };
    result[`adaptive_${namespace}_${itemIds[i]}`] = JSON.stringify(stats);
  }
  return result;
}

const guitarGroups = getLevels(GUITAR);
const fbGroupIds = guitarGroups.map((g) => g.id);
const fbItemIds = fbGroupIds.map((id) => getItemIdsForLevel(GUITAR, id));
const unseen = (ids: string[]): LevelItemProfile => ({
  itemIds: ids,
  state: 'unseen',
});

function fbState(
  name: string,
  expectedVerbs: string[],
  levels: LevelItemProfile[],
  enabledLevelIds: string[],
): RecommendationState {
  return {
    name,
    expectedVerbs,
    namespace: 'fretboard',
    kind: 'multi-group',
    localStorageData: {
      ...perLevelScenario('fretboard', levels),
      fretboard_enabledGroups: JSON.stringify(enabledLevelIds),
    },
  };
}

// ---------------------------------------------------------------------------
// Fretboard states (multi-group)
// ---------------------------------------------------------------------------

/** Just started group 0 — a few items seen, rest unseen. */
export const FB_STARTING = fbState(
  'fb-starting',
  ['Practice'],
  [
    { itemIds: fbItemIds[0], state: 'working', seenFraction: 0.35 },
    ...fbItemIds.slice(1).map(unseen),
  ],
  [fbGroupIds[0]],
);

/** Groups at different stages: g0 automatic, g1 mixed, g2 just starting.
 *  Gate closed (g1/g2 not Learned) → no Start rec, just Practice. */
export const FB_LEARNING = fbState(
  'fb-learning',
  ['Practice'],
  [
    { itemIds: fbItemIds[0], state: 'automatic' },
    { itemIds: fbItemIds[1], state: 'mixed' },
    { itemIds: fbItemIds[2], state: 'working', seenFraction: 0.5 },
    ...fbItemIds.slice(3).map(unseen),
  ],
  [fbGroupIds[0], fbGroupIds[1], fbGroupIds[2]],
);

/** First levels mastered + working on next ones. */
export const FB_SOLID_LEARNING = fbState(
  'fb-solid-learning',
  ['Practice'],
  [
    { itemIds: fbItemIds[0], state: 'automatic' },
    { itemIds: fbItemIds[1], state: 'automatic' },
    { itemIds: fbItemIds[2], state: 'mixed' },
    { itemIds: fbItemIds[3], state: 'working', seenFraction: 0.5 },
    ...fbItemIds.slice(4).map(unseen),
  ],
  [fbGroupIds[0], fbGroupIds[1], fbGroupIds[2], fbGroupIds[3]],
);

/** First levels mastered but stale → Review. */
export const FB_NEEDS_REVIEW = fbState(
  'fb-needs-review',
  ['Review'],
  [
    { itemIds: fbItemIds[0], state: 'stale' },
    { itemIds: fbItemIds[1], state: 'stale' },
    { itemIds: fbItemIds[2], state: 'stale' },
    ...fbItemIds.slice(3).map(unseen),
  ],
  [fbGroupIds[0], fbGroupIds[1], fbGroupIds[2]],
);

/** Almost all levels automatic, last one mixed.
 *  Automatic levels with scheduled review get no rec.
 *  Only the last (mixed) group gets Practice. */
export const FB_ALMOST_AUTOMATIC = fbState(
  'fb-almost-automatic',
  ['Practice'],
  [
    ...fbItemIds.slice(0, -1).map((ids) => ({
      itemIds: ids,
      state: 'automatic' as const,
    })),
    { itemIds: fbItemIds[fbItemIds.length - 1], state: 'mixed' as const },
  ],
  fbGroupIds,
);

// ---------------------------------------------------------------------------
// Note ↔ Semitones states (single-level, no levels)
// ---------------------------------------------------------------------------

/** Items slow/working → Practice. */
export const NOTE_SEMI_LEARNING: RecommendationState = {
  name: 'noteSemitones-learning',
  expectedVerbs: ['Practice'],
  namespace: 'noteSemitones',
  kind: 'single-level',
  localStorageData: perLevelScenario('noteSemitones', [
    { itemIds: NOTE_SEMI_ITEMS, state: 'working' },
  ]),
};

/** Items were fast but are now stale → Review. */
export const NOTE_SEMI_SOLID_STALE: RecommendationState = {
  name: 'noteSemitones-solid-stale',
  expectedVerbs: ['Review'],
  namespace: 'noteSemitones',
  kind: 'single-level',
  localStorageData: perLevelScenario('noteSemitones', [
    { itemIds: NOTE_SEMI_ITEMS, state: 'stale' },
  ]),
};

/** All items automatic and fresh → All items automatic. */
export const NOTE_SEMI_AUTOMATIC: RecommendationState = {
  name: 'noteSemitones-automatic',
  expectedVerbs: ['All items automatic! Practice something else'],
  namespace: 'noteSemitones',
  kind: 'single-level',
  localStorageData: seedAllAutomatic('noteSemitones', NOTE_SEMI_ITEMS),
};

// ---------------------------------------------------------------------------
// All states for iteration
// ---------------------------------------------------------------------------

export const ALL_STATES: RecommendationState[] = [
  FB_STARTING,
  FB_LEARNING,
  FB_SOLID_LEARNING,
  FB_NEEDS_REVIEW,
  FB_ALMOST_AUTOMATIC,
  NOTE_SEMI_LEARNING,
  NOTE_SEMI_SOLID_STALE,
  NOTE_SEMI_AUTOMATIC,
];
