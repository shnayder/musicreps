// Scope control components: progress bars for practice scope display.

import { useState } from 'preact/hooks';
import type { ProgressSegment } from '../stats-display.ts';
import { SpeedLevelModal } from './speed-level-legend.tsx';
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
// and level progress cards. Tapping opens a speed level legend modal.
// ---------------------------------------------------------------------------

export function ProgressBarLabeled(
  { label, segments, disabled, plain }: {
    label?: string;
    segments: ProgressSegment[];
    disabled?: boolean;
    plain?: boolean;
  },
) {
  const [legendOpen, setLegendOpen] = useState(false);
  const cls = plain ? 'progress-bar-plain' : 'progress-bar-labeled';
  return (
    <>
      <div
        class={cls + ' progress-bar-tappable'}
        onClick={() => setLegendOpen(true)}
        role='button'
        tabIndex={0}
      >
        {label && (
          <Text role='label' as='div' class='progress-bar-label'>
            {label}
          </Text>
        )}
        <GroupProgressBar segments={segments} disabled={disabled} />
      </div>
      <SpeedLevelModal
        open={legendOpen}
        onClose={() => setLegendOpen(false)}
      />
    </>
  );
}
