// Quiz UI components: prompt, feedback, and countdown bar.
// Emits the same CSS class names as the build-time HTML in html-helpers.ts.

import { getUseSolfege } from '../music-data.ts';
import { ActionButton } from './action-button.tsx';
import { Text } from './text.tsx';

// ---------------------------------------------------------------------------
// TextPrompt — quiz question text
// ---------------------------------------------------------------------------

export function TextPrompt({ text }: { text: string }) {
  return <Text role='quiz-prompt' as='div' class='quiz-prompt'>{text}</Text>;
}

// ---------------------------------------------------------------------------
// FeedbackDisplay — correct/incorrect feedback and hint
// ---------------------------------------------------------------------------

export function FeedbackDisplay(
  { text, className, hint, correct, onNext, onCheck, label = 'Next', notice }: {
    text: string;
    className: string;
    hint?: string;
    correct?: boolean | null;
    onNext?: () => void;
    /** Show a "Check" button for free-entry modes (sequential/multi-tap). */
    onCheck?: () => void;
    label?: string;
    /** Non-interactive notice shown when there's no action button. */
    notice?: string;
  },
) {
  let extraCls = 'next-btn';
  if (correct === true) extraCls += ' page-action-correct';
  else if (correct === false) extraCls += ' page-action-wrong';

  // Determine which button to show:
  // 1. After answer: Next button
  // 2. Before answer with entries: Check button
  // 3. Notice only (e.g. "Last question"): notice text
  // 4. Otherwise: hidden placeholder
  let button;
  if (notice && !onNext && !onCheck) {
    button = <div class='feedback-notice'>{notice}</div>;
  } else if (onNext) {
    button = (
      <ActionButton variant='primary' class={extraCls} onClick={onNext}>
        {label}
      </ActionButton>
    );
  } else if (onCheck) {
    button = notice
      ? (
        <div class='page-action-row'>
          <span class='page-action-notice'>{notice}</span>
          <ActionButton variant='primary' onClick={onCheck}>
            Check
          </ActionButton>
        </div>
      )
      : (
        <ActionButton variant='primary' class='next-btn' onClick={onCheck}>
          Check
        </ActionButton>
      );
  } else {
    button = (
      <ActionButton
        variant='primary'
        class='next-btn'
        onClick={() => {}}
        style={{ visibility: 'hidden' }}
      >
        {label}
      </ActionButton>
    );
  }

  return (
    <>
      <div class={className + ' sr-only'} aria-live='polite'>{text}</div>
      {button}
      <div
        class='hint'
        style={hint ? undefined : { visibility: 'hidden' }}
      >
        {hint || '\u00A0'}
      </div>
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

const NOTE_HINT_LETTER = 'C D E, c d e, C#, fs (=F#), Db, bb (=Bb)';
const NOTE_HINT_SOLFEGE = 'do re mi, Do Re Mi, do#, reb';

const HINT_TEXT: Record<string, string> = {
  'number-0-11': '0\u20139, 10, 11',
  'number-1-12': '1\u20139, 10, 11, 12',
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
