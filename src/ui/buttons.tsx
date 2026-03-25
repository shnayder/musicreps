// Answer button components: Preact equivalents of html-helpers button generators.
// Each emits the same CSS class names as the build-time HTML for style parity.

import { useCallback, useEffect, useRef, useState } from 'preact/hooks';

import {
  ACCIDENTAL_NAMES,
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
// Note answer buttons (12-note grid)
// ---------------------------------------------------------------------------

export function NoteButtons(
  { onAnswer, useFlats, narrowing, feedback }: {
    onAnswer?: (note: string) => void;
    /** When set, accidental buttons show flats (true) or sharps (false). */
    useFlats?: boolean;
    /** Set of note names to highlight as keyboard matches; others dimmed. */
    narrowing?: ReadonlySet<string> | null;
    feedback?: ButtonFeedback | null;
  },
) {
  const cls = 'answer-buttons answer-buttons-notes';
  return (
    <div class={cls}>
      {NOTE_NAMES.map((n) => {
        let label: string;
        if (useFlats !== undefined) {
          const note = NOTES.find((x) => x.name === n);
          label = note
            ? displayNote(pickAccidentalName(note.displayName, useFlats))
            : displayNote(n);
        } else {
          label = displayNote(n);
        }
        let btnCls = 'answer-btn answer-btn-note';
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
    <div class='split-note-buttons'>
      <div class='split-note-row-base'>
        {NATURAL_NOTES.map((n) => {
          let cls = 'split-note-btn split-note-base';
          if (effective === n) cls += ' split-note-pending';
          else if (effective) cls += ' split-note-dimmed';
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
        class={'split-note-row-accidentals' +
          (showAccidentals ? '' : ' split-note-acc-hidden')}
      >
        {ACCIDENTALS_SINGLE.map(({ label, suffix }) => (
          <button
            type='button'
            tabIndex={0}
            key={label}
            class='split-note-btn split-note-acc'
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
// Piano-layout note buttons (fretboard modes)
// ---------------------------------------------------------------------------

export function PianoNoteButtons(
  { onAnswer, hideAccidentals, narrowing, feedback }: {
    onAnswer?: (note: string) => void;
    hideAccidentals?: boolean;
    /** Set of note names to highlight as keyboard matches; others dimmed. */
    narrowing?: ReadonlySet<string> | null;
    feedback?: ButtonFeedback | null;
  },
) {
  return (
    <div class='note-buttons'>
      <div class='note-row-accidentals'>
        {ACCIDENTAL_NAMES.map((n) => {
          const label = displayNote(n);
          let cls = 'note-btn accidental' + (hideAccidentals ? ' hidden' : '');
          if (narrowing && !hideAccidentals) {
            cls += narrowing.has(n) ? ' kb-match' : ' kb-dimmed';
          }
          cls += feedbackClass(feedback ?? null, n, label);
          return (
            <button
              type='button'
              tabIndex={0}
              key={n}
              class={cls}
              data-note={n}
              onClick={onAnswer ? () => onAnswer(n) : undefined}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div class='note-row-naturals'>
        {NATURAL_NOTES.map((n) => {
          const label = displayNote(n);
          let cls = 'note-btn';
          if (narrowing) {
            cls += narrowing.has(n) ? ' kb-match' : ' kb-dimmed';
          }
          cls += feedbackClass(feedback ?? null, n, label);
          return (
            <button
              type='button'
              tabIndex={0}
              key={n}
              class={cls}
              data-note={n}
              onClick={onAnswer ? () => onAnswer(n) : undefined}
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
  const cls = 'answer-buttons answer-buttons-numbers';
  return (
    <div class={cls}>
      {nums.map((i) => {
        const val = String(i);
        let btnCls = 'answer-btn answer-btn-num';
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
  const cls = 'answer-buttons answer-buttons-intervals';
  return (
    <div class={cls}>
      {INTERVAL_ABBREVS.map((iv) => {
        let btnCls = 'answer-btn answer-btn-interval';
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
    <div class='split-keysig-row-numbers'>
      {KEYSIG_NUMBERS.map((n) => {
        let cls = 'split-keysig-btn split-keysig-num';
        if (!answered) {
          if (pendingNum === n) cls += ' split-keysig-pending';
          else if (pendingNum) cls += ' split-keysig-dimmed';
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
    <div class='split-keysig-row-accidentals'>
      {KEYSIG_ACCIDENTALS.map(({ label, suffix }) => {
        let cls = 'split-keysig-btn split-keysig-acc';
        if (!answered) {
          if (pendingAcc === suffix) cls += ' split-keysig-pending';
          else if (pendingAcc) cls += ' split-keysig-dimmed';
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
  const cls = 'split-keysig-buttons';

  return (
    <div class={cls}>
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
  const cls = 'answer-buttons answer-buttons-degrees';
  return (
    <div class={cls}>
      {DEGREE_LABELS.map(([val, label]) => {
        let btnCls = 'answer-btn answer-btn-degree';
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
  const cls = 'answer-buttons answer-buttons-numerals';
  return (
    <div class={cls}>
      {ROMAN_NUMERALS.map((n) => {
        let btnCls = 'answer-btn answer-btn-numeral';
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
