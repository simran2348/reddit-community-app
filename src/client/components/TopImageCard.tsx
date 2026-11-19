import { memo, useState } from 'react';
import { navigateTo } from '@devvit/web/client';
import type { ImageRanking } from '../../shared/api';
import { formatCount } from '../format';

type TopImageCardProps = {
  image: ImageRanking;
  isActive: boolean;
};

type ImageStatus = 'loading' | 'loaded' | 'error';

/** Bundled default from /public, used when a user has no snoovatar. */
const DEFAULT_AVATAR = '/snoo.png';

/** The author's snoovatar, falling back to the default Snoo. */
const Avatar = ({ url }: { url: string | null }) => {
  const [failed, setFailed] = useState(false);
  const useDefault = !url || failed;
  // The circle is a clipping wrapper so the default Snoo can be zoomed
  // inside it without the circle itself growing.
  return (
    <span className={`avatar${useDefault ? ' avatar--default' : ''}`}>
      <img
        className="avatar__image"
        src={useDefault ? DEFAULT_AVATAR : url}
        alt=""
        loading="lazy"
        draggable={false}
        onError={useDefault ? undefined : () => setFailed(true)}
      />
    </span>
  );
};

/** Avatar, title, author, upvotes and comments; shared by both layouts. */
const PostDetails = ({ image }: { image: ImageRanking }) => (
  <div className="post-details">
    <Avatar url={image.authorAvatarUrl} />
    <div className="post-details__text">
      <button
        type="button"
        className="post-details__title link-button"
        onClick={() => navigateTo(image.postUrl)}
        title={image.title}
      >
        {image.title}
      </button>
      <p className="post-details__meta">
        <span className="post-details__author">u/{image.author}</span>
        <span className="post-details__stat" title={`${image.score} upvotes`}>
          <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 4l8 9h-5v7H9v-7H4z" fill="currentColor" />
          </svg>
          {formatCount(image.score)}
        </span>
        <span
          className="post-details__stat"
          title={`${image.commentCount} comments`}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 5h16v11H9l-5 4z" />
          </svg>
          {formatCount(image.commentCount)}
        </span>
      </p>
    </div>
  </div>
);

const Photo = ({
  image,
  isActive,
}: {
  image: ImageRanking;
  isActive: boolean;
}) => {
  const [status, setStatus] = useState<ImageStatus>('loading');
  return (
    <div className={`cover-card is-${status}`}>
      {status === 'error' ? (
        <span className="cover-card__fallback">Image unavailable</span>
      ) : (
        <img
          className="cover-card__image"
          src={image.imageUrl}
          alt={`#${image.rank}: ${image.title} by u/${image.author}`}
          loading={isActive ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
        />
      )}
    </div>
  );
};

/** Image card with the post details overlaid on a fade at the bottom. */
export const TopImageCard = memo(({ image, isActive }: TopImageCardProps) => (
  <div className="overlay-card">
    <Photo image={image} isActive={isActive} />
    {image.rank <= 3 && (
      <img
        className="rank-medal"
        src={`/p${image.rank}.png`}
        alt={`Rank ${image.rank}`}
        draggable={false}
      />
    )}
    <div className="overlay-card__details">
      <PostDetails image={image} />
    </div>
  </div>
));
TopImageCard.displayName = 'TopImageCard';
