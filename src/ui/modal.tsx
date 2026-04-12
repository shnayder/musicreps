// Modal — reusable dialog overlay for the design system.
// Renders via portal to document.body so it paints above all stacking
// contexts (layout-main's isolation:isolate, footer, etc.).
// Dismissed by clicking backdrop, pressing Escape, or the close button.
//
// Accessibility:
// - role='dialog' + aria-modal='true'
// - Focus moves to the close button when opened
// - Focus restores to the previously-focused element on close
// - Body scroll is locked while open

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
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Escape-to-close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // On open: remember focus, move focus to close button, lock body scroll.
  // On close: restore focus and scroll.
  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Focus the close button after the portal mounts.
    queueMicrotask(() => closeBtnRef.current?.focus());
    return () => {
      document.body.style.overflow = prevOverflow;
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open]);

  const handleBackdrop = useCallback(
    (e: MouseEvent) => {
      if (e.target === backdropRef.current) onClose();
    },
    [onClose],
  );

  if (!open) return null;

  return createPortal(
    <div class='modal-backdrop' ref={backdropRef} onClick={handleBackdrop}>
      <div
        class='modal-surface'
        role='dialog'
        aria-modal='true'
        aria-label={title}
      >
        <div class='modal-header'>
          <Text role='heading-section' as='h2'>{title}</Text>
          <button
            ref={closeBtnRef}
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
