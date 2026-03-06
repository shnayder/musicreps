// Declarative mode definition types.
// A ModeDefinition captures everything that varies between quiz modes,
// letting GenericMode handle all the shared hook composition + rendering.

import type { StatsTableRow } from '../types.ts';

// ---------------------------------------------------------------------------
// Response types — what buttons the user sees and how keyboard maps to them
// ---------------------------------------------------------------------------

export type NoteResponseDef = {
  kind: 'note';
  /** Whether to show flat labels on buttons. Called per-question. */
  useFlats?: boolean;
};

export type PianoNoteResponseDef = {
  kind: 'piano-note';
  hideAccidentals?: boolean;
};

export type NumberResponseDef = {
  kind: 'number';
  start: number;
  end: number;
};

export type DegreeResponseDef = { kind: 'degree' };
export type NumeralResponseDef = { kind: 'numeral' };
export type IntervalResponseDef = { kind: 'interval' };
export type KeysigResponseDef = { kind: 'keysig' };

/** A single response type (one set of buttons + one keyboard handler). */
export type ResponseDef =
  | NoteResponseDef
  | PianoNoteResponseDef
  | NumberResponseDef
  | DegreeResponseDef
  | NumeralResponseDef
  | IntervalResponseDef
  | KeysigResponseDef;

// ---------------------------------------------------------------------------
// Answer definition — how the user answers (possibly direction-dependent)
// ---------------------------------------------------------------------------

export type UnidirectionalAnswer = ResponseDef;

export type BidirectionalAnswer = {
  kind: 'bidirectional';
  fwd: ResponseDef;
  rev: ResponseDef;
};

export type AnswerDef = UnidirectionalAnswer | BidirectionalAnswer;

// ---------------------------------------------------------------------------
// Scope definition — how the user filters what to practice
// ---------------------------------------------------------------------------

export type NoScopeDef = { kind: 'none' };

export type GroupScopeDef = {
  kind: 'groups';
  groups: Array<{ label: string }>;
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
// Keyboard hint — what type hint to show below buttons
// ---------------------------------------------------------------------------

export type KeyboardHintDef = 'note' | 'number-0-11' | 'number-1-12' | null;

// ---------------------------------------------------------------------------
// ModeDefinition — the full declarative mode specification
// ---------------------------------------------------------------------------

/**
 * Everything needed to create a fully functional quiz mode.
 *
 * The generic component handles all hook composition, rendering, keyboard
 * routing, and phase transitions. The mode only provides data + pure logic.
 *
 * @typeParam Q - The question type returned by getQuestion.
 */
export type ModeDefinition<Q = unknown> = {
  // --- Identity ---
  id: string;
  name: string;
  namespace: string;
  description: string;
  beforeAfter: { before: string; after: string };
  itemNoun: string;

  // --- Item space ---
  allItems: string[];

  // --- Pure logic ---
  /** Parse an item ID into a question object. */
  getQuestion: (itemId: string) => Q;
  /** Generate prompt text from a question. */
  getPromptText: (q: Q) => string;
  /** Check user's answer against the correct answer. */
  checkAnswer: (q: Q, input: string) => {
    correct: boolean;
    correctAnswer: string;
  };

  // --- Direction (for bidirectional modes) ---
  /** Get the direction of a question. Only needed for bidirectional answers. */
  getDirection?: (q: Q) => 'fwd' | 'rev';

  // --- Per-question display flags ---
  /** Whether to show flat labels on note buttons for this question. */
  getUseFlats?: (q: Q) => boolean;

  // --- UI configuration ---
  answer: AnswerDef;
  scope: ScopeDef;
  stats: StatsDef;

  // --- Keyboard hint ---
  /** Keyboard hint type shown during quiz. For bidirectional modes, this
   *  can be a function of direction. */
  getKeyboardHint?:
    | KeyboardHintDef
    | ((dir: 'fwd' | 'rev') => KeyboardHintDef);
};
