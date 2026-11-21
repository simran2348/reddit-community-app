import { useCallback, useEffect, useRef, useState } from 'react';
import type { SlideshowSeconds, UserPreferences } from '../shared/api';
import { isRankingPeriod, isSlideshowSeconds } from '../shared/api';
import {
  fetchPreferences,
  savePreferences,
} from './services/preferencesService';

export const SLIDESHOW_OPTIONS: readonly SlideshowSeconds[] = [3, 5];

/**
 * Per-viewer Settings choices. Kept in this browser's storage for an
 * instant start, and saved to the viewer's Reddit account (server, Redis)
 * when logged in, so they follow them to other devices.
 */
export type Preferences = UserPreferences;

const STORAGE_KEY = 'leaderboard:preferences';

const DEFAULTS: Preferences = {
  period: 'week',
  slideshowSeconds: 5,
};

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
  const current = useRef(prefs);
  // Set once the viewer changes something here, so a slower server load
  // never overwrites a choice they just made.
  const changedLocally = useRef(false);

  // Account copy wins over this device's copy (logged-in viewers only).
  useEffect(() => {
    let cancelled = false;
    fetchPreferences()
      .then(({ preferences }) => {
        if (cancelled || !preferences || changedLocally.current) return;
        current.current = preferences;
        write(preferences);
        setPrefs(preferences);
      })
      .catch((error: unknown) => {
        console.warn('Failed to load saved settings', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback((changes: Partial<Preferences>) => {
    changedLocally.current = true;
    const next = { ...current.current, ...changes };
    current.current = next;
    setPrefs(next);
    write(next);
    // Logged-out viewers just get a null back; failures keep the local copy.
    savePreferences(next).catch((error: unknown) => {
      console.warn('Failed to save settings', error);
    });
  }, []);

  return { prefs, update };
};
