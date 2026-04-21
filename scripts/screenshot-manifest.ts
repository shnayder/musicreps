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
  justStarting,
  type LevelItemProfile,
  masteredFresh,
  masteredStale,
  perLevelScenario,
  returnedAfterBreak,
  semitoneMathItemIds,
} from '../src/fixtures/heatmap-scenarios.ts';
import { generateLocalStorageData } from '../src/fixtures/recommendation-scenarios.ts';
import {
  NOTE_SEMI_AUTOMATIC,
  NOTE_SEMI_LEARNING,
  NOTE_SEMI_SOLID_STALE,
} from '../src/fixtures/recommendation-states.ts';

const noteSemiStates = [
  NOTE_SEMI_LEARNING,
  NOTE_SEMI_SOLID_STALE,
  NOTE_SEMI_AUTOMATIC,
];
import { GUITAR } from '../src/music-data.ts';
import { SKILL_NAMES } from '../src/skill-catalog.ts';
import {
  getItemIdsForLevel,
  getLevels,
} from '../src/skills/fretboard/logic.ts';
import {
  ALL_LEVEL_IDS as SEMI_MATH_GROUP_IDS,
  getItemIdsForLevel as semiMathGetGroup,
} from '../src/skills/semitone-math/logic.ts';
import {
  ALL_LEVEL_IDS as KEY_SIG_GROUP_IDS,
  getItemIdsForLevel as keySigGetGroup,
} from '../src/skills/key-signatures/logic.ts';
import {
  ALL_ITEMS as NOTE_SEMI_ITEMS,
} from '../src/skills/note-semitones/logic.ts';

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
  'guitarChordShapes',
  'ukuleleChordShapes',
] as const;

// All modes use QuizEngine — seed motor baselines so calibration is skipped.
export const ENGINE_MODES = MODE_IDS;

// Display names — re-exported from centralized SKILL_NAMES
export const MODE_TITLES: Record<string, string> = SKILL_NAMES;

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
  skillId: string;
  fixture?: FixtureDetail;
  localStorageData?: Record<string, string>;
  clickTab?: 'progress';
  /** Extra click selectors (scoped to #skill-{skillId}) applied after tab
   *  switching. Used e.g. to open a modal before capture. */
  clickSelectors?: string[];
};

// ---------------------------------------------------------------------------
// Manifest builder
// ---------------------------------------------------------------------------

export function buildManifest(): ScreenshotEntry[] {
  const entries: ScreenshotEntry[] = [];
  const guitarGroups = getLevels(GUITAR);
  const fbGroupIds = guitarGroups.map((g) => g.id);
  const gIds = fbGroupIds.map((id) => getItemIdsForLevel(GUITAR, id));

  // Home screen (before any mode is selected)
  entries.push({ name: 'home', skillId: 'home' });

  // Home screen with starred skills (Active tab — default when starred)
  entries.push({
    name: 'home-starred',
    skillId: 'home',
    localStorageData: {
      starredSkills: JSON.stringify(['fretboard', 'keySignatures']),
    },
  });

  // Home screen: Active tab with nothing starred
  entries.push({
    name: 'home-active-empty',
    skillId: 'home',
    localStorageData: { homeTab: 'active' },
  });

  // Home screen: recommendations — mixed cue labels
  // fretboard: stale (review), semitoneMath: working (get-faster),
  // keySignatures: mastered g0 (learn-next), intervalMath: not started
  entries.push({
    name: 'home-recs-mixed',
    skillId: 'home',
    localStorageData: {
      starredSkills: JSON.stringify([
        'fretboard',
        'semitoneMath',
        'keySignatures',
        'intervalMath',
      ]),
      // fretboard: groups 0-2 mastered but stale → "Review"
      ...perLevelScenario('fretboard', [
        { itemIds: gIds[0], state: 'stale' },
        { itemIds: gIds[1], state: 'stale' },
        { itemIds: gIds[2], state: 'stale' },
        ...gIds.slice(3).map((ids) => ({
          itemIds: ids,
          state: 'unseen' as const,
        })),
      ]),
      // semitoneMath: first group slow but fresh → "Practice"
      ...perLevelScenario('semitoneMath', [
        {
          itemIds: semiMathGetGroup(SEMI_MATH_GROUP_IDS[0]),
          state: 'working',
          seenFraction: 0.7,
        },
      ]),
      // keySignatures: first group mastered, rest unseen → "Start"
      ...generateLocalStorageData(
        'keySignatures',
        {
          [KEY_SIG_GROUP_IDS[0]]: {
            automaticCount: 14,
            workingCount: 0,
            unseenCount: 0,
            totalCount: 14,
          },
        },
        Date.now(),
        keySigGetGroup,
      ),
      // intervalMath: no data → "not-started" (won't show cue unless cold-start)
    },
  });

  // Home screen: all done — all starred skills fully automatic
  entries.push({
    name: 'home-recs-all-done',
    skillId: 'home',
    localStorageData: {
      starredSkills: JSON.stringify(['noteSemitones', 'keySignatures']),
      // noteSemitones: all items automatic (single-level, use perLevelScenario)
      ...perLevelScenario('noteSemitones', [
        { itemIds: NOTE_SEMI_ITEMS, state: 'automatic' },
      ]),
      // keySignatures: all groups automatic
      ...generateLocalStorageData(
        'keySignatures',
        Object.fromEntries(
          KEY_SIG_GROUP_IDS.map((id) => {
            const items = keySigGetGroup(id);
            return [id, {
              automaticCount: items.length,
              workingCount: 0,
              unseenCount: 0,
              totalCount: items.length,
            }];
          }),
        ),
        Date.now(),
        keySigGetGroup,
      ),
    },
  });

  // Home screen: cold start — all starred but none started
  entries.push({
    name: 'home-recs-cold-start',
    skillId: 'home',
    localStorageData: {
      starredSkills: JSON.stringify([
        'semitoneMath',
        'keySignatures',
        'fretboard',
      ]),
    },
  });

  // Single-level mode (noteSemitones) — uses shared recommendation states
  for (const state of noteSemiStates) {
    entries.push({
      name: `design-${state.name}`,
      skillId: 'noteSemitones',
      localStorageData: state.localStorageData,
    });
  }

  // All modes: idle + quiz (+ reverse quiz for bidirectional modes)
  for (const skillId of MODE_IDS) {
    entries.push({ name: `${skillId}-idle`, skillId });
    entries.push({
      name: `${skillId}-quiz`,
      skillId,
      fixture: quizActive(defaultItems[skillId]),
    });
    if (BIDIRECTIONAL_MODES.has(skillId)) {
      entries.push({
        name: `${skillId}-quiz-rev`,
        skillId,
        fixture: quizActive(defaultItems[`${skillId}_rev`]),
      });
    }
  }

  // Speed Check: fixture-based calibration captures.
  // SpeedCheck is rendered by GenericMode (e.g. semitoneMath), not SpeedTap
  // (SpeedTap uses fretboard-tap which is not yet in IMPLEMENTED_TASK_TYPES).
  entries.push(
    {
      name: 'speedCheck-intro',
      skillId: 'semitoneMath',
      fixture: speedCheckIntro(),
    },
    {
      name: 'speedCheck-testing',
      skillId: 'semitoneMath',
      fixture: speedCheckTesting(),
    },
    {
      name: 'speedCheck-results',
      skillId: 'semitoneMath',
      fixture: speedCheckResults(),
    },
  );

  // Design moments: correct, wrong, round-complete (semitoneMath)
  entries.push({
    name: 'design-correct-feedback',
    skillId: 'semitoneMath',
    fixture: quizCorrectFeedback(defaultItems.semitoneMath),
  });
  entries.push({
    name: 'design-wrong-feedback',
    skillId: 'semitoneMath',
    fixture: quizWrongFeedback(defaultItems.semitoneMath),
  });

  // Interval Math: double-accidental answers (G# - m2 = F##)
  // The correct answer is F## but the button grid only has G (enharmonic).
  // Fixture correctAnswer='G' for button highlighting; in live mode,
  // getDisplayAnswer produces 'F𝄪 (= G)' for the feedback text.
  entries.push({
    name: 'design-intervalMath-double-sharp-correct',
    skillId: 'intervalMath',
    fixture: quizCorrectFeedback('G#-m2', {
      correctAnswer: 'G',
      userInput: 'G',
    }),
  });
  entries.push({
    name: 'design-intervalMath-double-sharp-wrong',
    skillId: 'intervalMath',
    fixture: quizWrongFeedback('G#-m2', {
      correctAnswer: 'G',
      userInput: 'D#',
    }),
  });
  entries.push({
    name: 'design-round-complete',
    skillId: 'semitoneMath',
    fixture: quizRoundComplete(),
  });

  // Timer edge states: end-of-round walkthrough (semitoneMath)
  entries.push({
    name: 'design-feedback-timer-low',
    skillId: 'semitoneMath',
    fixture: quizFeedbackTimerLow(defaultItems.semitoneMath),
  });
  entries.push({
    name: 'design-feedback-timer-expired',
    skillId: 'semitoneMath',
    fixture: quizFeedbackTimerExpired(defaultItems.semitoneMath),
  });
  entries.push({
    name: 'design-last-question-awaiting',
    skillId: 'semitoneMath',
    fixture: quizLastQuestionAwaiting(defaultItems.semitoneMath),
  });
  entries.push({
    name: 'design-last-question-answered',
    skillId: 'semitoneMath',
    fixture: quizLastQuestionAnswered(defaultItems.semitoneMath),
  });

  // Fretboard design moments: correct + wrong
  // Item '5-8' = high E string, fret 8 = C natural.
  entries.push({
    name: 'design-fretboard-correct',
    skillId: 'fretboard',
    fixture: quizCorrectFeedback(defaultItems.fretboard, {
      correctAnswer: 'C',
    }),
  });
  entries.push({
    name: 'design-fretboard-wrong',
    skillId: 'fretboard',
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
      skillId: 'semitoneMath',
      localStorageData: scenarioFn('semitoneMath', mathIds),
      clickTab: 'progress',
    });
  }

  // Progress tab: fretboard heatmap scenarios (6x13 grid)
  const fbIds = fretboardItemIds(6, 13);
  for (const [label, scenarioFn] of scenarios) {
    entries.push({
      name: `design-fretboard-progress-${label}`,
      skillId: 'fretboard',
      localStorageData: scenarioFn('fretboard', fbIds),
      clickTab: 'progress',
    });
  }

  // Progress tab: group-aware fretboard scenarios
  // Each scenario has different groups in different learning stages.
  const unseen = (ids: string[]): LevelItemProfile => ({
    itemIds: ids,
    state: 'unseen',
  });

  const fbGroupScenarios: [
    string,
    LevelItemProfile[],
    string[], // enabled group IDs
  ][] = [
    // Just started group 0 — a few items seen, rest unseen
    [
      'fb-starting',
      [
        { itemIds: gIds[0], state: 'working', seenFraction: 0.35 },
        ...gIds.slice(1).map(unseen),
      ],
      [fbGroupIds[0]],
    ],
    // Working on first few groups — group 0 fast, group 1 mixed, group 2 just starting
    [
      'fb-working',
      [
        { itemIds: gIds[0], state: 'automatic' },
        { itemIds: gIds[1], state: 'mixed' },
        { itemIds: gIds[2], state: 'working', seenFraction: 0.5 },
        ...gIds.slice(3).map(unseen),
      ],
      fbGroupIds.slice(0, 3),
    ],
    // Mastered first couple, working on next ones
    [
      'fb-mastered-working',
      [
        { itemIds: gIds[0], state: 'automatic' },
        { itemIds: gIds[1], state: 'automatic' },
        { itemIds: gIds[2], state: 'mixed' },
        { itemIds: gIds[3], state: 'working', seenFraction: 0.5 },
        ...gIds.slice(4).map(unseen),
      ],
      fbGroupIds.slice(0, 4),
    ],
    // Needs review — first groups mastered but stale
    [
      'fb-needs-review',
      [
        { itemIds: gIds[0], state: 'stale' },
        { itemIds: gIds[1], state: 'stale' },
        { itemIds: gIds[2], state: 'stale' },
        ...gIds.slice(3).map(unseen),
      ],
      fbGroupIds.slice(0, 3),
    ],
    // Nearly done — everything except last group is fast
    [
      'fb-nearly-done',
      [
        ...gIds.slice(0, -1).map((ids) => ({
          itemIds: ids,
          state: 'automatic' as const,
        })),
        { itemIds: gIds[gIds.length - 1], state: 'mixed' as const },
      ],
      fbGroupIds,
    ],
  ];

  for (const [label, groups, enabledLevelIds] of fbGroupScenarios) {
    const data = {
      ...perLevelScenario('fretboard', groups),
      fretboard_enabledLevels: JSON.stringify(enabledLevelIds),
    };
    // Practice tab — suggested mode (default)
    entries.push({
      name: `design-fretboard-practice-${label}`,
      skillId: 'fretboard',
      localStorageData: data,
    });
    // Practice tab — custom mode
    entries.push({
      name: `design-fretboard-custom-${label}`,
      skillId: 'fretboard',
      localStorageData: {
        ...data,
        fretboard_enabledLevels_practiceMode: 'custom',
      },
    });
    // Progress tab
    entries.push({
      name: `design-fretboard-progress-${label}`,
      skillId: 'fretboard',
      localStorageData: data,
      clickTab: 'progress',
    });
  }

  // Chord spelling feedback: correct (C major = C E G) and wrong (C F G)
  const natBtn = (n: number) =>
    `.answer-grid-stack > .answer-grid:first-child > button:nth-child(${n})`;
  const accBtn = (n: number) =>
    `.answer-grid-stack > .answer-grid:last-child > button:nth-child(${n})`;
  const natural = accBtn(2); // ♮
  entries.push({
    name: 'design-chordSpelling-correct',
    skillId: 'chordSpelling',
    fixture: quizActive('C:major'),
    clickSelectors: [
      natBtn(1),
      natural, // C
      natBtn(3),
      natural, // E
      natBtn(5),
      natural, // G
      '.next-btn', // Check
    ],
  });
  entries.push({
    name: 'design-chordSpelling-wrong',
    skillId: 'chordSpelling',
    fixture: quizActive('C:major'),
    clickSelectors: [
      natBtn(1),
      natural, // C
      natBtn(4),
      natural, // F (wrong)
      natBtn(5),
      natural, // G
      '.next-btn', // Check
    ],
  });

  // Marketing story — targeted items + modal captures used by the App Store
  // / Play Store screenshot manifest (scripts/marketing-manifest.ts).
  entries.push({
    name: 'marketing-scaleDegrees-D-4',
    skillId: 'scaleDegrees',
    fixture: quizActive('D:4:fwd'),
  });
  // Chord spelling: show intermediate state with D and F# already entered.
  // clickSelectors tap the note buttons after the active fixture is applied.
  entries.push({
    name: 'marketing-chordSpelling-D7',
    skillId: 'chordSpelling',
    fixture: quizActive('D:dom7'),
    // Chord spelling uses SplitNoteButtons (natural + accidental rows).
    // Primary row: C D E F G A B. Secondary: ♭ ♮ ♯.
    // Tap D + ♮ to enter "D", then F + ♯ to enter "F#".
    clickSelectors: [
      '.answer-grid-stack > .answer-grid:first-child > button:nth-child(2)',
      '.answer-grid-stack > .answer-grid:last-child > button:nth-child(2)',
      '.answer-grid-stack > .answer-grid:first-child > button:nth-child(4)',
      '.answer-grid-stack > .answer-grid:last-child > button:nth-child(3)',
    ],
  });
  // Guitar chord shapes Am: tap all 5 played positions, then click Check to
  // land in the correct-feedback state with the chord highlighted.
  // Voicing [0,1,2,2,0,'x']: string 0 fret 0, s1 f1, s2 f2, s3 f2, s4 f0.
  entries.push({
    name: 'marketing-guitarChordShapes-Am-correct',
    skillId: 'guitarChordShapes',
    fixture: quizActive('A:minor'),
    clickSelectors: [
      '.fb-tap[data-string="0"][data-fret="0"]',
      '.fb-tap[data-string="1"][data-fret="1"]',
      '.fb-tap[data-string="2"][data-fret="2"]',
      '.fb-tap[data-string="3"][data-fret="2"]',
      '.fb-tap[data-string="4"][data-fret="0"]',
      '.next-btn',
    ],
  });
  // Fretboard practice tab with the SpeedLevelModal open (tap the first
  // level's progress bar). The modal is rendered by ProgressBarLabeled on
  // the Practice tab; Progress tab uses heatmaps, not tappable bars.
  // Reuses the fb-working group scenario so the bars are non-trivial.
  const fbWorking = fbGroupScenarios.find(([l]) => l === 'fb-working')!;
  const fbWorkingLocalStorage = {
    ...perLevelScenario('fretboard', fbWorking[1]),
    fretboard_enabledLevels: JSON.stringify(fbWorking[2]),
  };
  entries.push({
    name: 'marketing-fretboard-practice-modal',
    skillId: 'fretboard',
    localStorageData: fbWorkingLocalStorage,
    clickSelectors: ['.progress-bar-tappable'],
  });
  // Fretboard round-complete with non-zero progress: reuse the fb-working
  // group scenario (g0 automatic, g1 mixed, g2 working) so the per-level
  // progress bars are populated, then inject the round-complete engine state.
  entries.push({
    name: 'marketing-fretboard-round-complete',
    skillId: 'fretboard',
    localStorageData: fbWorkingLocalStorage,
    fixture: quizRoundComplete('good'),
  });

  return entries;
}
