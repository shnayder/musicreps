// ActionButton — structural recipe for primary/secondary action buttons.
// Encodes the page-action-btn visual treatment into a single component
// so callers just pick a variant instead of composing CSS classes manually.

import type { ComponentChildren } from 'preact';

export type ActionVariant = 'primary' | 'secondary';

export function ActionButton(
  { variant, children, onClick, disabled, class: extra, ...rest }: {
    variant: ActionVariant;
    children: ComponentChildren;
    onClick: () => void;
    disabled?: boolean;
    class?: string;
    [key: string]: unknown;
  },
) {
  const cls = variant === 'primary'
    ? 'page-action-btn page-action-primary'
    : 'page-action-btn page-action-secondary';
  const full = cls + (extra ? ' ' + extra : '');
  return (
    <button
      type='button'
      tabIndex={0}
      class={full}
      onClick={onClick}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}
