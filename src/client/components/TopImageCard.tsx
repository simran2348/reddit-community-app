import { memo, useState } from 'react';
import { ArrowBigUp, MessageSquare, Quote } from 'lucide-react';
import { navigateTo } from '@devvit/web/client';
import type { ImageRanking } from '../../shared/api';
import { formatCount } from '../format';

type TopImageCardProps = {
  image: ImageRanking;
};

type ImageStatus = 'loading' | 'loaded' | 'error';

/** Bundled default from /public, used when a user has no snoovatar. */
const DEFAULT_AVATAR = '/snoo.png';

/** The author's snoovatar, falling back to the default Snoo. */
export const Avatar = ({ url }: { url: string | null }) => {
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
          <ArrowBigUp size={14} aria-hidden="true" />
          {formatCount(image.score)}
        </span>
        <span
          className="post-details__stat"
          title={`${image.commentCount} comments`}
        >
          <MessageSquare size={12} strokeWidth={2.5} aria-hidden="true" />
          {formatCount(image.commentCount)}
        </span>
      </p>
    </div>
  </div>
);

const Photo = ({ image, src }: { image: ImageRanking; src: string }) => {
  const [status, setStatus] = useState<ImageStatus>('loading');
  return (
    <div className={`cover-card is-${status}`}>
      {status === 'error' ? (
        <span className="cover-card__fallback">Image unavailable</span>
      ) : (
        <img
          className="cover-card__image"
          src={src}
          alt={`#${image.rank}: ${image.title} by u/${image.author}`}
          loading="eager"
          decoding="async"
          draggable={false}
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
        />
      )}
    </div>
  );
};

/**
 * Text post (only when mods include them in Top posts): the start of the
 * post's text on a dark card, or the title when the post has no body. The
 * usual details still sit at the bottom.
 */
const TextBody = ({ image }: { image: ImageRanking }) => (
  <div className="text-card">
    <Quote className="text-card__mark" size={22} aria-hidden="true" />
    <p className={`text-card__text${image.body ? '' : ' is-title'}`}>
      {image.body ?? image.title}
    </p>
  </div>
);

/** Image card with the post details overlaid on a fade at the bottom. */
export const TopImageCard = memo(({ image }: TopImageCardProps) => (
  <div className="overlay-card">
    {image.imageUrl ? (
      <Photo image={image} src={image.imageUrl} />
    ) : (
      <TextBody image={image} />
    )}
    <div className="overlay-card__details">
      <PostDetails image={image} />
    </div>
  </div>
));
TopImageCard.displayName = 'TopImageCard';
