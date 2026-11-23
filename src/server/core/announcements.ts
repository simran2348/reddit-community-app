import { media, reddit, redis } from '@devvit/web/server';
import type { Post } from '@devvit/web/server';
import type { WinnerEntry } from '../../shared/api';
import { fillAnnouncementBody, fillAnnouncementTitle } from './rules';
import type { AnnouncementSettings } from './settings';
import { getSourceSubreddit } from './source';

/**
 * Hash: announcement post ID → award ID. Used to keep the app's own
 * announcement posts out of Top posts, the monthly pick and the competition
 * (they repost the winning photo, so they could otherwise win themselves).
 */
const ANNOUNCEMENTS_KEY = 'winners:announcements';
/**
 * Hash: award ID → pending image announcement (JSON). Reddit creates image
 * posts in the background, so the post ID isn't known straight away; the
 * post is found later by its title and the pinned comment added then.
 */
const PENDING_KEY = 'winners:announcements:pending';
/** Quick looks for the new image post right after submitting it. */
const QUICK_FIND_ATTEMPTS = 4;
const QUICK_FIND_DELAY_MS = 2500;
/** Newest posts searched for a pending announcement. */
const FIND_SCAN_LIMIT = 50;
/** A pending announcement that never shows up is given up after this. */
const PENDING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

type Pending = { title: string; body: string; submittedAt: string };

/** IDs of every announcement post the app has made. */
export const getAnnouncementPostIds = async (): Promise<Set<string>> =>
  new Set(Object.keys(await redis.hGetAll(ANNOUNCEMENTS_KEY)));

const isGif = (url: string): boolean => /\.gif(\?|$)/i.test(url);

/**
 * Reddit's answer for an image post it is still processing. The post IS
 * being created, so this must not be treated as a failure.
 */
const isStillProcessing = (error: unknown): boolean =>
  error instanceof Error && /created asynchronously/i.test(error.message);

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const register = (postId: string, awardId: string) =>
  redis.hSet(ANNOUNCEMENTS_KEY, { [postId]: awardId });

/** Adds the body as a comment pinned by the app (a failure is only logged). */
const pinComment = async (post: Post, body: string): Promise<void> => {
  try {
    const comment = await post.addComment({ text: body });
    await comment.distinguish(true);
  } catch (error) {
    console.error(`[announce] could not pin the comment on ${post.id}`, error);
  }
};

/** The app's own new post with this title, made at or after `since`. */
const findAppPost = async (
  title: string,
  since: Date
): Promise<Post | null> => {
  const [appUser, known] = await Promise.all([
    reddit.getAppUser(),
    getAnnouncementPostIds(),
  ]);
  if (!appUser) return null;
  const posts = await reddit
    .getNewPosts({
      subredditName: getSourceSubreddit(),
      limit: FIND_SCAN_LIMIT,
    })
    .all();
  // A minute of slack for clock differences between us and Reddit.
  const earliest = since.getTime() - 60_000;
  return (
    posts.find(
      (post) =>
        post.authorName === appUser.username &&
        post.title.trim() === title.trim() &&
        post.createdAt.getTime() >= earliest &&
        !known.has(post.id)
    ) ?? null
  );
};

/** Finds a processed image post, pins the body on it and records it. */
const completePending = async (
  awardId: string,
  pending: Pending
): Promise<Post | null> => {
  const post = await findAppPost(pending.title, new Date(pending.submittedAt));
  if (!post) return null;
  await register(post.id, awardId);
  await redis.hDel(PENDING_KEY, [awardId]);
  await pinComment(post, pending.body);
  console.log(`[announce] ${awardId} image post ready: ${post.id}`);
  return post;
};

const parsePending = (json: string): Pending | null => {
  try {
    const value: unknown = JSON.parse(json);
    if (
      typeof value === 'object' &&
      value !== null &&
      'title' in value &&
      typeof value.title === 'string' &&
      'body' in value &&
      typeof value.body === 'string' &&
      'submittedAt' in value &&
      typeof value.submittedAt === 'string'
    ) {
      return {
        title: value.title,
        body: value.body,
        submittedAt: value.submittedAt,
      };
    }
  } catch {
    // Corrupt entry; dropped below.
  }
  return null;
};

/**
 * Finishes image announcements Reddit was still processing: run by the
 * 15-minute job and the winner checks. Gives up (and logs) after a day.
 */
export const finishPendingAnnouncements = async (): Promise<void> => {
  const all = await redis.hGetAll(PENDING_KEY);
  for (const [awardId, json] of Object.entries(all)) {
    const pending = parsePending(json);
    const age = pending
      ? Date.now() - new Date(pending.submittedAt).getTime()
      : Infinity;
    try {
      if (pending && (await completePending(awardId, pending))) continue;
    } catch (error) {
      console.error(`[announce] ${awardId} lookup failed`, error);
      continue;
    }
    if (!(age < PENDING_MAX_AGE_MS)) {
      await redis.hDel(PENDING_KEY, [awardId]);
      console.error(`[announce] ${awardId} image post never appeared`);
    }
  }
};

/**
 * Image post of the winning photo (re-uploaded to Reddit, since image posts
 * need Reddit-hosted media) with the body as a pinned comment. Returns the
 * post, or null while Reddit is still processing it (finished later).
 */
const submitImageAnnouncement = async (
  awardId: string,
  title: string,
  body: string,
  imageUrl: string
): Promise<Post | null> => {
  const asset = await media.upload({
    url: imageUrl,
    type: isGif(imageUrl) ? 'gif' : 'image',
  });
  const submittedAt = new Date();
  let post: Post;
  try {
    post = await reddit.submitPost({
      subredditName: getSourceSubreddit(),
      title,
      kind: 'image',
      imageUrls: [asset.mediaUrl],
      sendreplies: false,
    });
  } catch (error) {
    if (!isStillProcessing(error)) throw error;
    return finishLater(awardId, title, body, submittedAt);
  }
  // The post exists now, so nothing after this may throw (the caller would
  // otherwise post a duplicate text announcement).
  await register(post.id, awardId).catch((error: unknown) =>
    console.error(`[announce] could not record ${post.id}`, error)
  );
  await pinComment(post, body);
  return post;
};

/**
 * Reddit is creating the image post in the background: remember it, then
 * look for it a few times now; the 15-minute job finishes it otherwise.
 * Never throws (the post already exists).
 */
const finishLater = async (
  awardId: string,
  title: string,
  body: string,
  submittedAt: Date
): Promise<Post | null> => {
  const pending: Pending = {
    title,
    body,
    submittedAt: submittedAt.toISOString(),
  };
  try {
    await redis.hSet(PENDING_KEY, { [awardId]: JSON.stringify(pending) });
    for (let attempt = 0; attempt < QUICK_FIND_ATTEMPTS; attempt++) {
      await wait(QUICK_FIND_DELAY_MS);
      const post = await completePending(awardId, pending);
      if (post) return post;
    }
  } catch (error) {
    console.error(`[announce] ${awardId} lookup failed; retried later`, error);
  }
  return null;
};

/** Fallback when the photo can't be uploaded: a text post with the body. */
const submitTextAnnouncement = (
  title: string,
  body: string,
  imageUrl: string
) =>
  reddit.submitPost({
    subredditName: getSourceSubreddit(),
    title,
    text: `${body}\n\n[Winning photo](${imageUrl})`,
    sendreplies: false,
  });

/**
 * Posts the winner announcement (when switched on). Runs once per award,
 * right after the award is saved; a failure is logged and never undoes the
 * award. Returns a short result for the check's log / toast.
 */
export const announceWinner = async (
  awardId: string,
  announcement: AnnouncementSettings,
  winner: WinnerEntry,
  values: Record<string, string>
): Promise<string> => {
  if (!announcement.enabled) return 'no announcement (off)';

  const filled = {
    ...values,
    user: `u/${winner.author}`,
    post: winner.postUrl,
    title: winner.title,
  };
  const title = fillAnnouncementTitle(announcement.title, filled);
  const body = fillAnnouncementBody(announcement.body, filled);

  try {
    const post = await submitImageAnnouncement(
      awardId,
      title,
      body,
      winner.imageUrl
    );
    if (post) {
      console.log(`[announce] ${awardId} announced in ${post.id}`);
      return `announced in ${post.id}`;
    }
    console.log(`[announce] ${awardId} image post still processing`);
    return 'announcement posting (comment pinned once Reddit finishes)';
  } catch (error) {
    // Upload or submit failed outright, so no image post exists: fall back
    // to a text post. (Reddit's "still processing" answer never gets here.)
    console.error(
      `[announce] ${awardId} image post failed, posting text`,
      error
    );
  }

  try {
    const post = await submitTextAnnouncement(title, body, winner.imageUrl);
    await register(post.id, awardId);
    console.log(`[announce] ${awardId} announced as text in ${post.id}`);
    return `announced as text in ${post.id}`;
  } catch (error) {
    console.error(`[announce] ${awardId} could not be announced`, error);
    return 'announcement failed (see logs)';
  }
};
