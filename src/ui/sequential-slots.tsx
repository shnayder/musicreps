// SequentialSlots — shared progress indicator for sequential response modes.
// Shows slots that fill as the user enters answers, with deferred feedback
// (all slots evaluated at once after the last input).

import type { SequentialEntryResult } from '../declarative/types.ts';

/**
 * Render sequential input slots with deferred per-entry feedback.
 *
 * During input: filled slots show what the user entered, the next empty
 * slot is highlighted as active.
 *
 * After evaluation: each slot turns green (correct) or red (wrong).
 * If any are wrong, the correct answers are shown below.
 */
export function SequentialSlots(
  { expectedCount, entries, evaluated, correctTones }: {
    expectedCount: number;
    /** User's entries so far (display form). */
    entries: { display: string }[];
    /** Per-entry evaluation results. Null before evaluation. */
    evaluated: SequentialEntryResult[] | null;
    /** Correct tones to show when any entry is wrong (already display-formatted). */
    correctTones: string[] | null;
  },
) {
  const anyWrong = evaluated?.some((e) => !e.correct) ?? false;

  return (
    <div class='seq-slots-container'>
      <div class='seq-slots'>
        {Array.from({ length: expectedCount }, (_, i) => {
          let cls = 'seq-slot';
          let content = '\u00A0';
          if (evaluated && i < evaluated.length) {
            // Post-evaluation: show evaluated display with green/red
            content = evaluated[i].display;
            cls += evaluated[i].correct ? ' correct' : ' wrong';
          } else if (i < entries.length) {
            // Pre-evaluation: show what user entered
            content = entries[i].display;
            cls += ' filled';
          } else if (i === entries.length) {
            cls += ' active';
          }
          return <span key={i} class={cls}>{content}</span>;
        })}
      </div>
      {anyWrong && correctTones && (
        <div class='seq-correct-row'>
          {correctTones.map((t, i) => (
            <span key={i} class='seq-correct-note'>{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}
