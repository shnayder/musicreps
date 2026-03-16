// Text — structural recipe for the type hierarchy.
// Maps a content role to the correct font-size/weight/color recipe so
// callers say "subsection-header" instead of picking CSS classes manually.

import type { ComponentChildren } from 'preact';

export type TextRole =
  | 'section-header'
  | 'subsection-header'
  | 'label'
  | 'secondary'
  | 'caption'
  | 'metric';

export function Text(
  { role, children, class: extra, as: Tag = 'span', ...rest }: {
    role: TextRole;
    children: ComponentChildren;
    class?: string;
    as?: 'span' | 'div' | 'p' | 'h1' | 'h2' | 'h3';
    [key: string]: unknown;
  },
) {
  const cls = 'text-' + role + (extra ? ' ' + extra : '');
  return <Tag class={cls} {...rest}>{children}</Tag>;
}
