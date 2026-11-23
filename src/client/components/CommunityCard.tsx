import { memo, useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { navigateTo, showToast } from '@devvit/web/client';
import { Check, MessageSquareText, Plus, Users } from 'lucide-react';
import type { CommunityResponse } from '../../shared/api';
import { formatCount } from '../format';
import { NoBannerPattern } from './NoBannerPattern';
import { fetchCommunity, joinCommunity } from '../services/communityService';
import { ApiError } from '../services/http';

type Status =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; data: CommunityResponse };

/** Community DP: "r/" in orange until the icon has loaded (or if none). */
const CommunityIcon = ({ url }: { url: string | null }) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const showImage = url !== null && !failed;
  return (
    <span className="community__icon">
      {!loaded && (
        <span className="community__icon-mark" aria-hidden="true">
          r<span className="community__icon-slash">/</span>
        </span>
      )}
      {showImage && (
        <img
          className={loaded ? 'is-loaded' : undefined}
          src={url}
          alt=""
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
};

/**
 * Settings layout around the options (`children`): the community header on
 * top (edge-to-edge banner, icon, name, members, Join) and the feedback
 * button at the bottom. If the info can't load, only the options show.
 */
export const CommunityCard = memo(({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchCommunity()
      .then((data) => {
        if (!cancelled) setStatus({ kind: 'ready', data });
      })
      .catch(() => {
        if (!cancelled) setStatus({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const join = useCallback(async () => {
    if (status.kind !== 'ready' || joining) return;
    if (!status.data.isLoggedIn) {
      showToast('Log in to join the community.');
      return;
    }
    setJoining(true);
    try {
      await joinCommunity();
      setStatus({
        kind: 'ready',
        data: {
          ...status.data,
          joined: true,
          members: status.data.joined
            ? status.data.members
            : status.data.members + 1,
        },
      });
      showToast(`Welcome to r/${status.data.name}!`);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'JOIN_UNAVAILABLE') {
        // Reddit wouldn't let the app join for them: open the subreddit,
        // where Reddit's own Join button works.
        showToast(`Opening r/${status.data.name} so you can join there`);
        navigateTo(`https://www.reddit.com/r/${status.data.name}/`);
        return;
      }
      showToast(
        error instanceof Error ? error.message : 'Could not join. Try again.'
      );
    } finally {
      setJoining(false);
    }
  }, [status, joining]);

  if (status.kind === 'loading') {
    // Skeleton in the same layout: grey banner, DP showing "r/", two text
    // bars and the (disabled) Join button.
    return (
      <>
        <div className="community is-loading" aria-busy="true">
          <div className="community__banner" />
          <div className="community__row">
            <span className="community__icon">
              <span className="community__icon-mark" aria-hidden="true">
                r<span className="community__icon-slash">/</span>
              </span>
            </span>
            <div className="community__text">
              <span className="community__skeleton community__skeleton--name" />
              <span className="community__skeleton community__skeleton--members" />
            </div>
            <button type="button" className="community__join" disabled>
              <Plus size={14} strokeWidth={3} aria-hidden="true" />
              Join
            </button>
          </div>
        </div>
        {children}
      </>
    );
  }
  if (status.kind === 'error') return <>{children}</>;

  const { data } = status;
  const bannerStyle = data.bannerUrl
    ? { backgroundImage: `url("${data.bannerUrl}")` }
    : undefined;

  return (
    <>
      <section className="community" aria-label={`r/${data.name}`}>
        {data.bannerUrl ? (
          <div className="community__banner" style={bannerStyle} />
        ) : (
          <div className="community__banner no-banner">
            <NoBannerPattern seed={data.name} />
            <p className="no-banner__text">This subreddit has no banner</p>
          </div>
        )}
        <div className="community__row">
          <CommunityIcon url={data.iconUrl} />
          <div className="community__text">
            <p className="community__name">r/{data.name}</p>
            <p className="community__members">
              <Users size={12} aria-hidden="true" />
              {formatCount(data.members)} members
            </p>
          </div>
          <button
            type="button"
            className={`community__join${data.joined ? ' is-joined' : ''}`}
            onClick={() => void join()}
            disabled={joining || data.joined}
          >
            {data.joined ? (
              <Check size={14} strokeWidth={3} aria-hidden="true" />
            ) : (
              <Plus size={14} strokeWidth={3} aria-hidden="true" />
            )}
            {data.joined ? 'Joined' : 'Join'}
          </button>
        </div>
      </section>
      {children}
      <button
        type="button"
        className="community__feedback"
        onClick={() =>
          navigateTo(
            `https://www.reddit.com/message/compose?to=%2Fr%2F${encodeURIComponent(data.name)}`
          )
        }
      >
        <MessageSquareText size={15} aria-hidden="true" />
        Send feedback to the mods
      </button>
    </>
  );
});
CommunityCard.displayName = 'CommunityCard';
