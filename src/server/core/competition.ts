import { context, reddit, redis } from '@devvit/web/server';
import type { Post } from '@devvit/web/server';
import { isT3 } from '@devvit/web/shared';
import type {
  CompetitionEntry,
  CompetitionResponse,
  VoteCountsResponse,
  VoteErrorCode,
  VoteResponse,
  ViewerVoteState,
} from '../../shared/api';
import { getAvatarUrls } from './avatars';
import { cached, keySlug } from './cache';
import { getPostImage, hiddenReason, isHiddenPost, toPostUrl } from './media';
import { flairMatches, getCommunitySettings } from './settings';
import { getSourceSubreddit, isFromSourceSubreddit } from './source';

/**
 * One-time backfill depth: Reddit listings page back through about the 1,000
 * newest posts. After that, triggers keep the index current. (Reddit search
 * can't be used: it doesn't match flairs with emoji or decorative Unicode.)
 */
const BACKFILL_SCAN_LIMIT = 1000;
/**
 * Newest posts re-checked by the 15-minute catch-up job, in case a trigger
 * was missed. One listing page, so it stays cheap.
 */
const CATCH_UP_SCAN_LIMIT = 100;
/** Most recent entries shown (each is fetched by ID when the cache refreshes). */
const MAX_ENTRIES = 500;
/** Parallel post lookups when building the entry list. */
const FETCH_BATCH_SIZE = 20;
const ENTRIES_CACHE_TTL_SECONDS = 5 * 60;
const POST_ID_PATTERN = /^t3_[a-z0-9]+$/i;

/** Entry data cached from Reddit; vote counts are always read live. */
type CachedEntry = Omit<CompetitionEntry, 'voteCount'> & {
  authorId: string | null;
};

/** null means every image post in the subreddit is an entry. */
type Flair = string | null;

/**
 * Redis keys are scoped by flair, so changing the competition flair starts a
 * fresh competition without touching the votes of the previous one. Redis is
 * already isolated per installation (and so per subreddit).
 */
const keys = (flair: Flair) => {
  const scope = `competition:${keySlug(flair ?? 'all')}`;
  return {
    /** Sorted set of entry post IDs, scored by post time (ms). */
    index: `${scope}:index`,
    /** Set once the one-time backfill scan has run for this scope. */
    seeded: `${scope}:seeded`,
    /** Short-lived cache of the built entry list. */
    entries: `${scope}:entries:v6`,
    counts: `${scope}:counts`,
    userVotes: (userId: string) => `${scope}:user:${userId}`,
  };
};

export class VoteError extends Error {
  readonly code: VoteErrorCode;
  readonly httpStatus: 400 | 401 | 403 | 409 | 500;

  constructor(
    code: VoteErrorCode,
    message: string,
    httpStatus: 400 | 401 | 403 | 409 | 500
  ) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

/** Reads settings and fails if moderators have switched the competition off. */
const requireCompetition = async (): Promise<Flair> => {
  const { competitionEnabled, competitionFlair } = await getCommunitySettings();
  if (!competitionEnabled) {
    throw new VoteError(
      'COMPETITION_DISABLED',
      'The photo competition is not running right now.',
      403
    );
  }
  return competitionFlair;
};

/**
 * Belongs in the index: right subreddit and flair. Image and moderation state
 * are checked when entries are shown instead, because a just-submitted post's
 * image may still be processing and removed posts can be re-approved.
 */
const isIndexable = (post: Post, flair: Flair): boolean =>
  isFromSourceSubreddit(post.subredditName) &&
  flairMatches(post.flair?.text, flair);

/** Displayable right now: indexable, has an image, not removed/NSFW. */
const isEligiblePost = (post: Post, flair: Flair): boolean =>
  isFromSourceSubreddit(post.subredditName) &&
  !isHiddenPost(post) &&
  flairMatches(post.flair?.text, flair) &&
  getPostImage(post) !== null;

const toCachedEntry = (post: Post): CachedEntry | null => {
  const image = getPostImage(post);
  if (!image) return null;
  return {
    id: post.id,
    title: post.title,
    author: post.authorName,
    authorId: post.authorId ?? null,
    // Filled in after, in one batched (and cached) lookup for all entries.
    authorAvatarUrl: null,
    score: post.score,
    commentCount: post.numberOfComments,
    imageUrl: image.url,
    imageWidth: image.width,
    imageHeight: image.height,
    flair: post.flair?.text ?? '',
    createdAt: post.createdAt.toISOString(),
    postUrl: toPostUrl(post),
  };
};

/**
 * Logs how many posts were scanned and why candidates were dropped, so a
 * missing entry can be explained from `devvit logs`.
 */
const logEntryDiagnostics = (flair: Flair, posts: Post[]): void => {
  const flairsSeen = new Map<string, number>();
  const dropped: string[] = [];
  let eligible = 0;
  for (const post of posts) {
    const text = post.flair?.text ?? '(no flair)';
    flairsSeen.set(text, (flairsSeen.get(text) ?? 0) + 1);
    if (!flairMatches(post.flair?.text, flair)) continue;
    const reason =
      hiddenReason(post) ??
      (getPostImage(post) === null ? 'no image found' : null);
    if (reason) dropped.push(`${post.id} "${post.title}" → ${reason}`);
    else eligible += 1;
  }
  console.log(
    `[competition] backfill r/${getSourceSubreddit()} flair=${JSON.stringify(flair)} ` +
      `scanned=${posts.length} eligible=${eligible}`
  );
  console.log(
    `[competition] flairs seen: ${JSON.stringify(Object.fromEntries(flairsSeen))}`
  );
  if (dropped.length > 0) {
    console.log(
      `[competition] flair matched but dropped:\n${dropped.join('\n')}`
    );
  }
};

// ---------- Entry index (kept current by triggers) ----------

const addToIndex = (flair: Flair, post: Post) =>
  redis.zAdd(keys(flair).index, {
    member: post.id,
    score: post.createdAt.getTime(),
  });

/** Drops the cached entry list so the next request rebuilds it. */
const invalidateEntries = (flair: Flair) => redis.del(keys(flair).entries);

/**
 * Seeds the index once per competition scope from the newest posts, so
 * entries posted before the triggers existed (or before this flair was set)
 * are included. Later posts arrive through triggers.
 */
const ensureSeeded = async (flair: Flair): Promise<void> => {
  const k = keys(flair);
  if (await redis.get(k.seeded)) return;

  const posts = await reddit
    .getNewPosts({
      subredditName: getSourceSubreddit(),
      limit: BACKFILL_SCAN_LIMIT,
    })
    .all();
  logEntryDiagnostics(flair, posts);

  const indexable = posts.filter((post) => isIndexable(post, flair));
  if (indexable.length > 0) {
    await redis.zAdd(
      k.index,
      ...indexable.map((post) => ({
        member: post.id,
        score: post.createdAt.getTime(),
      }))
    );
  }
  await redis.set(k.seeded, new Date().toISOString());
};

/**
 * Re-checks one post against the current competition and adds it to, or
 * removes it from, the index. Called by the post submit / flair triggers.
 */
export const syncPostEntry = async (postId: string): Promise<void> => {
  if (!isT3(postId)) return;
  const { competitionFlair: flair } = await getCommunitySettings();

  let post: Post;
  try {
    post = await reddit.getPostById(postId);
  } catch {
    await removePostEntry(postId);
    return;
  }

  if (isIndexable(post, flair)) {
    await addToIndex(flair, post);
    console.log(`[competition] indexed ${post.id} "${post.title}"`);
  } else {
    await redis.zRem(keys(flair).index, [post.id]);
  }
  await invalidateEntries(flair);
};

/**
 * Safety net for missed triggers, run every 15 minutes by the scheduler.
 * Re-checks the newest posts: matching posts are added (re-adding one that's
 * already indexed just rewrites the same post time, so nothing duplicates and
 * votes are untouched), and indexed posts whose flair no longer matches are
 * removed. The entry cache is only cleared if something changed.
 */
export const catchUpEntries = async (): Promise<void> => {
  const { competitionEnabled, competitionFlair: flair } =
    await getCommunitySettings();
  if (!competitionEnabled) return;

  // First run for this flair: the full backfill covers the newest posts.
  await ensureSeeded(flair);

  const k = keys(flair);
  const posts = await reddit
    .getNewPosts({
      subredditName: getSourceSubreddit(),
      limit: CATCH_UP_SCAN_LIMIT,
    })
    .all();

  const added: Post[] = [];
  const removed: string[] = [];
  for (const post of posts) {
    const indexed = typeof (await redis.zScore(k.index, post.id)) === 'number';
    if (isIndexable(post, flair)) {
      if (!indexed) added.push(post);
    } else if (indexed) {
      removed.push(post.id);
    }
  }

  if (added.length > 0) {
    await redis.zAdd(
      k.index,
      ...added.map((post) => ({
        member: post.id,
        score: post.createdAt.getTime(),
      }))
    );
  }
  if (removed.length > 0) await redis.zRem(k.index, removed);
  if (added.length > 0 || removed.length > 0) await invalidateEntries(flair);

  console.log(
    `[competition] catch-up scanned=${posts.length} added=${added.length} removed=${removed.length}` +
      added.map((post) => `\n  + ${post.id} "${post.title}"`).join('')
  );
};

/** Removes a post from the index (e.g. it was deleted). */
export const removePostEntry = async (postId: string): Promise<void> => {
  const { competitionFlair: flair } = await getCommunitySettings();
  await redis.zRem(keys(flair).index, [postId]);
  await invalidateEntries(flair);
};

/** Fetches posts by ID in small parallel batches; missing posts are skipped. */
const fetchPosts = async (ids: string[]): Promise<Post[]> => {
  const posts: Post[] = [];
  for (let i = 0; i < ids.length; i += FETCH_BATCH_SIZE) {
    const requests: Promise<Post>[] = [];
    for (const id of ids.slice(i, i + FETCH_BATCH_SIZE)) {
      if (isT3(id)) requests.push(reddit.getPostById(id));
    }
    const results = await Promise.allSettled(requests);
    for (const result of results) {
      if (result.status === 'fulfilled') posts.push(result.value);
    }
  }
  return posts;
};

/**
 * Builds the entry list from the index, newest first. Every post is
 * re-checked, so removed, NSFW or re-flaired posts drop out (and come back if
 * restored). Deleted posts are pruned from the index.
 */
const loadEntries = async (flair: Flair): Promise<CachedEntry[]> => {
  await ensureSeeded(flair);
  const k = keys(flair);
  const ranked = await redis.zRange(k.index, 0, MAX_ENTRIES - 1, {
    by: 'rank',
    reverse: true,
  });
  const ids = ranked.map((item) => item.member);
  const posts = await fetchPosts(ids);

  const found = new Set<string>(posts.map((post) => post.id));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length > 0) await redis.zRem(k.index, missing);

  console.log(
    `[competition] index=${ids.length} fetched=${posts.length} pruned=${missing.length}`
  );

  const entries = posts
    .filter((post) => isEligiblePost(post, flair))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map(toCachedEntry)
    .filter((entry): entry is CachedEntry => entry !== null);

  const avatars = await getAvatarUrls(entries.map((entry) => entry.author));
  return entries.map((entry) => ({
    ...entry,
    authorAvatarUrl: avatars.get(entry.author) ?? null,
  }));
};

const getCachedEntries = (flair: Flair): Promise<CachedEntry[]> =>
  cached(
    keys(flair).entries,
    ENTRIES_CACHE_TTL_SECONDS,
    () => loadEntries(flair),
    (entries) => entries.length > 0
  );

const readCounts = async (flair: Flair): Promise<Record<string, number>> => {
  const raw = await redis.hGetAll(keys(flair).counts);
  const counts: Record<string, number> = {};
  for (const [postId, value] of Object.entries(raw)) {
    const parsed = Number.parseInt(value, 10);
    counts[postId] = Number.isFinite(parsed) ? parsed : 0;
  }
  return counts;
};

const readViewer = async (
  flair: Flair,
  entries: CachedEntry[]
): Promise<ViewerVoteState> => {
  const { userId } = context;
  if (!userId) {
    return { isLoggedIn: false, votedPostIds: [], ownPostIds: [] };
  }
  const votes = await redis.hGetAll(keys(flair).userVotes(userId));
  return {
    isLoggedIn: true,
    votedPostIds: Object.keys(votes),
    ownPostIds: entries
      .filter((entry) => entry.authorId === userId)
      .map((entry) => entry.id),
  };
};

export const getCompetition = async (): Promise<CompetitionResponse> => {
  const flair = await requireCompetition();
  const { competitionTheme, competitionThemeDescription, competitionPostUrl } =
    await getCommunitySettings();
  const cachedEntries = await getCachedEntries(flair);
  const [counts, viewer] = await Promise.all([
    readCounts(flair),
    readViewer(flair, cachedEntries),
  ]);

  // Most Reddit upvotes first; ties keep the cached newest-first order.
  const entries: CompetitionEntry[] = cachedEntries
    .map(({ authorId: _authorId, ...entry }) => ({
      ...entry,
      voteCount: counts[entry.id] ?? 0,
    }))
    .sort((a, b) => b.score - a.score);

  return {
    subreddit: getSourceSubreddit(),
    flair,
    theme: {
      title: competitionTheme,
      description: competitionThemeDescription,
      postUrl: competitionPostUrl,
    },
    entries,
    viewer,
  };
};

export const getVoteCounts = async (): Promise<VoteCountsResponse> => {
  const flair = await requireCompetition();
  const cachedEntries = await getCachedEntries(flair);
  const [counts, viewer] = await Promise.all([
    readCounts(flair),
    readViewer(flair, cachedEntries),
  ]);
  return { counts, viewer };
};

/**
 * Records a vote. Every rule is enforced here on the server:
 * - the competition must be enabled in the subreddit settings,
 * - the voter must be logged in (identity comes from the Devvit context),
 * - the post must currently be an eligible entry,
 * - users cannot vote for their own photo,
 * - one vote per user per entry (atomic HSETNX on the user's vote hash).
 */
export const submitVote = async (postId: unknown): Promise<VoteResponse> => {
  const flair = await requireCompetition();

  const { userId } = context;
  if (!userId) {
    throw new VoteError('NOT_LOGGED_IN', 'Log in to Reddit to vote.', 401);
  }
  if (
    typeof postId !== 'string' ||
    !POST_ID_PATTERN.test(postId) ||
    !isT3(postId)
  ) {
    throw new VoteError('INVALID_REQUEST', 'Invalid entry.', 400);
  }

  let post: Post;
  try {
    post = await reddit.getPostById(postId);
  } catch {
    throw new VoteError('NOT_ELIGIBLE', 'This entry no longer exists.', 403);
  }
  if (!isEligiblePost(post, flair) || post.archived) {
    throw new VoteError(
      'NOT_ELIGIBLE',
      'This post is not part of the current competition.',
      403
    );
  }
  if (post.authorId === userId) {
    throw new VoteError('OWN_ENTRY', "You can't vote for your own photo.", 403);
  }

  const k = keys(flair);
  const userVotesKey = k.userVotes(userId);
  const recorded = await redis.hSetNX(
    userVotesKey,
    post.id,
    new Date().toISOString()
  );
  if (recorded === 0) {
    throw new VoteError(
      'ALREADY_VOTED',
      'You already voted for this photo.',
      409
    );
  }

  let voteCount: number;
  try {
    voteCount = await redis.hIncrBy(k.counts, post.id, 1);
  } catch (error) {
    // Roll back the vote marker so the user can retry.
    await redis.hDel(userVotesKey, [post.id]);
    throw error;
  }

  const entries = await getCachedEntries(flair);
  const viewer = await readViewer(flair, entries);
  return { status: 'ok', postId: post.id, voteCount, viewer };
};
