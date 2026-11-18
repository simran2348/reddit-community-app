import { memo, useCallback } from 'react';
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
    const renderEntry = useCallback(
      (entry: CompetitionEntry, isActive: boolean) => (
        <CompetitionCard
          entry={entry}
          voteState={getVoteState(entry)}
          isActive={isActive}
          onVote={onVote}
        />
      ),
      [getVoteState, onVote]
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
