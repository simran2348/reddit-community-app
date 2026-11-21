import { memo, useCallback, useMemo, useState } from 'react';
import type { CompetitionEntry } from '../../shared/api';
import { Carousel } from './Carousel';
import { CompetitionCard } from './CompetitionCard';
import { Slideshow, SlideshowButton } from './Slideshow';

type CompetitionCarouselProps = {
  entries: readonly CompetitionEntry[];
  /** Time per image in the slideshow (the Settings interval). */
  slideshowMs: number;
};

const getKey = (entry: CompetitionEntry) => entry.id;

export const CompetitionCarousel = memo(
  ({ entries, slideshowMs }: CompetitionCarouselProps) => {
    // Medals for the top 3 by Reddit upvotes. Entries with the same score
    // share a place; entries at 0 or below get none.
    const medals = useMemo(() => {
      const map = new Map<string, number>();
      for (const entry of entries) {
        if (entry.score <= 0) continue;
        const place =
          1 + entries.filter((other) => other.score > entry.score).length;
        if (place <= 3) map.set(entry.id, place);
      }
      return map;
    }, [entries]);

    const renderEntry = useCallback(
      (entry: CompetitionEntry) => (
        <CompetitionCard entry={entry} medal={medals.get(entry.id) ?? null} />
      ),
      [medals]
    );

    // Index the slideshow starts from (the front entry), or null if closed.
    const [slideshowStart, setSlideshowStart] = useState<number | null>(null);
    const closeSlideshow = useCallback(() => setSlideshowStart(null), []);
    const renderActions = useCallback(
      (index: number) => (
        <SlideshowButton onClick={() => setSlideshowStart(index)} />
      ),
      []
    );

    return (
      <>
        <Carousel
          items={entries}
          getKey={getKey}
          renderItem={renderEntry}
          label="photo"
          renderActions={renderActions}
        />
        {slideshowStart !== null && (
          <Slideshow
            images={entries}
            startIndex={slideshowStart}
            intervalMs={slideshowMs}
            onClose={closeSlideshow}
          />
        )}
      </>
    );
  }
);
CompetitionCarousel.displayName = 'CompetitionCarousel';
