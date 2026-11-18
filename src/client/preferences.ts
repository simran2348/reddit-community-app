import { useCallback, useState } from 'react';

/**
 * How post details are shown on Top Images cards:
 * - `overlay`: avatar, title, upvotes and comments sit on top of the image.
 * - `reveal`: details are tucked under the image; swipe the image up to see.
 */
export type ImageLayout = 'overlay' | 'reveal';

const STORAGE_KEY = 'leaderboard:image-layout';
const DEFAULT_LAYOUT: ImageLayout = 'overlay';

const isImageLayout = (value: unknown): value is ImageLayout =>
  value === 'overlay' || value === 'reveal';

/** Per-viewer convenience only; storage may be unavailable in webviews. */
const readLayout = (): ImageLayout => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isImageLayout(stored) ? stored : DEFAULT_LAYOUT;
  } catch {
    return DEFAULT_LAYOUT;
  }
};

const writeLayout = (layout: ImageLayout): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, layout);
  } catch {
    // Ignore: the choice still applies for this session.
  }
};

export const useImageLayout = () => {
  const [layout, setLayoutState] = useState<ImageLayout>(readLayout);
  const setLayout = useCallback((next: ImageLayout) => {
    setLayoutState(next);
    writeLayout(next);
  }, []);
  return { layout, setLayout };
};
