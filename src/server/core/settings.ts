import { settings } from '@devvit/web/server';

export type CommunitySettings = {
  competitionEnabled: boolean;
  /** Top posts also ranks text posts (never the competition). */
  rankingsIncludeText: boolean;
  /** Flair for competition entries; null means every image post is eligible. */
  competitionFlair: string | null;
};

export const getCommunitySettings = async (): Promise<CommunitySettings> => {
  const [competitionEnabled, competitionFlair, rankingsIncludeText] =
    await Promise.all([
      settings.get<boolean>('competitionEnabled'),
      settings.get<string>('competitionFlair'),
      settings.get<boolean>('rankingsIncludeText'),
    ]);

  const flair =
    typeof competitionFlair === 'string' ? competitionFlair.trim() : '';

  return {
    competitionEnabled: competitionEnabled === true,
    rankingsIncludeText: rankingsIncludeText === true,
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
  (typeof postFlair === 'string' && sameFlair(postFlair, configured));

/** Loose match; flairs with no letters/digits (emoji only) must match exactly. */
const sameFlair = (a: string, b: string): boolean => {
  const loose = normalizeFlair(b);
  return loose.length > 0 ? normalizeFlair(a) === loose : a.trim() === b.trim();
};

/**
 * Compares flairs by their letters and digits only. NFKC turns decorative
 * Unicode (e.g. 𝗣𝗵𝗼𝘁𝗼𝗴𝗿𝗮𝗽𝗵𝘆) into plain text, then emoji, punctuation
 * and spacing are dropped, so "📸 | 𝗣𝗵𝗼𝘁𝗼𝗴𝗿𝗮𝗽𝗵𝘆 𝗖𝗼𝗻𝘁𝗲𝘀𝘁" and
 * "Photography Contest" match each other.
 */
const normalizeFlair = (flair: string): string =>
  flair
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
