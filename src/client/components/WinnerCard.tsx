import { memo } from 'react';
import { ArrowBigUp } from 'lucide-react';
import type { WinnerEntry } from '../../shared/api';
import { formatCount } from '../format';
import { Photo, PostDetails } from './TopImageCard';

type WinnerCardProps = {
  entry: WinnerEntry;
  /** Medal for places 1-3 (competitions); off for a month's single winner. */
  showMedal: boolean;
};

/**
 * A saved winner, in the same style as a competition card: photo, medal for
 * places 1-3 (competitions only), avatar/title/author and an orange tag with
 * the upvotes it had when it was awarded.
 */
export const WinnerCard = memo(({ entry, showMedal }: WinnerCardProps) => (
  <div className="overlay-card">
    <Photo src={entry.imageUrl} alt={`${entry.title} by u/${entry.author}`} />
    {showMedal && entry.rank <= 3 && (
      <img
        className="rank-medal"
        src={`/p${entry.rank}.png`}
        alt={`Place ${entry.rank}`}
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
));
WinnerCard.displayName = 'WinnerCard';
