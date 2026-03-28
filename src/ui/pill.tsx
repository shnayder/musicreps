// Pill — shared badge/tag component with variant styling.

import type { ComponentChildren } from 'preact';

export function Pill(
  { variant, children }: {
    variant?: string;
    children: ComponentChildren;
  },
) {
  const cls = variant ? `pill pill-${variant}` : 'pill';
  return <span class={cls}>{children}</span>;
}
