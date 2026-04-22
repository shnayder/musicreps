// Scope control components: progress bars for practice scope display.

import { useState } from 'preact/hooks';
import type { ProgressSegment } from '../stats-display.ts';
import {
  type ProgressBarKind,
  SpeedLevelModal,
} from './speed-level-legend.tsx';
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
    <div class={'level-progress-bar' + (disabled ? ' skipped' : '')}>
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
  {
    label,
    segments,
    disabled,
    plain,
    kind = 'single-level',
    baseline = null,
  }: {
    label?: string;
    segments: ProgressSegment[];
    disabled?: boolean;
    plain?: boolean;
    /** Whether the bar shows one segment per level or per item. */
    kind?: ProgressBarKind;
    /** Motor baseline in ms (null = default). Used in legend modal. */
    baseline?: number | null;
  },
) {
  const [legendOpen, setLegendOpen] = useState(false);
  const cls = plain ? 'progress-bar-plain' : 'progress-bar-labeled';
  return (
    <>
      <button
        type='button'
        class={cls + ' progress-bar-tappable'}
        onClick={() => setLegendOpen(true)}
        aria-label={label
          ? `${label}. Tap for speed level legend.`
          : 'Tap for speed level legend'}
      >
        {label && (
          <Text role='label' as='div' class='progress-bar-label'>
            {label}
          </Text>
        )}
        <GroupProgressBar segments={segments} disabled={disabled} />
      </button>
      <SpeedLevelModal
        open={legendOpen}
        onClose={() => setLegendOpen(false)}
        kind={kind}
        baseline={baseline}
      />
    </>
  );
}
