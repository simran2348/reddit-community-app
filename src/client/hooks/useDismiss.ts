import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Calls `onDismiss` on a tap outside `ref` or on Escape while `open`.
 * Listeners live on this iframe's document only, never on Reddit's page.
 */
export const useDismiss = (
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onDismiss: () => void
): void => {
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const root = ref.current;
      if (
        root &&
        event.target instanceof Node &&
        !root.contains(event.target)
      ) {
        onDismiss();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [ref, open, onDismiss]);
};
