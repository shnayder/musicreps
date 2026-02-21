// Quiz UI components: prompt, feedback, and countdown bar.
// Emits the same CSS class names as the build-time HTML in html-helpers.ts.

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
