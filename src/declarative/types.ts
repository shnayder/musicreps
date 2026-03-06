// Declarative mode definition types.
// A ModeDefinition captures everything that varies between quiz modes,
// letting GenericMode handle all the shared hook composition + rendering.

import type { StatsTableRow } from '../types.ts';

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

/** Which tap/click buttons to show. Keyboard input goes through a text field. */
export type ButtonsDef =
  | NoteButtonsDef
  | PianoNoteButtonsDef
  | NumberButtonsDef
  | DegreeButtonsDef
  | NumeralButtonsDef
  | IntervalButtonsDef
  | KeysigButtonsDef;

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
// ModeDefinition — the full declarative mode specification
// ---------------------------------------------------------------------------

/**
 * Everything needed to create a fully functional quiz mode.
 *
 * The generic component handles all hook composition, rendering, and phase
 * transitions. Keyboard input is via a text field + Enter — no per-mode
 * keyboard handler needed. Buttons remain for tap/click.
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
};
