import type { RankingPeriod } from '../shared/api';

/** Short label for the ranking period, e.g. in the bottom navigation. */
export const PERIOD_LABEL: Record<RankingPeriod, string> = {
  week: 'This week',
  month: 'This month',
  year: 'This year',
};

/** Longer wording for messages such as empty states. */
export const PERIOD_TEXT: Record<RankingPeriod, string> = {
  week: 'the last 7 days',
  month: 'the last 30 days',
  year: 'the last 12 months',
};
