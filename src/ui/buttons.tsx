// Answer button components: Preact equivalents of html-helpers button generators.
// Each emits the same CSS class names as the build-time HTML for style parity.

import { useCallback, useEffect, useRef, useState } from 'preact/hooks';

import {
  ACCIDENTAL_NAMES,
  DEGREE_LABELS,
  displayNote,
  INTERVAL_ABBREVS,
  KEYSIG_LABELS,
  NATURAL_NOTES,
  NOTE_NAMES,
  NOTES,
  pickAccidentalName,
  ROMAN_NUMERALS,
} from '../music-data.ts';

// ---------------------------------------------------------------------------
// Feedback state for button highlighting after answer
// ---------------------------------------------------------------------------

export type ButtonFeedback = {
  correct: boolean;
  /** Raw input value the user submitted (button value). */
  userInput: string;
  /** Display-form correct answer (matched against button labels). */
  displayAnswer: string;
};

/** Compute feedback CSS class for a button given its value and display label. */
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
    if (buttonLabel === feedback.displayAnswer) return ' btn-feedback-reveal';
  }
  return '';
}

// ---------------------------------------------------------------------------
// Note answer buttons (12-note grid)
// ---------------------------------------------------------------------------

export function NoteButtons(
  { onAnswer, hidden, useFlats, calibrationActive, narrowing, feedback }: {
    onAnswer?: (note: string) => void;
    hidden?: boolean;
    /** When set, accidental buttons show flats (true) or sharps (false). */
    useFlats?: boolean;
    /** Add .calibration-active class (keeps buttons visible during calibration). */
    calibrationActive?: boolean;
    /** Set of note names to highlight as keyboard matches; others dimmed. */
    narrowing?: ReadonlySet<string> | null;
    feedback?: ButtonFeedback | null;
  },
) {
  const cls = 'answer-buttons answer-buttons-notes' +
    (hidden ? ' answer-group-hidden' : '') +
    (calibrationActive ? ' calibration-active' : '');
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

  const handleAccidental = useCallback((suffix: string) => {
    setPendingBase((prev) => {
      if (!prev) return null;
      onAnswerRef.current(suffix ? prev + suffix : prev);
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
  { start, end, onAnswer, hidden, narrowing, feedback }: {
    start: number;
    end: number;
    onAnswer?: (num: number) => void;
    hidden?: boolean;
    /** Set of number strings to highlight as keyboard matches; others dimmed. */
    narrowing?: ReadonlySet<string> | null;
    feedback?: ButtonFeedback | null;
  },
) {
  const nums = [];
  for (let i = start; i <= end; i++) nums.push(i);
  const cls = 'answer-buttons answer-buttons-numbers' +
    (hidden ? ' answer-group-hidden' : '');
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
  { onAnswer, hidden, feedback }: {
    onAnswer?: (interval: string) => void;
    hidden?: boolean;
    feedback?: ButtonFeedback | null;
  },
) {
  const cls = 'answer-buttons answer-buttons-intervals' +
    (hidden ? ' answer-group-hidden' : '');
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
// Key signature buttons
// ---------------------------------------------------------------------------

export function KeysigButtons(
  { onAnswer, hidden, feedback }: {
    onAnswer?: (sig: string) => void;
    hidden?: boolean;
    feedback?: ButtonFeedback | null;
  },
) {
  const cls = 'answer-buttons answer-buttons-keysig' +
    (hidden ? ' answer-group-hidden' : '');
  return (
    <div class={cls}>
      {KEYSIG_LABELS.map((s) => {
        let btnCls = 'answer-btn answer-btn-keysig';
        btnCls += feedbackClass(feedback ?? null, s, s);
        return (
          <button
            type='button'
            tabIndex={0}
            key={s}
            class={btnCls}
            data-sig={s}
            onClick={onAnswer ? () => onAnswer(s) : undefined}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scale degree buttons
// ---------------------------------------------------------------------------

export function DegreeButtons(
  { onAnswer, hidden, feedback }: {
    onAnswer?: (degree: string) => void;
    hidden?: boolean;
    feedback?: ButtonFeedback | null;
  },
) {
  const cls = 'answer-buttons answer-buttons-degrees' +
    (hidden ? ' answer-group-hidden' : '');
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
  { onAnswer, hidden, feedback }: {
    onAnswer?: (numeral: string) => void;
    hidden?: boolean;
    feedback?: ButtonFeedback | null;
  },
) {
  const cls = 'answer-buttons answer-buttons-numerals' +
    (hidden ? ' answer-group-hidden' : '');
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
