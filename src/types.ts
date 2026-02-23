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
  stabilityGrowthBase: number;
  stabilityDecayOnWrong: number;
  recallThreshold: number;
  expansionThreshold: number;
  speedBonusMax: number;
  selfCorrectionThreshold: number;
  automaticityTarget: number;
  automaticityThreshold: number;
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
  dueCount: number;
  unseenCount: number;
  masteredCount: number;
  totalCount: number;
};

export interface AdaptiveSelector {
  recordResponse(itemId: string, timeMs: number, correct?: boolean): void;
  selectNext(validItems: string[]): string;
  getStats(itemId: string): ItemStats | null;
  getWeight(itemId: string): number;
  getRecall(itemId: string): number | null;
  getAutomaticity(itemId: string): number | null;
  getStringRecommendations(
    stringIndices: number[],
    getItemIds: (index: number) => string[],
  ): StringRecommendation[];
  checkAllMastered(items: string[]): boolean;
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

export type RecommendationResult = {
  recommended: Set<number>;
  enabled: Set<number> | null;
  consolidateIndices: number[];
  consolidateDueCount: number;
  expandIndex: number | null;
  expandNewCount: number;
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
  timeDisplayText: string;
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

export type NoteFilter = 'natural' | 'sharps-flats' | 'all';

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
    kind: 'fretboard';
    instrument: Instrument;
  }
  | {
    kind: 'note-filter';
    storageKey: string;
  };

/** Runtime state: what the user has currently selected. */
export type ScopeState =
  | { kind: 'none' }
  | { kind: 'groups'; enabledGroups: ReadonlySet<number> }
  | {
    kind: 'fretboard';
    enabledStrings: ReadonlySet<number>;
    noteFilter: NoteFilter;
  }
  | { kind: 'note-filter'; noteFilter: NoteFilter };

// --- Sequential response ---

export type SequentialState = {
  expectedCount: number;
  entries: { input: string; display: string; correct: boolean }[];
};

export type SequentialInputResult =
  | { status: 'continue'; state: SequentialState }
  | { status: 'complete'; correct: boolean; correctAnswer: string };

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
