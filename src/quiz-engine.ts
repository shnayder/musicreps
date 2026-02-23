// Quiz engine utilities: keyboard handlers, note button labels, and
// calibration helpers. Used by Preact mode components and the
// useQuizEngine hook.

import { displayNote, getUseSolfege, NOTE_NAMES, NOTES } from './music-data.ts';
import type { NoteKeyHandler } from './types.ts';

/** Set of note names in the standard 12-button grid. */
const NOTE_NAME_SET = new Set(NOTE_NAMES);

/** Delay (ms) before auto-submitting when multiple completions remain. */
export const PENDING_DELAY_AMBIGUOUS = 600;
/** Delay (ms) before auto-submitting when input is unambiguous (single match).
 *  Currently all note letters and buffered digits produce multiple matches,
 *  so this branch doesn't fire — kept for clarity and future input types. */
export const PENDING_DELAY_UNAMBIGUOUS = 400;

/**
 * Map from flat spelling (e.g. "Db") to its button name (e.g. "C#").
 * Built from NOTES.accepts so we highlight the enharmonic button when the
 * user might follow a letter with 'b'.
 */
const FLAT_TO_BUTTON: Record<string, string> = {};
for (const note of NOTES) {
  for (const a of note.accepts) {
    if (a.endsWith('b') && a.length === 2) {
      // 'db' → 'C#' — capitalize the flat spelling for lookup
      FLAT_TO_BUTTON[a[0].toUpperCase() + 'b'] = note.name;
    }
  }
}

/**
 * Compute the set of button note names matching a pending keyboard note.
 * Includes the natural note, its sharp (if present), and the enharmonic
 * button reachable via flat spelling (e.g. pending "A" → {A, A#, G#}
 * because the user might type Ab which maps to the G# button).
 * Returns null when there is no pending note.
 */
export function noteNarrowingSet(
  pendingNote: string | null,
): ReadonlySet<string> | null {
  if (!pendingNote) return null;
  const matches = new Set<string>();
  matches.add(pendingNote);
  const sharp = pendingNote + '#';
  if (NOTE_NAME_SET.has(sharp)) matches.add(sharp);
  const flatButton = FLAT_TO_BUTTON[pendingNote + 'b'];
  if (flatButton) matches.add(flatButton);
  return matches;
}

/**
 * Compute the set of number button strings matching a pending digit.
 * For digit 1 in 0-11: {1, 10, 11}. For digit 1 in 1-12: {1, 10, 11, 12}.
 * Returns null when there is no pending digit.
 */
export function numberNarrowingSet(
  pendingDigit: number | null,
  end: number,
  start = 0,
): ReadonlySet<string> | null {
  if (pendingDigit === null) return null;
  const matches = new Set<string>();
  if (pendingDigit >= start && pendingDigit <= end) {
    matches.add(String(pendingDigit));
  }
  // Multi-digit completions (pendingDigit * 10 + d)
  for (let d = 0; d <= 9; d++) {
    const num = pendingDigit * 10 + d;
    if (num > end) break;
    if (num >= start) matches.add(String(num));
  }
  return matches;
}

/**
 * Create a keyboard handler for note input (C D E F G A B + #/s/b for accidentals).
 * Used by any mode where the answer is a note name.
 *
 * The handler keeps an internal timeout to allow a short window after a note key
 * is pressed for an accidental key (`#` / `b`) to be entered. Callers should
 * invoke `reset()` when the quiz stops and before restarting to clear any pending
 * note and prevent stale input from being submitted after the quiz has ended.
 */
export function createNoteKeyHandler(
  submitAnswer: (note: string) => void,
  allowAccidentals: () => boolean = () => true,
  onPendingChange?: (pendingNote: string | null) => void,
): NoteKeyHandler {
  let pendingNote: string | null = null;
  let pendingTimeout: number | null = null;

  function setPending(note: string | null): void {
    pendingNote = note;
    onPendingChange?.(note);
  }

  function reset(): void {
    if (pendingTimeout) clearTimeout(pendingTimeout);
    setPending(null);
    pendingTimeout = null;
  }

  function handleKey(e: KeyboardEvent): boolean {
    const key = e.key.toUpperCase();

    // Enter commits the pending note immediately (skip pending wait)
    if (e.key === 'Enter' && pendingNote) {
      e.preventDefault();
      if (pendingTimeout) clearTimeout(pendingTimeout);
      const note = pendingNote;
      setPending(null);
      pendingTimeout = null;
      submitAnswer(note);
      return true;
    }

    // Handle #/s for sharps or b for flats after a pending note
    if (pendingNote && allowAccidentals()) {
      if (
        e.key === '#' || e.key === 's' || e.key === 'S' ||
        (e.shiftKey && e.key === '3')
      ) {
        e.preventDefault();
        if (pendingTimeout) clearTimeout(pendingTimeout);
        const note = pendingNote;
        setPending(null);
        pendingTimeout = null;
        submitAnswer(note + '#');
        return true;
      }
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        if (pendingTimeout) clearTimeout(pendingTimeout);
        const note = pendingNote;
        setPending(null);
        pendingTimeout = null;
        submitAnswer(note + 'b');
        return true;
      }
    }

    if ('CDEFGAB'.includes(key)) {
      e.preventDefault();
      if (pendingTimeout) clearTimeout(pendingTimeout);

      if (!allowAccidentals()) {
        submitAnswer(key);
      } else {
        setPending(key);
        const delay = noteNarrowingSet(key)!.size > 1
          ? PENDING_DELAY_AMBIGUOUS
          : PENDING_DELAY_UNAMBIGUOUS;
        pendingTimeout = setTimeout(() => {
          const note = pendingNote!;
          setPending(null);
          pendingTimeout = null;
          submitAnswer(note);
        }, delay);
      }
      return true;
    }

    return false;
  }

  function getPendingNote(): string | null {
    return pendingNote;
  }

  return { handleKey, reset, getPendingNote };
}

/**
 * Create a keyboard handler for solfège input (Do Re Mi Fa Sol La Si + #/b).
 * Case-insensitive. Buffers two characters to identify the syllable, then
 * waits for an optional accidental. All syllables are unambiguous after 2 chars.
 */
export function createSolfegeKeyHandler(
  submitAnswer: (note: string) => void,
  allowAccidentals: () => boolean = () => true,
  onPendingChange?: (pendingNote: string | null) => void,
): NoteKeyHandler {
  const SOLFEGE_TO_NOTE: Record<string, string> = {
    'do': 'C',
    're': 'D',
    'mi': 'E',
    'fa': 'F',
    'so': 'G',
    'la': 'A',
    'si': 'B',
  };
  const FIRST_CHARS = new Set(['d', 'r', 'm', 'f', 's', 'l']);

  let buffer: string = '';
  let pendingNote: string | null = null;
  let pendingTimeout: number | null = null;

  function setPending(note: string | null): void {
    pendingNote = note;
    onPendingChange?.(note);
  }

  function reset(): void {
    buffer = '';
    if (pendingTimeout) clearTimeout(pendingTimeout);
    pendingTimeout = null;
    setPending(null);
  }

  function submitPending(): void {
    if (pendingNote) {
      if (pendingTimeout) clearTimeout(pendingTimeout);
      const note = pendingNote;
      setPending(null);
      pendingTimeout = null;
      submitAnswer(note);
    }
  }

  function handleKey(e: KeyboardEvent): boolean {
    const key = e.key.toLowerCase();

    // Enter commits the pending note immediately (skip pending wait)
    if (e.key === 'Enter') {
      if (pendingNote) {
        e.preventDefault();
        if (pendingTimeout) clearTimeout(pendingTimeout);
        const note = pendingNote;
        setPending(null);
        pendingTimeout = null;
        submitAnswer(note);
        return true;
      }
      // Clear partial syllable buffer without submitting
      if (buffer.length > 0) {
        buffer = '';
        return true;
      }
      return false;
    }

    // Handle accidental after resolved syllable
    if (pendingNote && allowAccidentals()) {
      if (e.key === '#' || (e.shiftKey && e.key === '3')) {
        e.preventDefault();
        if (pendingTimeout) clearTimeout(pendingTimeout);
        const note = pendingNote;
        setPending(null);
        pendingTimeout = null;
        submitAnswer(note + '#');
        return true;
      }
      // 'b' is flat (no solfège syllable starts with 'b')
      if (key === 'b') {
        e.preventDefault();
        if (pendingTimeout) clearTimeout(pendingTimeout);
        const note = pendingNote;
        setPending(null);
        pendingTimeout = null;
        submitAnswer(note + 'b');
        return true;
      }
    }

    // Submit any pending note before starting new input
    if (pendingNote && FIRST_CHARS.has(key)) {
      submitPending();
    }

    // Continue building syllable
    if (buffer.length > 0) {
      e.preventDefault();
      buffer += key;
      const note = SOLFEGE_TO_NOTE[buffer];
      if (note) {
        buffer = '';
        if (!allowAccidentals()) {
          submitAnswer(note);
        } else {
          setPending(note);
          const delay = noteNarrowingSet(note)!.size > 1
            ? PENDING_DELAY_AMBIGUOUS
            : PENDING_DELAY_UNAMBIGUOUS;
          pendingTimeout = setTimeout(() => {
            const n = pendingNote!;
            setPending(null);
            pendingTimeout = null;
            submitAnswer(n);
          }, delay);
        }
      } else if (buffer.length >= 2) {
        // Invalid pair — reset
        buffer = '';
      }
      return true;
    }

    // Start new syllable
    if (FIRST_CHARS.has(key)) {
      e.preventDefault();
      // Submit any pending note first
      submitPending();
      buffer = key;
      return true;
    }

    return false;
  }

  function getPendingNote(): string | null {
    return pendingNote;
  }

  return { handleKey, reset, getPendingNote };
}

/**
 * Adaptive key handler: delegates to letter or solfège handler based on
 * current notation mode. Drop-in replacement for createNoteKeyHandler.
 */
export function createAdaptiveKeyHandler(
  submitAnswer: (note: string) => void,
  allowAccidentals: () => boolean = () => true,
  onPendingChange?: (pendingNote: string | null) => void,
): NoteKeyHandler {
  const letterHandler = createNoteKeyHandler(
    submitAnswer,
    allowAccidentals,
    onPendingChange,
  );
  const solfegeHandler = createSolfegeKeyHandler(
    submitAnswer,
    allowAccidentals,
    onPendingChange,
  );

  return {
    handleKey(e: KeyboardEvent): boolean {
      return getUseSolfege()
        ? solfegeHandler.handleKey(e)
        : letterHandler.handleKey(e);
    },
    reset(): void {
      letterHandler.reset();
      solfegeHandler.reset();
    },
    getPendingNote(): string | null {
      return getUseSolfege()
        ? solfegeHandler.getPendingNote()
        : letterHandler.getPendingNote();
    },
  };
}

/**
 * Update all note button labels in a container to reflect current notation mode.
 * Handles .answer-btn-note, .note-btn, and .string-toggle elements.
 */
export function refreshNoteButtonLabels(container: HTMLElement): void {
  container.querySelectorAll<HTMLButtonElement>('.answer-btn-note').forEach(
    function (btn) {
      const note = NOTES.find(function (n) {
        return n.name === btn.dataset.note;
      });
      if (note) btn.textContent = displayNote(note.name);
    },
  );
  container.querySelectorAll<HTMLButtonElement>('.note-btn').forEach(
    function (btn) {
      const noteName = btn.dataset.note;
      if (noteName) btn.textContent = displayNote(noteName);
    },
  );
  container.querySelectorAll<HTMLButtonElement>('.string-toggle').forEach(
    function (btn) {
      const stringNote = btn.dataset.stringNote;
      if (stringNote) btn.textContent = displayNote(stringNote);
    },
  );
}

/**
 * Build human-readable threshold descriptions from a motor baseline.
 * Used by the calibration results screen.
 */
export function getCalibrationThresholds(
  baseline: number,
): { label: string; maxMs: number | null; meaning: string }[] {
  return [
    {
      label: 'Automatic',
      maxMs: Math.round(baseline * 1.5),
      meaning: 'Fully memorized — instant recall',
    },
    {
      label: 'Good',
      maxMs: Math.round(baseline * 3.0),
      meaning: 'Solid recall, minor hesitation',
    },
    {
      label: 'Developing',
      maxMs: Math.round(baseline * 4.5),
      meaning: 'Working on it — needs practice',
    },
    {
      label: 'Slow',
      maxMs: Math.round(baseline * 6.0),
      meaning: 'Significant hesitation',
    },
    { label: 'Very slow', maxMs: null, meaning: 'Not yet learned' },
  ];
}

/**
 * Pick a random calibration button, weighted toward accidentals ~35% of the time.
 * Shared helper for mode getCalibrationTrialConfig implementations.
 */
export function pickCalibrationButton(
  buttons: HTMLElement[],
  prevBtn: HTMLElement | null,
  rng?: () => number,
): HTMLElement {
  const rand = rng || Math.random;
  const sharpBtns = buttons.filter((b) => {
    const note = b.dataset.note;
    return note && note.includes('#');
  });
  const naturalBtns = buttons.filter((b) => {
    const note = b.dataset.note;
    return note && !note.includes('#');
  });

  // ~35% chance of sharp if available
  const useSharp = sharpBtns.length > 0 && rand() < 0.35;
  const pool = useSharp
    ? sharpBtns
    : (naturalBtns.length > 0 ? naturalBtns : buttons);

  let btn;
  do {
    btn = pool[Math.floor(rand() * pool.length)];
  } while (btn === prevBtn && pool.length > 1);
  return btn;
}
