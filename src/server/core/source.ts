/**
 * Subreddit whose posts power Top Images and the Photo Competition.
 * Hardcoded for now; switch back to `context.subredditName` to use the
 * subreddit the app is installed in.
 */
export const SOURCE_SUBREDDIT = 'DesiTown';

export const isFromSourceSubreddit = (subredditName: string): boolean =>
  subredditName.toLowerCase() === SOURCE_SUBREDDIT.toLowerCase();
