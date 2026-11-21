import { memo, useCallback, useMemo } from 'react';
import type { CompetitionEntry } from '../../shared/api';
import { Carousel } from './Carousel';
import { CompetitionCard } from './CompetitionCard';
import type { VoteButtonState } from './VoteButton';

type CompetitionCarouselProps = {
  entries: readonly CompetitionEntry[];
  getVoteState: (entry: CompetitionEntry) => VoteButtonState;
  onVote: (postId: string) => void;
};

const getKey = (entry: CompetitionEntry) => entry.id;

export const CompetitionCarousel = memo(
  ({ entries, getVoteState, onVote }: CompetitionCarouselProps) => {
    // Medals for the top 3 by votes, from live counts (so a vote can move a
    // medal without reordering the carousel). Entries with the same votes
    // share a place; entries without votes get no medal.
    const medals = useMemo(() => {
      const map = new Map<string, number>();
      for (const entry of entries) {
        if (entry.voteCount === 0) continue;
        const place =
          1 +
          entries.filter((other) => other.voteCount > entry.voteCount).length;
        if (place <= 3) map.set(entry.id, place);
      }
      return map;
    }, [entries]);

    const renderEntry = useCallback(
      (entry: CompetitionEntry) => (
        <CompetitionCard
          entry={entry}
          voteState={getVoteState(entry)}
          medal={medals.get(entry.id) ?? null}
          onVote={onVote}
        />
      ),
      [getVoteState, onVote, medals]
    );

    return (
      <Carousel
        items={entries}
        getKey={getKey}
        renderItem={renderEntry}
        label="photo"
      />
    );
  }
);
CompetitionCarousel.displayName = 'CompetitionCarousel';
