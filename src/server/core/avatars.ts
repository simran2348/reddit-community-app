import { reddit } from '@devvit/web/server';
import { cached, keySlug } from './cache';

/** Snoovatars rarely change; caching avoids a lookup per entry per rebuild. */
const AVATAR_CACHE_TTL_SECONDS = 24 * 60 * 60;
const BATCH_SIZE = 20;

type AvatarLookup = { url: string | null };

const lookup = async (username: string): Promise<AvatarLookup> => {
  try {
    const url = await reddit.getSnoovatarUrl(username);
    return { url: url && url.startsWith('https://') ? url : null };
  } catch {
    return { url: null };
  }
};

/** Author snoovatar; null for deleted users, no avatar, or lookup errors. */
export const getAvatarUrl = async (
  username: string
): Promise<string | null> => {
  if (!username || username === '[deleted]') return null;
  const result = await cached(
    `avatar:v1:${keySlug(username)}`,
    AVATAR_CACHE_TTL_SECONDS,
    () => lookup(username)
  );
  return result.url;
};

/** Avatars for many authors, a batch at a time, keyed by username. */
export const getAvatarUrls = async (
  usernames: readonly string[]
): Promise<Map<string, string | null>> => {
  const unique = [...new Set(usernames)];
  const result = new Map<string, string | null>();
  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);
    const urls = await Promise.all(batch.map(getAvatarUrl));
    batch.forEach((name, j) => result.set(name, urls[j] ?? null));
  }
  return result;
};
