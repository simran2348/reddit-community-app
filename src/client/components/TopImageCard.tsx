import { memo, useState } from 'react';
import type { ReactNode } from 'react';
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

type PostDetailsProps = {
  title: string;
  author: string;
  avatarUrl: string | null;
  postUrl: string;
  /** Upvotes and comments; omitted on competition cards. */
  score?: number;
  commentCount?: number;
  /** Optional control on the right (e.g. the competition Vote button). */
  action?: ReactNode;
};

/**
 * Avatar, title, author, upvotes and comments, overlaid on the photo's
 * bottom fade. Shared by Top posts and the competition.
 */
export const PostDetails = ({
  title,
  author,
  avatarUrl,
  postUrl,
  score,
  commentCount,
  action,
}: PostDetailsProps) => (
  <div className="post-details">
    <Avatar url={avatarUrl} />
    <div className="post-details__text">
      <button
        type="button"
        className="post-details__title link-button"
        onClick={() => navigateTo(postUrl)}
        title={title}
      >
        {title}
      </button>
      <p className="post-details__meta">
        <span className="post-details__author">u/{author}</span>
        {score !== undefined && (
          <span className="post-details__stat" title={`${score} upvotes`}>
            <ArrowBigUp size={14} aria-hidden="true" />
            {formatCount(score)}
          </span>
        )}
        {commentCount !== undefined && (
          <span
            className="post-details__stat"
            title={`${commentCount} comments`}
          >
            <MessageSquare size={12} strokeWidth={2.5} aria-hidden="true" />
            {formatCount(commentCount)}
          </span>
        )}
      </p>
    </div>
    {action && <div className="post-details__action">{action}</div>}
  </div>
);

/** Cover-fitted photo that fades in once loaded. */
export const Photo = ({ src, alt }: { src: string; alt: string }) => {
  const [status, setStatus] = useState<ImageStatus>('loading');
  return (
    <div className={`cover-card is-${status}`}>
      {status === 'error' ? (
        <span className="cover-card__fallback">Image unavailable</span>
      ) : (
        <img
          className="cover-card__image"
          src={src}
          alt={alt}
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
      <Photo
        src={image.imageUrl}
        alt={`#${image.rank}: ${image.title} by u/${image.author}`}
      />
    ) : (
      <TextBody image={image} />
    )}
    <div className="overlay-card__details">
      <PostDetails
        title={image.title}
        author={image.author}
        avatarUrl={image.authorAvatarUrl}
        postUrl={image.postUrl}
        score={image.score}
        commentCount={image.commentCount}
      />
    </div>
  </div>
));
TopImageCard.displayName = 'TopImageCard';
