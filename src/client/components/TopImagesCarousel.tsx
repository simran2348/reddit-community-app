import { memo, useCallback } from 'react';
import type { ImageRanking } from '../../shared/api';
import type { ImageLayout } from '../preferences';
import { Carousel } from './Carousel';
import type { RevealState } from './Carousel';
import { TopImageCard } from './TopImageCard';

type TopImagesCarouselProps = {
  images: readonly ImageRanking[];
  layout: ImageLayout;
};

const getKey = (image: ImageRanking) => image.id;

export const TopImagesCarousel = memo(
  ({ images, layout }: TopImagesCarouselProps) => {
    const renderImage = useCallback(
      (image: ImageRanking, isActive: boolean, reveal: RevealState) => (
        <TopImageCard
          image={image}
          isActive={isActive}
          layout={layout}
          reveal={reveal}
        />
      ),
      [layout]
    );

    return (
      <Carousel
        items={images}
        getKey={getKey}
        renderItem={renderImage}
        label="image"
      />
    );
  }
);
TopImagesCarousel.displayName = 'TopImagesCarousel';
