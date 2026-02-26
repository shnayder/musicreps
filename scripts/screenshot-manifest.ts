// Shared screenshot manifest: mode IDs, titles, and state entries used by
// both take-screenshots.ts and ui-iterate.ts.

import { defaultItems } from '../src/fixtures/items.ts';
import type { FixtureDetail } from '../src/fixtures/quiz-page.ts';
import {
  quizActive,
  quizCorrectFeedback,
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
  masteredFresh,
  masteredStale,
  returnedAfterBreak,
  semitoneMathItemIds,
} from '../src/fixtures/heatmap-scenarios.ts';

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

// Display names matching src/app.ts registrations
export const MODE_TITLES: Record<string, string> = {
  fretboard: 'Guitar Fretboard',
  ukulele: 'Ukulele Fretboard',
  speedTap: 'Speed Tap',
  noteSemitones: 'Note \u2194 Semitones',
  intervalSemitones: 'Interval \u2194 Semitones',
  semitoneMath: 'Semitone Math',
  intervalMath: 'Interval Math',
  keySignatures: 'Key Signatures',
  scaleDegrees: 'Scale Degrees',
  diatonicChords: 'Diatonic Chords',
  chordSpelling: 'Chord Spelling',
};

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

  return entries;
}
