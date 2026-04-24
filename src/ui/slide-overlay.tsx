// SlideOverlay — modal overlay that slides in from a screen edge.
// Renders via portal to document.body. Modal behavior: dimmed backdrop,
// Escape-to-close, focus trap, body scroll lock, #app inert.
//
// No built-in close button — partial overlays dismiss via backdrop tap
// or Escape; full-screen overlays should render their own X button and
// pass its ref as focusRef.

import type { ComponentChildren, RefObject } from 'preact';
import { createPortal } from 'preact/compat';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';

export type SlideOrigin = 'top' | 'bottom';

type AnimState = 'entering' | 'open' | 'exiting';

/** Manages enter/exit animation lifecycle. Returns [mounted, state, surfaceRef]. */
function useSlideAnimation(open: boolean) {
  const [state, setState] = useState<AnimState>('entering');
  const [mounted, setMounted] = useState(false);
  const surfaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setState('entering');
    } else if (mounted) {
      setState('exiting');
    }
  }, [open]);

  // Trigger enter animation on next frame after mount
  useEffect(() => {
    if (state !== 'entering') return;
    const id = requestAnimationFrame(() => setState('open'));
    return () => cancelAnimationFrame(id);
  }, [state]);

  // Unmount after exit transition completes
  useEffect(() => {
    if (state !== 'exiting') return;
    const el = surfaceRef.current;
    const done = () => setMounted(false);
    if (!el) {
      done();
      return;
    }
    el.addEventListener('transitionend', done, { once: true });
    const fallback = setTimeout(done, 350);
    return () => {
      el.removeEventListener('transitionend', done);
      clearTimeout(fallback);
    };
  }, [state]);

  return { mounted, state, surfaceRef } as const;
}

/** Manages focus, scroll lock, inert, and Escape-to-close. */
function useOverlayModal(
  mounted: boolean,
  onClose: () => void,
  focusRef?: RefObject<HTMLElement>,
  fallbackRef?: RefObject<HTMLElement>,
) {
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!mounted) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      // Trap Tab within the overlay surface. Find all focusable elements
      // inside; if none, just prevent Tab from leaving entirely.
      if (e.key === 'Tab') {
        const surface = fallbackRef?.current;
        if (!surface) return;
        const focusable = surface.querySelectorAll<HTMLElement>(
          'button,a,[tabindex]:not([tabindex="-1"]),input,select,textarea',
        );
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [mounted, onClose]);

  useEffect(() => {
    if (!mounted) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const app = document.getElementById('app');
    app?.setAttribute('inert', '');
    queueMicrotask(() => {
      (focusRef?.current ?? fallbackRef?.current)?.focus();
    });
    return () => {
      document.body.style.overflow = prevOverflow;
      app?.removeAttribute('inert');
      previouslyFocusedRef.current?.focus?.();
    };
  }, [mounted]);
}

export function SlideOverlay(
  { open, onClose, origin = 'top', ariaLabel, focusRef, children }: {
    open: boolean;
    onClose: () => void;
    origin?: SlideOrigin;
    ariaLabel: string;
    /** Element to focus when overlay opens. Falls back to the surface. */
    focusRef?: RefObject<HTMLElement>;
    children: ComponentChildren;
  },
) {
  const { mounted, state, surfaceRef } = useSlideAnimation(open);
  useOverlayModal(mounted, onClose, focusRef, surfaceRef);

  const handleBackdrop = useCallback(
    (e: MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  if (!mounted) return null;

  return createPortal(
    <div class='slide-overlay-backdrop' onClick={handleBackdrop}>
      <div
        ref={surfaceRef}
        class='slide-overlay-surface'
        data-origin={origin}
        data-state={state}
        role='dialog'
        aria-modal='true'
        aria-label={ariaLabel}
        aria-description='Press Escape to dismiss'
        tabIndex={-1}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
