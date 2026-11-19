import { context, reddit } from '@devvit/web/server';

/** Creates the app's custom post, titled for the subreddit it's posted in. */
export const createPost = async () => {
  return await reddit.submitCustomPost({
    title: `Welcome to r/${context.subredditName}`,
  });
};
