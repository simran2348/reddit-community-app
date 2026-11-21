import { memo, useCallback, useMemo, useState } from 'react';
import { Play } from 'lucide-react';
import type { ImageRanking } from '../../shared/api';
import { Carousel } from './Carousel';
import { Slideshow } from './Slideshow';
import { TopImageCard } from './TopImageCard';

type TopImagesCarouselProps = {
  images: readonly ImageRanking[];
  /** Time per image in the full-screen slideshow. */
  slideshowMs: number;
  paused: boolean;
};

const getKey = (image: ImageRanking) => image.id;
const renderImage = (image: ImageRanking) => <TopImageCard image={image} />;

export const TopImagesCarousel = memo(
  ({ images, slideshowMs, paused }: TopImagesCarouselProps) => {
    // Text posts (when mods include them) are skipped by the slideshow.
    const photos = useMemo(
      () => images.filter((image) => image.imageUrl !== null),
      [images]
    );
    // Index the slideshow starts from, or null while it's closed.
    const [slideshowStart, setSlideshowStart] = useState<number | null>(null);
    const closeSlideshow = useCallback(() => setSlideshowStart(null), []);

    const renderActions = useCallback(
      (index: number) => (
        <button
          type="button"
          className="carousel-action"
          aria-label="Play slideshow"
          title="Play slideshow"
          onClick={() => {
            // Start from the front card, or the next image after a text post.
            const front = images[index];
            const after = images
              .slice(index)
              .concat(images.slice(0, index))
              .find((image) => image.imageUrl !== null);
            const start = photos.findIndex(
              (photo) => photo.id === (front?.imageUrl ? front.id : after?.id)
            );
            setSlideshowStart(Math.max(0, start));
          }}
        >
          <Play
            className="carousel-action__icon"
            size={16}
            fill="currentColor"
            aria-hidden="true"
          />
        </button>
      ),
      [images, photos]
    );

    return (
      <>
        <Carousel
          items={images}
          getKey={getKey}
          renderItem={renderImage}
          label="image"
          paused={paused || slideshowStart !== null}
          renderActions={photos.length > 0 ? renderActions : undefined}
        />
        {slideshowStart !== null && (
          <Slideshow
            images={photos}
            startIndex={slideshowStart}
            intervalMs={slideshowMs}
            onClose={closeSlideshow}
          />
        )}
      </>
    );
  }
);
TopImagesCarousel.displayName = 'TopImagesCarousel';
