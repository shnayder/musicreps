// useKeyHandler — attach/detach a document keydown listener based on
// an active flag. Cleans up on unmount.

import { useEffect, useRef } from 'preact/hooks';

/**
 * Attach a keydown handler to `document` when `active` is true.
 * Uses a ref so the handler can be swapped without re-attaching.
 */
export function useKeyHandler(
  handler: ((e: KeyboardEvent) => void) | null,
  active: boolean,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!active || !handlerRef.current) return;
    const listener = (e: KeyboardEvent) => handlerRef.current?.(e);
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [active]);
}
