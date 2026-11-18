import { memo, useCallback, useId, useRef, useState } from 'react';
import type { RankingPeriod } from '../../shared/api';
import { useDismiss } from '../hooks/useDismiss';

type TimeFilterProps = {
  value: RankingPeriod;
  onChange: (period: RankingPeriod) => void;
};

const OPTIONS: readonly { value: RankingPeriod; label: string }[] = [
  { value: 'week', label: 'this week' },
  { value: 'month', label: 'this month' },
];

const labelFor = (period: RankingPeriod): string =>
  OPTIONS.find((option) => option.value === period)?.label ?? period;

/**
 * Sentence-style filter: "Top posts <this week>". The period is underlined
 * with an orange dotted line and opens a small menu to switch period.
 */
export const TimeFilter = memo(({ value, onChange }: TimeFilterProps) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback(() => setOpen(false), []);
  useDismiss(rootRef, open, close);

  const select = (period: RankingPeriod) => {
    setOpen(false);
    if (period !== value) onChange(period);
  };

  return (
    <div className="period" ref={rootRef}>
      <h2 className="period__label">
        Top posts{' '}
        <button
          type="button"
          className={`period__trigger${open ? ' is-open' : ''}`}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((current) => !current)}
        >
          {labelFor(value)}
          <svg
            className="period__chevron"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </h2>

      <div
        id={menuId}
        className={`period__menu${open ? ' is-open' : ''}`}
        role="menu"
        aria-label="Ranking period"
        aria-hidden={!open}
        inert={!open}
      >
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="menuitemradio"
            aria-checked={value === option.value}
            className={`period__option${value === option.value ? ' is-active' : ''}`}
            onClick={() => select(option.value)}
          >
            Top posts {option.label}
          </button>
        ))}
      </div>
    </div>
  );
});
TimeFilter.displayName = 'TimeFilter';
