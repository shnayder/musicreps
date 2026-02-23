// Quiz UI components: prompt, feedback, and countdown bar.
// Emits the same CSS class names as the build-time HTML in html-helpers.ts.

import { getUseSolfege } from '../music-data.ts';

// ---------------------------------------------------------------------------
// TextPrompt — quiz question text
// ---------------------------------------------------------------------------

export function TextPrompt({ text }: { text: string }) {
  return <div class='quiz-prompt'>{text}</div>;
}

// ---------------------------------------------------------------------------
// FeedbackDisplay — correct/incorrect feedback, time, and hint
// ---------------------------------------------------------------------------

export function FeedbackDisplay(
  { text, className, time, hint }: {
    text: string;
    className: string;
    time?: string;
    hint?: string;
  },
) {
  return (
    <>
      <div class={className}>{text}</div>
      {time ? <div class='time-display'>{time}</div> : null}
      {hint ? <div class='hint'>{hint}</div> : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// KeyboardHint — discoverable keyboard shortcut help, hidden on touch devices
// ---------------------------------------------------------------------------

/** Answer types that have keyboard support. */
export type KeyboardHintType =
  | 'note'
  | 'number-0-11'
  | 'number-1-12'
  | null;

const NOTE_HINT_LETTER = 'Keyboard: C D E … or C# Db \u2014 Enter to confirm';
const NOTE_HINT_SOLFEGE =
  'Keyboard: do re mi … or do# reb \u2014 Enter to confirm';

const HINT_TEXT: Record<string, string> = {
  'number-0-11': 'Keyboard: 0\u20139, 10, 11 \u2014 Enter to confirm',
  'number-1-12': 'Keyboard: 1\u20139, 10, 11, 12 \u2014 Enter to confirm',
};

export function KeyboardHint(
  { type }: { type: KeyboardHintType },
) {
  if (!type) return null;
  const text = type === 'note'
    ? (getUseSolfege() ? NOTE_HINT_SOLFEGE : NOTE_HINT_LETTER)
    : HINT_TEXT[type];
  return <div class='keyboard-hint'>{text}</div>;
}

// ---------------------------------------------------------------------------
// CountdownBar — round timer countdown
// ---------------------------------------------------------------------------

export function CountdownBar(
  { pct, warning, lastQuestion }: {
    pct: number;
    warning?: boolean;
    lastQuestion?: boolean;
  },
) {
  let cls = 'quiz-countdown-bar';
  if (warning) cls += ' round-timer-warning';
  if (lastQuestion) cls += ' last-question';
  return (
    <div class={cls}>
      <div class='quiz-countdown-fill' style={{ width: `${pct}%` }} />
    </div>
  );
}
