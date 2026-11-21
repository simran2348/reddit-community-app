import { context } from '@devvit/web/server';

/**
 * Subreddit whose posts power Top Images and the Photo Competition: the one
 * the app is installed in. Triggers (new posts, flair changes) only fire for
 * this subreddit, so the competition index depends on it being the source.
 */
export const getSourceSubreddit = (): string => context.subredditName;
// export const getSourceSubreddit = (): string => 'IndianFashion';

export const isFromSourceSubreddit = (subredditName: string): boolean =>
  subredditName.toLowerCase() === getSourceSubreddit().toLowerCase();
