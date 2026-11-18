import type { CSSProperties, ReactNode } from 'react';
import { CarouselControls } from './CarouselControls';
import { useCarousel } from '../hooks/useCarousel';

type CarouselProps<T> = {
  items: readonly T[];
  getKey: (item: T) => string;
  renderItem: (item: T, isActive: boolean, reveal: RevealState) => ReactNode;
  label: string;
};

/** Swipe-up reveal state; only ever true for the active card. */
export type RevealState = {
  revealed: boolean;
  toggle: () => void;
};

type SlidePosition =
  'active' | 'prev' | 'next' | 'hidden-left' | 'hidden-right';

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
}: CarouselProps<T>) => {
  const carousel = useCarousel(items.length);

  return (
    <div className="carousel">
      <div className="carousel__frame">
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
              const offset = i - carousel.index;
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
                    {isNear &&
                      renderItem(item, isActive, {
                        revealed: isActive && carousel.revealed,
                        toggle: carousel.toggleRevealed,
                      })}
                  </div>
                  {isNeighbour && (
                    <button
                      type="button"
                      className="carousel__card-hit"
                      tabIndex={-1}
                      aria-label={`Show ${label} ${i + 1}`}
                      onClick={() => carousel.selectFromTap(i)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        <CarouselControls
          index={carousel.index}
          count={items.length}
          onPrev={carousel.prev}
          onNext={carousel.next}
          label={label}
        />
      </div>
      <p className="carousel-position" aria-live="polite">
        {items.length === 0
          ? '0 / 0'
          : `${carousel.index + 1} / ${items.length}`}
      </p>
    </div>
  );
};
