import { useCallback, useState } from 'react';
import type { RankingPeriod } from '../shared/api';
import { isRankingPeriod } from '../shared/api';

export type AutoplaySeconds = 3 | 5;

export const AUTOPLAY_OPTIONS: readonly AutoplaySeconds[] = [3, 5];

/** Per-viewer display preferences (never shared, never sent to the server). */
export type Preferences = {
  period: RankingPeriod;
  autoplay: boolean;
  autoplaySeconds: AutoplaySeconds;
};

const STORAGE_KEY = 'leaderboard:preferences';

const DEFAULTS: Preferences = {
  period: 'week',
  autoplay: false,
  autoplaySeconds: 5,
};

const isAutoplaySeconds = (value: unknown): value is AutoplaySeconds =>
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
  const autoplay = 'autoplay' in data ? data.autoplay : undefined;
  const seconds = 'autoplaySeconds' in data ? data.autoplaySeconds : undefined;
  return {
    period: isRankingPeriod(period) ? period : DEFAULTS.period,
    autoplay: typeof autoplay === 'boolean' ? autoplay : DEFAULTS.autoplay,
    autoplaySeconds: isAutoplaySeconds(seconds)
      ? seconds
      : DEFAULTS.autoplaySeconds,
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
