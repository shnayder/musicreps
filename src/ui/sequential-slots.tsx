// SequentialSlots — shows what the user has entered so far for sequential
// response modes. No empty placeholders — the user doesn't know the expected
// count. After evaluation, per-entry feedback (correct/wrong) is shown,
// and if any are wrong the correct answer appears below.

import type { SequentialEntryResult } from '../declarative/types.ts';

/**
 * Render the user's sequential entries with deferred per-entry feedback.
 *
 * During input: filled slots show what the user entered so far.
 * After evaluation: each slot turns green (correct) or red (wrong).
 * If any are wrong, the correct answers are shown below.
 */
export function SequentialSlots(
  { entries, evaluated, correctTones }: {
    /** User's entries so far (display form). */
    entries: { display: string }[];
    /** Per-entry evaluation results. Null before evaluation. */
    evaluated: SequentialEntryResult[] | null;
    /** Correct tones to show when any entry is wrong (already display-formatted). */
    correctTones: string[] | null;
  },
) {
  const anyWrong = evaluated?.some((e) => !e.correct) ?? false;
  // Also wrong if user entered a different number of notes than expected
  const countMismatch = !!(evaluated && correctTones &&
    entries.length !== correctTones.length);

  return (
    <div class='seq-slots-container'>
      <div class='seq-slots'>
        {entries.map((entry, i) => {
          let cls = 'seq-slot';
          let content: string;
          if (evaluated && i < evaluated.length) {
            content = evaluated[i].display;
            cls += evaluated[i].correct ? ' correct' : ' wrong';
          } else {
            content = entry.display;
            cls += ' filled';
          }
          return <span key={i} class={cls}>{content}</span>;
        })}
      </div>
      {(anyWrong || countMismatch) && correctTones && (
        <div class='seq-correct-row'>
          {correctTones.map((t, i) => (
            <span key={i} class='seq-correct-note'>{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}
