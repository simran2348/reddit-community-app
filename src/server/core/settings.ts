import { settings } from '@devvit/web/server';

export type CommunitySettings = {
  /** Flair for app showcase posts; null means every post is eligible. */
  appFlair: string | null;
  competitionFlair: string;
  singleVote: boolean;
};

const DEFAULT_COMPETITION_FLAIR = 'Photo Contest';

const readString = async (name: string): Promise<string | null> => {
  const value = await settings.get<string>(name);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const getCommunitySettings = async (): Promise<CommunitySettings> => {
  const [appFlair, competitionFlair, singleVote] = await Promise.all([
    readString('appFlair'),
    readString('competitionFlair'),
    settings.get<boolean>('singleVotePerCompetition'),
  ]);

  return {
    appFlair,
    competitionFlair: competitionFlair ?? DEFAULT_COMPETITION_FLAIR,
    singleVote: singleVote === true,
  };
};

/** Case- and whitespace-insensitive flair comparison. */
export const flairMatches = (
  postFlair: string | undefined,
  configured: string
): boolean =>
  typeof postFlair === 'string' &&
  normalizeFlair(postFlair) === normalizeFlair(configured);

export const normalizeFlair = (flair: string): string =>
  flair.trim().replace(/\s+/g, ' ').toLowerCase();
