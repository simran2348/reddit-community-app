import { useCallback, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, TouchEvent } from 'react';

const SWIPE_THRESHOLD_PX = 30;
const SWIPE_CLICK_GUARD_MS = 350;

type Gesture = {
  x: number;
  y: number;
  handled: boolean;
  /** Started inside a `[data-reveal-zone]`, so vertical swipes reveal. */
  vertical: boolean;
};

const REVEAL_ZONE_SELECTOR = '[data-reveal-zone]';

const startsInRevealZone = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest(REVEAL_ZONE_SELECTOR) !== null;

/**
 * Index state plus swipe/keyboard handlers for a carousel.
 *
 * Swipes fire as soon as the finger has moved far enough horizontally (on
 * move, not on release). Mobile webviews such as the Reddit app often cancel
 * the touch once the native feed starts tracking it, so waiting for
 * touchend/pointerup would silently drop the swipe. Nothing calls
 * preventDefault and the stage uses `touch-action: pan-y`, so vertical
 * gestures still scroll the Reddit feed normally.
 *
 * Touch input uses touch events (the most reliable in embedded webviews);
 * mouse and pen use pointer events.
 */
export const useCarousel = (count: number) => {
  const [rawIndex, setIndex] = useState(0);
  const gesture = useRef<Gesture | null>(null);
  const lastSwipeAt = useRef(0);
  // Index whose details are revealed; any slide change clears it, so each
  // image starts covered and must be swiped up again.
  const [revealedIndex, setRevealedIndex] = useState<number | null>(null);

  // Clamp during render so a shrinking list never leaves us out of range.
  const index = count === 0 ? 0 : Math.min(rawIndex, count - 1);

  const goTo = useCallback(
    (next: number) => {
      if (count === 0) return;
      setIndex(Math.max(0, Math.min(next, count - 1)));
      setRevealedIndex(null);
    },
    [count]
  );

  const prev = useCallback(() => goTo(index - 1), [goTo, index]);
  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const reset = useCallback(() => {
    setIndex(0);
    setRevealedIndex(null);
  }, []);

  const revealed = revealedIndex === index;
  const setRevealed = useCallback(
    (open: boolean) => setRevealedIndex(open ? index : null),
    [index]
  );
  const toggleRevealed = useCallback(
    () => setRevealedIndex((current) => (current === index ? null : index)),
    [index]
  );

  /** Tap on a neighbouring card; ignored right after a swipe ends on it. */
  const selectFromTap = useCallback(
    (target: number) => {
      if (Date.now() - lastSwipeAt.current < SWIPE_CLICK_GUARD_MS) return;
      goTo(target);
    },
    [goTo]
  );

  const start = useCallback(
    (x: number, y: number, target: EventTarget | null) => {
      gesture.current = {
        x,
        y,
        handled: false,
        vertical: startsInRevealZone(target),
      };
    },
    []
  );

  /** Fires at most one action (slide change or reveal) per gesture. */
  const move = useCallback(
    (x: number, y: number) => {
      const g = gesture.current;
      if (!g || g.handled) return;
      const dx = x - g.x;
      const dy = y - g.y;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (absX < SWIPE_THRESHOLD_PX && absY < SWIPE_THRESHOLD_PX) return;

      if (absX >= absY * 1.2) {
        g.handled = true;
        lastSwipeAt.current = Date.now();
        if (dx < 0) next();
        else prev();
        return;
      }

      if (g.vertical && absY >= SWIPE_THRESHOLD_PX) {
        g.handled = true;
        lastSwipeAt.current = Date.now();
        setRevealed(dy < 0);
        return;
      }

      // Mostly vertical outside the image: let Reddit scroll.
      gesture.current = null;
    },
    [next, prev, setRevealed]
  );

  const end = useCallback(() => {
    gesture.current = null;
  }, []);

  const onTouchStart = useCallback(
    (event: TouchEvent<HTMLElement>) => {
      const touch = event.touches[0];
      if (event.touches.length === 1 && touch) {
        start(touch.clientX, touch.clientY, event.target);
      } else {
        end();
      }
    },
    [start, end]
  );

  const onTouchMove = useCallback(
    (event: TouchEvent<HTMLElement>) => {
      const touch = event.touches[0];
      if (touch) move(touch.clientX, touch.clientY);
    },
    [move]
  );

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType === 'touch') return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      start(event.clientX, event.clientY, event.target);
    },
    [start]
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType === 'touch') return;
      move(event.clientX, event.clientY);
    },
    [move]
  );

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
    selectFromTap,
    revealed,
    toggleRevealed,
    canPrev: index > 0,
    canNext: index < count - 1,
    viewportHandlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd: end,
      onTouchCancel: end,
      onPointerDown,
      onPointerMove,
      onPointerUp: end,
      onPointerCancel: end,
      onPointerLeave: end,
      onKeyDown,
    },
  };
};
