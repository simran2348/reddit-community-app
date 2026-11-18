import { useCallback, useEffect, useState } from 'react';
import type { RankingPeriod, RankingsResponse } from '../../shared/api';
import { SettingsButton } from '../components/SettingsButton';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { TimeFilter } from '../components/TimeFilter';
import { TopImagesCarousel } from '../components/TopImagesCarousel';
import type { ImageLayout } from '../preferences';
import { clearRankingsCache, fetchRankings } from '../services/rankingService';

type Result =
  | { status: 'success'; data: RankingsResponse }
  | { status: 'error'; message: string };

const PERIOD_TEXT: Record<RankingPeriod, string> = {
  week: 'the last 7 days',
  month: 'the last 30 days',
};

type TopImagesScreenProps = {
  layout: ImageLayout;
  onOpenSettings: () => void;
};

export const TopImagesScreen = ({
  layout,
  onOpenSettings,
}: TopImagesScreenProps) => {
  const [period, setPeriod] = useState<RankingPeriod>('week');
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
      role="tabpanel"
      aria-labelledby="tab-images"
    >
      <div className="screen__toolbar">
        <TimeFilter value={period} onChange={setPeriod} />
        <SettingsButton onClick={onOpenSettings} />
      </div>

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
            layout={layout}
          />
        )}
      </div>
    </section>
  );
};
