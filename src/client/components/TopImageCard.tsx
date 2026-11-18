import { memo, useState } from 'react';
import { navigateTo } from '@devvit/web/client';
import type { ImageRanking } from '../../shared/api';
import { formatCount } from '../format';
import type { ImageLayout } from '../preferences';
import type { RevealState } from './Carousel';

type TopImageCardProps = {
  image: ImageRanking;
  isActive: boolean;
  layout: ImageLayout;
  reveal: RevealState;
};

type ImageStatus = 'loading' | 'loaded' | 'error';

const Avatar = ({ name, url }: { name: string; url: string | null }) => {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      <span className="avatar avatar--fallback" aria-hidden="true">
        {name.charAt(0).toUpperCase() || '?'}
      </span>
    );
  }
  return (
    <img
      className="avatar"
      src={url}
      alt=""
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
};

/** Avatar, title, author, upvotes and comments; shared by both layouts. */
const PostDetails = ({ image }: { image: ImageRanking }) => (
  <div className="post-details">
    <Avatar name={image.author} url={image.authorAvatarUrl} />
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

export const TopImageCard = memo(
  ({ image, isActive, layout, reveal }: TopImageCardProps) => {
    if (layout === 'overlay') {
      return (
        <div className="overlay-card">
          <Photo image={image} isActive={isActive} />
          <div className="overlay-card__details">
            <PostDetails image={image} />
          </div>
        </div>
      );
    }

    // Reveal layout: details sit underneath; the photo slides up to show them.
    return (
      <div className={`reveal-card${reveal.revealed ? ' is-revealed' : ''}`}>
        <div className="reveal-card__details" aria-hidden={!reveal.revealed}>
          <PostDetails image={image} />
        </div>
        <div className="reveal-card__photo" data-reveal-zone="">
          <Photo image={image} isActive={isActive} />
          {isActive && (
            <button
              type="button"
              className="reveal-card__toggle"
              onClick={reveal.toggle}
              aria-expanded={reveal.revealed}
              aria-label={
                reveal.revealed ? 'Hide post details' : 'Show post details'
              }
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 15l6-6 6 6" />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  }
);
TopImageCard.displayName = 'TopImageCard';
