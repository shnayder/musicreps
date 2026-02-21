// Answer button components: Preact equivalents of html-helpers button generators.
// Each emits the same CSS class names as the build-time HTML for style parity.

import { displayNote, NOTES, pickAccidentalName } from '../music-data.ts';

const ALL_NOTES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];
const ACCIDENTALS = ['C#', 'D#', 'F#', 'G#', 'A#'];
const NATURALS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const INTERVALS = [
  'm2',
  'M2',
  'm3',
  'M3',
  'P4',
  'TT',
  'P5',
  'm6',
  'M6',
  'm7',
  'M7',
  'P8',
];
const KEYSIGS = [
  '0',
  '1#',
  '2#',
  '3#',
  '4#',
  '5#',
  '6#',
  '7#',
  '1b',
  '2b',
  '3b',
  '4b',
  '5b',
  '6b',
  '7b',
];
const DEGREES: [string, string][] = [
  ['1', '1st'],
  ['2', '2nd'],
  ['3', '3rd'],
  ['4', '4th'],
  ['5', '5th'],
  ['6', '6th'],
  ['7', '7th'],
];
const NUMERALS = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii\u00B0'];

// ---------------------------------------------------------------------------
// Note answer buttons (12-note grid)
// ---------------------------------------------------------------------------

export function NoteButtons(
  { onAnswer, hidden, useFlats }: {
    onAnswer?: (note: string) => void;
    hidden?: boolean;
    /** When set, accidental buttons show flats (true) or sharps (false). */
    useFlats?: boolean;
  },
) {
  const cls = 'answer-buttons answer-buttons-notes' +
    (hidden ? ' answer-group-hidden' : '');
  return (
    <div class={cls}>
      {ALL_NOTES.map((n) => {
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
        {ACCIDENTALS.map((n) => (
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
        {NATURALS.map((n) => (
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
      {INTERVALS.map((iv) => (
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
      {KEYSIGS.map((s) => (
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
      {DEGREES.map(([val, label]) => (
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
      {NUMERALS.map((n) => (
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
