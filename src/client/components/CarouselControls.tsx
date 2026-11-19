import { memo } from 'react';

type CarouselControlsProps = {
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  label: string;
};

const Chevron = ({ direction }: { direction: 'left' | 'right' }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={direction === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
  </svg>
);

/** Arrow buttons overlaid on the left/right edges of the image stage. */
export const CarouselControls = memo(
  ({ canPrev, canNext, onPrev, onNext, label }: CarouselControlsProps) => (
    <>
      <button
        type="button"
        className="carousel-nav carousel-nav--prev"
        onClick={onPrev}
        disabled={!canPrev}
        aria-label={`Previous ${label}`}
      >
        <Chevron direction="left" />
      </button>
      <button
        type="button"
        className="carousel-nav carousel-nav--next"
        onClick={onNext}
        disabled={!canNext}
        aria-label={`Next ${label}`}
      >
        <Chevron direction="right" />
      </button>
    </>
  )
);
CarouselControls.displayName = 'CarouselControls';
