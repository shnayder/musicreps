// Layout primitives: Stack, Card, Well, Section.
// Composable building blocks that own spacing and containment,
// so children don't need one-off margin classes.

import type { ComponentChildren } from 'preact';
import { Text } from './text.tsx';
import type { TextRole } from './text.tsx';

// ---------------------------------------------------------------------------
// Stack — flex column with a semantic gap
// ---------------------------------------------------------------------------

/** Semantic gap names mapped to CSS custom properties. */
export type StackGap =
  | 'micro' // --gap-micro  (2px)  — sub-element coupling
  | 'related' // --gap-related (4px)  — related siblings
  | 'group' // --gap-group  (12px) — distinct groups
  | 'component' // --pad-component (16px) — card-internal sections
  | 'region' // --pad-region (24px) — layout region breaks
  | 'section'; // --gap-section (32px) — page-level separators

export function Stack(
  { gap, children, class: extra, as: Tag = 'div' }: {
    gap: StackGap;
    children: ComponentChildren;
    class?: string;
    as?: 'div' | 'section' | 'nav' | 'fieldset';
  },
) {
  const cls = 'stack stack-' + gap + (extra ? ' ' + extra : '');
  return <Tag class={cls}>{children}</Tag>;
}

// ---------------------------------------------------------------------------
// Bar — flex row with a semantic gap (horizontal counterpart of Stack)
// ---------------------------------------------------------------------------

export function Bar(
  { gap, children, class: extra, as: Tag = 'div' }: {
    gap: StackGap;
    children: ComponentChildren;
    class?: string;
    as?: 'div' | 'section' | 'nav' | 'span';
  },
) {
  const cls = 'bar bar-' + gap + (extra ? ' ' + extra : '');
  return <Tag class={cls}>{children}</Tag>;
}

// ---------------------------------------------------------------------------
// Card — container surface with padding, background, border, radius
// ---------------------------------------------------------------------------

export type CardVariant = 'card' | 'well';
export type CardAccent = 'brand' | 'notice';
export type CardPadding = 'default' | 'compact';

export function Card(
  { children, variant = 'card', accent, padding = 'default', class: extra }: {
    children: ComponentChildren;
    variant?: CardVariant;
    accent?: CardAccent;
    padding?: CardPadding;
    class?: string;
  },
) {
  let cls = 'card';
  if (variant === 'well') cls += ' card-well';
  if (padding === 'compact') cls += ' card-compact';
  if (accent) cls += ' card-accent-' + accent;
  if (extra) cls += ' ' + extra;
  return <div class={cls}>{children}</div>;
}

// ---------------------------------------------------------------------------
// Section — heading + content with a consistent gap
// ---------------------------------------------------------------------------

export function Section(
  { heading, headingRole = 'heading-section', children, class: extra }: {
    heading: string;
    headingRole?: TextRole;
    children: ComponentChildren;
    class?: string;
  },
) {
  const cls = 'section-block' + (extra ? ' ' + extra : '');
  return (
    <section class={cls}>
      <Text role={headingRole} as='h2'>{heading}</Text>
      {children}
    </section>
  );
}
