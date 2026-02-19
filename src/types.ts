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

// ---------------------------------------------------------------------------
// Mode definition — the complete specification of a quiz mode
// ---------------------------------------------------------------------------

export type NoteFilter = 'natural' | 'sharps-flats' | 'all';

// --- Scope: what controls appear and what the user has selected ---

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

// --- Prompt: how questions appear ---

/**
 * 'text': infrastructure sets .quiz-prompt textContent. Zero DOM in mode.
 * 'custom': mode gets a callback for full control (fretboard SVG, speed tap).
 */
export type PromptSpec<TQuestion> =
  | {
    kind: 'text';
    /** Pure: derive prompt string from question data. */
    getText(question: TQuestion): string;
  }
  | {
    kind: 'custom';
    /** Render the question into the quiz area. */
    render(question: TQuestion, els: QuizAreaEls): void;
    /** Clear the previous question (before render and on stop). */
    clear(els: QuizAreaEls): void;
    /** Visual feedback after answer (e.g., green/red fretboard circle). */
    onAnswer?(
      question: TQuestion,
      result: CheckAnswerResult,
      els: QuizAreaEls,
    ): void;
  };

// --- Response: how answers are collected ---

export type AnswerGroup = {
  id: string;
  html: string;
  getButtonAnswer(btn: HTMLElement): string | null;
};

export type KeyHandlerFactory = (
  submitAnswer: (input: string) => void,
  getScope: () => ScopeState,
) => NoteKeyHandler;

export type SequentialState = {
  expectedCount: number;
  entries: { input: string; display: string; correct: boolean }[];
};

export type SequentialInputResult =
  | { status: 'continue'; state: SequentialState }
  | { status: 'complete'; correct: boolean; correctAnswer: string };

export type ResponseSpec =
  | {
    kind: 'buttons';
    /** Build-time HTML for the answer button area. */
    answerButtonsHTML: string;
    createKeyHandler: KeyHandlerFactory;
    /** Extract the answer string from a clicked button. */
    getButtonAnswer(btn: HTMLElement): string | null;
  }
  | {
    kind: 'bidirectional';
    /** Two or more button groups, shown/hidden per question. */
    groups: AnswerGroup[];
    /** Which group ID to show for a given question. */
    getActiveGroup(question: unknown): string;
    createKeyHandler: KeyHandlerFactory;
  }
  | {
    kind: 'sequential';
    answerButtonsHTML: string;
    createKeyHandler: KeyHandlerFactory;
    handleInput(
      itemId: string,
      input: string,
      state: SequentialState,
    ): SequentialInputResult;
    initSequentialState(itemId: string): SequentialState;
    renderProgress(state: SequentialState, els: QuizAreaEls): void;
  }
  | {
    kind: 'spatial';
    handleTap(
      target: HTMLElement,
      itemId: string,
    ): CheckAnswerResult | null;
    createKeyHandler?: KeyHandlerFactory;
  };

// --- Stats visualization ---

export type StatsSpec =
  | {
    kind: 'table';
    getRows(): StatsTableRow[];
    fwdHeader: string;
    revHeader: string;
  }
  | {
    kind: 'grid';
    colLabels: string[];
    getItemId(noteName: string, colIndex: number): string | string[];
    notes?: { name: string; displayName: string }[];
  }
  | {
    kind: 'custom';
    render(
      statsMode: string,
      statsEl: HTMLElement,
      selector: AdaptiveSelector,
      baseline: number | null,
      modeContainer: HTMLElement,
    ): void;
  };

export type StatsTableRow = {
  label: string;
  sublabel: string;
  _colHeader: string;
  fwdItemId: string;
  revItemId: string;
};

// --- Calibration ---

export type CalibrationSpec = {
  introHint?: string;
  getButtons?(container: HTMLElement): HTMLElement[];
  getTrialConfig?(
    buttons: HTMLElement[],
    prevBtn: HTMLElement | null,
  ): CalibrationTrialConfig;
};

// --- DOM references for mode callbacks ---

export type QuizAreaEls = {
  promptEl: HTMLElement;
  quizArea: HTMLElement;
  /** The mode-screen container element. */
  container: HTMLElement;
  /** Fretboard SVG wrapper (present only in fretboard modes). */
  fretboardWrapper?: HTMLElement;
  /** Fretboard SVG wrapper in progress tab (for heatmap). */
  progressFretboardWrapper?: HTMLElement;
};

// --- ModeDefinition: the central interface ---

/**
 * Complete specification of a quiz mode. Provides data and pure logic;
 * the shared ModeController handles DOM, lifecycle, and engine wiring.
 *
 * Generic TQuestion captures the mode's per-question data shape.
 */
export interface ModeDefinition<TQuestion = unknown> {
  id: string;
  name: string;
  storageNamespace: string;

  /** All possible item IDs. Used for storage preload and "all items" stats. */
  allItemIds: string[];

  /** Which items are eligible given the current scope selection. */
  getEnabledItems(scope: ScopeState): string[];

  scopeSpec: ScopeSpec;

  /** Derive question data from an item ID. Pure. */
  getQuestion(itemId: string): TQuestion;

  /** Check if user input is correct. Pure. */
  checkAnswer(itemId: string, input: string): CheckAnswerResult;

  prompt: PromptSpec<TQuestion>;
  response: ResponseSpec;
  stats: StatsSpec;

  /** Human-readable label for what's being practiced. */
  getPracticingLabel(scope: ScopeState): string;

  /** Session summary line ("3 strings · natural notes · 60s"). */
  getSessionSummary(scope: ScopeState): string;

  /** Calibration provider key (shared across modes with same button layout). */
  calibrationProvider?: string;

  /** Custom calibration config. */
  calibrationSpec?: CalibrationSpec;

  /** For multi-entry modes: expected response count per item. */
  getExpectedResponseCount?(itemId: string): number;

  /**
   * Optional: enriches recommendation with extra context.
   * Returns extra text parts for the message, and optional note filter
   * to apply when the user clicks "Use suggestion".
   */
  getRecommendationContext?(
    rec: RecommendationResult,
    selector: AdaptiveSelector,
  ): { extraParts: string[]; noteFilter?: NoteFilter };
}

// --- ModeUIState: the mode-level state object for State+Render ---

export type PracticeSummaryState = {
  statusLabel: string;
  statusDetail: string;
  recommendationText: string;
  showRecommendationButton: boolean;
  sessionSummary: string;
  masteryText: string;
  showMastery: boolean;
  enabledItemCount: number;
};

export type ModeUIState = {
  activeTab: 'practice' | 'progress';
  scope: ScopeState;
  practice: PracticeSummaryState;
  statsMode: 'retention' | 'speed' | null;
  recommendation: RecommendationResult | null;
};

// --- ModeController: returned by createModeController ---

export interface ModeController {
  init(): void;
  activate(): void;
  deactivate(): void;
  /** Handle notation changes (refresh labels, stats). */
  onNotationChange?(): void;
}
