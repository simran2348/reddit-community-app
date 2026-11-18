import type { Post } from '@devvit/web/server';

export type PostImage = {
  url: string;
  width: number | null;
  height: number | null;
};

/** Reddit preview URLs come HTML-escaped (`&amp;`), which breaks signed URLs. */
const unescapeUrl = (url: string): string => url.replace(/&amp;/g, '&');

const isHttpsUrl = (url: string): boolean => url.startsWith('https://');

/**
 * Gallery status is a proto enum that may arrive as its numeric value or its
 * string name depending on the transport, so check both forms.
 */
const isFailedMedia = (status: unknown): boolean => {
  const value = String(status);
  return value === '2' || value === 'GALLERY_MEDIA_STATUS_FAILED';
};

const IMAGE_EXTENSION =/\.(jpe?g|png|gif|webp)(\?.*)?$/i;

/**
 * Picks the best displayable image for a post: the first valid gallery/preview
 * media, then a direct image link, then the thumbnail. Returns null for posts
 * without an image so they can be excluded from photo competitions.
 */
export const getPostImage = (post: Post): PostImage | null => {
  const media = post.gallery.find(
    (item) => !isFailedMedia(item.status) && isHttpsUrl(unescapeUrl(item.url))
  );
  if (media) {
    return {
      url: unescapeUrl(media.url),
      width: media.width > 0 ? media.width : null,
      height: media.height > 0 ? media.height : null,
    };
  }

  const directUrl = unescapeUrl(post.url);
  if (isHttpsUrl(directUrl) && IMAGE_EXTENSION.test(directUrl)) {
    return { url: directUrl, width: null, height: null };
  }

  const thumbnail = post.thumbnail;
  if (thumbnail && isHttpsUrl(unescapeUrl(thumbnail.url))) {
    return {
      url: unescapeUrl(thumbnail.url),
      width: thumbnail.width > 0 ? thumbnail.width : null,
      height: thumbnail.height > 0 ? thumbnail.height : null,
    };
  }

  return null;
};

/** Posts that should never be surfaced in the dashboard. */
export const isHiddenPost = (post: Post): boolean =>
  post.removed || post.spam || post.nsfw || post.quarantined || post.hidden;

export const toPostUrl = (post: Post): string =>
  `https://www.reddit.com${post.permalink}`;
