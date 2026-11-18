import { memo } from 'react';

type CarouselControlsProps = {
  index: number;
  count: number;
  onPrev: () => void;
  onNext: () => void;
  label: string;
};

export const CarouselControls = memo(
  ({ index, count, onPrev, onNext, label }: CarouselControlsProps) => (
    <div className="carousel-controls">
      <button
        type="button"
        className="icon-button"
        onClick={onPrev}
        disabled={index <= 0}
        aria-label={`Previous ${label}`}
      >
        <span aria-hidden="true">‹</span>
      </button>
      <span className="carousel-controls__position" aria-live="polite">
        {count === 0 ? '0 / 0' : `${index + 1} / ${count}`}
      </span>
      <button
        type="button"
        className="icon-button"
        onClick={onNext}
        disabled={index >= count - 1}
        aria-label={`Next ${label}`}
      >
        <span aria-hidden="true">›</span>
      </button>
    </div>
  )
);
CarouselControls.displayName = 'CarouselControls';
