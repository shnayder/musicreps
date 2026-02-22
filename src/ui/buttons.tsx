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
// Note answer buttons (12-note grid)
// ---------------------------------------------------------------------------

export function NoteButtons(
  { onAnswer, hidden, useFlats, calibrationActive }: {
    onAnswer?: (note: string) => void;
    hidden?: boolean;
    /** When set, accidental buttons show flats (true) or sharps (false). */
    useFlats?: boolean;
    /** Add .calibration-active class (keeps buttons visible during calibration). */
    calibrationActive?: boolean;
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
        return (
          <button
            type='button'
            key={n}
            class='answer-btn answer-btn-note'
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
  { onAnswer, hideAccidentals }: {
    onAnswer?: (note: string) => void;
    hideAccidentals?: boolean;
  },
) {
  return (
    <div class='note-buttons'>
      <div class='note-row-accidentals'>
        {ACCIDENTAL_NAMES.map((n) => (
          <button
            type='button'
            key={n}
            class={'note-btn accidental' + (hideAccidentals ? ' hidden' : '')}
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
            key={n}
            class='note-btn'
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
  { start, end, onAnswer, hidden }: {
    start: number;
    end: number;
    onAnswer?: (num: number) => void;
    hidden?: boolean;
  },
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
          key={i}
          class='answer-btn answer-btn-num'
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
  { onAnswer, hidden }: {
    onAnswer?: (interval: string) => void;
    hidden?: boolean;
  },
) {
  const cls = 'answer-buttons answer-buttons-intervals' +
    (hidden ? ' answer-group-hidden' : '');
  return (
    <div class={cls}>
      {INTERVAL_ABBREVS.map((iv) => (
        <button
          type='button'
          key={iv}
          class='answer-btn answer-btn-interval'
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
  { onAnswer, hidden }: { onAnswer?: (sig: string) => void; hidden?: boolean },
) {
  const cls = 'answer-buttons answer-buttons-keysig' +
    (hidden ? ' answer-group-hidden' : '');
  return (
    <div class={cls}>
      {KEYSIG_LABELS.map((s) => (
        <button
          type='button'
          key={s}
          class='answer-btn answer-btn-keysig'
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
  { onAnswer, hidden }: {
    onAnswer?: (degree: string) => void;
    hidden?: boolean;
  },
) {
  const cls = 'answer-buttons answer-buttons-degrees' +
    (hidden ? ' answer-group-hidden' : '');
  return (
    <div class={cls}>
      {DEGREE_LABELS.map(([val, label]) => (
        <button
          type='button'
          key={val}
          class='answer-btn answer-btn-degree'
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
  { onAnswer, hidden }: {
    onAnswer?: (numeral: string) => void;
    hidden?: boolean;
  },
) {
  const cls = 'answer-buttons answer-buttons-numerals' +
    (hidden ? ' answer-group-hidden' : '');
  return (
    <div class={cls}>
      {ROMAN_NUMERALS.map((n) => (
        <button
          type='button'
          key={n}
          class='answer-btn answer-btn-numeral'
          data-numeral={n}
          onClick={onAnswer ? () => onAnswer(n) : undefined}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
