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
import { cached, keySlug } from './cache';
import { getPostImage, hiddenReason, isHiddenPost, toPostUrl } from './media';
import { flairMatches, getCommunitySettings } from './settings';
import { isFromSourceSubreddit, SOURCE_SUBREDDIT } from './source';

/**
 * How far back to look for entries: Reddit listings page back through about
 * the 1,000 newest posts (10 requests of 100, cached for 5 minutes). Reddit
 * search can't be used instead: it doesn't match flairs written with emoji or
 * decorative Unicode letters, which competition flairs often use.
 */
const SCAN_LIMIT = 1000;
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
 * fresh competition without touching the votes of the previous one. The source
 * subreddit is included so switching it also starts fresh.
 */
const keys = (flair: Flair) => {
  const scope = `competition:${keySlug(SOURCE_SUBREDDIT)}:${keySlug(flair ?? 'all')}`;
  return {
    entries: `${scope}:entries:v4`,
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
    `[competition] r/${SOURCE_SUBREDDIT} flair=${JSON.stringify(flair)} ` +
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

const loadEntries = async (flair: Flair): Promise<CachedEntry[]> => {
  const posts = await reddit
    .getNewPosts({ subredditName: SOURCE_SUBREDDIT, limit: SCAN_LIMIT })
    .all();

  logEntryDiagnostics(flair, posts);

  return posts
    .filter((post) => isEligiblePost(post, flair))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map(toCachedEntry)
    .filter((entry): entry is CachedEntry => entry !== null);
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
  const cachedEntries = await getCachedEntries(flair);
  const [counts, viewer] = await Promise.all([
    readCounts(flair),
    readViewer(flair, cachedEntries),
  ]);

  const entries: CompetitionEntry[] = cachedEntries.map(
    ({ authorId: _authorId, ...entry }) => ({
      ...entry,
      voteCount: counts[entry.id] ?? 0,
    })
  );

  return { subreddit: SOURCE_SUBREDDIT, flair, entries, viewer };
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
