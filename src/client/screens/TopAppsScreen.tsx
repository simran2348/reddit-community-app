import { useCallback, useEffect, useState } from 'react';
import type { RankingPeriod, RankingsResponse } from '../../shared/api';
import { AppRankingCarousel } from '../components/AppRankingCarousel';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { TimeFilter } from '../components/TimeFilter';
import { clearRankingsCache, fetchRankings } from '../services/rankingService';

type Result =
  | { status: 'success'; data: RankingsResponse }
  | { status: 'error'; message: string };

const PERIOD_TEXT: Record<RankingPeriod, string> = {
  week: 'the last 7 days',
  month: 'the last 30 days',
};

const describeRanking = (data: RankingsResponse): string => {
  const scope = data.flair ? `"${data.flair}" posts` : 'posts';
  return `Ranked by upvotes on ${scope} from ${PERIOD_TEXT[data.period]}. Updates every 10 min.`;
};

export const TopAppsScreen = () => {
  const [period, setPeriod] = useState<RankingPeriod>('week');
  const [results, setResults] = useState<Partial<Record<RankingPeriod, Result>>>(
    {}
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchRankings(period)
      .then((data) => {
        if (!cancelled) {
          setResults((prev) => ({ ...prev, [period]: { status: 'success', data } }));
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : 'Could not load rankings.';
          setResults((prev) => ({ ...prev, [period]: { status: 'error', message } }));
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
      className="screen screen--apps"
      id="panel-apps"
      role="tabpanel"
      aria-labelledby="tab-apps"
    >
      <div className="screen__toolbar">
        <TimeFilter value={period} onChange={setPeriod} />
      </div>

      <div className="screen__body">
        {!result && <LoadingState label="Loading rankings" />}
        {result?.status === 'error' && (
          <ErrorState message={result.message} onRetry={retry} />
        )}
        {result?.status === 'success' && result.data.apps.length === 0 && (
          <EmptyState
            icon="🏆"
            title="No apps ranked yet"
            message={`No ${result.data.flair ? `"${result.data.flair}" ` : ''}posts from ${PERIOD_TEXT[period]}.`}
          />
        )}
        {result?.status === 'success' && result.data.apps.length > 0 && (
          <AppRankingCarousel
            key={period}
            apps={result.data.apps}
            info={describeRanking(result.data)}
          />
        )}
      </div>
    </section>
  );
};
