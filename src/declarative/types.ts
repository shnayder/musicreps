// Declarative mode definition types.
// A ModeDefinition captures everything that varies between quiz modes,
// letting GenericMode handle all the shared hook composition + rendering.

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
};

export type PianoNoteButtonsDef = {
  kind: 'piano-note';
  hideAccidentals?: boolean;
};

export type NumberButtonsDef = {
  kind: 'number';
  start: number;
  end: number;
};

export type DegreeButtonsDef = { kind: 'degree' };
export type NumeralButtonsDef = { kind: 'numeral' };
export type IntervalButtonsDef = { kind: 'interval' };
export type KeysigButtonsDef = { kind: 'keysig' };
export type SplitNoteButtonsDef = { kind: 'split-note' };

/** Which tap/click buttons to show. Keyboard input goes through a text field. */
export type ButtonsDef =
  | NoteButtonsDef
  | PianoNoteButtonsDef
  | NumberButtonsDef
  | DegreeButtonsDef
  | NumeralButtonsDef
  | IntervalButtonsDef
  | KeysigButtonsDef
  | SplitNoteButtonsDef;

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

export type GroupScopeDef = {
  kind: 'groups';
  groups: Array<{ label: string | (() => string) }>;
  getItemIdsForGroup: (index: number) => string[];
  allGroupIndices: number[];
  storageKey: string;
  scopeLabel: string;
  defaultEnabled: number[];
  formatLabel: (enabledGroups: ReadonlySet<number>) => string;
};

export type ScopeDef = NoScopeDef | GroupScopeDef;

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

/** Evaluation result from a sequential mode's evaluate(). */
export type SequentialEvalResult = {
  correct: boolean;
  correctAnswer: string;
  perEntry: SequentialEntryResult[];
};

/**
 * Configuration for modes that collect multiple inputs before scoring.
 * The mode says "I need N inputs" and "here's how to grade them."
 * GenericMode handles collection, slot rendering, and engine integration.
 */
export type SequentialDef<Q> = {
  /** How many inputs this question expects. */
  expectedCount: (q: Q) => number;

  /** Check all collected inputs at once. Called after GenericMode has
   *  gathered exactly `expectedCount` inputs from the user. */
  evaluate: (q: Q, inputs: string[]) => SequentialEvalResult;

  /** Parse batch text input into individual answers (optional — enables
   *  keyboard entry). If omitted, only tap/button input is available. */
  parseBatchInput?: (text: string) => string[];

  /** Placeholder for batch text input field. */
  batchPlaceholder?: string | ((q: Q) => string);
};

// ---------------------------------------------------------------------------
// Mode controller — optional hook for imperative rendering + engine hooks
// ---------------------------------------------------------------------------

/**
 * Returned by a mode's `useController` hook. Provides custom rendering,
 * engine lifecycle hooks, and keyboard handling. All fields are optional —
 * GenericMode falls back to defaults for anything not provided.
 */
export type ModeController<Q> = {
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
  /** Keyboard narrowing set for PianoNoteButtons. */
  narrowing?: ReadonlySet<string> | null;
  /** Dynamic hideAccidentals override for PianoNoteButtons. */
  hideAccidentals?: boolean;
};

// ---------------------------------------------------------------------------
// ModeDefinition — the full declarative mode specification
// ---------------------------------------------------------------------------

/**
 * Everything needed to create a fully functional quiz mode.
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
/** Base fields shared by all mode definitions. */
type ModeDefinitionBase<Q> = {
  // --- Identity ---
  id: string;
  name: string;
  namespace: string;
  /** Motor task type for speed check calibration. Defaults to 'note-button'. */
  motorTaskType?: MotorTaskType;
  description: string;
  beforeAfter: {
    before: string | (() => string);
    after: string | (() => string);
  };
  itemNoun: string;

  // --- Item space ---
  allItems: string[];

  // --- Pure logic ---
  /** Parse an item ID into a question object. */
  getQuestion: (itemId: string) => Q;
  /** Generate prompt text from a question. */
  getPromptText: (q: Q) => string;

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

  // --- UI configuration ---
  buttons: AnswerDef;
  scope: ScopeDef;
  stats: StatsDef;

  // --- Optional controller hook ---
  /** Preact hook returning imperative rendering + lifecycle hooks.
   *  Called inside GenericMode — may use useRef, useState, etc. */
  useController?: (enabledGroups: ReadonlySet<number>) => ModeController<Q>;
};

/**
 * Everything needed to create a fully functional quiz mode.
 *
 * Uses a discriminated union: single-answer modes must provide `answer`,
 * sequential modes must provide `sequential`. This prevents runtime crashes
 * from accidentally omitting `answer` on a non-sequential mode.
 *
 * @typeParam Q - The question type returned by getQuestion.
 */
export type ModeDefinition<Q = unknown> =
  & ModeDefinitionBase<Q>
  & (
    | {
      /** Declarative answer spec: what the correct answer is and how to check it. */
      answer: AnswerSpecDef<Q>;
      sequential?: undefined;
    }
    | {
      /** When present, GenericMode collects multiple inputs before scoring.
       *  Replaces the single-answer flow. */
      sequential: SequentialDef<Q>;
      answer?: undefined;
    }
  );
