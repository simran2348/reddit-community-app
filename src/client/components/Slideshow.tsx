import { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { ImageRanking } from '../../shared/api';
import { CarouselControls } from './CarouselControls';
import { Avatar } from './TopImageCard';
import { useCarousel } from '../hooks/useCarousel';
import { useDocumentHidden } from '../hooks/useDocumentHidden';

type SlideshowProps = {
  images: readonly ImageRanking[];
  startIndex: number;
  intervalMs: number;
  onClose: () => void;
};

/** Shortest distance around the loop, used to only load nearby images. */
const loopDistance = (i: number, index: number, count: number): number => {
  const forward = (((i - index) % count) + count) % count;
  return Math.min(forward, count - forward);
};

/**
 * Black overlay over the whole post that cross-fades through the images
 * (fitted, never cropped) and loops. It stays inside the splash: no expanded
 * mode. Where the browser allows it, it also asks for real fullscreen.
 * Swipe, arrows or the arrow keys move; Space pauses; Esc closes.
 */
export const Slideshow = ({
  images,
  startIndex,
  intervalMs,
  onClose,
}: SlideshowProps) => {
  const count = images.length;
  const carousel = useCarousel(count, {
    alwaysLoop: true,
    initialIndex: startIndex,
  });
  const { index, next } = carousel;
  const [playing, setPlaying] = useState(true);
  const documentHidden = useDocumentHidden();
  const rootRef = useRef<HTMLDivElement>(null);

  // Auto-advance; any manual move restarts the countdown.
  useEffect(() => {
    if (!playing || documentHidden || count < 2) return;
    const timer = window.setTimeout(next, intervalMs);
    return () => window.clearTimeout(timer);
  }, [playing, documentHidden, count, index, intervalMs, next]);

  // Focus for keyboard control; real fullscreen when permitted (often not
  // inside Reddit's iframe, in which case the overlay alone covers the post).
  useEffect(() => {
    const root = rootRef.current;
    root?.focus({ preventScroll: true });
    if (root && document.fullscreenEnabled && !document.fullscreenElement) {
      root.requestFullscreen().catch(() => undefined);
    }
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => undefined);
      }
    };
  }, []);

  const togglePlaying = useCallback(() => setPlaying((p) => !p), []);

  const { onKeyDown: onArrowKey, ...gestureHandlers } =
    carousel.viewportHandlers;

  return createPortal(
    <div
      ref={rootRef}
      className="slideshow"
      role="dialog"
      aria-modal="true"
      aria-label="Image slideshow"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
        else if (event.key === ' ' && event.target === event.currentTarget) {
          event.preventDefault();
          togglePlaying();
        } else onArrowKey(event);
      }}
    >
      <ul className="slideshow__stage" {...gestureHandlers}>
        {images.map((image, i) => {
          const isCurrent = i === index;
          return (
            <li
              key={image.id}
              className={`slideshow__slide${isCurrent ? ' is-current' : ''}`}
              aria-hidden={!isCurrent}
            >
              {loopDistance(i, index, count) <= 1 && (
                <>
                  <img
                    className="slideshow__image"
                    src={image.imageUrl ?? undefined}
                    alt={image.title}
                    draggable={false}
                  />
                  {/* Author's avatar, fading with its image. */}
                  <span
                    className="slideshow__avatar"
                    title={`u/${image.author}`}
                  >
                    <Avatar url={image.authorAvatarUrl} />
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ul>

      <p className="slideshow__counter" aria-live="polite">
        {index + 1} / {count}
      </p>

      <div className="slideshow__buttons">
        <button
          type="button"
          className="slideshow__button"
          onClick={togglePlaying}
          aria-label={playing ? 'Pause slideshow' : 'Play slideshow'}
        >
          {playing ? (
            <Pause size={18} aria-hidden="true" />
          ) : (
            <Play size={18} aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          className="slideshow__button"
          onClick={onClose}
          aria-label="Close slideshow"
        >
          <X size={18} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>

      <CarouselControls
        canPrev={carousel.canPrev}
        canNext={carousel.canNext}
        onPrev={carousel.prev}
        onNext={carousel.next}
        label="image"
      />
    </div>,
    document.body
  );
};
