import type { RankingPeriod, RankingsResponse } from '../../shared/api';
import { requestJson } from './http';

/** In-memory cache so toggling the filter doesn't refetch within a session. */
const cache = new Map<RankingPeriod, Promise<RankingsResponse>>();

export const fetchRankings = (
  period: RankingPeriod
): Promise<RankingsResponse> => {
  const existing = cache.get(period);
  if (existing) return existing;

  const request = requestJson<RankingsResponse>(
    `/api/rankings?period=${period}`
  );
  cache.set(period, request);
  // Drop failed requests so a retry hits the network again.
  request.catch(() => cache.delete(period));
  return request;
};

export const clearRankingsCache = (period: RankingPeriod): void => {
  cache.delete(period);
};
