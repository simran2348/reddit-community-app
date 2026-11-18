import { settings } from '@devvit/web/server';

export type CommunitySettings = {
  competitionEnabled: boolean;
  /** Flair for competition entries; null means every image post is eligible. */
  competitionFlair: string | null;
};

export const getCommunitySettings = async (): Promise<CommunitySettings> => {
  const [competitionEnabled, competitionFlair] = await Promise.all([
    settings.get<boolean>('competitionEnabled'),
    settings.get<string>('competitionFlair'),
  ]);

  const flair =
    typeof competitionFlair === 'string' ? competitionFlair.trim() : '';

  return {
    competitionEnabled: competitionEnabled === true,
    competitionFlair: flair.length > 0 ? flair : null,
  };
};

/**
 * Case- and whitespace-insensitive flair comparison. A null configured flair
 * matches every post.
 */
export const flairMatches = (
  postFlair: string | undefined,
  configured: string | null
): boolean =>
  configured === null ||
  (typeof postFlair === 'string' &&
    normalizeFlair(postFlair) === normalizeFlair(configured));

const normalizeFlair = (flair: string): string =>
  flair.trim().replace(/\s+/g, ' ').toLowerCase();
