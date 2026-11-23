/**
 * Pure rules (no Reddit or Redis calls), kept here so they can be unit
 * tested on their own: see rules.test.ts (`npm run test:unit`).
 */

/** Trimmed text, or null when unset or blank. */
export const textOrNull = (value: string | undefined): string | null => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed.length > 0 ? trimmed : null;
};

/**
 * "YYYY-MM-DD" → the end of that day in UTC (23:59:59.999). Anything else
 * (blank, wrong format, impossible date) means no end date.
 */
export const parseEndDate = (
  value: string | undefined
): { text: string; endsAt: Date } | null => {
  const text = textOrNull(value);
  const match = text?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!text || !match) return null;
  const [, y, m, d] = match.map(Number);
  if (y === undefined || m === undefined || d === undefined) return null;
  const endsAt = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
  // Date.UTC rolls over (month 13, 30 Feb), so check nothing moved.
  const valid = endsAt.getUTCMonth() === m - 1 && endsAt.getUTCDate() === d;
  return valid ? { text, endsAt } : null;
};

/** The earlier of two optional dates (null when both are null). */
export const earliest = (a: Date | null, b: Date | null): Date | null =>
  a && b ? (a.getTime() <= b.getTime() ? a : b) : (a ?? b);

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

/** Loose match; flairs with no letters/digits (emoji only) must match exactly. */
const sameFlair = (a: string, b: string): boolean => {
  const loose = normalizeFlair(b);
  return loose.length > 0 ? normalizeFlair(a) === loose : a.trim() === b.trim();
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

/**
 * Fills {placeholders} in a template (winner flairs, announcement posts).
 * Names ignore case and inner spaces ({Theme}, {ThEmE}, { theme } all work);
 * unknown ones are left as typed so a typo is visible rather than silently
 * dropped.
 */
export const fillTemplate = (
  template: string,
  values: Record<string, string>
): string =>
  template.replace(
    /\{\s*(\w+)\s*\}/g,
    (whole, name: string) => values[name.toLowerCase()] ?? whole
  );

/** True when the template uses {name} (any capitalisation / spacing). */
const usesPlaceholder = (template: string, name: string): boolean =>
  new RegExp(`\\{\\s*${name}\\s*\\}`, 'i').test(template);

/** Reddit's limit for post titles. */
export const TITLE_MAX_LENGTH = 300;

/** Filled-in announcement title, cut to Reddit's 300-character limit. */
export const fillAnnouncementTitle = (
  template: string,
  values: Record<string, string>
): string => {
  const title = fillTemplate(template, values).trim();
  return title.length > TITLE_MAX_LENGTH
    ? `${title.slice(0, TITLE_MAX_LENGTH - 1).trimEnd()}…`
    : title;
};

/**
 * Filled-in announcement body. {user} and {post} must always reach the
 * post: if the mods' text leaves either out, a "Winner: …" / "Winning post:
 * …" line is added at the end.
 */
export const fillAnnouncementBody = (
  template: string,
  values: { user: string; post: string } & Record<string, string>
): string => {
  const extra: string[] = [];
  if (!usesPlaceholder(template, 'user')) extra.push(`Winner: ${values.user}`);
  if (!usesPlaceholder(template, 'post')) {
    extra.push(`Winning post: ${values.post}`);
  }
  return [fillTemplate(template, values).trim(), ...extra]
    .filter((part) => part.length > 0)
    .join('\n\n');
};

/**
 * Monthly winners are kept for a year: the month just finished plus the 12
 * before it (e.g. October 2026 stays until October 2027 is awarded alongside
 * it, and is removed when November 2027 is awarded).
 */
export const MONTHLY_KEEP_MONTHS = 12;
const MONTHLY_ID = /^monthly:(\d{4})-(\d{2})$/;

/** Months since year 0, so month ranges are simple subtraction. */
const monthNumber = (year: number, monthIndex: number): number =>
  year * 12 + monthIndex;

/**
 * True for a monthly record older than a year (see MONTHLY_KEEP_MONTHS).
 * Competition records, and IDs that don't parse, are never expired.
 */
export const isExpiredMonthly = (id: string, now: Date): boolean => {
  const match = id.match(MONTHLY_ID);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const lastFinished = monthNumber(now.getUTCFullYear(), now.getUTCMonth()) - 1;
  return monthNumber(year, month - 1) < lastFinished - MONTHLY_KEEP_MONTHS;
};

/** Which posts belong to the current competition, by post time. */
export type CompetitionWindow = {
  /** Previous competition with the same flair ended then; null = no limit. */
  after: Date | null;
  /** This competition ends then; null = no end yet. */
  until: Date | null;
};

/**
 * Posted after the previous competition (same flair) ended and no later than
 * this one's end, so old entries aren't entered again and late posts don't
 * count.
 */
export const isInWindow = (
  createdAt: string,
  window: CompetitionWindow
): boolean => {
  const time = Date.parse(createdAt);
  if (Number.isNaN(time)) return false;
  return (
    (window.after === null || time > window.after.getTime()) &&
    (window.until === null || time <= window.until.getTime())
  );
};
