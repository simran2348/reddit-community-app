import { useCallback, useState } from 'react';
import type { RankingPeriod } from '../shared/api';
import { isRankingPeriod } from '../shared/api';

export type SlideshowSeconds = 3 | 5;

export const SLIDESHOW_OPTIONS: readonly SlideshowSeconds[] = [3, 5];

/** Per-viewer display preferences (never shared, never sent to the server). */
export type Preferences = {
  period: RankingPeriod;
  /** Time per image in the slideshow. */
  slideshowSeconds: SlideshowSeconds;
};

const STORAGE_KEY = 'leaderboard:preferences';

const DEFAULTS: Preferences = {
  period: 'week',
  slideshowSeconds: 5,
};

const isSlideshowSeconds = (value: unknown): value is SlideshowSeconds =>
  value === 3 || value === 5;

/** Validates each field so a stale or tampered value falls back safely. */
const parse = (raw: string | null): Preferences => {
  if (!raw) return DEFAULTS;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return DEFAULTS;
  }
  if (typeof data !== 'object' || data === null) return DEFAULTS;
  const period = 'period' in data ? data.period : undefined;
  // Older versions stored the interval as `autoplaySeconds`.
  const seconds =
    'slideshowSeconds' in data
      ? data.slideshowSeconds
      : 'autoplaySeconds' in data
        ? data.autoplaySeconds
        : undefined;
  return {
    period: isRankingPeriod(period) ? period : DEFAULTS.period,
    slideshowSeconds: isSlideshowSeconds(seconds)
      ? seconds
      : DEFAULTS.slideshowSeconds,
  };
};

/** Storage may be unavailable in webviews; everything still works in memory. */
const read = (): Preferences => {
  try {
    return parse(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULTS;
  }
};

const write = (prefs: Preferences): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore: the choice still applies for this session.
  }
};

export const usePreferences = () => {
  const [prefs, setPrefs] = useState<Preferences>(read);

  const update = useCallback((changes: Partial<Preferences>) => {
    setPrefs((current) => {
      const next = { ...current, ...changes };
      write(next);
      return next;
    });
  }, []);

  return { prefs, update };
};
