// MetricCard + MetricsBar — body-level stat display.
// Small card showing a centered value (largish) with a label below.
// MetricsBar arranges cards side-by-side with equal widths.

import type { ComponentChildren } from 'preact';

export function MetricCard(
  { value, label }: {
    value: ComponentChildren;
    label: ComponentChildren;
  },
) {
  return (
    <div class='card metric-card'>
      <span class='metric-card-value'>{value}</span>
      <span class='metric-card-label'>{label}</span>
    </div>
  );
}

export function MetricsBar(
  { children }: { children: ComponentChildren },
) {
  return <div class='metrics-bar'>{children}</div>;
}
