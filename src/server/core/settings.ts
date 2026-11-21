import { settings } from '@devvit/web/server';

export type CommunitySettings = {
  /** Mod toggle AND the end date (if any) hasn't passed yet. */
  competitionEnabled: boolean;
  /** The mod toggle alone (true even after the end date has passed). */
  competitionSwitchedOn: boolean;
  /** End of the competition (end of the set day, UTC); null = no end. */
  competitionEndsAt: Date | null;
  /** The end date as typed (YYYY-MM-DD), part of the competition's ID. */
  competitionEndDate: string | null;
  /** Flair text templates for winners ({theme}, {month}, {year}). */
  competitionWinnerFlair: string;
  monthlyWinnerFlair: string;
  /** Optional flair template ID applied with the winner text. */
  winnerFlairTemplateId: string | null;
  /** Top posts also ranks text posts (never the competition). */
  rankingsIncludeText: boolean;
  /** Competition theme name and description; null when not set. */
  competitionTheme: string | null;
  competitionThemeDescription: string | null;
  /** Post with the full competition details; null when unset or invalid. */
  competitionPostUrl: string | null;
  /** Flair for competition entries; null means every image post is eligible. */
  competitionFlair: string | null;
};

export const getCommunitySettings = async (): Promise<CommunitySettings> => {
  const [
    competitionEnabled,
    competitionFlair,
    rankingsIncludeText,
    competitionTheme,
    competitionThemeDescription,
    competitionPostLink,
    competitionEndDate,
    competitionWinnerFlair,
    monthlyWinnerFlair,
    winnerFlairTemplateId,
  ] = await Promise.all([
    settings.get<boolean>('competitionEnabled'),
    settings.get<string>('competitionFlair'),
    settings.get<boolean>('rankingsIncludeText'),
    settings.get<string>('competitionTheme'),
    settings.get<string>('competitionThemeDescription'),
    settings.get<string>('competitionPostLink'),
    settings.get<string>('competitionEndDate'),
    settings.get<string>('competitionWinnerFlair'),
    settings.get<string>('monthlyWinnerFlair'),
    settings.get<string>('winnerFlairTemplateId'),
  ]);

  const endDate = parseEndDate(competitionEndDate);

  const flair =
    typeof competitionFlair === 'string' ? competitionFlair.trim() : '';

  return {
    // An end date in the past ends the competition automatically.
    competitionEnabled:
      competitionEnabled === true &&
      (endDate === null || Date.now() < endDate.endsAt.getTime()),
    competitionSwitchedOn: competitionEnabled === true,
    competitionEndsAt: endDate?.endsAt ?? null,
    competitionEndDate: endDate?.text ?? null,
    competitionWinnerFlair:
      textOrNull(competitionWinnerFlair) ?? DEFAULT_COMPETITION_WINNER_FLAIR,
    monthlyWinnerFlair:
      textOrNull(monthlyWinnerFlair) ?? DEFAULT_MONTHLY_WINNER_FLAIR,
    winnerFlairTemplateId: textOrNull(winnerFlairTemplateId),
    rankingsIncludeText: rankingsIncludeText === true,
    competitionFlair: flair.length > 0 ? flair : null,
    competitionTheme: textOrNull(competitionTheme),
    competitionThemeDescription: textOrNull(competitionThemeDescription),
    competitionPostUrl: httpsUrlOrNull(competitionPostLink),
  };
};

/**
 * A valid https link, or null. A bare "reddit.com/..." gets https:// added;
 * anything that still isn't a proper https URL is ignored rather than shown.
 */
const httpsUrlOrNull = (value: string | undefined): string | null => {
  const text = textOrNull(value);
  if (!text) return null;
  const withScheme = /^[a-z]+:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
};

export const DEFAULT_COMPETITION_WINNER_FLAIR = '🏆 {theme} {year}';
export const DEFAULT_MONTHLY_WINNER_FLAIR = '⬆️ {month} {year}';

/**
 * "YYYY-MM-DD" → the end of that day in UTC (23:59:59.999). Anything else
 * (blank, wrong format, impossible date) means no end date.
 */
const parseEndDate = (
  value: string | undefined
): { text: string; endsAt: Date } | null => {
  const text = textOrNull(value);
  const match = text?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!text || !match) return null;
  const [, y, m, d] = match.map(Number);
  if (y === undefined || m === undefined || d === undefined) return null;
  const endsAt = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
  return endsAt.getUTCDate() === d ? { text, endsAt } : null;
};

/** Trimmed text, or null when unset or blank. */
const textOrNull = (value: string | undefined): string | null => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed.length > 0 ? trimmed : null;
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
