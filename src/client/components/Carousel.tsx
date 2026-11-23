import { useEffect, useState } from 'react';
import type { CSSProperties, PointerEvent, ReactNode } from 'react';
import { CarouselControls } from './CarouselControls';
import { useCarousel } from '../hooks/useCarousel';
import type { CarouselDirection } from '../hooks/useCarousel';
import { useDocumentHidden } from '../hooks/useDocumentHidden';

type CarouselProps<T> = {
  items: readonly T[];
  getKey: (item: T) => string;
  renderItem: (item: T, isActive: boolean) => ReactNode;
  label: string;
  /** Advance automatically every N ms; null/undefined disables auto-play. */
  autoplayMs?: number | null;
  /** Externally paused (e.g. settings open or another tab showing). */
  paused?: boolean;
  /** Extra controls in the frame's top-right gutter, given the front index. */
  renderActions?: ((index: number) => ReactNode) | undefined;
};

type SlidePosition =
  'active' | 'prev' | 'next' | 'hidden-left' | 'hidden-right';

/**
 * Signed distance from the front card around the loop, taking the shorter
 * way. With 10 items and item 1 in front, item 10 is -1 (left) and item 2
 * is +1 (right).
 *
 * A card exactly halfway round (with 2 items, the other one) is equally far
 * both ways, so it goes to the side we just came from: after moving forward
 * it exits left, after moving back it exits right, and it starts on the right.
 */
const loopOffset = (
  i: number,
  index: number,
  count: number,
  direction: CarouselDirection,
  loops: boolean
): number => {
  if (count === 0) return 0;
  // Short lists don't loop: cards simply sit in order.
  if (!loops) return i - index;
  const forward = (((i - index) % count) + count) % count;
  if (forward * 2 === count) return direction === 1 ? -forward : forward;
  return forward > count / 2 ? forward - count : forward;
};

const positionFor = (offset: number): SlidePosition => {
  if (offset === 0) return 'active';
  if (offset === -1) return 'prev';
  if (offset === 1) return 'next';
  return offset < 0 ? 'hidden-left' : 'hidden-right';
};

/**
 * Coverflow carousel: the active card sits centred, its neighbours peek out
 * scaled-down on either side, and the rest are stacked out of view. Cards are
 * absolutely positioned inside an overflow-clipped stage, so nothing can
 * widen or scroll the page. Tapping a neighbour brings it to the front.
 */
export const Carousel = <T,>({
  items,
  getKey,
  renderItem,
  label,
  autoplayMs = null,
  paused = false,
  renderActions,
}: CarouselProps<T>) => {
  const carousel = useCarousel(items.length);
  const [hovered, setHovered] = useState(false);
  const documentHidden = useDocumentHidden();
  const { index, next, goTo, canNext } = carousel;
  const count = items.length;

  // Auto-play: one timeout per slide, so any manual change restarts the
  // countdown. Wraps from the last image back to the first. Pauses while
  // hovered with a mouse or when not visible.
  const autoplayActive =
    autoplayMs !== null && count > 1 && !paused && !hovered && !documentHidden;

  useEffect(() => {
    if (!autoplayActive || autoplayMs === null) return;
    // On a short, non-looping list the last image rewinds to the first.
    const advance = canNext ? next : () => goTo(0, -1);
    const timer = window.setTimeout(advance, autoplayMs);
    return () => window.clearTimeout(timer);
  }, [autoplayActive, autoplayMs, index, next, goTo, canNext]);

  const onPointerEnter = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse') setHovered(true);
  };
  const onPointerLeave = () => setHovered(false);

  // One card: nothing to page through, so no arrows or "1 / 1" tag.
  const single = items.length <= 1;

  return (
    <div className="carousel">
      <div
        className="carousel__frame"
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      >
        <div
          className="carousel__stage"
          role="region"
          aria-roledescription="carousel"
          aria-label={label}
          tabIndex={0}
          {...carousel.viewportHandlers}
        >
          <ul className="carousel__cards">
            {items.map((item, i) => {
              const offset = loopOffset(
                i,
                carousel.index,
                items.length,
                carousel.direction,
                carousel.loops
              );
              const position = positionFor(offset);
              const isActive = position === 'active';
              const isNeighbour = position === 'prev' || position === 'next';
              // Only render images for cards that are on screen or about to be.
              const isNear = Math.abs(offset) <= 2;
              const style: CSSProperties & Record<'--depth', number> = {
                '--depth': Math.abs(offset),
              };
              return (
                <li
                  key={getKey(item)}
                  className={`carousel__card is-${position}`}
                  style={style}
                  aria-roledescription="slide"
                  aria-label={`${i + 1} of ${items.length}`}
                  aria-hidden={!isActive}
                >
                  <div className="carousel__card-content" inert={!isActive}>
                    {isNear && renderItem(item, isActive)}
                  </div>
                  {/* Each card carries its own position tag, so it moves
                      with the image and fades in when the card is in front. */}
                  {!single && (
                    <span className="card-position" aria-hidden="true">
                      {i + 1} / {items.length}
                    </span>
                  )}
                  {isNeighbour && (
                    <button
                      type="button"
                      className="carousel__card-hit"
                      tabIndex={-1}
                      aria-label={`Show ${label} ${i + 1}`}
                      onClick={() =>
                        carousel.selectFromTap(i, offset < 0 ? -1 : 1)
                      }
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        {renderActions && (
          <div className="carousel__actions">{renderActions(index)}</div>
        )}
        {!single && (
          <CarouselControls
            canPrev={carousel.canPrev}
            canNext={carousel.canNext}
            onPrev={carousel.prev}
            onNext={carousel.next}
            label={label}
          />
        )}
        {/* Screen-reader announcement of the current position. */}
        <p className="visually-hidden" aria-live="polite">
          {items.length === 0
            ? '0 of 0'
            : `${label} ${carousel.index + 1} of ${items.length}`}
        </p>
      </div>
    </div>
  );
};
