// Scope control components: progress bars for practice scope display.

import type { ProgressSegment } from '../stats-display.ts';
import { Text } from './text.tsx';

// ---------------------------------------------------------------------------
// GroupProgressBar — segmented bar showing per-item mastery colors.
// Segments pack left: each slice's flex = weight, and a trailing spacer
// absorbs the remaining space so unfilled portions show as background.
// ---------------------------------------------------------------------------

export function GroupProgressBar(
  { segments, disabled }: { segments: ProgressSegment[]; disabled?: boolean },
) {
  const totalSlots = segments.length;
  const usedFlex = segments.reduce((sum, s) => sum + s.weight, 0);
  const spacerFlex = totalSlots - usedFlex;
  return (
    <div class={'group-progress-bar' + (disabled ? ' skipped' : '')}>
      {segments.map((seg, i) =>
        seg.weight > 0
          ? (
            <div
              class='group-bar-slice'
              key={i}
              style={`flex:${seg.weight};background:${seg.color}`}
            />
          )
          : null
      )}
      {spacerFlex > 0 && (
        <div class='group-bar-slice' style={`flex:${spacerFlex}`} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProgressBarLabeled — labeled progress bar with border, for skill header
// and level progress cards. Distinct from the bare GroupProgressBar used
// on home screen cards.
// ---------------------------------------------------------------------------

export function ProgressBarLabeled(
  { label, segments, disabled, plain }: {
    label?: string;
    segments: ProgressSegment[];
    disabled?: boolean;
    plain?: boolean;
  },
) {
  const cls = plain ? 'progress-bar-plain' : 'progress-bar-labeled';
  return (
    <div class={cls}>
      {label && (
        <Text role='label' as='div' class='progress-bar-label'>
          {label}
        </Text>
      )}
      <GroupProgressBar segments={segments} disabled={disabled} />
    </div>
  );
}
