import { memo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type CarouselControlsProps = {
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  label: string;
};

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
        <ChevronLeft size={22} strokeWidth={2.5} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="carousel-nav carousel-nav--next"
        onClick={onNext}
        disabled={!canNext}
        aria-label={`Next ${label}`}
      >
        <ChevronRight size={22} strokeWidth={2.5} aria-hidden="true" />
      </button>
    </>
  )
);
CarouselControls.displayName = 'CarouselControls';
