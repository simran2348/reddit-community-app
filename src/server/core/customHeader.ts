import { redis } from '@devvit/web/server';
import { isRedditImageUrl } from './rules';

/**
 * Mods can replace the banner and icon shown in the app's Settings header
 * (subreddit menu → "Customise app header"). Saved in Redis; anything not
 * set falls back to the subreddit's own banner and icon. Read on every
 * request (not cached), so changes show on the next open.
 */
const HEADER_KEY = 'community:custom-header';

export type CustomHeader = {
  bannerUrl: string | null;
  iconUrl: string | null;
};

export const getCustomHeader = async (): Promise<CustomHeader> => {
  const saved = await redis.hGetAll(HEADER_KEY);
  return {
    bannerUrl: isRedditImageUrl(saved.bannerUrl) ? saved.bannerUrl : null,
    iconUrl: isRedditImageUrl(saved.iconUrl) ? saved.iconUrl : null,
  };
};

/** One image's change: a new uploaded URL, 'reset', or 'keep'. */
export type HeaderChange = { set: string } | 'reset' | 'keep';

const apply = async (field: keyof CustomHeader, change: HeaderChange) => {
  if (change === 'keep') return;
  if (change === 'reset') await redis.hDel(HEADER_KEY, [field]);
  else await redis.hSet(HEADER_KEY, { [field]: change.set });
};

export const updateCustomHeader = async (
  banner: HeaderChange,
  icon: HeaderChange
): Promise<void> => {
  await apply('bannerUrl', banner);
  await apply('iconUrl', icon);
};
