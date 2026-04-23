// MetricCard + MetricsBar — body-level stat display.
// Small card showing a centered value (largish) with a label below.
// MetricsBar arranges cards side-by-side with equal widths.

import type { ComponentChildren } from 'preact';
import { Text } from './text.tsx';

export function MetricCard(
  { value, label }: {
    value: ComponentChildren;
    label: ComponentChildren;
  },
) {
  return (
    <div class='card metric-card'>
      <Text role='metric-card' as='span'>{value}</Text>
      <span class='metric-card-label'>{label}</span>
    </div>
  );
}

export function MetricsBar(
  { children }: { children: ComponentChildren },
) {
  return <div class='metrics-bar'>{children}</div>;
}
