// Declarative skill definition types.
// A SkillDefinition captures everything that varies between quiz skills,
// letting GenericSkill handle all the shared hook composition + rendering.

import type { ComponentChildren } from 'preact';
import type {
  CheckAnswerResult,
  ItemStats,
  MotorTaskType,
  StatsTableRow,
} from '../types.ts';

/** Minimal selector interface for stats rendering (color computation). */
export type StatsSelector = {
  getSpeedScore(id: string): number | null;
  getFreshness(id: string): number | null;
  getStats(id: string): ItemStats | null;
};

// ---------------------------------------------------------------------------
// Button types — what clickable/tappable buttons appear during quiz
// ---------------------------------------------------------------------------

export type NoteButtonsDef = {
  kind: 'note';
  /** Grid column count. Defaults to 4. Use 6 for compact layouts (fretboard). */
  columns?: number;
};

export type NumberButtonsDef = {
  kind: 'number';
  start: number;
  end: number;
};

export type DegreeButtonsDef = { kind: 'degree' };
export type NumeralButtonsDef = { kind: 'numeral' };
export type IntervalButtonsDef = { kind: 'interval' };
export type SplitKeysigButtonsDef = { kind: 'split-keysig' };
export type SplitNoteButtonsDef = { kind: 'split-note' };
export type NoButtonsDef = { kind: 'none' };

/** Which tap/click buttons to show. Keyboard input goes through a text field. */
export type ButtonsDef =
  | NoteButtonsDef
  | NumberButtonsDef
  | DegreeButtonsDef
  | NumeralButtonsDef
  | IntervalButtonsDef
  | SplitKeysigButtonsDef
  | SplitNoteButtonsDef
  | NoButtonsDef;

// ---------------------------------------------------------------------------
// Answer definition — which buttons to show (possibly direction-dependent)
// ---------------------------------------------------------------------------

export type BidirectionalAnswer = {
  kind: 'bidirectional';
  fwd: ButtonsDef;
  rev: ButtonsDef;
};

export type AnswerDef = ButtonsDef | BidirectionalAnswer;

// ---------------------------------------------------------------------------
// Scope definition — how the user filters what to practice
// ---------------------------------------------------------------------------

export type NoScopeDef = { kind: 'none' };

export type LevelScopeDef = {
  kind: 'levels';
  levels: Array<
    {
      id: string;
      label: string | (() => string);
      longLabel?: string | (() => string);
    }
  >;
  getItemIdsForLevel: (id: string) => string[];
  allLevelIds: string[];
  storageKey: string;
  scopeLabel: string;
  defaultEnabled: string[];
  formatLabel: (enabledLevels: ReadonlySet<string>) => string;
};

export type ScopeDef = NoScopeDef | LevelScopeDef;

// ---------------------------------------------------------------------------
// Stats definition — how progress stats are displayed
// ---------------------------------------------------------------------------

export type GridStatsDef = {
  kind: 'grid';
  colLabels: string[];
  getItemId: (
    rowName: string,
    colIndex: number,
  ) => string | string[];
  notes?: Array<{ name: string; displayName: string }>;
};

export type TableStatsDef = {
  kind: 'table';
  getRows: () => StatsTableRow[];
  fwdHeader: string;
  revHeader: string;
  fwd2Header?: string;
  rev2Header?: string;
};

export type NoStatsDef = { kind: 'none' };

export type StatsDef = GridStatsDef | TableStatsDef | NoStatsDef;

// ---------------------------------------------------------------------------
// Answer specification — how the framework checks correctness + button feedback
// ---------------------------------------------------------------------------

/** How the framework checks correctness and normalizes for button feedback. */
export type ComparisonStrategy =
  | 'exact' // string ===
  | 'integer' // parseInt() ===
  | 'note-enharmonic' // spelledNoteMatchesSemitone (any enharmonic ok)
  | 'interval'; // intervalMatchesInput (primary + alt abbrevs)

/** Declarative answer spec: what the correct answer is and how to check it. */
export type AnswerSpec<Q> = {
  getExpectedValue: (q: Q) => string;
  comparison: ComparisonStrategy;
  /** Override display text for feedback. Defaults: displayNote(expected) for
   *  note-enharmonic, expected for others. */
  getDisplayAnswer?: (q: Q) => string;
  /** Normalize raw user input before comparison and button matching.
   *  E.g., "4" → "IV" for numeral input, "vii" → "vii°". */
  normalizeInput?: (input: string) => string;
};

export type BidirectionalAnswerSpec<Q> = {
  kind: 'bidirectional';
  fwd: AnswerSpec<Q>;
  rev: AnswerSpec<Q>;
};

export type AnswerSpecDef<Q> = AnswerSpec<Q> | BidirectionalAnswerSpec<Q>;

// ---------------------------------------------------------------------------
// Sequential response — modes that collect multiple inputs before evaluating
// ---------------------------------------------------------------------------

/** Per-entry evaluation result returned by sequential evaluate(). */
export type SequentialEntryResult = {
  display: string;
  correct: boolean;
};

/** Evaluation result from a sequential skill's evaluate(). */
export type SequentialEvalResult = {
  correct: boolean;
  correctAnswer: string;
  perEntry: SequentialEntryResult[];
};

/**
 * Configuration for modes that collect multiple inputs before scoring.
 * The mode says "I need N inputs" and "here's how to grade them."
 * GenericSkill handles collection, slot rendering, and engine integration.
 */
export type SequentialDef<Q> = {
  /** How many inputs this question expects. */
  expectedCount: (q: Q) => number;

  /** Check all collected inputs at once. Called after GenericSkill has
   *  gathered exactly `expectedCount` inputs from the user. */
  evaluate: (q: Q, inputs: string[]) => SequentialEvalResult;

  /** Parse batch text input into individual answers (optional — enables
   *  keyboard entry). If omitted, only tap/button input is available. */
  parseBatchInput?: (text: string) => string[];

  /** Placeholder for batch text input field. */
  batchPlaceholder?: string | ((q: Q) => string);
};

// ---------------------------------------------------------------------------
// Multi-tap response — modes where user taps multiple targets (any order)
// ---------------------------------------------------------------------------

/** Per-position evaluation result for multi-tap feedback. */
export type MultiTapEntryResult = {
  positionKey: string;
  correct: boolean;
};

/** Evaluation result from a multi-tap skill's evaluate. */
export type MultiTapEvalResult = {
  correct: boolean;
  correctAnswer: string;
  perEntry: MultiTapEntryResult[];
  /** Positions the user missed (correct but not tapped). */
  missed: string[];
};

/**
 * Configuration for modes where the user taps multiple targets in any order.
 * The mode says "here are the targets" and GenericSkill handles collection,
 * de-duplication, evaluation, and engine integration.
 */
export type MultiTapDef<Q> = {
  /** All target position IDs for this question (unordered set). */
  getTargets: (q: Q) => string[];

  /** Evaluate all tapped positions at once. Called after the user has
   *  tapped exactly `getTargets(q).length` positions.
   *  Must return `correctAnswer` for engine feedback display. */
  evaluate: (q: Q, tapped: string[]) => MultiTapEvalResult;

  /** Number of strings on the fretboard (default 6 for guitar). */
  stringCount?: number;

  /** Return string indices that are muted for this question.
   *  Shown as X markers on the fretboard after evaluation. */
  getMutedStrings?: (q: Q) => number[];

  /** When true, only one tap per string is allowed. Tapping a new fret on a
   *  string that already has a tap replaces the old one (chord shape behavior). */
  onePerString?: boolean;
};

// ---------------------------------------------------------------------------
// Mode controller — optional hook for imperative rendering + engine hooks
// ---------------------------------------------------------------------------

/**
 * Returned by a skill's `useController` hook. Provides custom rendering,
 * engine lifecycle hooks, and keyboard handling. All fields are optional —
 * GenericSkill falls back to defaults for anything not provided.
 */
export type SkillController<Q> = {
  /** Custom prompt content rendered as QuizArea child (replaces text prompt). */
  renderPrompt?: (q: Q) => ComponentChildren;
  /** Custom stats content rendered in the practice tab (replaces grid/table). */
  renderStats?: (selector: StatsSelector) => ComponentChildren;
  /** Called after the user answers (e.g., color an SVG circle). */
  onAnswer?: (itemId: string, result: CheckAnswerResult) => void;
  /** Called when quiz starts. */
  onStart?: () => void;
  /** Called when quiz stops. */
  onStop?: () => void;
  /** Mode keyboard handler. Return true if handled. Replaces text input. */
  handleKey?: (
    e: KeyboardEvent,
    ctx: { submitAnswer: (input: string) => void },
  ) => boolean | void;
  /** Called on mode deactivation (e.g., reset keyboard handler). */
  deactivateCleanup?: () => void;
  /** Keyboard narrowing set for NoteButtons. */
  narrowing?: ReadonlySet<string> | null;
  /** Dynamic hideAccidentals override for NoteButtons. */
  hideAccidentals?: boolean;
  /** Dynamic column count override for NoteButtons. */
  buttonColumns?: number;
  /** Ref for GenericSkill to inject the engine's submitAnswer function.
   *  Required for controllers that submit programmatically (e.g., multi-tap). */
  engineSubmitRef?: { current: (input: string) => void };
};

// ---------------------------------------------------------------------------
// Question context — round-scoped state passed to getQuestion
// ---------------------------------------------------------------------------

/** Round-scoped context threaded into `getQuestion` so modes can react to
 *  per-round state without reaching into the engine directly. */
export type QuestionContext = {
  /** Per-round random flag: when true, modes that honor it spell accidentals
   *  using flats (Bb) instead of sharps (A#). Set by engineStart and
   *  engineContinueRound. */
  useFlats: boolean;
};

// ---------------------------------------------------------------------------
// SkillDefinition — the full declarative mode specification
// ---------------------------------------------------------------------------

/**
 * Everything needed to create a fully functional quiz skill.
 *
 * The generic component handles all hook composition, rendering, and phase
 * transitions. Keyboard input is via a text field + Enter — no per-mode
 * keyboard handler needed. Buttons remain for tap/click.
 *
 * Modes with custom rendering needs (e.g., SVG fretboard) provide a
 * `useController` hook that returns imperative rendering and lifecycle hooks.
 *
 * @typeParam Q - The question type returned by getQuestion.
 */
/** Base fields shared by all skill definitions. */
type SkillDefinitionBase<Q> = {
  // --- Identity ---
  id: string;
  name: string;
  namespace: string;
  /** Motor task type for speed check calibration. Defaults to 'note-button'. */
  motorTaskType?: MotorTaskType;
  description: string;
  /** Longer description for the About tab — what this skill is and why it
   *  matters. Falls back to `description` if omitted. */
  aboutDescription?: string;
  beforeAfter: {
    before: string[] | (() => string[]);
    after: string | (() => string);
  };
  itemNoun: string;

  // --- Item space ---
  allItems: string[];

  // --- Pure logic ---
  /** Parse an item ID into a question object. The optional ctx carries
   *  round-scoped state (e.g., per-round random accidental spelling). Modes
   *  that don't care can ignore it. */
  getQuestion: (itemId: string, ctx?: QuestionContext) => Q;
  /** Generate prompt text from a question. */
  getPromptText: (q: Q) => string;
  /** Instruction shown above the prompt during quiz (e.g., "What note is this?"). */
  quizInstruction?: string | ((q: Q) => string);

  // --- Direction (for bidirectional modes) ---
  /** Get the direction of a question. Only needed for bidirectional answers. */
  getDirection?: (q: Q) => 'fwd' | 'rev';

  // --- Per-question display flags ---
  /** Whether to show flat labels on note buttons for this question. */
  getUseFlats?: (q: Q) => boolean;

  // --- Input validation ---
  /** Validate that input looks like a real answer (not garbage).
   *  If provided and returns false, the input is rejected with a shake
   *  animation instead of being scored as wrong.
   *  If not provided, all non-empty input is accepted. */
  validateInput?: (q: Q, input: string) => boolean;

  /** Placeholder text for the answer text field. Can be static or per-question. */
  inputPlaceholder?: string | ((q: Q) => string);

  // --- Response count scaling ---
  /** Number of expected sub-responses per item (e.g., fretboard positions for
   *  a note, tones in a chord). Used for speed-score scaling in the learner
   *  model. If omitted, each item counts as 1 response. */
  getExpectedResponseCount?: (itemId: string) => number;

  // --- UI configuration ---
  buttons: AnswerDef;
  scope: ScopeDef;
  stats: StatsDef;

  // --- Optional controller hook ---
  /** Preact hook returning imperative rendering + lifecycle hooks.
   *  Called inside GenericSkill — may use useRef, useState, etc. */
  useController?: (enabledLevels: ReadonlySet<string>) => SkillController<Q>;
};

/**
 * Everything needed to create a fully functional quiz skill.
 *
 * Uses a discriminated union: single-answer modes must provide `answer`,
 * sequential modes must provide `sequential`. This prevents runtime crashes
 * from accidentally omitting `answer` on a non-sequential mode.
 *
 * @typeParam Q - The question type returned by getQuestion.
 */
export type SkillDefinition<Q = unknown> =
  & SkillDefinitionBase<Q>
  & (
    | {
      /** Declarative answer spec: what the correct answer is and how to check it. */
      answer: AnswerSpecDef<Q>;
      sequential?: undefined;
      multiTap?: undefined;
    }
    | {
      /** When present, GenericSkill collects multiple inputs before scoring.
       *  Replaces the single-answer flow. */
      sequential: SequentialDef<Q>;
      answer?: undefined;
      multiTap?: undefined;
    }
    | {
      /** When present, GenericSkill collects taps on a spatial surface (e.g.,
       *  fretboard) and evaluates all at once after the expected count. */
      multiTap: MultiTapDef<Q>;
      answer?: undefined;
      sequential?: undefined;
    }
  );
