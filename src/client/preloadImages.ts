/**
 * Safety cap: if an image request hangs (it never loads or fails), the
 * screen still opens after this long instead of showing the loader forever.
 */
const MAX_WAIT_MS = 30_000;

/** Loads and decodes one image; failures resolve too (the card handles them). */
const preload = (url: string): Promise<void> =>
  new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      image.decode().then(resolve, resolve);
    };
    image.onerror = () => resolve();
    image.src = url;
  });

/**
 * Downloads and decodes the given images; resolves once all are ready (or
 * failed), or after MAX_WAIT_MS at most. The browser cache then serves the
 * carousel's <img> tags instantly, so cards never show a loading state.
 */
export const preloadImages = (urls: readonly string[]): Promise<void> => {
  const all = Promise.all([...new Set(urls)].map(preload)).then(
    () => undefined
  );
  const timeout = new Promise<void>((resolve) =>
    window.setTimeout(resolve, MAX_WAIT_MS)
  );
  return Promise.race([all, timeout]);
};

const isUrl = (url: string | null | undefined): url is string =>
  typeof url === 'string' && url.length > 0;

/**
 * Images to wait for before showing a carousel: all of them for short lists;
 * for long lists, the cards drawn on first view (front, two after it and two
 * before it, wrapping around). Later cards load as you swipe, a couple ahead.
 */
export const imagesToPreload = (
  urls: readonly (string | null)[],
  allUpTo: number
): string[] => {
  if (urls.length <= allUpTo) return urls.filter(isUrl);
  const at = (i: number) => urls[(i + urls.length) % urls.length];
  return [at(0), at(1), at(2), at(-1), at(-2)].filter(isUrl);
};
