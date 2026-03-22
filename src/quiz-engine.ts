// Quiz engine utilities: keyboard handlers, note button labels, and
// calibration helpers. Used by Preact mode components and the
// useQuizEngine hook.

import { displayNote, getUseSolfege, NOTE_NAMES, NOTES } from './music-data.ts';
import type { NoteKeyHandler } from './types.ts';

/** Set of note names in the standard 12-button grid. */
const NOTE_NAME_SET = new Set(NOTE_NAMES);

/** Delay (ms) before auto-submitting when multiple completions remain. */
export const PENDING_DELAY_AMBIGUOUS = 600;
/** Delay (ms) before auto-submitting when input is unambiguous (single match). */
export const PENDING_DELAY_UNAMBIGUOUS = 400;

/**
 * Map from flat spelling (e.g. "Db") to its button name (e.g. "C#").
 */
const FLAT_TO_BUTTON: Record<string, string> = {};
for (const note of NOTES) {
  for (const a of note.accepts) {
    if (a.endsWith('b') && a.length === 2) {
      FLAT_TO_BUTTON[a[0].toUpperCase() + 'b'] = note.name;
    }
  }
}

/**
 * Compute the set of button note names matching a pending keyboard note.
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
  for (let d = 0; d <= 9; d++) {
    const num = pendingDigit * 10 + d;
    if (num > end) break;
    if (num >= start) matches.add(String(num));
  }
  return matches;
}

// ---------------------------------------------------------------------------
// PendingNoteManager — shared pending-note + accidental resolution
// ---------------------------------------------------------------------------

type PendingNoteState = {
  pendingNote: string | null;
  pendingTimeout: number | null;
};

/**
 * Manages the pending-note-with-accidental pattern shared by both
 * letter and solfège key handlers. Handles timeout, accidental keys
 * (#/s/b), and Enter to commit immediately.
 */
function createPendingNoteManager(
  submitAnswer: (note: string) => void,
  allowAccidentals: () => boolean,
  onPendingChange?: (pendingNote: string | null) => void,
) {
  const state: PendingNoteState = { pendingNote: null, pendingTimeout: null };

  function setPending(note: string | null): void {
    state.pendingNote = note;
    onPendingChange?.(note);
  }

  function reset(): void {
    if (state.pendingTimeout) clearTimeout(state.pendingTimeout);
    setPending(null);
    state.pendingTimeout = null;
  }

  function submitPending(): void {
    if (state.pendingNote) {
      if (state.pendingTimeout) clearTimeout(state.pendingTimeout);
      const note = state.pendingNote;
      setPending(null);
      state.pendingTimeout = null;
      submitAnswer(note);
    }
  }

  /** Handle Enter to commit pending note. Returns true if handled. */
  function handleEnter(e: KeyboardEvent): boolean {
    if (e.key !== 'Enter' || !state.pendingNote) return false;
    e.preventDefault();
    submitPending();
    return true;
  }

  /** Handle accidental keys after a pending note. Returns true if handled. */
  function handleAccidental(e: KeyboardEvent): boolean {
    if (!state.pendingNote || !allowAccidentals()) return false;
    const key = e.key.toLowerCase();

    if (
      e.key === '#' || e.key === 's' || e.key === 'S' ||
      (e.shiftKey && e.key === '3')
    ) {
      e.preventDefault();
      if (state.pendingTimeout) clearTimeout(state.pendingTimeout);
      const note = state.pendingNote;
      setPending(null);
      state.pendingTimeout = null;
      submitAnswer(note + '#');
      return true;
    }
    if (key === 'b') {
      e.preventDefault();
      if (state.pendingTimeout) clearTimeout(state.pendingTimeout);
      const note = state.pendingNote;
      setPending(null);
      state.pendingTimeout = null;
      submitAnswer(note + 'b');
      return true;
    }
    return false;
  }

  /** Set a pending note with auto-submit timeout. */
  function setPendingWithTimeout(note: string): void {
    if (state.pendingTimeout) clearTimeout(state.pendingTimeout);
    if (!allowAccidentals()) {
      submitAnswer(note);
      return;
    }
    setPending(note);
    const delay = noteNarrowingSet(note)!.size > 1
      ? PENDING_DELAY_AMBIGUOUS
      : PENDING_DELAY_UNAMBIGUOUS;
    state.pendingTimeout = setTimeout(() => {
      const n = state.pendingNote!;
      setPending(null);
      state.pendingTimeout = null;
      submitAnswer(n);
    }, delay);
  }

  return {
    state,
    reset,
    submitPending,
    handleEnter,
    handleAccidental,
    setPendingWithTimeout,
    getPendingNote: () => state.pendingNote,
  };
}

// ---------------------------------------------------------------------------
// Note key handler (letter mode: C D E F G A B)
// ---------------------------------------------------------------------------

export function createNoteKeyHandler(
  submitAnswer: (note: string) => void,
  allowAccidentals: () => boolean = () => true,
  onPendingChange?: (pendingNote: string | null) => void,
): NoteKeyHandler {
  const pm = createPendingNoteManager(
    submitAnswer,
    allowAccidentals,
    onPendingChange,
  );

  function handleKey(e: KeyboardEvent): boolean {
    if (pm.handleEnter(e)) return true;
    if (pm.handleAccidental(e)) return true;

    const key = e.key.toUpperCase();
    if ('CDEFGAB'.includes(key)) {
      e.preventDefault();
      pm.setPendingWithTimeout(key);
      return true;
    }
    return false;
  }

  return { handleKey, reset: pm.reset, getPendingNote: pm.getPendingNote };
}

// ---------------------------------------------------------------------------
// Solfège key handler (Do Re Mi Fa Sol La Si)
// ---------------------------------------------------------------------------

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

  const pm = createPendingNoteManager(
    submitAnswer,
    allowAccidentals,
    onPendingChange,
  );
  let buffer = '';

  function handleKey(e: KeyboardEvent): boolean {
    const key = e.key.toLowerCase();

    // Enter commits pending or clears partial buffer
    if (e.key === 'Enter') {
      if (pm.handleEnter(e)) return true;
      if (buffer.length > 0) {
        buffer = '';
        return true;
      }
      return false;
    }

    if (pm.handleAccidental(e)) return true;

    // Submit pending before starting new input
    if (pm.state.pendingNote && FIRST_CHARS.has(key)) pm.submitPending();

    // Continue building syllable
    if (buffer.length > 0) {
      e.preventDefault();
      buffer += key;
      const note = SOLFEGE_TO_NOTE[buffer];
      if (note) {
        buffer = '';
        pm.setPendingWithTimeout(note);
      } else if (buffer.length >= 2) {
        buffer = '';
      }
      return true;
    }

    // Start new syllable
    if (FIRST_CHARS.has(key)) {
      e.preventDefault();
      pm.submitPending();
      buffer = key;
      return true;
    }

    return false;
  }

  function reset(): void {
    buffer = '';
    pm.reset();
  }

  return { handleKey, reset, getPendingNote: pm.getPendingNote };
}

// ---------------------------------------------------------------------------
// Adaptive key handler (delegates to letter or solfège based on setting)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Note button label refresh
// ---------------------------------------------------------------------------

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
  container.querySelectorAll<HTMLButtonElement>('.split-note-base').forEach(
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

// ---------------------------------------------------------------------------
// Calibration helpers
// ---------------------------------------------------------------------------

export type CalibrationThreshold = {
  label: string;
  maxMs: number | null;
  meaning: string;
  colorToken: string;
};

export function getCalibrationThresholds(
  baseline: number,
): CalibrationThreshold[] {
  return [
    {
      label: 'Automatic',
      maxMs: Math.round(baseline * 1.5),
      meaning: 'Fully memorized \u2014 instant recall',
      colorToken: '--heatmap-5',
    },
    {
      label: 'Solid',
      maxMs: Math.round(baseline * 3.0),
      meaning: 'Solid recall, minor hesitation',
      colorToken: '--heatmap-4',
    },
    {
      label: 'Learning',
      maxMs: Math.round(baseline * 4.5),
      meaning: 'Working on it \u2014 needs practice',
      colorToken: '--heatmap-3',
    },
    {
      label: 'Hesitant',
      maxMs: Math.round(baseline * 6.0),
      meaning: 'Significant hesitation',
      colorToken: '--heatmap-2',
    },
    {
      label: 'Starting',
      maxMs: null,
      meaning: 'Not yet learned',
      colorToken: '--heatmap-1',
    },
  ];
}

/**
 * Pick a random note name for calibration trials.
 * 65% naturals, 35% sharps. No consecutive repeats.
 */
export function pickCalibrationNote(
  prevNote: string | null,
  rng?: () => number,
): string {
  const rand = rng || Math.random;
  const naturals = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const sharps = ['C#', 'D#', 'F#', 'G#', 'A#'];
  const useSharp = rand() < 0.35;
  const pool = useSharp ? sharps : naturals;
  let note;
  do {
    note = pool[Math.floor(rand() * pool.length)];
  } while (note === prevNote && pool.length > 1);
  return note;
}
