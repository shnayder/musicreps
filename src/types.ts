// Shared type definitions — zero runtime code, erased by esbuild.
// Interfaces for shapes referenced by 2+ source files.

// ---------------------------------------------------------------------------
// Music theory data
// ---------------------------------------------------------------------------

export type Note = {
  name: string;
  displayName: string;
  num: number;
  accepts: string[];
};

export type Interval = {
  name: string;
  num: number;
  abbrev: string;
  altAbbrevs?: string[];
};

export type MajorKey = {
  root: string;
  sharps: number;
  flats: number;
  accidentalCount: number;
  accidentalType: 'none' | 'sharps' | 'flats';
};

export type DiatonicChord = {
  degree: number;
  numeral: string;
  quality: 'major' | 'minor' | 'diminished';
  qualityLabel: string;
};

export type ChordType = {
  name: string;
  symbol: string;
  intervals: number[];
  degrees: string[];
  group: number;
};

export type Instrument = {
  id: string;
  name: string;
  storageNamespace: string;
  stringCount: number;
  fretCount: number;
  stringNames: string[];
  stringOffsets: number[];
  defaultString: number;
  fretMarkers: number[];
};

// ---------------------------------------------------------------------------
// Adaptive selector
// ---------------------------------------------------------------------------

export type ItemStats = {
  recentTimes: number[];
  ewma: number;
  sampleCount: number;
  lastSeen: number;
  stability: number | null;
  lastCorrectAt: number | null;
};

export type AdaptiveConfig = {
  minTime: number;
  unseenBoost: number;
  ewmaAlpha: number;
  maxStoredTimes: number;
  maxResponseTime: number;
  initialStability: number;
  maxStability: number;
  stabilityGrowthMax: number;
  stabilityDecayOnWrong: number;
  freshnessThreshold: number;
  selfCorrectionThreshold: number;
  speedTarget: number;
};

export interface StorageAdapter {
  getStats(itemId: string): ItemStats | null;
  saveStats(itemId: string, stats: ItemStats): void;
  getLastSelected(): string | null;
  setLastSelected(itemId: string): void;
  getDeadline(itemId: string): number | null;
  saveDeadline(itemId: string, deadline: number): void;
  preload?(itemIds: string[]): void;
}

export type StringRecommendation = {
  string: number;
  workingCount: number;
  unseenCount: number;
  automaticCount: number;
  totalCount: number;
};

export interface AdaptiveSelector {
  recordResponse(itemId: string, timeMs: number, correct?: boolean): void;
  selectNext(validItems: string[]): string;
  getStats(itemId: string): ItemStats | null;
  getWeight(itemId: string): number;
  getRecall(itemId: string, nowMs?: number): number | null;
  getSpeedScore(itemId: string): number | null;
  getFreshness(itemId: string, nowMs?: number): number | null;
  getLevelSpeed(
    itemIds: string[],
    percentile?: number,
  ): { level: number; seen: number };
  getLevelFreshness(
    itemIds: string[],
    percentile?: number,
    nowMs?: number,
  ): { level: number; seen: number };
  getStringRecommendations(
    stringIndices: number[],
    getItemIds: (index: number) => string[],
  ): StringRecommendation[];
  checkAllAutomatic(items: string[]): boolean;
  checkNeedsReview(items: string[]): boolean;
  updateConfig(newCfg: Partial<AdaptiveConfig>): void;
  getConfig(): AdaptiveConfig;
}

// ---------------------------------------------------------------------------
// Deadline
// ---------------------------------------------------------------------------

export type DeadlineConfig = {
  decreaseFactor: number;
  increaseFactor: number;
  minDeadlineMargin: number;
  ewmaMultiplier: number;
  headroomMultiplier: number;
  maxDropFactor: number;
};

export interface DeadlineTracker {
  getDeadline(
    itemId: string,
    ewma: number | null,
    responseCount?: number,
  ): number;
  recordOutcome(
    itemId: string,
    correct: boolean,
    responseCount?: number,
    responseTime?: number | null,
  ): number | undefined;
  updateConfig(newAdaptiveCfg: AdaptiveConfig): void;
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

export type LevelRecommendation = {
  index: number;
  type: 'review' | 'practice' | 'expand' | 'automate';
};

export type RecommendationResult = {
  recommended: Set<number>;
  enabled: Set<number> | null;
  expandIndex: number | null;
  expandNewCount: number;
  /** Per-level recommendations in priority order. */
  levelRecs: LevelRecommendation[];
};

// ---------------------------------------------------------------------------
// Quiz engine
// ---------------------------------------------------------------------------

export type EnginePhase =
  | 'idle'
  | 'active'
  | 'round-complete'
  | 'calibration-intro'
  | 'calibrating'
  | 'calibration-results';

export function isCalibrationPhase(phase: EnginePhase): boolean {
  return phase === 'calibrating' || phase.startsWith('calibration');
}

export type EngineState = {
  phase: EnginePhase;
  currentItemId: string | null;
  answered: boolean;
  questionStartTime: number | null;

  questionCount: number;
  quizStartTime: number | null;

  roundNumber: number;
  roundAnswered: number;
  roundCorrect: number;
  roundTimerExpired: boolean;
  roundResponseTimes: number[];
  roundDurationMs: number;

  masteredCount: number;
  totalEnabledCount: number;

  feedbackText: string;
  feedbackClass: string;
  feedbackCorrect: boolean | null;
  feedbackDisplayAnswer: string | null;
  /** Raw input value the user submitted (button value or typed text). */
  feedbackUserInput: string | null;

  hintText: string;

  masteryText: string;
  showMastery: boolean;

  calibrationBaseline: number | null;

  quizActive: boolean;
  answersEnabled: boolean;
};

export type CheckAnswerResult = {
  correct: boolean;
  correctAnswer: string;
};

// ---------------------------------------------------------------------------
// Key handler
// ---------------------------------------------------------------------------

export type NoteKeyHandler = {
  handleKey(e: KeyboardEvent): boolean;
  reset(): void;
  /** Returns the currently buffered note (e.g., 'C' awaiting accidental). */
  getPendingNote(): string | null;
};

// ---------------------------------------------------------------------------
// Scope and mode configuration
// ---------------------------------------------------------------------------

export type NoteFilter = 'natural' | 'sharps-flats' | 'all' | 'none';

export type GroupDef = {
  index: number;
  label: string;
  /** Item IDs belonging to this group. Precomputed at mode creation. */
  itemIds: string[];
};

/** Build-time configuration: what scope controls to render. */
export type ScopeSpec =
  | { kind: 'none' }
  | {
    kind: 'groups';
    groups: GroupDef[];
    defaultEnabled: number[];
    storageKey: string;
    /** Label for the toggle group heading (defaults to "Groups" in HTML). */
    label?: string;
    /** Sort function for recommending which unstarted group to expand next. */
    sortUnstarted?: (
      a: StringRecommendation,
      b: StringRecommendation,
    ) => number;
  }
  | {
    kind: 'note-filter';
    storageKey: string;
  };

/** Why a group was skipped: user claims mastery vs. deferred for later. */
export type GroupStatus = 'mastered' | 'deferred';

/** Runtime state: what the user has currently selected. */
export type ScopeState =
  | { kind: 'none' }
  | {
    kind: 'groups';
    enabledGroups: ReadonlySet<number>;
    skippedGroups: ReadonlyMap<number, GroupStatus>;
  }
  | { kind: 'note-filter'; noteFilter: NoteFilter };

// --- Stats ---

export type StatsTableRow = {
  label: string;
  sublabel: string;
  _colHeader: string;
  fwdItemId: string;
  revItemId: string;
};

// --- Mode lifecycle ---

/** Navigation handle for activating/deactivating a quiz mode. */
export type ModeHandle = {
  activate(): void;
  deactivate(): void;
};

// --- Practice summary state ---

export type PracticeSummaryState = {
  statusLabel: string;
  statusDetail: string;
  recommendationText: string;
  showRecommendationButton: boolean;
  masteryText: string;
  showMastery: boolean;
  enabledItemCount: number;
};

// --- Settings controller ---

export type SettingsController = {
  getUseSolfege: () => boolean;
  setUseSolfege: (useSolfege: boolean) => void;
};

// --- Fixture types ---

/** Describes a fixture state for the speed-check calibration screen. */
export type SpeedCheckFixture = {
  phase: 'intro' | 'running' | 'results';
  /** Baseline value in ms (for 'results' phase). Defaults to 0. */
  baseline?: number;
  /** Trial progress text (for 'running' phase). Defaults to ''. */
  trialProgress?: string;
  /** Which button to highlight green (for 'running' phase). */
  targetNote?: string;
};

/** Shape dispatched via __fixture__ custom event. */
export type FixtureDetail = {
  engineState?: Partial<EngineState>;
  timerPct?: number;
  timerText?: string;
  timerWarning?: boolean;
  timerLastQuestion?: boolean;
  calibration?: SpeedCheckFixture;
};
