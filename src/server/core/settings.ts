import { redis, settings } from '@devvit/web/server';
import { keySlug } from './cache';

export type CommunitySettings = {
  /** Mod toggle AND the competition hasn't ended (end date or ended early). */
  competitionEnabled: boolean;
  /** The mod toggle alone (true even after the end date has passed). */
  competitionSwitchedOn: boolean;
  /**
   * When the competition ends: the end of the set day (UTC), or the moment a
   * mod ended it early, whichever is first. null = no end yet.
   */
  competitionEndsAt: Date | null;
  /** The end date as typed (YYYY-MM-DD); null when not set. */
  competitionEndDate: string | null;
  /** True when a mod used "End competition now" for this competition. */
  competitionEndedEarly: boolean;
  /**
   * Identifies the current competition (entry flair + end date, or + theme
   * when there's no end date). A new end date or theme = a new competition.
   */
  competitionKey: string;
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
  const theme = textOrNull(competitionTheme);
  const key = competitionKeyFor(flair || null, endDate?.text ?? null, theme);
  const endedEarlyAt = await getEarlyEnd(key);
  const endsAt = earliest(endDate?.endsAt ?? null, endedEarlyAt);

  return {
    // A passed end date, or "End competition now", ends it automatically.
    competitionEnabled:
      competitionEnabled === true &&
      (endsAt === null || Date.now() < endsAt.getTime()),
    competitionSwitchedOn: competitionEnabled === true,
    competitionEndsAt: endsAt,
    competitionEndDate: endDate?.text ?? null,
    competitionEndedEarly: endedEarlyAt !== null,
    competitionKey: key,
    competitionWinnerFlair:
      textOrNull(competitionWinnerFlair) ?? DEFAULT_COMPETITION_WINNER_FLAIR,
    monthlyWinnerFlair:
      textOrNull(monthlyWinnerFlair) ?? DEFAULT_MONTHLY_WINNER_FLAIR,
    winnerFlairTemplateId: textOrNull(winnerFlairTemplateId),
    rankingsIncludeText: rankingsIncludeText === true,
    competitionFlair: flair.length > 0 ? flair : null,
    competitionTheme: theme,
    competitionThemeDescription: textOrNull(competitionThemeDescription),
    competitionPostUrl: httpsUrlOrNull(competitionPostLink),
  };
};

/**
 * The competition's identity. With an end date it's flair + date (the same
 * ID saved awards already use); without one, flair + theme, so setting a new
 * theme starts a new competition after an early end.
 */
const competitionKeyFor = (
  flair: string | null,
  endDate: string | null,
  theme: string | null
): string => {
  const base = keySlug(flair ?? 'all');
  return endDate
    ? `${base}:${endDate}`
    : `${base}:open:${keySlug(theme ?? 'untitled')}`;
};

const earlyEndKey = (competitionKey: string) =>
  `competition:ended-early:${competitionKey}`;

const getEarlyEnd = async (competitionKey: string): Promise<Date | null> => {
  const value = await redis.get(earlyEndKey(competitionKey));
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * "End competition now": records the moment for this competition, so it
 * counts as ended from now on even though the end date (if any) is later.
 * Apps can't change mod settings, so this lives in Redis.
 */
export const endCompetitionEarly = async (
  competitionKey: string
): Promise<void> => {
  await redis.set(earlyEndKey(competitionKey), new Date().toISOString());
};

const earliest = (a: Date | null, b: Date | null): Date | null =>
  a && b ? (a.getTime() <= b.getTime() ? a : b) : (a ?? b);

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
