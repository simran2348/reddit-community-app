import { useCallback, useEffect, useState } from 'react';
import type { RankingPeriod, RankingsResponse } from '../../shared/api';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { TopImagesCarousel } from '../components/TopImagesCarousel';
import { PERIOD_TEXT } from '../periods';
import { clearRankingsCache, fetchRankings } from '../services/rankingService';

type Result =
  | { status: 'success'; data: RankingsResponse }
  | { status: 'error'; message: string };

type TopImagesScreenProps = {
  period: RankingPeriod;
  /** Auto-play interval in ms, or null when auto-play is off. */
  autoplayMs: number | null;
  /** Pause auto-play (settings open or this tab hidden). */
  paused: boolean;
};

export const TopImagesScreen = ({
  period,
  autoplayMs,
  paused,
}: TopImagesScreenProps) => {
  const [results, setResults] = useState<
    Partial<Record<RankingPeriod, Result>>
  >({});
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchRankings(period)
      .then((data) => {
        if (!cancelled) {
          setResults((prev) => ({
            ...prev,
            [period]: { status: 'success', data },
          }));
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message =
            error instanceof Error
              ? error.message
              : 'Could not load top images.';
          setResults((prev) => ({
            ...prev,
            [period]: { status: 'error', message },
          }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [period, attempt]);

  const retry = useCallback(() => {
    clearRankingsCache(period);
    setResults((prev) => {
      const next = { ...prev };
      delete next[period];
      return next;
    });
    setAttempt((n) => n + 1);
  }, [period]);

  const result = results[period];

  return (
    <section
      className="screen screen--images"
      id="panel-images"
      aria-label="Top posts"
    >
      <div className="screen__body">
        {!result && <LoadingState label="Loading top images" />}
        {result?.status === 'error' && (
          <ErrorState message={result.message} onRetry={retry} />
        )}
        {result?.status === 'success' && result.data.images.length === 0 && (
          <EmptyState
            icon="🖼️"
            title="No images yet"
            message={`No image posts in r/${result.data.subreddit} from ${PERIOD_TEXT[period]}.`}
          />
        )}
        {result?.status === 'success' && result.data.images.length > 0 && (
          <TopImagesCarousel
            key={period}
            images={result.data.images}
            autoplayMs={autoplayMs}
            paused={paused}
          />
        )}
      </div>
    </section>
  );
};
