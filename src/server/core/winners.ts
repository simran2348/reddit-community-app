import { reddit, redis } from '@devvit/web/server';
import { isT3 } from '@devvit/web/shared';
import type { WinnerEntry, WinnerRecord } from '../../shared/api';
import { getAvatarUrl } from './avatars';
import { cached, keySlug } from './cache';
import { getFinalStandings } from './competition';
import { getPostImage, isHiddenPost, toPostUrl } from './media';
import { getCommunitySettings } from './settings';
import { getSourceSubreddit } from './source';

/**
 * Winners records ("hall of fame"), written by the hourly winner checks:
 * - Competition: once the end date has passed, the top post by upvotes wins
 *   (gets the winner flair) and the top 10 are saved.
 * - Monthly: on the 1st, last calendar month's top image post wins (flair +
 *   saved).
 * Records are our own snapshots, so they don't depend on what flair text a
 * subreddit uses or later renames.
 */

const RECORDS_KEY = 'winners:records';
const COMPETITION_TOP_COUNT = 10;
/** Reddit's "month" is the last 30 days, so scan the year and filter dates. */
const MONTHLY_SCAN_LIMIT = 1000;
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const fill = (template: string, values: Record<string, string>): string =>
  template.replace(
    /\{(\w+)\}/g,
    (whole, name: string) => values[name] ?? whole
  );

const isWinnerRecord = (value: unknown): value is WinnerRecord =>
  typeof value === 'object' &&
  value !== null &&
  'id' in value &&
  'label' in value &&
  'entries' in value &&
  Array.isArray(value.entries);

/** How long a "still visible?" check of a winner post is reused. */
const VISIBILITY_CACHE_TTL_SECONDS = 30 * 60;
const VISIBILITY_BATCH_SIZE = 20;

/**
 * Is the winner post still up? Deleted by its author or removed / marked
 * NSFW by mods means hidden. Cached per post for 30 minutes. A failed
 * lookup (Reddit hiccup) counts as visible and isn't cached, so winners
 * never vanish because of a temporary error.
 */
const isStillVisible = async (postId: string): Promise<boolean> => {
  if (!isT3(postId)) return false;
  try {
    const result = await cached(
      `winners:visible:v1:${postId}`,
      VISIBILITY_CACHE_TTL_SECONDS,
      async () => {
        const post = await reddit.getPostById(postId);
        return { visible: !isHiddenPost(post) };
      }
    );
    return result.visible;
  } catch {
    return true;
  }
};

/** Visibility of many posts, a batch at a time. */
const visiblePostIds = async (ids: readonly string[]): Promise<Set<string>> => {
  const unique = [...new Set(ids)];
  const visible = new Set<string>();
  for (let i = 0; i < unique.length; i += VISIBILITY_BATCH_SIZE) {
    const batch = unique.slice(i, i + VISIBILITY_BATCH_SIZE);
    const results = await Promise.all(batch.map(isStillVisible));
    batch.forEach((id, j) => {
      if (results[j]) visible.add(id);
    });
  }
  return visible;
};

/**
 * Saved awards, newest first, without posts that have since been deleted or
 * removed. Awards are final: the others keep their original places (no one
 * moves up), and an award with no posts left is dropped from the list.
 */
export const listWinners = async (): Promise<WinnerRecord[]> => {
  const raw = await redis.hGetAll(RECORDS_KEY);
  const records: WinnerRecord[] = [];
  for (const json of Object.values(raw)) {
    try {
      const parsed: unknown = JSON.parse(json);
      if (isWinnerRecord(parsed)) records.push(parsed);
    } catch {
      // Skip a corrupt record rather than failing the whole list.
    }
  }

  const visible = await visiblePostIds(
    records.flatMap((record) => record.entries.map((entry) => entry.id))
  );
  return records
    .map((record) => ({
      ...record,
      entries: record.entries.filter((entry) => visible.has(entry.id)),
    }))
    .filter((record) => record.entries.length > 0)
    .sort((a, b) => b.awardedAt.localeCompare(a.awardedAt));
};

const hasRecord = async (id: string): Promise<boolean> =>
  (await redis.hGet(RECORDS_KEY, id)) !== undefined;

const saveRecord = (record: WinnerRecord) =>
  redis.hSet(RECORDS_KEY, { [record.id]: JSON.stringify(record) });

/** Applies the winner flair; a failure is logged, the record is kept. */
const applyFlair = async (
  postId: string,
  text: string,
  templateId: string | null
): Promise<void> => {
  if (!isT3(postId)) return;
  try {
    await reddit.setPostFlair({
      subredditName: getSourceSubreddit(),
      postId,
      text,
      ...(templateId ? { flairTemplateId: templateId } : {}),
    });
    console.log(`[winners] flair "${text}" set on ${postId}`);
  } catch (error) {
    console.error(`[winners] could not set flair on ${postId}`, error);
  }
};

/** Awards the competition once its end date has passed. */
export const checkCompetitionWinner = async (): Promise<string> => {
  const settings = await getCommunitySettings();
  const { competitionEndsAt: endsAt, competitionEndDate: endDate } = settings;
  if (!settings.competitionSwitchedOn || !endsAt || !endDate) {
    return 'competition: no end date set';
  }
  if (Date.now() < endsAt.getTime())
    return `competition: runs until ${endDate}`;

  const flair = settings.competitionFlair;
  const id = `competition:${keySlug(flair ?? 'all')}:${endDate}`;
  if (await hasRecord(id)) return 'competition: already awarded';

  const standings = await getFinalStandings(flair, COMPETITION_TOP_COUNT);
  const year = String(endsAt.getUTCFullYear());
  const theme = settings.competitionTheme ?? flair ?? 'Photo competition';
  const label = `${theme} ${year}`;
  const entries: WinnerEntry[] = standings.map((entry, i) => ({
    id: entry.id,
    title: entry.title,
    author: entry.author,
    authorAvatarUrl: entry.authorAvatarUrl,
    imageUrl: entry.imageUrl,
    score: entry.score,
    rank: i + 1,
    postUrl: entry.postUrl,
  }));

  // Saved even with no entries, so the same competition isn't re-checked.
  await saveRecord({
    id,
    kind: 'competition',
    label,
    awardedAt: new Date().toISOString(),
    entries,
  });

  const winner = entries[0];
  if (!winner) return `competition: "${label}" ended with no entries`;
  await applyFlair(
    winner.id,
    fill(settings.competitionWinnerFlair, { theme, year }),
    settings.winnerFlairTemplateId
  );
  return `competition: "${label}" won by ${winner.id}`;
};

/** Awards last calendar month's top image post (once per month). */
export const checkMonthlyWinner = async (): Promise<string> => {
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)
  );
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthKey = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`;
  const id = `monthly:${monthKey}`;
  if (await hasRecord(id)) return `monthly: ${monthKey} already awarded`;

  const posts = await reddit
    .getTopPosts({
      subredditName: getSourceSubreddit(),
      timeframe: 'year',
      limit: MONTHLY_SCAN_LIMIT,
    })
    .all();
  const top = posts
    .filter((post) => {
      const time = post.createdAt.getTime();
      return (
        time >= start.getTime() &&
        time < end.getTime() &&
        !isHiddenPost(post) &&
        !post.stickied &&
        getPostImage(post) !== null
      );
    })
    .sort((a, b) => b.score - a.score)[0];

  const month = MONTH_NAMES[start.getUTCMonth()] ?? monthKey;
  const year = String(start.getUTCFullYear());
  const label = `${month} ${year}`;
  const image = top ? getPostImage(top) : null;

  const entries: WinnerEntry[] =
    top && image
      ? [
          {
            id: top.id,
            title: top.title,
            author: top.authorName,
            authorAvatarUrl: await getAvatarUrl(top.authorName),
            imageUrl: image.url,
            score: top.score,
            rank: 1,
            postUrl: toPostUrl(top),
          },
        ]
      : [];

  await saveRecord({
    id,
    kind: 'monthly',
    label,
    awardedAt: new Date().toISOString(),
    entries,
  });

  const winner = entries[0];
  if (!winner) return `monthly: no image posts in ${label}`;
  const settings = await getCommunitySettings();
  await applyFlair(
    winner.id,
    fill(settings.monthlyWinnerFlair, { month, year }),
    settings.winnerFlairTemplateId
  );
  return `monthly: ${label} won by ${winner.id}`;
};

/** Both checks; each is safe to run repeatedly (one award per period). */
export const runWinnerChecks = async (): Promise<string[]> => {
  const results: string[] = [];
  for (const check of [checkCompetitionWinner, checkMonthlyWinner]) {
    try {
      results.push(await check());
    } catch (error) {
      console.error('[winners] check failed', error);
      results.push(`${check.name}: failed (see logs)`);
    }
  }
  console.log(`[winners] ${results.join(' | ')}`);
  return results;
};
