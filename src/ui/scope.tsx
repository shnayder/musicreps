// Scope control components: progress bars for practice scope display.

import { Text } from './text.tsx';

// ---------------------------------------------------------------------------
// GroupProgressBar — segmented bar showing per-item mastery colors
// ---------------------------------------------------------------------------

export function GroupProgressBar(
  { colors, disabled }: { colors: string[]; disabled?: boolean },
) {
  return (
    <div class={'group-progress-bar' + (disabled ? ' skipped' : '')}>
      {colors.map((color, i) => (
        <div class='group-bar-slice' key={i} style={`background:${color}`} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProgressBarLabeled — labeled progress bar with border, for skill header
// and level progress cards. Distinct from the bare GroupProgressBar used
// on home screen cards.
// ---------------------------------------------------------------------------

export function ProgressBarLabeled(
  { label, colors, disabled, plain }: {
    label?: string;
    colors: string[];
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
      <GroupProgressBar colors={colors} disabled={disabled} />
    </div>
  );
}
