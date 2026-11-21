import { context, redis } from '@devvit/web/server';
import { parsePreferences } from '../../shared/api';
import type { UserPreferences } from '../../shared/api';

/**
 * Settings choices per Reddit account, so they follow the viewer to any
 * device. Redis is per installation, so this is per community too.
 */
const key = (userId: string) => `preferences:${userId}`;

export const getPreferences = async (): Promise<UserPreferences | null> => {
  const { userId } = context;
  if (!userId) return null;
  const raw = await redis.get(key(userId));
  if (!raw) return null;
  try {
    return parsePreferences(JSON.parse(raw));
  } catch {
    return null;
  }
};

/** Saves validated choices; returns false when logged out. */
export const savePreferences = async (
  preferences: UserPreferences
): Promise<boolean> => {
  const { userId } = context;
  if (!userId) return false;
  await redis.set(key(userId), JSON.stringify(preferences));
  return true;
};
