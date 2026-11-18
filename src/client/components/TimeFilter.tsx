import { memo } from 'react';
import type { RankingPeriod } from '../../shared/api';

type TimeFilterProps = {
  value: RankingPeriod;
  onChange: (period: RankingPeriod) => void;
};

const OPTIONS: readonly { value: RankingPeriod; label: string }[] = [
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
];

export const TimeFilter = memo(({ value, onChange }: TimeFilterProps) => (
  <div className="segmented" role="radiogroup" aria-label="Ranking period">
    {OPTIONS.map((option) => (
      <button
        key={option.value}
        type="button"
        role="radio"
        aria-checked={value === option.value}
        className={`segmented__option${value === option.value ? ' is-active' : ''}`}
        onClick={() => onChange(option.value)}
      >
        {option.label}
      </button>
    ))}
  </div>
));
TimeFilter.displayName = 'TimeFilter';
