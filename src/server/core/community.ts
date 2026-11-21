import { context, reddit, redis } from '@devvit/web/server';
import type { CommunityResponse } from '../../shared/api';
import { cached, keySlug } from './cache';
import { getSourceSubreddit } from './source';

const INFO_CACHE_TTL_SECONDS = 30 * 60;

type CommunityDetails = Omit<CommunityResponse, 'isLoggedIn' | 'joined'>;

const joinedKey = (subreddit: string, userId: string) =>
  `community:${keySlug(subreddit)}:joined:${userId}`;

const httpsOrNull = (url: string | undefined): string | null =>
  url && url.startsWith('https://') ? url : null;

/**
 * Reddit often hands out community images as resized copies, e.g.
 * `styles.redditmedia.com/.../communityIcon_x.png?width=64&s=...`. Shown
 * at 90px on a 2-3x phone screen those look blurry. On styles.redditmedia.com
 * the same path without the query string is the original upload, so drop it.
 * Other hosts (e.g. preview.redd.it) need their signed query, so they're
 * left alone.
 */
const fullSize = (url: string | null): string | null => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'styles.redditmedia.com') {
      parsed.search = '';
      return parsed.toString();
    }
  } catch {
    // Not a valid URL: use it as given.
  }
  return url;
};

/** Name, title, icon, banner and member count (cached for 30 minutes). */
const loadDetails = async (subreddit: string): Promise<CommunityDetails> => {
  const info = await reddit.getSubredditInfoByName(subreddit);
  const styles = info.id
    ? await reddit.getSubredditStyles(info.id).catch(() => null)
    : null;
  const rawIcon = httpsOrNull(styles?.icon);
  const rawBanner = httpsOrNull(
    styles?.mobileBannerImage ?? styles?.bannerBackgroundImage
  );
  return {
    name: info.name ?? subreddit,
    title: info.title ?? null,
    iconUrl: fullSize(rawIcon),
    bannerUrl: fullSize(rawBanner),
    bannerColor: styles?.bannerBackgroundColor ?? styles?.primaryColor ?? null,
    members: info.subscribersCount ?? 0,
  };
};

export const getCommunity = async (): Promise<CommunityResponse> => {
  const subreddit = getSourceSubreddit();
  const details = await cached(
    `community:${keySlug(subreddit)}:details:v2`,
    INFO_CACHE_TTL_SECONDS,
    () => loadDetails(subreddit)
  );
  const { userId } = context;
  const joined = userId
    ? Boolean(await redis.get(joinedKey(subreddit, userId)))
    : false;
  return { ...details, isLoggedIn: Boolean(userId), joined };
};

/**
 * Joins the subreddit the app is installed in, as the viewer (no-op if they
 * already are a member). Remembered per user so the button shows "Joined".
 */
export const joinCommunity = async (): Promise<boolean> => {
  const { userId } = context;
  if (!userId) return false;
  await reddit.subscribeToCurrentSubreddit();
  await redis.set(joinedKey(getSourceSubreddit(), userId), '1');
  return true;
};
