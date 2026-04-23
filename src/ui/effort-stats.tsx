// EffortStatsLine — shared "N today · N total · N day(s)" stats row.
// Rendered in the home header and in each skill's progress-tab "Overall"
// section. Keeping one component keeps the two displays in lockstep.

import { Bar } from './layout.tsx';
import { Text } from './text.tsx';

export function EffortStatsLine(
  { repsToday, totalReps, daysActive }: {
    repsToday: number;
    totalReps: number;
    daysActive: number;
  },
) {
  return (
    <Bar gap='group' class='effort-stats-bar'>
      <span class='effort-stat'>
        <Text role='metric-header' as='span'>
          {repsToday.toLocaleString()}
        </Text>
        {' today'}
      </span>
      <span class='effort-stat-sep' aria-hidden='true'>&middot;</span>
      <span class='effort-stat'>
        <Text role='metric-header' as='span'>
          {totalReps.toLocaleString()}
        </Text>
        {' total'}
      </span>
      <span class='effort-stat-sep' aria-hidden='true'>&middot;</span>
      <span class='effort-stat'>
        <Text role='metric-header' as='span'>
          {daysActive.toLocaleString()}
        </Text>
        {daysActive === 1 ? ' day' : ' days'}
      </span>
    </Bar>
  );
}
