import { useCallback, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

const SWIPE_THRESHOLD_PX = 40;

type SwipeStart = { x: number; y: number; pointerId: number };

/**
 * Index state plus swipe/keyboard handlers for a carousel.
 *
 * Swipes are detected from pointer down/up deltas only; nothing calls
 * preventDefault, and the viewport uses `touch-action: pan-y`, so vertical
 * gestures continue to scroll the Reddit feed normally.
 */
export const useCarousel = (count: number) => {
  const [rawIndex, setIndex] = useState(0);
  const swipeStart = useRef<SwipeStart | null>(null);

  // Clamp during render so a shrinking list never leaves us out of range.
  const index = count === 0 ? 0 : Math.min(rawIndex, count - 1);

  const goTo = useCallback(
    (next: number) => {
      if (count === 0) return;
      setIndex(Math.max(0, Math.min(next, count - 1)));
    },
    [count]
  );

  const prev = useCallback(() => goTo(index - 1), [goTo, index]);
  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const reset = useCallback(() => setIndex(0), []);

  const onPointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    swipeStart.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
    };
  }, []);

  const onPointerUp = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const start = swipeStart.current;
      swipeStart.current = null;
      if (!start || start.pointerId !== event.pointerId) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy)) {
        return;
      }
      if (dx < 0) next();
      else prev();
    },
    [next, prev]
  );

  const onPointerCancel = useCallback(() => {
    swipeStart.current = null;
  }, []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === 'ArrowLeft') prev();
      else if (event.key === 'ArrowRight') next();
    },
    [next, prev]
  );

  return {
    index,
    count,
    prev,
    next,
    goTo,
    reset,
    canPrev: index > 0,
    canNext: index < count - 1,
    viewportHandlers: {
      onPointerDown,
      onPointerUp,
      onPointerCancel,
      onKeyDown,
    },
  };
};
