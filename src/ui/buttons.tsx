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
 *  Both fields are normalized to canonical button values by GenericMode
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
  { onAnswer, useFlats, hideAccidentals, narrowing, feedback }: {
    onAnswer?: (note: string) => void;
    /** When set, accidental buttons show flats (true) or sharps (false). */
    useFlats?: boolean;
    /** When true, render only 7 natural notes instead of all 12. */
    hideAccidentals?: boolean;
    /** Set of note names to highlight as keyboard matches; others dimmed. */
    narrowing?: ReadonlySet<string> | null;
    feedback?: ButtonFeedback | null;
  },
) {
  const notes = hideAccidentals ? NATURAL_NOTES : NOTE_NAMES;
  return (
    <div class='answer-grid'>
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
// Split note buttons: base note row + accidental row (two-step input)
// ---------------------------------------------------------------------------

const ACCIDENTALS_SINGLE = [
  { label: '\u266D', suffix: 'b' }, // ♭
  { label: '\u266E', suffix: '' }, // ♮ (natural)
  { label: '\u266F', suffix: '#' }, // ♯
] as const;

export function SplitNoteButtons(
  { onAnswer, sequential, pendingNote, answered }: {
    onAnswer: (note: string) => void;
    /** Enable chain-submit: tapping a new base note auto-submits the pending
     *  note as natural. Only meaningful in sequential modes (Chord Spelling). */
    sequential?: boolean;
    /** Pending note from keyboard input — used to sync visual state. */
    pendingNote?: string | null;
    /** When true, buttons are inactive (answer already submitted). */
    answered?: boolean;
  },
) {
  const [pendingBase, setPendingBase] = useState<string | null>(null);
  const onAnswerRef = useRef(onAnswer);
  onAnswerRef.current = onAnswer;

  // Sync: clear button pending state when keyboard sets a pending note
  // (keyboard takes over), or when answered.
  useEffect(() => {
    if (pendingNote || answered) setPendingBase(null);
  }, [pendingNote, answered]);

  const handleBase = useCallback((note: string) => {
    setPendingBase((prev) => {
      if (prev === note) {
        // Double-tap: confirm natural
        onAnswerRef.current(note);
        return null;
      }
      if (prev && sequential) {
        // Chain: submit previous as natural, start new pending
        onAnswerRef.current(prev);
      }
      return note;
    });
  }, [sequential]);

  const pendingNoteRef = useRef(pendingNote);
  pendingNoteRef.current = pendingNote;

  const handleAccidental = useCallback((suffix: string) => {
    setPendingBase((prev) => {
      // Use button pending first, fall back to keyboard pending
      const base = prev ?? pendingNoteRef.current;
      if (!base) return null;
      onAnswerRef.current(suffix ? base + suffix : base);
      return null;
    });
  }, []);

  // The effective pending state: button tap OR keyboard
  const effective = pendingBase ?? pendingNote ?? null;
  const showAccidentals = effective !== null && !answered;

  return (
    <div class='answer-grid-stack'>
      <div class='answer-grid'>
        {NATURAL_NOTES.map((n) => {
          let cls = 'answer-btn';
          if (effective === n) cls += ' answer-btn-pending';
          else if (effective) cls += ' answer-btn-dimmed';
          return (
            <button
              type='button'
              tabIndex={0}
              key={n}
              class={cls}
              data-note={n}
              disabled={answered}
              onClick={() => handleBase(n)}
            >
              {displayNote(n)}
            </button>
          );
        })}
      </div>
      <div
        class={'answer-grid' +
          (showAccidentals ? '' : ' answer-grid-acc-hidden')}
      >
        {ACCIDENTALS_SINGLE.map(({ label, suffix }) => (
          <button
            type='button'
            tabIndex={0}
            key={label}
            class='answer-btn'
            data-accidental={suffix || 'natural'}
            disabled={!showAccidentals}
            onClick={() => handleAccidental(suffix)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
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
// Split key-signature buttons (number + sharp/flat, either order)
// ---------------------------------------------------------------------------

const KEYSIG_NUMBERS = ['0', '1', '2', '3', '4', '5', '6', '7'] as const;
const KEYSIG_ACCIDENTALS = [
  { label: '\u266D', suffix: 'b' }, // ♭
  { label: '\u266F', suffix: '#' }, // ♯
] as const;

/** Parse a keysig value like "2#" into { num, suffix }. */
function parseKeysig(val: string): { num: string; suffix: string } {
  if (val === '0') return { num: '0', suffix: '' };
  const num = val.slice(0, -1);
  const suffix = val.slice(-1);
  return { num, suffix };
}

type KeysigFeedbackParts = {
  fb: ButtonFeedback;
  parsed: { num: string; suffix: string };
  correctParsed: { num: string; suffix: string };
};

function KeysigNumberRow(
  { pendingNum, pendingAcc, answered, fbParts, onTap }: {
    pendingNum: string | null;
    pendingAcc: string | null;
    answered: boolean;
    fbParts: KeysigFeedbackParts | null;
    onTap: (n: string) => void;
  },
) {
  return (
    <div class='answer-grid'>
      {KEYSIG_NUMBERS.map((n) => {
        let cls = 'answer-btn';
        if (!answered) {
          if (pendingNum === n) cls += ' answer-btn-pending';
          else if (pendingNum) cls += ' answer-btn-dimmed';
        }
        const disabled = answered || (n === '0' && pendingAcc !== null);
        if (fbParts) {
          const numFb: ButtonFeedback = {
            correct: fbParts.fb.correct,
            userInput: fbParts.parsed.num,
            displayAnswer: fbParts.correctParsed.num,
          };
          cls += feedbackClass(numFb, n, n);
        }
        return (
          <button
            type='button'
            tabIndex={0}
            key={n}
            class={cls}
            data-sig-num={n}
            disabled={disabled}
            onClick={() => onTap(n)}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

function KeysigAccidentalRow(
  { pendingNum, pendingAcc, answered, fbParts, onTap }: {
    pendingNum: string | null;
    pendingAcc: string | null;
    answered: boolean;
    fbParts: KeysigFeedbackParts | null;
    onTap: (suffix: string) => void;
  },
) {
  return (
    <div class='answer-grid'>
      {KEYSIG_ACCIDENTALS.map(({ label, suffix }) => {
        let cls = 'answer-btn';
        if (!answered) {
          if (pendingAcc === suffix) cls += ' answer-btn-pending';
          else if (pendingAcc) cls += ' answer-btn-dimmed';
        }
        const disabled = answered || pendingNum === '0';
        if (fbParts) {
          const accFb: ButtonFeedback = {
            correct: fbParts.fb.correct,
            userInput: fbParts.parsed.suffix,
            displayAnswer: fbParts.correctParsed.suffix,
          };
          cls += feedbackClass(accFb, suffix, label);
        }
        return (
          <button
            type='button'
            tabIndex={0}
            key={suffix}
            class={cls}
            data-sig-acc={suffix}
            disabled={disabled}
            onClick={() => onTap(suffix)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function SplitKeysigButtons(
  { onAnswer, feedback }: {
    onAnswer?: (sig: string) => void;
    feedback?: ButtonFeedback | null;
  },
) {
  const [pendingNum, setPendingNum] = useState<string | null>(null);
  const [pendingAcc, setPendingAcc] = useState<string | null>(null);
  const onAnswerRef = useRef(onAnswer);
  onAnswerRef.current = onAnswer;

  // Auto-submit when both selections are made
  useEffect(() => {
    if (pendingNum && pendingAcc) {
      onAnswerRef.current?.(pendingNum + pendingAcc);
      setPendingNum(null);
      setPendingAcc(null);
    }
  }, [pendingNum, pendingAcc]);

  // Reset pending state when feedback arrives (new question)
  const prevFeedback = useRef(feedback);
  useEffect(() => {
    if (feedback !== prevFeedback.current) {
      prevFeedback.current = feedback;
      if (!feedback) {
        setPendingNum(null);
        setPendingAcc(null);
      }
    }
  }, [feedback]);

  const handleNum = useCallback((n: string) => {
    if (n === '0') {
      onAnswerRef.current?.('0');
      setPendingNum(null);
      setPendingAcc(null);
      return;
    }
    setPendingNum((prev) => prev === n ? null : n);
  }, []);

  const handleAcc = useCallback((suffix: string) => {
    setPendingAcc((prev) => prev === suffix ? null : suffix);
  }, []);

  const fbParts: KeysigFeedbackParts | null = feedback
    ? {
      fb: feedback,
      parsed: parseKeysig(feedback.userInput),
      correctParsed: parseKeysig(feedback.displayAnswer),
    }
    : null;

  const answered = !!feedback;

  return (
    <div class='answer-grid-stack'>
      <KeysigNumberRow
        pendingNum={pendingNum}
        pendingAcc={pendingAcc}
        answered={answered}
        fbParts={fbParts}
        onTap={handleNum}
      />
      <KeysigAccidentalRow
        pendingNum={pendingNum}
        pendingAcc={pendingAcc}
        answered={answered}
        fbParts={fbParts}
        onTap={handleAcc}
      />
    </div>
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
