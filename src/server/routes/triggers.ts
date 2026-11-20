import { Hono } from 'hono';
import type {
  OnAppInstallRequest,
  OnPostDeleteRequest,
  OnPostFlairUpdateRequest,
  OnPostSubmitRequest,
  TriggerResponse,
} from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { removePostEntry, syncPostEntry } from '../core/competition';
import { createPost } from '../core/post';

export const triggers = new Hono();

const ok = (message: string): TriggerResponse => ({
  status: 'success',
  message,
});

/** Event payloads may carry bare IDs; normalise to the `t3_` form. */
const toPostId = (id: string | undefined): string | null => {
  if (!id) return null;
  return id.startsWith('t3_') ? id : `t3_${id}`;
};

triggers.post('/on-app-install', async (c) => {
  try {
    const post = await createPost();
    const input = await c.req.json<OnAppInstallRequest>();

    return c.json<TriggerResponse>(
      ok(
        `Post created in subreddit ${context.subredditName} with id ${post.id} (trigger: ${input.type})`
      ),
      200
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<TriggerResponse>(
      {
        status: 'error',
        message: 'Failed to create post',
      },
      400
    );
  }
});

/**
 * Competition index triggers. A new post or a flair change re-checks the post
 * (flair, image, moderation state) and adds it to or removes it from the
 * index; a deletion removes it. Failures are logged, never retried loudly, as
 * the next backfill or page load will still re-check entries.
 */
triggers.post('/on-post-submit', async (c) => {
  try {
    const body = await c.req.json<OnPostSubmitRequest>();
    const postId = toPostId(body.post?.id);
    if (postId) await syncPostEntry(postId);
    return c.json<TriggerResponse>(ok(`post submit: ${postId ?? 'no post'}`));
  } catch (error) {
    console.error('[competition] post submit trigger failed', error);
    return c.json<TriggerResponse>(ok('post submit: failed (logged)'));
  }
});

triggers.post('/on-post-flair-update', async (c) => {
  try {
    const body = await c.req.json<OnPostFlairUpdateRequest>();
    const postId = toPostId(body.post?.id);
    if (postId) await syncPostEntry(postId);
    return c.json<TriggerResponse>(ok(`flair update: ${postId ?? 'no post'}`));
  } catch (error) {
    console.error('[competition] flair update trigger failed', error);
    return c.json<TriggerResponse>(ok('flair update: failed (logged)'));
  }
});

triggers.post('/on-post-delete', async (c) => {
  try {
    const body = await c.req.json<OnPostDeleteRequest>();
    const postId = toPostId(body.postId);
    if (postId) await removePostEntry(postId);
    return c.json<TriggerResponse>(ok(`post delete: ${postId ?? 'no post'}`));
  } catch (error) {
    console.error('[competition] post delete trigger failed', error);
    return c.json<TriggerResponse>(ok('post delete: failed (logged)'));
  }
});
