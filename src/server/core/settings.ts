import { redis, settings } from '@devvit/web/server';
import { keySlug } from './cache';
import { earliest, parseEndDate, textOrNull } from './rules';

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
  /**
   * Optional flair template IDs (Mod Tools → Post flair) giving each winner
   * flair its style; the text above always replaces the template's text.
   * null = plain text flair.
   */
  competitionWinnerFlairTemplateId: string | null;
  monthlyWinnerFlairTemplateId: string | null;
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
    competitionWinnerFlairTemplateId,
    monthlyWinnerFlairTemplateId,
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
    settings.get<string>('competitionWinnerFlairTemplateId'),
    settings.get<string>('monthlyWinnerFlairTemplateId'),
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
    competitionWinnerFlairTemplateId: textOrNull(
      competitionWinnerFlairTemplateId
    ),
    monthlyWinnerFlairTemplateId: textOrNull(monthlyWinnerFlairTemplateId),
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
