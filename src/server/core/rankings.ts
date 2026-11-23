import { reddit } from '@devvit/web/server';
import type { Post } from '@devvit/web/server';
import type {
  ImageRanking,
  RankingPeriod,
  RankingsResponse,
} from '../../shared/api';
import { getAvatarUrl } from './avatars';
import { cached } from './cache';
import { getPostImage, isHiddenPost, toPostUrl } from './media';
import { getCommunitySettings } from './settings';
import { getSourceSubreddit } from './source';
import { getAnnouncementPostIds } from './announcements';

const TOP_COUNT = 10;
const SCAN_LIMIT = 100;
const CACHE_TTL_SECONDS = 10 * 60;
/** Characters of a text post's body sent for its card. */
const BODY_EXCERPT_LENGTH = 400;

type Ranked = { post: Post; imageUrl: string | null; body: string | null };

/** Self (text) post: its URL is its own comments page. */
const isTextPost = (post: Post): boolean =>
  post.url.includes(post.permalink) || post.url.length === 0;

const excerpt = (text: string | undefined): string | null => {
  const trimmed = (text ?? '').replace(/\s+/g, ' ').trim();
  if (trimmed.length === 0) return null;
  return trimmed.length > BODY_EXCERPT_LENGTH
    ? `${trimmed.slice(0, BODY_EXCERPT_LENGTH).trimEnd()}…`
    : trimmed;
};

const toRanking = (
  { post, imageUrl, body }: Ranked,
  authorAvatarUrl: string | null,
  rank: number,
  period: RankingPeriod
): ImageRanking => ({
  id: post.id,
  title: post.title,
  author: post.authorName,
  authorAvatarUrl,
  imageUrl,
  body,
  score: post.score,
  commentCount: post.numberOfComments,
  rank,
  period,
  postUrl: toPostUrl(post),
});

/**
 * Top posts in the subreddit for the period, ranked by upvotes: image posts,
 * plus text posts when the mods turn that on.
 */
const loadRankings = async (
  subreddit: string,
  period: RankingPeriod,
  includeText: boolean
): Promise<RankingsResponse> => {
  const posts = await reddit
    .getTopPosts({
      subredditName: subreddit,
      timeframe: period,
      limit: SCAN_LIMIT,
    })
    .all();

  // The app's winner announcements repost winning photos; leave them out.
  const announcements = await getAnnouncementPostIds();
  const top: Ranked[] = [];
  const sorted = posts
    .filter(
      (post) =>
        !isHiddenPost(post) && !post.stickied && !announcements.has(post.id)
    )
    .sort((a, b) => b.score - a.score);

  for (const post of sorted) {
    if (top.length >= TOP_COUNT) break;
    const image = getPostImage(post);
    if (image) top.push({ post, imageUrl: image.url, body: null });
    else if (includeText && isTextPost(post)) {
      top.push({ post, imageUrl: null, body: excerpt(post.body) });
    }
  }

  const avatars = await Promise.all(
    top.map(({ post }) => getAvatarUrl(post.authorName))
  );

  const images = top.map((entry, i) =>
    toRanking(entry, avatars[i] ?? null, i + 1, period)
  );

  return {
    period,
    subreddit,
    images,
    generatedAt: new Date().toISOString(),
  };
};

export const getRankings = async (
  period: RankingPeriod
): Promise<RankingsResponse> => {
  const subreddit = getSourceSubreddit();
  const { rankingsIncludeText } = await getCommunitySettings();
  const kind = rankingsIncludeText ? 'all' : 'images';
  return cached(
    `rankings:${kind}:v3:${subreddit.toLowerCase()}:${period}`,
    CACHE_TTL_SECONDS,
    () => loadRankings(subreddit, period, rankingsIncludeText),
    (result) => result.images.length > 0
  );
};
