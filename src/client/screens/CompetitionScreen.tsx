import { useCallback, useEffect, useState } from 'react';
import type { CompetitionResponse } from '../../shared/api';
import { CompetitionCarousel } from '../components/CompetitionCarousel';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  MIN_LOADING_MS,
} from '../components/States';
import { useMinimumDuration } from '../hooks/useMinimumDuration';
import { fetchCompetition } from '../services/competitionService';
import { ThemeInfo } from '../components/ThemeInfo';
import { imagesToPreload, preloadImages } from '../preloadImages';

/**
 * Up to this many entries, every image is downloaded before the screen opens.
 * Competitions can have hundreds of entries, so beyond this only the first
 * visible cards are waited for.
 */
const MAX_ENTRIES_TO_PRELOAD = 20;

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: CompetitionResponse };

type CompetitionScreenProps = {
  /** True while this tab is visible (closes the theme modal when not). */
  isActive: boolean;
  /** Time per image in the slideshow (the Settings interval). */
  slideshowMs: number;
};

export const CompetitionScreen = ({
  isActive,
  slideshowMs,
}: CompetitionScreenProps) => {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchCompetition()
      .then(async (data) => {
        // Keep the camera loader up until the entry images are ready (all of
        // them for up to 20 entries; otherwise the ones shown first).
        await preloadImages(
          imagesToPreload(
            data.entries.map((entry) => entry.imageUrl),
            MAX_ENTRIES_TO_PRELOAD
          )
        );
        if (cancelled) return;
        setState({ status: 'success', data });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status: 'error',
          message:
            error instanceof Error ? error.message : 'Could not load entries.',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  const data = state.status === 'success' ? state.data : null;

  // The loader stays for at least 5s, longer if the request is slower.
  const showLoader = useMinimumDuration(
    state.status === 'loading',
    MIN_LOADING_MS
  );

  return (
    <section
      className="screen screen--competition"
      id="panel-competition"
      aria-label="Photo competition"
    >
      <div className="screen__body">
        {showLoader && <LoadingState label="Loading entries" />}
        {!showLoader && state.status === 'error' && (
          <ErrorState message={state.message} onRetry={retry} />
        )}
        {!showLoader && data && data.entries.length === 0 && (
          <EmptyState icon="📸" title="No entries yet" />
        )}
        {!showLoader && data && data.entries.length > 0 && (
          <CompetitionCarousel
            entries={data.entries}
            slideshowMs={slideshowMs}
          />
        )}
        {!showLoader && data && (
          <ThemeInfo theme={data.theme} active={isActive} />
        )}
      </div>
    </section>
  );
};
