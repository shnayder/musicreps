// Modal — reusable dialog overlay for the design system.
// Renders via portal to document.body so it paints above all stacking
// contexts (layout-main's isolation:isolate, footer, etc.).
// Dismissed by clicking backdrop, pressing Escape, or the close button.

import type { ComponentChildren } from 'preact';
import { createPortal } from 'preact/compat';
import { useCallback, useEffect, useRef } from 'preact/hooks';
import { Text } from './text.tsx';

export function Modal(
  { title, open, onClose, children }: {
    title: string;
    open: boolean;
    onClose: () => void;
    children: ComponentChildren;
  },
) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleBackdrop = useCallback(
    (e: MouseEvent) => {
      if (e.target === backdropRef.current) onClose();
    },
    [onClose],
  );

  if (!open) return null;

  return createPortal(
    <div class='modal-backdrop' ref={backdropRef} onClick={handleBackdrop}>
      <div class='modal-surface' role='dialog' aria-label={title}>
        <div class='modal-header'>
          <Text role='heading-section' as='h2'>{title}</Text>
          <button
            type='button'
            class='modal-close'
            onClick={onClose}
            aria-label='Close'
          >
            {'\u00d7'}
          </button>
        </div>
        <div class='modal-body'>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
