import { useEffect, useRef, useState } from 'react';

/**
 * Keeps a loading indicator up for at least `minMs` once it appears: returns
 * true while `active` is true, and for the rest of the minimum time after it
 * turns false. Each new loading phase restarts the minimum.
 */
export const useMinimumDuration = (active: boolean, minMs: number): boolean => {
  const [holding, setHolding] = useState(active);
  const [wasActive, setWasActive] = useState(active);
  const timer = useRef<number | undefined>(undefined);

  // A new loading phase starts holding again (state adjusted during render,
  // React's pattern for state derived from a prop change).
  if (active !== wasActive) {
    setWasActive(active);
    if (active) setHolding(true);
  }

  useEffect(() => {
    if (!active) return;
    window.clearTimeout(timer.current);
    // Not cleared when `active` turns false: that's exactly the case where
    // the hold must continue until the minimum is reached.
    timer.current = window.setTimeout(() => setHolding(false), minMs);
  }, [active, minMs]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return active || holding;
};
