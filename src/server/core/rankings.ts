import { reddit } from '@devvit/web/server';
import type { Post } from '@devvit/web/server';
import type {
  ImageRanking,
  RankingPeriod,
  RankingsResponse,
} from '../../shared/api';
import { cached } from './cache';
import { getPostImage, isHiddenPost, toPostUrl } from './media';
import { SOURCE_SUBREDDIT } from './source';

const TOP_COUNT = 10;
const SCAN_LIMIT = 100;
const CACHE_TTL_SECONDS = 10 * 60;

const toRanking = (
  post: Post,
  imageUrl: string,
  authorAvatarUrl: string | null,
  rank: number,
  period: RankingPeriod
): ImageRanking => ({
  id: post.id,
  title: post.title,
  author: post.authorName,
  authorAvatarUrl,
  imageUrl,
  score: post.score,
  commentCount: post.numberOfComments,
  rank,
  period,
  postUrl: toPostUrl(post),
});

/** Author snoovatar; null for deleted users, no avatar, or lookup errors. */
const getAvatarUrl = async (username: string): Promise<string | null> => {
  if (!username || username === '[deleted]') return null;
  try {
    const url = await reddit.getSnoovatarUrl(username);
    return url && url.startsWith('https://') ? url : null;
  } catch {
    return null;
  }
};

/** Top image posts in the subreddit for the period, ranked by upvotes. */
const loadRankings = async (
  subreddit: string,
  period: RankingPeriod
): Promise<RankingsResponse> => {
  const posts = await reddit
    .getTopPosts({ subredditName: subreddit, timeframe: period, limit: SCAN_LIMIT })
    .all();

  const top: { post: Post; imageUrl: string }[] = [];
  const sorted = posts
    .filter((post) => !isHiddenPost(post) && !post.stickied)
    .sort((a, b) => b.score - a.score);

  for (const post of sorted) {
    if (top.length >= TOP_COUNT) break;
    const image = getPostImage(post);
    if (image) top.push({ post, imageUrl: image.url });
  }

  const avatars = await Promise.all(
    top.map(({ post }) => getAvatarUrl(post.authorName))
  );

  const images = top.map(({ post, imageUrl }, i) =>
    toRanking(post, imageUrl, avatars[i] ?? null, i + 1, period)
  );

  return {
    period,
    subreddit,
    images,
    generatedAt: new Date().toISOString(),
  };
};

export const getRankings = (period: RankingPeriod): Promise<RankingsResponse> => {
  const subreddit = SOURCE_SUBREDDIT;
  return cached(
    `rankings:images:v2:${subreddit.toLowerCase()}:${period}`,
    CACHE_TTL_SECONDS,
    () => loadRankings(subreddit, period),
    (result) => result.images.length > 0
  );
};
