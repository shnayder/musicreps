// Shared screenshot manifest: mode IDs, titles, and state entries used by
// both take-screenshots.ts and ui-iterate.ts.

import { defaultItems } from '../src/fixtures/items.ts';
import type { FixtureDetail } from '../src/types.ts';
import {
  quizActive,
  quizCorrectFeedback,
  quizFeedbackTimerExpired,
  quizFeedbackTimerLow,
  quizLastQuestionAnswered,
  quizLastQuestionAwaiting,
  quizRoundComplete,
  quizWrongFeedback,
  speedCheckIntro,
  speedCheckResults,
  speedCheckTesting,
} from '../src/fixtures/quiz-page.ts';
import {
  building,
  fretboardItemIds,
  type GroupItemProfile,
  justStarting,
  masteredFresh,
  masteredStale,
  perGroupScenario,
  returnedAfterBreak,
  semitoneMathItemIds,
} from '../src/fixtures/heatmap-scenarios.ts';
import { GUITAR, MODE_NAMES } from '../src/music-data.ts';
import { getGroups, getItemIdsForGroup } from '../src/modes/fretboard/logic.ts';

// ---------------------------------------------------------------------------
// Mode IDs & titles
// ---------------------------------------------------------------------------

export const MODE_IDS = [
  'fretboard',
  'ukulele',
  'speedTap',
  'noteSemitones',
  'intervalSemitones',
  'semitoneMath',
  'intervalMath',
  'keySignatures',
  'scaleDegrees',
  'diatonicChords',
  'chordSpelling',
] as const;

// All modes use QuizEngine — seed motor baselines so calibration is skipped.
export const ENGINE_MODES = MODE_IDS;

// Display names — re-exported from centralized MODE_NAMES
export const MODE_TITLES: Record<string, string> = MODE_NAMES;

const BIDIRECTIONAL_MODES = new Set([
  'noteSemitones',
  'intervalSemitones',
  'keySignatures',
  'scaleDegrees',
  'diatonicChords',
]);

// ---------------------------------------------------------------------------
// Screenshot entry
// ---------------------------------------------------------------------------

export type ScreenshotEntry = {
  name: string;
  modeId: string;
  fixture?: FixtureDetail;
  localStorageData?: Record<string, string>;
  clickTab?: 'progress';
};

// ---------------------------------------------------------------------------
// Manifest builder
// ---------------------------------------------------------------------------

export function buildManifest(): ScreenshotEntry[] {
  const entries: ScreenshotEntry[] = [];

  // Home screen (before any mode is selected)
  entries.push({ name: 'home', modeId: 'home' });

  // Home screen with starred skills
  entries.push({
    name: 'home-starred',
    modeId: 'home',
    localStorageData: {
      starredSkills: JSON.stringify(['fretboard', 'keySignatures']),
    },
  });

  // All modes: idle + quiz (+ reverse quiz for bidirectional modes)
  for (const modeId of MODE_IDS) {
    entries.push({ name: `${modeId}-idle`, modeId });
    entries.push({
      name: `${modeId}-quiz`,
      modeId,
      fixture: quizActive(defaultItems[modeId]),
    });
    if (BIDIRECTIONAL_MODES.has(modeId)) {
      entries.push({
        name: `${modeId}-quiz-rev`,
        modeId,
        fixture: quizActive(defaultItems[`${modeId}_rev`]),
      });
    }
  }

  // Speed Check: fixture-based calibration captures
  entries.push(
    {
      name: 'speedCheck-intro',
      modeId: 'speedTap',
      fixture: speedCheckIntro(),
    },
    {
      name: 'speedCheck-testing',
      modeId: 'speedTap',
      fixture: speedCheckTesting(),
    },
    {
      name: 'speedCheck-results',
      modeId: 'speedTap',
      fixture: speedCheckResults(),
    },
  );

  // Design moments: correct, wrong, round-complete (semitoneMath)
  entries.push({
    name: 'design-correct-feedback',
    modeId: 'semitoneMath',
    fixture: quizCorrectFeedback(defaultItems.semitoneMath),
  });
  entries.push({
    name: 'design-wrong-feedback',
    modeId: 'semitoneMath',
    fixture: quizWrongFeedback(defaultItems.semitoneMath),
  });
  entries.push({
    name: 'design-round-complete',
    modeId: 'semitoneMath',
    fixture: quizRoundComplete(),
  });

  // Timer edge states: end-of-round walkthrough (semitoneMath)
  entries.push({
    name: 'design-feedback-timer-low',
    modeId: 'semitoneMath',
    fixture: quizFeedbackTimerLow(defaultItems.semitoneMath),
  });
  entries.push({
    name: 'design-feedback-timer-expired',
    modeId: 'semitoneMath',
    fixture: quizFeedbackTimerExpired(defaultItems.semitoneMath),
  });
  entries.push({
    name: 'design-last-question-awaiting',
    modeId: 'semitoneMath',
    fixture: quizLastQuestionAwaiting(defaultItems.semitoneMath),
  });
  entries.push({
    name: 'design-last-question-answered',
    modeId: 'semitoneMath',
    fixture: quizLastQuestionAnswered(defaultItems.semitoneMath),
  });

  // Fretboard design moments: correct + wrong
  entries.push({
    name: 'design-fretboard-correct',
    modeId: 'fretboard',
    fixture: quizCorrectFeedback(defaultItems.fretboard),
  });
  entries.push({
    name: 'design-fretboard-wrong',
    modeId: 'fretboard',
    fixture: quizWrongFeedback(defaultItems.fretboard),
  });

  // Progress tab: semitoneMath heatmap scenarios (12x11 grid)
  const mathIds = semitoneMathItemIds();
  const scenarios: [
    string,
    (ns: string, ids: string[]) => Record<string, string>,
  ][] = [
    ['just-starting', justStarting],
    ['building', building],
    ['mastered-fresh', masteredFresh],
    ['mastered-stale', masteredStale],
    ['returned', returnedAfterBreak],
  ];
  for (const [label, scenarioFn] of scenarios) {
    entries.push({
      name: `design-progress-${label}`,
      modeId: 'semitoneMath',
      localStorageData: scenarioFn('semitoneMath', mathIds),
      clickTab: 'progress',
    });
  }

  // Progress tab: fretboard heatmap scenarios (6x13 grid)
  const fbIds = fretboardItemIds(6, 13);
  for (const [label, scenarioFn] of scenarios) {
    entries.push({
      name: `design-fretboard-progress-${label}`,
      modeId: 'fretboard',
      localStorageData: scenarioFn('fretboard', fbIds),
      clickTab: 'progress',
    });
  }

  // Progress tab: group-aware fretboard scenarios
  // Each scenario has different groups in different learning stages.
  const guitarGroups = getGroups(GUITAR);
  const gIds = guitarGroups.map((_, i) => getItemIdsForGroup(GUITAR, i));
  const unseen = (ids: string[]): GroupItemProfile => ({
    itemIds: ids,
    state: 'unseen',
  });

  const fbGroupScenarios: [
    string,
    GroupItemProfile[],
    number[], // enabled group indices
  ][] = [
    // Just started group 0 — a few items seen, rest unseen
    [
      'fb-starting',
      [
        { itemIds: gIds[0], state: 'slow-fresh', seenFraction: 0.35 },
        ...gIds.slice(1).map(unseen),
      ],
      [0],
    ],
    // Working on first few groups — group 0 fast, group 1 mixed, group 2 just starting
    [
      'fb-working',
      [
        { itemIds: gIds[0], state: 'fast-fresh' },
        { itemIds: gIds[1], state: 'mixed' },
        { itemIds: gIds[2], state: 'slow-fresh', seenFraction: 0.5 },
        ...gIds.slice(3).map(unseen),
      ],
      [0, 1, 2],
    ],
    // Mastered first couple, working on next ones
    [
      'fb-mastered-working',
      [
        { itemIds: gIds[0], state: 'fast-fresh' },
        { itemIds: gIds[1], state: 'fast-fresh' },
        { itemIds: gIds[2], state: 'mixed' },
        { itemIds: gIds[3], state: 'slow-fresh', seenFraction: 0.5 },
        ...gIds.slice(4).map(unseen),
      ],
      [0, 1, 2, 3],
    ],
    // Needs review — first groups mastered but stale
    [
      'fb-needs-review',
      [
        { itemIds: gIds[0], state: 'fast-stale' },
        { itemIds: gIds[1], state: 'fast-stale' },
        { itemIds: gIds[2], state: 'fast-stale' },
        ...gIds.slice(3).map(unseen),
      ],
      [0, 1, 2],
    ],
    // Nearly done — everything except B e ♯♭ (group 7) is fast
    [
      'fb-nearly-done',
      [
        { itemIds: gIds[0], state: 'fast-fresh' },
        { itemIds: gIds[1], state: 'fast-fresh' },
        { itemIds: gIds[2], state: 'fast-fresh' },
        { itemIds: gIds[3], state: 'fast-fresh' },
        { itemIds: gIds[4], state: 'fast-fresh' },
        { itemIds: gIds[5], state: 'fast-fresh' },
        { itemIds: gIds[6], state: 'fast-fresh' },
        { itemIds: gIds[7], state: 'mixed' },
      ],
      [0, 1, 2, 3, 4, 5, 6, 7],
    ],
  ];

  for (const [label, groups, enabledIndices] of fbGroupScenarios) {
    const data = {
      ...perGroupScenario('fretboard', groups),
      fretboard_enabledGroups: JSON.stringify(enabledIndices),
    };
    // Practice tab (default view)
    entries.push({
      name: `design-fretboard-practice-${label}`,
      modeId: 'fretboard',
      localStorageData: data,
    });
    // Progress tab
    entries.push({
      name: `design-fretboard-progress-${label}`,
      modeId: 'fretboard',
      localStorageData: data,
      clickTab: 'progress',
    });
  }

  return entries;
}
