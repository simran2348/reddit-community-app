import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { createPost } from '../core/post';
import { runWinnerChecks } from '../core/winners';

export const menu = new Hono();

menu.post('/post-create', async (c) => {
  try {
    const post = await createPost();

    return c.json<UiResponse>(
      {
        navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
      },
      200
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: 'Failed to create post',
      },
      400
    );
  }
});

/** Moderator menu: run the hourly winner checks right away. */
menu.post('/winner-checks', async (c) => {
  try {
    const results = await runWinnerChecks();
    return c.json<UiResponse>({ showToast: results.join(' · ') }, 200);
  } catch (error) {
    console.error('[winners] manual check failed', error);
    return c.json<UiResponse>({ showToast: 'Winner checks failed' }, 400);
  }
});
