import { redis } from '@devvit/web/server';

/**
 * Read-through Redis cache for expensive Reddit listing calls. Cached values
 * are plain JSON produced by `load`, so the parsed shape matches `T`.
 */
export const cached = async <T>(
  key: string,
  ttlSeconds: number,
  load: () => Promise<T>
): Promise<T> => {
  try {
    const hit = await redis.get(key);
    if (hit) {
      const parsed: T = JSON.parse(hit);
      return parsed;
    }
  } catch (error) {
    console.warn(`Cache read failed for ${key}`, error);
  }

  const value = await load();

  try {
    await redis.set(key, JSON.stringify(value), {
      expiration: new Date(Date.now() + ttlSeconds * 1000),
    });
  } catch (error) {
    console.warn(`Cache write failed for ${key}`, error);
  }

  return value;
};

/** Stable, Redis-safe key fragment for user-provided text such as flair. */
export const keySlug = (text: string): string =>
  text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'default';
