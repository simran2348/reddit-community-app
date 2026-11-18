import { context, reddit } from '@devvit/web/server';
import type { Post } from '@devvit/web/server';
import type {
  AppRanking,
  RankingPeriod,
  RankingsResponse,
} from '../../shared/api';
import { cached, keySlug } from './cache';
import { getPostImage, isHiddenPost, toPostUrl } from './media';
import { flairMatches, getCommunitySettings } from './settings';

const TOP_COUNT = 10;
const SCAN_LIMIT = 100;
const CACHE_TTL_SECONDS = 10 * 60;
const DESCRIPTION_LENGTH = 160;

/** Turns a markdown post body into a short plain-text description. */
const summarize = (body: string | undefined): string => {
  if (!body) return '';
  const text = body
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > DESCRIPTION_LENGTH
    ? `${text.slice(0, DESCRIPTION_LENGTH - 1).trimEnd()}…`
    : text;
};

const toRanking = (
  post: Post,
  rank: number,
  period: RankingPeriod
): AppRanking => ({
  id: post.id,
  name: post.title,
  description: summarize(post.body),
  author: post.authorName,
  iconUrl: getPostImage(post)?.url ?? null,
  score: post.score,
  commentCount: post.numberOfComments,
  rank,
  period,
  postUrl: toPostUrl(post),
});

const loadRankings = async (
  subredditName: string,
  period: RankingPeriod,
  flair: string | null
): Promise<RankingsResponse> => {
  const posts = await reddit
    .getTopPosts({ subredditName, timeframe: period, limit: SCAN_LIMIT })
    .all();

  const apps = posts
    .filter(
      (post) =>
        !isHiddenPost(post) &&
        !post.stickied &&
        post.id !== context.postId &&
        (flair === null || flairMatches(post.flair?.text, flair))
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_COUNT)
    .map((post, index) => toRanking(post, index + 1, period));

  return {
    period,
    flair,
    apps,
    generatedAt: new Date().toISOString(),
  };
};

export const getRankings = async (
  period: RankingPeriod
): Promise<RankingsResponse> => {
  const { subredditName } = context;
  const { appFlair } = await getCommunitySettings();
  const key = `rankings:${period}:${keySlug(appFlair ?? 'all')}`;
  return cached(key, CACHE_TTL_SECONDS, () =>
    loadRankings(subredditName, period, appFlair)
  );
};
