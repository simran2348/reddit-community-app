import type { CSSProperties, ReactNode } from 'react';
import { CarouselControls } from './CarouselControls';
import { useCarousel } from '../hooks/useCarousel';

type CarouselProps<T> = {
  items: readonly T[];
  getKey: (item: T) => string;
  renderItem: (item: T, isActive: boolean) => ReactNode;
  /** `peek` shows neighbouring cards on wider screens; `single` never does. */
  variant: 'peek' | 'single';
  label: string;
  /** Optional content rendered under the controls (e.g. ranking info). */
  footer?: ReactNode;
};

/**
 * Horizontal carousel that moves with a CSS transform inside an
 * overflow-clipped viewport, so it can never widen or scroll the page.
 */
export const Carousel = <T,>({
  items,
  getKey,
  renderItem,
  variant,
  label,
  footer,
}: CarouselProps<T>) => {
  const carousel = useCarousel(items.length);
  const trackStyle: CSSProperties & Record<'--index', number> = {
    '--index': carousel.index,
  };

  return (
    <div className="carousel">
      <div
        className={`carousel__viewport carousel__viewport--${variant}`}
        role="region"
        aria-roledescription="carousel"
        aria-label={label}
        tabIndex={0}
        {...carousel.viewportHandlers}
      >
        <ul className="carousel__track" style={trackStyle}>
          {items.map((item, i) => {
            const isActive = i === carousel.index;
            return (
              <li
                key={getKey(item)}
                className={`carousel__slide${isActive ? ' is-active' : ''}`}
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${items.length}`}
                aria-hidden={!isActive}
                inert={!isActive}
              >
                {renderItem(item, isActive)}
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
      {footer}
    </div>
  );
};
