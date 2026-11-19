import { memo } from 'react';
import type { ImageRanking } from '../../shared/api';
import { Carousel } from './Carousel';
import { TopImageCard } from './TopImageCard';

type TopImagesCarouselProps = {
  images: readonly ImageRanking[];
  autoplayMs: number | null;
  paused: boolean;
};

const getKey = (image: ImageRanking) => image.id;
const renderImage = (image: ImageRanking, isActive: boolean) => (
  <TopImageCard image={image} isActive={isActive} />
);

export const TopImagesCarousel = memo(
  ({ images, autoplayMs, paused }: TopImagesCarouselProps) => (
    <Carousel
      items={images}
      getKey={getKey}
      renderItem={renderImage}
      label="image"
      autoplayMs={autoplayMs}
      paused={paused}
    />
  )
);
TopImagesCarousel.displayName = 'TopImagesCarousel';
