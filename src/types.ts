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

export type CalibrationTrialConfig = {
  prompt: string;
  targetButtons: HTMLElement[];
};

export type EngineEls = {
  feedback: HTMLElement | null;
  timeDisplay: HTMLElement | null;
  hint: HTMLElement | null;
  stats: HTMLElement | null;
  quizArea: HTMLElement | null;
  quizPrompt: HTMLElement | null;
  masteryMessage: HTMLElement | null;
  baselineInfo: HTMLElement | null;
  quizHeaderClose: HTMLElement | null;
  countdownFill: HTMLElement | null;
  countdownBar: HTMLElement | null;
  quizInfoContext: HTMLElement | null;
  quizInfoTime: HTMLElement | null;
  quizLastQuestion: HTMLElement | null;
  quizInfoCount: HTMLElement | null;
  progressFill: HTMLElement | null;
  progressText: HTMLElement | null;
  roundCompleteEl: HTMLElement | null;
};

export interface QuizMode {
  id: string;
  storageNamespace: string;
  getEnabledItems(): string[];
  presentQuestion(itemId: string): void;
  checkAnswer(itemId: string, input: string): CheckAnswerResult;
  onStart?(): void;
  onStop?(): void;
  handleKey?(
    e: KeyboardEvent,
    ctx: { submitAnswer: (input: string) => void },
  ): boolean | void;
  onAnswer?(
    itemId: string,
    result: CheckAnswerResult,
    responseTime: number,
  ): void;
  getPracticingLabel?(): string;
  getExpectedResponseCount?(itemId: string): number;
  getCalibrationButtons?(): HTMLElement[];
  getCalibrationTrialConfig?(
    buttons: HTMLElement[],
    prevBtn: HTMLElement | null,
  ): CalibrationTrialConfig;
  calibrationIntroHint?: string;
  calibrationProvider?: string;
}

export interface QuizEngine {
  start(): void;
  stop(): void;
  showCalibrationIfNeeded(): void;
  submitAnswer(input: string): void;
  nextQuestion(): void;
  continueQuiz(): void;
  attach(): void;
  detach(): void;
  updateIdleMessage(): void;
  readonly isActive: boolean;
  readonly isRunning: boolean;
  readonly isAnswered: boolean;
  readonly baseline: number | null;
  selector: AdaptiveSelector;
  storage: StorageAdapter;
  els: EngineEls;
}

// ---------------------------------------------------------------------------
// Key handler
// ---------------------------------------------------------------------------

export type NoteKeyHandler = {
  handleKey(e: KeyboardEvent): boolean;
  reset(): void;
};
