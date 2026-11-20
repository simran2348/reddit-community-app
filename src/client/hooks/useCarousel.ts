import { useCallback, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, TouchEvent } from 'react';

const SWIPE_THRESHOLD_PX = 30;
const SWIPE_CLICK_GUARD_MS = 350;
/** Fewer images than this stop at the ends instead of looping. */
export const MIN_LOOP_COUNT = 4;

type Gesture = { x: number; y: number; handled: boolean };

/** Last move: 1 = forward (next), -1 = backward (prev), 0 = not moved yet. */
export type CarouselDirection = -1 | 0 | 1;

type CarouselState = { index: number; direction: CarouselDirection };

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
  const [state, setState] = useState<CarouselState>({
    index: 0,
    direction: 0,
  });
  const gesture = useRef<Gesture | null>(null);
  const lastSwipeAt = useRef(0);

  // Clamp during render so a shrinking list never leaves us out of range.
  const index = count === 0 ? 0 : Math.min(state.index, count - 1);
  const direction = state.direction;
  const loops = count >= MIN_LOOP_COUNT;

  /**
   * Jump to a slide. The direction decides which side cards that are equally
   * far both ways (e.g. the other card when there are only 2) end up on.
   * When omitted it's the shorter way round the loop.
   */
  const goTo = useCallback(
    (target: number, towards?: CarouselDirection) => {
      if (count === 0) return;
      const clamped = Math.max(0, Math.min(target, count - 1));
      setState((current) => {
        const from = Math.min(current.index, count - 1);
        const forward = (clamped - from + count) % count;
        const inferred: CarouselDirection =
          forward === 0
            ? current.direction
            : count < MIN_LOOP_COUNT
              ? clamped > from
                ? 1
                : -1
              : forward * 2 <= count
                ? 1
                : -1;
        return { index: clamped, direction: towards ?? inferred };
      });
    },
    [count]
  );

  // With 4+ images the carousel loops: before the first image comes the
  // last, and after the last comes the first. With 1-3 it stops at the ends.
  const canPrev = loops ? count > 1 : index > 0;
  const canNext = loops ? count > 1 : index < count - 1;

  const prev = useCallback(() => {
    if (index > 0) goTo(index - 1, -1);
    else if (loops) goTo(count - 1, -1);
  }, [goTo, index, count, loops]);
  const next = useCallback(() => {
    if (index + 1 < count) goTo(index + 1, 1);
    else if (loops) goTo(0, 1);
  }, [goTo, index, count, loops]);
  const reset = useCallback(() => setState({ index: 0, direction: 0 }), []);

  /** Tap on a neighbouring card; ignored right after a swipe ends on it. */
  const selectFromTap = useCallback(
    (target: number, towards: CarouselDirection) => {
      if (Date.now() - lastSwipeAt.current < SWIPE_CLICK_GUARD_MS) return;
      goTo(target, towards);
    },
    [goTo]
  );

  const start = useCallback((x: number, y: number) => {
    gesture.current = { x, y, handled: false };
  }, []);

  /** Fires at most one slide change per gesture. */
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

      // Mostly vertical: let Reddit scroll and ignore the rest of it.
      gesture.current = null;
    },
    [next, prev]
  );

  const end = useCallback(() => {
    gesture.current = null;
  }, []);

  const onTouchStart = useCallback(
    (event: TouchEvent<HTMLElement>) => {
      const touch = event.touches[0];
      if (event.touches.length === 1 && touch) {
        start(touch.clientX, touch.clientY);
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
      start(event.clientX, event.clientY);
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
    direction,
    count,
    loops,
    prev,
    next,
    goTo,
    reset,
    selectFromTap,
    canPrev,
    canNext,
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
