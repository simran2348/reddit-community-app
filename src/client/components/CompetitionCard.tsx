import { memo, useState } from 'react';
import { navigateTo } from '@devvit/web/client';
import type { CompetitionEntry } from '../../shared/api';
import { plural } from '../format';
import { VoteButton } from './VoteButton';
import type { VoteButtonState } from './VoteButton';

type CompetitionCardProps = {
  entry: CompetitionEntry;
  voteState: VoteButtonState;
  /** Medal place (1-3) by votes, or null for no medal. */
  medal: number | null;
  onVote: (postId: string) => void;
};

type ImageStatus = 'loading' | 'loaded' | 'error';

export const CompetitionCard = memo(
  ({ entry, voteState, medal, onVote }: CompetitionCardProps) => {
    const [imageStatus, setImageStatus] = useState<ImageStatus>('loading');

    return (
      <article className="card photo-card">
        <div className={`photo-card__frame is-${imageStatus}`}>
          {imageStatus === 'error' ? (
            <span className="photo-card__fallback">Image unavailable</span>
          ) : (
            <img
              className="photo-card__image"
              src={entry.imageUrl}
              alt={entry.title}
              loading="eager"
              decoding="async"
              draggable={false}
              onLoad={() => setImageStatus('loaded')}
              onError={() => setImageStatus('error')}
            />
          )}
          {medal !== null && (
            <img
              className="rank-medal"
              src={`/p${medal}.png`}
              alt={`Place ${medal} by votes`}
              draggable={false}
            />
          )}
        </div>

        <div className="photo-card__meta">
          <div className="photo-card__titles">
            <h2 className="photo-card__title">
              <button
                type="button"
                className="link-button"
                onClick={() => navigateTo(entry.postUrl)}
                title={entry.title}
              >
                {entry.title}
              </button>
            </h2>
            <p className="photo-card__author">
              u/{entry.author} ·{' '}
              <span className="photo-card__votes">
                {plural(entry.voteCount, 'vote', 'votes')}
              </span>
            </p>
          </div>
          <VoteButton state={voteState} onVote={() => onVote(entry.id)} />
        </div>
      </article>
    );
  }
);
CompetitionCard.displayName = 'CompetitionCard';
