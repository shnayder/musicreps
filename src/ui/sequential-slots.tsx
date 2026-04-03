// SequentialSlots — card-style response area for sequential input modes.
// Shows a dashed placeholder for the next note and filled slots as notes are
// entered. After evaluation, per-entry feedback (correct/wrong) is shown,
// with corrections aligned below wrong entries. An invisible correction row
// reserves space so the card never jumps on feedback.

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

  // Build correction row aligned to the top row: one span per entry slot.
  // Correct entries get an invisible spacer; wrong/missing get the right note.
  // Extra entries beyond the correct answer get empty spacers too.
  const showCorrection = (anyWrong || countMismatch) && !!correctTones;
  const tones = correctTones ?? [];
  const correctionCount = showCorrection
    ? Math.max(entries.length, tones.length)
    : 0;

  // Pad missing slots so both rows have equal column count after evaluation.
  const missingCount = showCorrection
    ? Math.max(0, tones.length - entries.length)
    : 0;

  return (
    <div class='seq-slots-container seq-card'>
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
        {/* Empty spacer slots for missing entries (user entered too few) */}
        {Array.from(
          { length: missingCount },
          (_, i) => <span key={`m${i}`} class='seq-slot'>&nbsp;</span>,
        )}
        {!evaluated && <span class='seq-slot seq-placeholder' />}
      </div>
      {showCorrection
        ? (
          <div class='seq-correct-row'>
            {Array.from({ length: correctionCount }, (_, i) => {
              const tone = tones[i];
              const wasCorrect = evaluated && i < evaluated.length &&
                evaluated[i].correct;
              return (!tone || wasCorrect)
                ? <span key={i} class='seq-correct-note'>&nbsp;</span>
                : <span key={i} class='seq-correct-note'>{tone}</span>;
            })}
          </div>
        )
        : (
          <div
            class='seq-correct-row'
            aria-hidden='true'
            style='visibility:hidden'
          >
            <span class='seq-correct-note'>&nbsp;</span>
          </div>
        )}
    </div>
  );
}
