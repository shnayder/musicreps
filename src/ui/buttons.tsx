// Answer button components — unified 4-column grid layout.
// All button types use .answer-grid container + .answer-btn buttons.

import { useCallback, useEffect, useRef, useState } from 'preact/hooks';

import {
  DEGREE_LABELS,
  displayNote,
  INTERVAL_ABBREVS,
  NATURAL_NOTES,
  NOTE_NAMES,
  NOTES,
  pickAccidentalName,
  ROMAN_NUMERALS,
} from '../music-data.ts';

// ---------------------------------------------------------------------------
// Feedback state for button highlighting after answer
// ---------------------------------------------------------------------------

/** Feedback state for highlighting buttons after an answer.
 *
 *  Both fields are normalized to canonical button values by GenericSkill
 *  before reaching here. For note buttons, that means NOTE_NAMES form
 *  ("C", "C#", "D#", etc.). For other button types, values match the
 *  button's data value (numbers, intervals, numerals, etc.).
 */
export type ButtonFeedback = {
  correct: boolean;
  /** Canonical button value for the user's answer. */
  userInput: string;
  /** Canonical button value for the correct answer. */
  displayAnswer: string;
};

/** Compute feedback CSS class for a button given its value and display label.
 *
 *  Compares feedback fields against both buttonValue and buttonLabel to handle
 *  cases where the canonical value differs from the display label (e.g., note
 *  buttons: value "D#", label "D♯"; degree buttons: value "5", label "5th").
 */
function feedbackClass(
  feedback: ButtonFeedback | null,
  buttonValue: string,
  buttonLabel: string,
): string {
  if (!feedback) return '';
  if (feedback.correct && buttonValue === feedback.userInput) {
    return ' btn-feedback-correct';
  }
  if (!feedback.correct) {
    if (buttonValue === feedback.userInput) return ' btn-feedback-wrong';
    if (
      buttonValue === feedback.displayAnswer ||
      buttonLabel === feedback.displayAnswer
    ) {
      return ' btn-feedback-reveal';
    }
  }
  return '';
}

// ---------------------------------------------------------------------------
// Note answer buttons (12-note or 7-natural grid)
// ---------------------------------------------------------------------------

export function NoteButtons(
  { onAnswer, useFlats, hideAccidentals, narrowing, feedback, columns }: {
    onAnswer?: (note: string) => void;
    /** When set, accidental buttons show flats (true) or sharps (false). */
    useFlats?: boolean;
    /** When true, render only 7 natural notes instead of all 12. */
    hideAccidentals?: boolean;
    /** Set of note names to highlight as keyboard matches; others dimmed. */
    narrowing?: ReadonlySet<string> | null;
    feedback?: ButtonFeedback | null;
    /** Grid column count. Defaults to 4. */
    columns?: number;
  },
) {
  const notes = hideAccidentals ? NATURAL_NOTES : NOTE_NAMES;
  const gridCls = columns === 6 ? 'answer-grid answer-grid-6' : 'answer-grid';
  return (
    <div class={gridCls}>
      {notes.map((n) => {
        let label: string;
        if (useFlats !== undefined) {
          const note = NOTES.find((x) => x.name === n);
          label = note
            ? displayNote(pickAccidentalName(note.displayName, useFlats))
            : displayNote(n);
        } else {
          label = displayNote(n);
        }
        let btnCls = 'answer-btn';
        if (narrowing) {
          btnCls += narrowing.has(n) ? ' kb-match' : ' kb-dimmed';
        }
        btnCls += feedbackClass(feedback ?? null, n, label);
        return (
          <button
            type='button'
            tabIndex={0}
            key={n}
            class={btnCls}
            data-note={n}
            onClick={onAnswer ? () => onAnswer(n) : undefined}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SplitButtons — shared two-row split input (either order, auto-submit)
// Used by chord spelling (note + accidental) and key signatures (number + accidental).
// ---------------------------------------------------------------------------

type SplitButtonItem = { label: string; value: string };

/** A primary value that auto-submits without needing the secondary row. */
type SplitShortcut = { value: string; submit: string };

/** Imperative handle for committing a pending primary selection from outside.
 *  Used by sequential modes so pressing Check submits a tapped letter that
 *  hasn't been paired with an accidental yet. */
export type SplitButtonsFlushRef = {
  current: (() => void) | null;
};

function SplitButtons(
  {
    primaryItems,
    secondaryItems,
    shortcut,
    combine,
    answered,
    onAnswer,
    primaryFeedback,
    secondaryFeedback,
    flushRef,
  }: {
    primaryItems: readonly SplitButtonItem[];
    secondaryItems: readonly SplitButtonItem[];
    shortcut?: SplitShortcut;
    combine: (primary: string, secondary: string) => string;
    answered?: boolean;
    onAnswer: (value: string) => void;
    primaryFeedback?: ButtonFeedback | null;
    secondaryFeedback?: ButtonFeedback | null;
    flushRef?: SplitButtonsFlushRef;
  },
) {
  const [pendingPri, setPendingPri] = useState<string | null>(null);
  const [pendingSec, setPendingSec] = useState<string | null>(null);
  const onAnswerRef = useRef(onAnswer);
  onAnswerRef.current = onAnswer;

  // Clear pending state when answer is consumed
  useEffect(() => {
    if (answered) {
      setPendingPri(null);
      setPendingSec(null);
    }
  }, [answered]);

  // Auto-submit when both selections are made
  useEffect(() => {
    if (pendingPri && pendingSec !== null) {
      onAnswerRef.current(combine(pendingPri, pendingSec));
      setPendingPri(null);
      setPendingSec(null);
    }
  }, [pendingPri, pendingSec, combine]);

  // Expose a "flush pending primary" handle. Used when a parent wants to
  // commit a tapped letter that hasn't been paired with an accidental yet
  // (e.g. user pressed Check before tapping ♮/♯/♭). Treated as natural.
  const flushPending = useCallback(() => {
    if (pendingPri && pendingSec === null) {
      onAnswerRef.current(combine(pendingPri, ''));
      setPendingPri(null);
      setPendingSec(null);
    }
  }, [pendingPri, pendingSec, combine]);
  useEffect(() => {
    if (!flushRef) return;
    flushRef.current = flushPending;
    return () => {
      flushRef.current = null;
    };
  }, [flushPending, flushRef]);

  const handlePri = useCallback((value: string) => {
    if (shortcut && value === shortcut.value) {
      onAnswerRef.current(shortcut.submit);
      setPendingPri(null);
      setPendingSec(null);
      return;
    }
    setPendingPri((prev) => prev === value ? null : value);
  }, [shortcut]);

  const handleSec = useCallback((value: string) => {
    setPendingSec((prev) => prev === value ? null : value);
  }, []);

  const isAnswered = !!answered || !!primaryFeedback || !!secondaryFeedback;

  return (
    <div class='answer-grid-stack'>
      <div class='answer-grid'>
        {primaryItems.map(({ label, value }) => {
          let cls = 'answer-btn';
          if (!isAnswered) {
            if (pendingPri === value) cls += ' answer-btn-pending';
            else if (pendingPri) cls += ' answer-btn-dimmed';
          }
          const disabled = isAnswered ||
            (shortcut && value === shortcut.value && pendingSec !== null);
          if (primaryFeedback) {
            cls += feedbackClass(primaryFeedback, value, label);
          }
          return (
            <button
              type='button'
              tabIndex={0}
              key={value}
              class={cls}
              disabled={!!disabled}
              onClick={() => handlePri(value)}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div class='answer-grid'>
        {secondaryItems.map(({ label, value }) => {
          let cls = 'answer-btn';
          if (!isAnswered) {
            if (pendingSec === value) cls += ' answer-btn-pending';
            else if (pendingSec) cls += ' answer-btn-dimmed';
          }
          const disabled = isAnswered ||
            (shortcut && pendingPri === shortcut.value);
          if (secondaryFeedback) {
            cls += feedbackClass(secondaryFeedback, value, label);
          }
          return (
            <button
              type='button'
              tabIndex={0}
              key={value}
              class={cls}
              disabled={!!disabled}
              onClick={() => handleSec(value)}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SplitNoteButtons — note + accidental (chord spelling)
// ---------------------------------------------------------------------------

const ACCIDENTAL_ITEMS: SplitButtonItem[] = [
  { label: '\u266D', value: 'b' }, // ♭
  { label: '\u266E', value: '' }, // ♮ (natural)
  { label: '\u266F', value: '#' }, // ♯
];
const combineNote = (base: string, acc: string) => acc ? base + acc : base;

export function SplitNoteButtons(
  { onAnswer, answered, flushRef }: {
    onAnswer: (note: string) => void;
    /** When true, buttons are inactive (answer already submitted). */
    answered?: boolean;
    flushRef?: SplitButtonsFlushRef;
  },
) {
  // Computed at render time so labels react to solfège toggle.
  const noteItems: SplitButtonItem[] = NATURAL_NOTES.map((n) => ({
    label: displayNote(n),
    value: n,
  }));
  return (
    <SplitButtons
      primaryItems={noteItems}
      secondaryItems={ACCIDENTAL_ITEMS}
      combine={combineNote}
      answered={answered}
      onAnswer={onAnswer}
      flushRef={flushRef}
    />
  );
}

// ---------------------------------------------------------------------------
// Number buttons
// ---------------------------------------------------------------------------

export function NumberButtons(
  { start, end, onAnswer, narrowing, feedback }: {
    start: number;
    end: number;
    onAnswer?: (num: number) => void;
    /** Set of number strings to highlight as keyboard matches; others dimmed. */
    narrowing?: ReadonlySet<string> | null;
    feedback?: ButtonFeedback | null;
  },
) {
  const nums = [];
  for (let i = start; i <= end; i++) nums.push(i);
  return (
    <div class='answer-grid'>
      {nums.map((i) => {
        const val = String(i);
        let btnCls = 'answer-btn';
        if (narrowing) {
          btnCls += narrowing.has(val) ? ' kb-match' : ' kb-dimmed';
        }
        btnCls += feedbackClass(feedback ?? null, val, val);
        return (
          <button
            type='button'
            tabIndex={0}
            key={i}
            class={btnCls}
            data-num={val}
            onClick={onAnswer ? () => onAnswer(i) : undefined}
          >
            {i}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Interval buttons
// ---------------------------------------------------------------------------

export function IntervalButtons(
  { onAnswer, feedback }: {
    onAnswer?: (interval: string) => void;
    feedback?: ButtonFeedback | null;
  },
) {
  return (
    <div class='answer-grid'>
      {INTERVAL_ABBREVS.map((iv) => {
        let btnCls = 'answer-btn';
        btnCls += feedbackClass(feedback ?? null, iv, iv);
        return (
          <button
            type='button'
            tabIndex={0}
            key={iv}
            class={btnCls}
            data-interval={iv}
            onClick={onAnswer ? () => onAnswer(iv) : undefined}
          >
            {iv}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SplitKeysigButtons — number + sharp/flat (key signatures)
// ---------------------------------------------------------------------------

const KEYSIG_NUMBER_ITEMS: SplitButtonItem[] = [
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
].map((n) => ({ label: n, value: n }));
const KEYSIG_ACC_ITEMS: SplitButtonItem[] = [
  { label: '\u266D', value: 'b' }, // ♭
  { label: '\u266F', value: '#' }, // ♯
];
const combineKeysig = (num: string, acc: string) => num + acc;

/** Parse a keysig value like "2#" into { primary, secondary }. */
function parseKeysig(
  val: string,
): { primary: string; secondary: string } {
  if (val === '0') return { primary: '0', secondary: '' };
  return { primary: val.slice(0, -1), secondary: val.slice(-1) };
}

export function SplitKeysigButtons(
  { onAnswer, feedback }: {
    onAnswer?: (sig: string) => void;
    feedback?: ButtonFeedback | null;
  },
) {
  let primaryFb: ButtonFeedback | null = null;
  let secondaryFb: ButtonFeedback | null = null;
  if (feedback) {
    const parsed = parseKeysig(feedback.userInput);
    const correct = parseKeysig(feedback.displayAnswer);
    primaryFb = {
      correct: parsed.primary === correct.primary,
      userInput: parsed.primary,
      displayAnswer: correct.primary,
    };
    secondaryFb = {
      correct: parsed.secondary === correct.secondary,
      userInput: parsed.secondary,
      displayAnswer: correct.secondary,
    };
  }
  return (
    <SplitButtons
      primaryItems={KEYSIG_NUMBER_ITEMS}
      secondaryItems={KEYSIG_ACC_ITEMS}
      shortcut={{ value: '0', submit: '0' }}
      combine={combineKeysig}
      answered={!!feedback}
      onAnswer={onAnswer ?? (() => {})}
      primaryFeedback={primaryFb}
      secondaryFeedback={secondaryFb}
    />
  );
}

// ---------------------------------------------------------------------------
// SplitNoteQualityButtons — note + chord quality (modal diatonic chords)
// ---------------------------------------------------------------------------

const QUALITY_ITEMS: SplitButtonItem[] = [
  { label: 'Major', value: 'major' },
  { label: 'Minor', value: 'minor' },
  { label: 'Dim', value: 'diminished' },
];
const combineNoteQuality = (note: string, quality: string) =>
  note + ':' + quality;

function parseNoteQuality(
  val: string,
): { primary: string; secondary: string } {
  const idx = val.indexOf(':');
  if (idx < 0) return { primary: val, secondary: '' };
  return { primary: val.slice(0, idx), secondary: val.slice(idx + 1) };
}

export function SplitNoteQualityButtons(
  { onAnswer, useFlats, feedback }: {
    onAnswer?: (val: string) => void;
    useFlats?: boolean;
    feedback?: ButtonFeedback | null;
  },
) {
  const noteItems: SplitButtonItem[] = NOTES.map((n) => ({
    value: n.name,
    label: useFlats !== undefined
      ? displayNote(pickAccidentalName(n.displayName, useFlats))
      : displayNote(n.name),
  }));

  let primaryFb: ButtonFeedback | null = null;
  let secondaryFb: ButtonFeedback | null = null;
  if (feedback) {
    const parsed = parseNoteQuality(feedback.userInput);
    const correct = parseNoteQuality(feedback.displayAnswer);
    primaryFb = {
      correct: parsed.primary === correct.primary,
      userInput: parsed.primary,
      displayAnswer: correct.primary,
    };
    secondaryFb = {
      correct: parsed.secondary === correct.secondary,
      userInput: parsed.secondary,
      displayAnswer: correct.secondary,
    };
  }
  return (
    <SplitButtons
      primaryItems={noteItems}
      secondaryItems={QUALITY_ITEMS}
      combine={combineNoteQuality}
      answered={!!feedback}
      onAnswer={onAnswer ?? (() => {})}
      primaryFeedback={primaryFb}
      secondaryFeedback={secondaryFb}
    />
  );
}

// ---------------------------------------------------------------------------
// Scale degree buttons
// ---------------------------------------------------------------------------

export function DegreeButtons(
  { onAnswer, feedback }: {
    onAnswer?: (degree: string) => void;
    feedback?: ButtonFeedback | null;
  },
) {
  return (
    <div class='answer-grid'>
      {DEGREE_LABELS.map(([val, label]) => {
        let btnCls = 'answer-btn';
        btnCls += feedbackClass(feedback ?? null, val, label);
        return (
          <button
            type='button'
            tabIndex={0}
            key={val}
            class={btnCls}
            data-degree={val}
            onClick={onAnswer ? () => onAnswer(val) : undefined}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Roman numeral buttons
// ---------------------------------------------------------------------------

export function NumeralButtons(
  { onAnswer, feedback }: {
    onAnswer?: (numeral: string) => void;
    feedback?: ButtonFeedback | null;
  },
) {
  return (
    <div class='answer-grid'>
      {ROMAN_NUMERALS.map((n) => {
        let btnCls = 'answer-btn';
        btnCls += feedbackClass(feedback ?? null, n, n);
        return (
          <button
            type='button'
            tabIndex={0}
            key={n}
            class={btnCls}
            data-numeral={n}
            onClick={onAnswer ? () => onAnswer(n) : undefined}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
