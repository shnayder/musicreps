// Answer button components: Preact equivalents of html-helpers button generators.
// Each emits the same CSS class names as the build-time HTML for style parity.

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
// Shared feedback props — all button components accept these for flash feedback
// ---------------------------------------------------------------------------

type FeedbackProps = {
  /** Raw value of the correct button (highlights green). */
  correctValue?: string;
  /** Raw value of the wrong button the user tapped (highlights red). */
  wrongValue?: string;
};

function feedbackClass(value: string, fb: FeedbackProps): string {
  if (fb.correctValue === value) return ' btn-correct';
  if (fb.wrongValue !== undefined && fb.wrongValue === value) {
    return ' btn-wrong';
  }
  return '';
}

// ---------------------------------------------------------------------------
// Note answer buttons (12-note grid)
// ---------------------------------------------------------------------------

export function NoteButtons(
  { onAnswer, hidden, useFlats, calibrationActive, correctValue, wrongValue }: {
    onAnswer?: (note: string) => void;
    hidden?: boolean;
    /** When set, accidental buttons show flats (true) or sharps (false). */
    useFlats?: boolean;
    /** Add .calibration-active class (keeps buttons visible during calibration). */
    calibrationActive?: boolean;
  } & FeedbackProps,
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
        return (
          <button
            type='button'
            tabIndex={0}
            key={n}
            class={'answer-btn answer-btn-note' +
              feedbackClass(n, { correctValue, wrongValue })}
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
// Piano-layout note buttons (fretboard modes)
// ---------------------------------------------------------------------------

export function PianoNoteButtons(
  { onAnswer, hideAccidentals, correctValue, wrongValue }: {
    onAnswer?: (note: string) => void;
    hideAccidentals?: boolean;
  } & FeedbackProps,
) {
  return (
    <div class='note-buttons'>
      <div class='note-row-accidentals'>
        {ACCIDENTAL_NAMES.map((n) => (
          <button
            type='button'
            tabIndex={0}
            key={n}
            class={'note-btn accidental' +
              (hideAccidentals ? ' hidden' : '') +
              feedbackClass(n, { correctValue, wrongValue })}
            data-note={n}
            onClick={onAnswer ? () => onAnswer(n) : undefined}
          >
            {displayNote(n)}
          </button>
        ))}
      </div>
      <div class='note-row-naturals'>
        {NATURAL_NOTES.map((n) => (
          <button
            type='button'
            tabIndex={0}
            key={n}
            class={'note-btn' +
              feedbackClass(n, { correctValue, wrongValue })}
            data-note={n}
            onClick={onAnswer ? () => onAnswer(n) : undefined}
          >
            {displayNote(n)}
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
  { start, end, onAnswer, hidden, correctValue, wrongValue }: {
    start: number;
    end: number;
    onAnswer?: (num: number) => void;
    hidden?: boolean;
  } & FeedbackProps,
) {
  const nums = [];
  for (let i = start; i <= end; i++) nums.push(i);
  const cls = 'answer-buttons answer-buttons-numbers' +
    (hidden ? ' answer-group-hidden' : '');
  return (
    <div class={cls}>
      {nums.map((i) => (
        <button
          type='button'
          tabIndex={0}
          key={i}
          class={'answer-btn answer-btn-num' +
            feedbackClass(String(i), { correctValue, wrongValue })}
          data-num={String(i)}
          onClick={onAnswer ? () => onAnswer(i) : undefined}
        >
          {i}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Interval buttons
// ---------------------------------------------------------------------------

export function IntervalButtons(
  { onAnswer, hidden, correctValue, wrongValue }: {
    onAnswer?: (interval: string) => void;
    hidden?: boolean;
  } & FeedbackProps,
) {
  const cls = 'answer-buttons answer-buttons-intervals' +
    (hidden ? ' answer-group-hidden' : '');
  return (
    <div class={cls}>
      {INTERVAL_ABBREVS.map((iv) => (
        <button
          type='button'
          tabIndex={0}
          key={iv}
          class={'answer-btn answer-btn-interval' +
            feedbackClass(iv, { correctValue, wrongValue })}
          data-interval={iv}
          onClick={onAnswer ? () => onAnswer(iv) : undefined}
        >
          {iv}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Key signature buttons
// ---------------------------------------------------------------------------

export function KeysigButtons(
  { onAnswer, hidden, correctValue, wrongValue }:
    & { onAnswer?: (sig: string) => void; hidden?: boolean }
    & FeedbackProps,
) {
  const cls = 'answer-buttons answer-buttons-keysig' +
    (hidden ? ' answer-group-hidden' : '');
  return (
    <div class={cls}>
      {KEYSIG_LABELS.map((s) => (
        <button
          type='button'
          tabIndex={0}
          key={s}
          class={'answer-btn answer-btn-keysig' +
            feedbackClass(s, { correctValue, wrongValue })}
          data-sig={s}
          onClick={onAnswer ? () => onAnswer(s) : undefined}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scale degree buttons
// ---------------------------------------------------------------------------

export function DegreeButtons(
  { onAnswer, hidden, correctValue, wrongValue }: {
    onAnswer?: (degree: string) => void;
    hidden?: boolean;
  } & FeedbackProps,
) {
  const cls = 'answer-buttons answer-buttons-degrees' +
    (hidden ? ' answer-group-hidden' : '');
  return (
    <div class={cls}>
      {DEGREE_LABELS.map(([val, label]) => (
        <button
          type='button'
          tabIndex={0}
          key={val}
          class={'answer-btn answer-btn-degree' +
            feedbackClass(val, { correctValue, wrongValue })}
          data-degree={val}
          onClick={onAnswer ? () => onAnswer(val) : undefined}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Roman numeral buttons
// ---------------------------------------------------------------------------

export function NumeralButtons(
  { onAnswer, hidden, correctValue, wrongValue }: {
    onAnswer?: (numeral: string) => void;
    hidden?: boolean;
  } & FeedbackProps,
) {
  const cls = 'answer-buttons answer-buttons-numerals' +
    (hidden ? ' answer-group-hidden' : '');
  return (
    <div class={cls}>
      {ROMAN_NUMERALS.map((n) => (
        <button
          type='button'
          tabIndex={0}
          key={n}
          class={'answer-btn answer-btn-numeral' +
            feedbackClass(n, { correctValue, wrongValue })}
          data-numeral={n}
          onClick={onAnswer ? () => onAnswer(n) : undefined}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
