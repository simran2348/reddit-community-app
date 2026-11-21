import { memo } from 'react';
import { ArrowBigUp } from 'lucide-react';
import type { CompetitionEntry } from '../../shared/api';
import { formatCount } from '../format';
import { Photo, PostDetails } from './TopImageCard';

type CompetitionCardProps = {
  entry: CompetitionEntry;
  /** Medal place (1-3) by Reddit upvotes, or null for no medal. */
  medal: number | null;
};

/**
 * Same look as a Top posts card: photo with the avatar, title and author on
 * a bottom fade, plus the top-3 medal and an orange tag with the post's
 * Reddit upvotes (people vote by upvoting the post on Reddit).
 */
export const CompetitionCard = memo(
  ({ entry, medal }: CompetitionCardProps) => (
    <div className="overlay-card">
      <Photo src={entry.imageUrl} alt={`${entry.title} by u/${entry.author}`} />
      {medal !== null && (
        <img
          className="rank-medal"
          src={`/p${medal}.png`}
          alt={`Place ${medal} by upvotes`}
          draggable={false}
        />
      )}
      <div className="overlay-card__details">
        <PostDetails
          title={entry.title}
          author={entry.author}
          avatarUrl={entry.authorAvatarUrl}
          postUrl={entry.postUrl}
          action={
            <span
              className="upvote-tag"
              title={`${entry.score} upvotes`}
              aria-label={`${entry.score} upvotes`}
            >
              <ArrowBigUp size={14} fill="currentColor" aria-hidden="true" />
              {formatCount(entry.score)}
            </span>
          }
        />
      </div>
    </div>
  )
);
CompetitionCard.displayName = 'CompetitionCard';
