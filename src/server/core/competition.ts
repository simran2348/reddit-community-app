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
import { getPostImage, isHiddenPost, toPostUrl } from './media';
import { flairMatches, getCommunitySettings } from './settings';

const SCAN_LIMIT = 100;
const ENTRIES_CACHE_TTL_SECONDS = 5 * 60;
const POST_ID_PATTERN = /^t3_[a-z0-9]+$/i;

/** Entry data cached from Reddit; vote counts are always read live. */
type CachedEntry = Omit<CompetitionEntry, 'voteCount'> & {
  authorId: string | null;
};

/**
 * Redis keys are scoped by flair, so changing the competition flair starts a
 * fresh competition without touching the votes of the previous one.
 */
const keys = (flair: string) => {
  const scope = `competition:${keySlug(flair)}`;
  return {
    entries: `${scope}:entries`,
    counts: `${scope}:counts`,
    ballot: `${scope}:ballot`,
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

const isEligiblePost = (post: Post, flair: string): boolean =>
  post.subredditId === context.subredditId &&
  !isHiddenPost(post) &&
  flairMatches(post.flair?.text, flair) &&
  getPostImage(post) !== null;

const toCachedEntry = (post: Post, flair: string): CachedEntry | null => {
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
    flair: post.flair?.text ?? flair,
    createdAt: post.createdAt.toISOString(),
    postUrl: toPostUrl(post),
  };
};

const loadEntries = async (flair: string): Promise<CachedEntry[]> => {
  const posts = await reddit
    .getNewPosts({ subredditName: context.subredditName, limit: SCAN_LIMIT })
    .all();

  return posts
    .filter((post) => isEligiblePost(post, flair))
    .map((post) => toCachedEntry(post, flair))
    .filter((entry): entry is CachedEntry => entry !== null);
};

const getCachedEntries = (flair: string): Promise<CachedEntry[]> =>
  cached(keys(flair).entries, ENTRIES_CACHE_TTL_SECONDS, () =>
    loadEntries(flair)
  );

const readCounts = async (flair: string): Promise<Record<string, number>> => {
  const raw = await redis.hGetAll(keys(flair).counts);
  const counts: Record<string, number> = {};
  for (const [postId, value] of Object.entries(raw)) {
    const parsed = Number.parseInt(value, 10);
    counts[postId] = Number.isFinite(parsed) ? parsed : 0;
  }
  return counts;
};

const readViewer = async (
  flair: string,
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
  const { competitionFlair, singleVote } = await getCommunitySettings();
  const cachedEntries = await getCachedEntries(competitionFlair);
  const [counts, viewer] = await Promise.all([
    readCounts(competitionFlair),
    readViewer(competitionFlair, cachedEntries),
  ]);

  const entries: CompetitionEntry[] = cachedEntries.map(
    ({ authorId: _authorId, ...entry }) => ({
      ...entry,
      voteCount: counts[entry.id] ?? 0,
    })
  );

  return { flair: competitionFlair, singleVote, entries, viewer };
};

export const getVoteCounts = async (): Promise<VoteCountsResponse> => {
  const { competitionFlair } = await getCommunitySettings();
  const cachedEntries = await getCachedEntries(competitionFlair);
  const [counts, viewer] = await Promise.all([
    readCounts(competitionFlair),
    readViewer(competitionFlair, cachedEntries),
  ]);
  return { counts, viewer };
};

/**
 * Records a vote. Every rule is enforced here on the server:
 * - the voter must be logged in (identity comes from the Devvit context),
 * - the post must currently be an eligible entry for the configured flair,
 * - users cannot vote for their own photo,
 * - one vote per user per entry (atomic HSETNX on the user's vote hash),
 * - optionally one vote per user per competition (atomic HSETNX on a ballot).
 */
export const submitVote = async (postId: unknown): Promise<VoteResponse> => {
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

  const { competitionFlair, singleVote } = await getCommunitySettings();
  const k = keys(competitionFlair);

  let post: Post;
  try {
    post = await reddit.getPostById(postId);
  } catch {
    throw new VoteError('NOT_ELIGIBLE', 'This entry no longer exists.', 403);
  }
  if (!isEligiblePost(post, competitionFlair) || post.archived) {
    throw new VoteError(
      'NOT_ELIGIBLE',
      'This post is not part of the current competition.',
      403
    );
  }
  if (post.authorId === userId) {
    throw new VoteError(
      'OWN_ENTRY',
      "You can't vote for your own photo.",
      403
    );
  }

  let claimedBallot = false;
  if (singleVote) {
    const claimed = await redis.hSetNX(k.ballot, userId, post.id);
    if (claimed === 0) {
      const existing = await redis.hGet(k.ballot, userId);
      if (existing === post.id) {
        throw new VoteError(
          'ALREADY_VOTED',
          'You already voted for this photo.',
          409
        );
      }
      throw new VoteError(
        'VOTE_LIMIT_REACHED',
        'You have already used your vote in this competition.',
        409
      );
    }
    claimedBallot = true;
  }

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
    // Roll back the vote markers so the user can retry.
    await redis.hDel(userVotesKey, [post.id]);
    if (claimedBallot) await redis.hDel(k.ballot, [userId]);
    throw error;
  }

  const entries = await getCachedEntries(competitionFlair);
  const viewer = await readViewer(competitionFlair, entries);
  return { status: 'ok', postId: post.id, voteCount, viewer };
};
