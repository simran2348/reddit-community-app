import type { RankingPeriod } from '../shared/api';

/** Short label for the ranking period, e.g. in the bottom navigation. */
export const PERIOD_LABEL: Record<RankingPeriod, string> = {
  week: 'This week',
  month: 'This month',
  year: 'This year',
};

